<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';

	let selectedRepo: any = null;
	let loading = true;

	onMount(() => {
		// Get selected repo from sessionStorage
		const repoData = sessionStorage.getItem('selected_repo');

		if (!repoData) {
			// No repo selected, redirect to repos page
			goto(`${base}/repos`);
			return;
		}

		selectedRepo = JSON.parse(repoData);
		loading = false;
	});

	function goToNewPost() {
		goto(`${base}/new-post`);
	}

	function backToRepos() {
		goto(`${base}/repos`);
	}

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
</script>

<div class="container">
	<div class="header">
		<h1>Dashboard</h1>
		<button class="logout-btn" onclick={logout}>Logout</button>
	</div>

	{#if loading}
		<p>Loading...</p>
	{:else if selectedRepo}
		<div class="repo-info">
			<h2>Repository: {selectedRepo.name}</h2>
			<p>Path: {selectedRepo.path_with_namespace}</p>
		</div>

		<div class="actions">
			<button class="new-post-btn" onclick={goToNewPost}>New Post</button>
			<button class="back-btn" onclick={backToRepos}>Back to Repositories</button>
		</div>
	{/if}
</div>

<style>
	.container {
		max-width: 800px;
		margin: 2rem auto;
		padding: 2rem;
	}

	.header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 2rem;
		gap: 1rem;
		flex-wrap: wrap;
	}

	h1 {
		margin: 0;
		flex: 1;
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

	.repo-info {
		background-color: #f8f9fa;
		padding: 1.5rem;
		border-radius: 4px;
		margin-bottom: 2rem;
	}

	.repo-info h2 {
		margin: 0 0 0.5rem 0;
	}

	.repo-info p {
		margin: 0;
		color: #666;
	}

	.actions {
		display: flex;
		gap: 1rem;
		flex-direction: column;
	}

	button {
		padding: 1rem;
		font-size: 1rem;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-weight: 600;
	}

	.new-post-btn {
		background-color: #fc6d26;
		color: white;
	}

	.new-post-btn:hover {
		background-color: #e24329;
	}

	.back-btn {
		background-color: #6c757d;
		color: white;
	}

	.back-btn:hover {
		background-color: #5a6268;
	}
</style>
