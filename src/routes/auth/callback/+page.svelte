<script lang="ts">
	import { onMount } from 'svelte';
	import { GitLab } from 'arctic';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';

	// GitLab OAuth Configuration from environment variables
	const GITLAB_CLIENT_ID = import.meta.env.VITE_GITLAB_CLIENT_ID;
	const GITLAB_URL = import.meta.env.VITE_GITLAB_URL;
	const REDIRECT_URI = import.meta.env.VITE_REDIRECT_URI;

	// Initialize Arctic GitLab client
	const gitlab = new GitLab(GITLAB_URL, GITLAB_CLIENT_ID, null, REDIRECT_URI);

	let status = 'Processing...';
	let error = '';
	let errorDetails = '';
	let debugInfo: any[] = [];
	let userInfo: any = null;

	function logout() {
		// Clear all stored tokens and user info
		sessionStorage.removeItem('gitlab_access_token');
		sessionStorage.removeItem('gitlab_refresh_token');
		sessionStorage.removeItem('oauth_state');
		sessionStorage.removeItem('code_verifier');
		sessionStorage.removeItem('selected_repo');

		// Navigate to home page
		goto(`${base}/`);
	}

	onMount(async () => {
		try {
			debugInfo.push({ step: 'Starting auth callback', time: new Date().toISOString() });

			// Get URL parameters
			const params = new URLSearchParams(window.location.search);
			const code = params.get('code');
			const state = params.get('state');

			debugInfo.push({
				step: 'URL params',
				hasCode: !!code,
				hasState: !!state,
				codeLength: code?.length
			});

			if (!code || !state) {
				throw new Error('Missing code or state parameter');
			}

			// Validate state (CSRF protection)
			const storedState = sessionStorage.getItem('oauth_state');
			debugInfo.push({
				step: 'State validation',
				hasStoredState: !!storedState,
				statesMatch: state === storedState
			});

			if (!storedState || state !== storedState) {
				throw new Error('Invalid state parameter - possible CSRF attack');
			}

			// Get stored code verifier
			const codeVerifier = sessionStorage.getItem('code_verifier');
			debugInfo.push({
				step: 'Code verifier',
				hasCodeVerifier: !!codeVerifier,
				verifierLength: codeVerifier?.length
			});

			if (!codeVerifier) {
				throw new Error('Missing code verifier');
			}

			status = 'Exchanging code for access token...';
			debugInfo.push({
				step: 'Token exchange starting',
				endpoint: (gitlab as any).tokenEndpoint,
				redirectUri: REDIRECT_URI
			});

			// Exchange authorization code for tokens using PKCE
			let tokens;
			try {
				tokens = await (gitlab as any).client.validateAuthorizationCode(
					(gitlab as any).tokenEndpoint,
					code,
					codeVerifier
				);
				debugInfo.push({ step: 'Token exchange successful' });
			} catch (tokenError: any) {
				debugInfo.push({
					step: 'Token exchange failed',
					errorType: tokenError?.constructor?.name,
					errorMessage: tokenError?.message,
					errorStack: tokenError?.stack,
					errorDetails: JSON.stringify(tokenError, null, 2)
				});
				throw new Error(`Token exchange failed: ${tokenError?.message || 'Unknown error'}`);
			}

			status = 'Fetching user info...';

			// Fetch user info from GitLab API
			const userResponse = await fetch(`${GITLAB_URL}/api/v4/user`, {
				headers: {
					Authorization: `Bearer ${tokens.accessToken()}`
				}
			});

			if (!userResponse.ok) {
				throw new Error('Failed to fetch user info');
			}

			userInfo = await userResponse.json();

			// Store the access token securely
			sessionStorage.setItem('gitlab_access_token', tokens.accessToken());

			// Store refresh token if available
			const refreshToken = tokens.refreshToken();
			if (refreshToken) {
				sessionStorage.setItem('gitlab_refresh_token', refreshToken);
			}

			// Debug: Check token scopes
			console.log('=== TOKEN DEBUG ===');
			console.log('Access Token:', tokens.accessToken());

			// Try to decode token if it's a JWT
			const token = tokens.accessToken();
			const parts = token.split('.');
			if (parts.length === 3) {
				try {
					const payload = JSON.parse(atob(parts[1]));
					console.log('Token payload:', payload);
					console.log('Scopes in token:', payload.scope);
				} catch (e) {
					console.log('Token is not a JWT or could not be decoded');
				}
			}

			// Check token info from GitLab
			try {
				const tokenInfoResponse = await fetch(`${GITLAB_URL}/oauth/token/info`, {
					headers: {
						Authorization: `Bearer ${token}`
					}
				});
				if (tokenInfoResponse.ok) {
					const tokenInfo = await tokenInfoResponse.json();
					console.log('Token info from GitLab:', tokenInfo);
					console.log('Actual scopes:', tokenInfo.scope);
				}
			} catch (e) {
				console.log('Could not fetch token info:', e);
			}

			// Clean up OAuth state
			sessionStorage.removeItem('oauth_state');
			sessionStorage.removeItem('code_verifier');

			status = `Success! Logged in as ${userInfo.username}. Redirecting...`;

			// Redirect to repos page after 2 seconds
			setTimeout(() => {
				goto(`${base}/repos`);
			}, 2000);
		} catch (err: any) {
			error = err instanceof Error ? err.message : 'An unknown error occurred';
			errorDetails = JSON.stringify({
				message: err?.message,
				name: err?.name,
				stack: err?.stack,
				cause: err?.cause,
				fullError: err
			}, null, 2);
			status = 'Error during authentication';
			debugInfo.push({
				step: 'Final error caught',
				error: err?.message,
				type: err?.constructor?.name
			});
		}
	});
