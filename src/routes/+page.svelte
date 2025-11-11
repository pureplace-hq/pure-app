<script lang="ts">
	import { onMount } from 'svelte';
	import { GitLab, generateCodeVerifier, generateState } from 'arctic';
	import { base } from '$app/paths';

	// GitLab OAuth Configuration from environment variables
	const GITLAB_CLIENT_ID = import.meta.env.VITE_GITLAB_CLIENT_ID;
	const GITLAB_URL = import.meta.env.VITE_GITLAB_URL;
	const REDIRECT_URI = import.meta.env.VITE_REDIRECT_URI;

	// Initialize Arctic GitLab client
	const gitlab = new GitLab(GITLAB_URL, GITLAB_CLIENT_ID, null, REDIRECT_URI);

	let isLoggedIn = false;
	let userInfo: any = null;
	let loading = true;

	onMount(async () => {
		// Check if user has an access token
		const accessToken = sessionStorage.getItem('gitlab_access_token');

		if (accessToken) {
			try {
				// Fetch user info to verify token is still valid
				const response = await fetch(`${GITLAB_URL}/api/v4/user`, {
					headers: {
						Authorization: `Bearer ${accessToken}`
					}
				});

				if (response.ok) {
					userInfo = await response.json();
					isLoggedIn = true;
				} else {
					// Token is invalid, clear it
					sessionStorage.removeItem('gitlab_access_token');
					sessionStorage.removeItem('gitlab_refresh_token');
				}
			} catch (err) {
				console.error('Failed to fetch user info:', err);
			}
		}

		loading = false;
	});

	async function loginWithGitLab() {
		// Generate state for CSRF protection
		const state = generateState();

		// Generate PKCE code verifier and challenge
		const codeVerifier = generateCodeVerifier();

		// Store state and code verifier for callback validation
		sessionStorage.setItem('oauth_state', state);
		sessionStorage.setItem('code_verifier', codeVerifier);

		// Create authorization URL with PKCE using the OAuth2Client
		const url = (gitlab as any).client.createAuthorizationURLWithPKCE(
			(gitlab as any).authorizationEndpoint,
			state,
			0, // CodeChallengeMethod.S256
			codeVerifier,
			['api']  // Full API access (includes read and write)
		);

		// Redirect to GitLab
		window.location.href = url.toString();
	}

	function logout() {
		// Clear all stored tokens and user info
		sessionStorage.removeItem('gitlab_access_token');
		sessionStorage.removeItem('gitlab_refresh_token');
		sessionStorage.removeItem('oauth_state');
		sessionStorage.removeItem('code_verifier');

		isLoggedIn = false;
		userInfo = null;
	}
</script>

<div class="container">
	<h1>Welcome to SvelteKit + GitLab OAuth</h1>
	<p>Frontend-only OAuth flow using PKCE</p>

	{#if loading}
		<p>Loading...</p>
	{:else if isLoggedIn && userInfo}
		<div class="user-card">
			<h2>Logged in as {userInfo.name}</h2>
			{#if userInfo.avatar_url}
				<img src={userInfo.avatar_url} alt="Avatar" />
			{/if}
			<div class="user-details">
				<p><strong>Username:</strong> {userInfo.username}</p>
				<p><strong>Email:</strong> {userInfo.email || 'Not available'}</p>
				{#if userInfo.web_url}
					<p><strong>Profile:</strong> <a href={userInfo.web_url} target="_blank">{userInfo.web_url}</a></p>
				{/if}
			</div>
			<div class="actions">
				<a href="{base}/repos" class="btn-repos">View Repositories</a>
				<button class="logout" onclick={logout}>Logout</button>
			</div>
		</div>
	{:else}
		<button onclick={loginWithGitLab}>Login with GitLab</button>
	{/if}
</div>

<style>
	.container {
		max-width: 800px;
		margin: 2rem auto;
		padding: 2rem;
		text-align: center;
	}

	h1 {
		color: #333;
		margin-bottom: 0.5rem;
	}

	.user-card {
		margin-top: 2rem;
		padding: 2rem;
		background-color: #f8f9fa;
		border-radius: 8px;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.user-card img {
		width: 100px;
		height: 100px;
		border-radius: 50%;
		margin: 1rem 0;
		border: 3px solid #fc6d26;
	}

	.user-details {
		margin: 1.5rem 0;
		text-align: left;
		display: inline-block;
	}

	.user-details p {
		margin: 0.5rem 0;
	}

	.user-details a {
		color: #fc6d26;
		text-decoration: none;
	}

	.user-details a:hover {
		text-decoration: underline;
	}

	.actions {
		display: flex;
		gap: 1rem;
		margin-top: 2rem;
		justify-content: center;
		flex-wrap: wrap;
	}

	.btn-repos {
		padding: 0.75rem 1.5rem;
		font-size: 1rem;
		background-color: #fc6d26;
		color: white;
		text-decoration: none;
		border-radius: 4px;
		font-weight: 600;
		transition: background-color 0.2s;
		display: inline-block;
	}

	.btn-repos:hover {
		background-color: #e24329;
	}

	button {
		margin-top: 0;
		padding: 0.75rem 1.5rem;
		font-size: 1rem;
		background-color: #fc6d26;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-weight: 600;
		transition: background-color 0.2s;
	}

	button:hover {
		background-color: #e24329;
	}

	button.logout {
		background-color: #6c757d;
	}

	button.logout:hover {
		background-color: #5a6268;
	}
</style>
