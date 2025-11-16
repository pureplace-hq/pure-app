<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { authStore } from '$lib/auth/store';
	import { getProvider, generateCodeVerifier, generateState } from '$lib/providers';

	let isLoggedIn = false;
	let userInfo: any = null;
	let loading = true;

	onMount(async () => {
		// Load auth state from sessionStorage
		authStore.loadFromStorage();

		// Check if user has an access token
		const accessToken = sessionStorage.getItem('gitlab_access_token');

		if (accessToken) {
			try {
				const provider = getProvider('gitlab');
				// Fetch user info to verify token is still valid
				userInfo = await provider.getUser(accessToken);
				isLoggedIn = true;
			} catch (err) {
				console.error('Failed to fetch user info:', err);
				// Token is invalid, clear it
				authStore.logout();
			}
		}

		loading = false;
	});

	async function loginWithProvider(providerName: 'gitlab' | 'github') {
		const provider = getProvider(providerName);

		// Generate state for CSRF protection
		const state = generateState();

		// Generate PKCE code verifier and challenge
		const codeVerifier = generateCodeVerifier();

		// Store state and code verifier for callback validation
		sessionStorage.setItem('oauth_state', state);
		sessionStorage.setItem('code_verifier', codeVerifier);

		// Create authorization URL (await because GitHub provider is async)
		const url = await provider.createAuthUrl(state, codeVerifier);

		// Redirect to provider
		window.location.href = url.toString();
	}

	function loginWithGitLab() {
		loginWithProvider('gitlab');
	}

	function loginWithGitHub() {
		loginWithProvider('github');
	}

	function logout() {
		authStore.logout();
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
		<div class="login-buttons">
			<button onclick={loginWithGitLab} class="btn-gitlab">Login with GitLab</button>
			<!-- GitHub button hidden - requires backend proxy for CORS -->
			<!-- <button onclick={loginWithGitHub} class="btn-github">Login with GitHub</button> -->
		</div>
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

	.login-buttons {
		display: flex;
		gap: 1rem;
		justify-content: center;
		flex-wrap: wrap;
	}

	.btn-gitlab {
		background-color: #fc6d26;
	}

	.btn-gitlab:hover {
		background-color: #e24329;
	}

	.btn-github {
		background-color: #24292e;
	}

	.btn-github:hover {
		background-color: #1b1f23;
	}
</style>