</script>

<div class="container">
	<div class="header">
		<h1>GitLab OAuth Callback</h1>
		<button class="logout-btn" onclick={logout}>Logout</button>
	</div>

	<div class="status">
		<p class:error={!!error}>{status}</p>
		{#if error}
			<p class="error-message">{error}</p>
			{#if errorDetails}
				<details class="error-details">
					<summary>Error Details (click to expand)</summary>
					<pre>{errorDetails}</pre>
				</details>
			{/if}
			<a href="{base}/">Go back home</a>
		{/if}
	</div>

	{#if debugInfo.length > 0}
		<details class="debug-info">
			<summary>Debug Info (click to expand)</summary>
			<div class="debug-steps">
				{#each debugInfo as info, i}
					<div class="debug-step">
						<strong>Step {i + 1}:</strong>
						<pre>{JSON.stringify(info, null, 2)}</pre>
					</div>
				{/each}
			</div>
		</details>
	{/if}

	{#if userInfo}
		<div class="user-info">
			<h2>Welcome, {userInfo.name}!</h2>
			{#if userInfo.avatar_url}
				<img src={userInfo.avatar_url} alt="Avatar" />
			{/if}
			<p>Username: {userInfo.username}</p>
			<p>Email: {userInfo.email || 'Not available'}</p>
			<p class="redirect-message">Redirecting to your repositories...</p>
		</div>
	{/if}
</div>

<style>
	.container {
		max-width: 600px;
		margin: 2rem auto;
		padding: 2rem;
		text-align: center;
	}

	.header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 2rem;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.header h1 {
		margin: 0;
		flex: 1;
		text-align: left;
	}

	.logout-btn {
		padding: 0.75rem 1.5rem;
		background-color: #6c757d;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-weight: 600;
		font-size: 0.95rem;
		transition: background-color 0.2s;
	}

	.logout-btn:hover {
		background-color: #5a6268;
	}

	.status {
		margin: 2rem 0;
		padding: 1rem;
		background-color: #f5f5f5;
		border-radius: 4px;
	}

	.error {
		color: #d32f2f;
	}

	.error-message {
		color: #d32f2f;
		font-weight: 600;
		margin-top: 1rem;
	}

	.user-info {
		margin-top: 2rem;
		padding: 1.5rem;
		background-color: #e8f5e9;
		border-radius: 4px;
	}

	.user-info img {
		width: 80px;
		height: 80px;
		border-radius: 50%;
		margin: 1rem 0;
	}

	.redirect-message {
		margin-top: 1rem;
		font-style: italic;
		color: #666;
	}

	a {
		display: inline-block;
		margin-top: 1rem;
		padding: 0.5rem 1rem;
		background-color: #fc6d26;
		color: white;
		text-decoration: none;
		border-radius: 4px;
	}

	a:hover {
		background-color: #e24329;
	}

	.error-details,
	.debug-info {
		margin-top: 1rem;
		padding: 1rem;
		background-color: #fff;
		border: 1px solid #ddd;
		border-radius: 4px;
		text-align: left;
	}

	.error-details summary,
	.debug-info summary {
		cursor: pointer;
		font-weight: 600;
		color: #fc6d26;
		margin-bottom: 0.5rem;
	}

	.error-details pre,
	.debug-step pre {
		background-color: #f5f5f5;
		padding: 0.75rem;
		border-radius: 4px;
		overflow-x: auto;
		font-size: 0.85rem;
		white-space: pre-wrap;
		word-wrap: break-word;
	}

	.debug-steps {
		margin-top: 0.5rem;
	}

	.debug-step {
		margin-bottom: 1rem;
		padding-bottom: 1rem;
		border-bottom: 1px solid #eee;
	}

	.debug-step:last-child {
		border-bottom: none;
	}
</style>
