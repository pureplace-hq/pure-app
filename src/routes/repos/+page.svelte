<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';

	const GITLAB_URL = import.meta.env.VITE_GITLAB_URL;

	let accessToken: string | null = null;
	let loading = true;
	let repositories: any[] = [];
	let selectedRepoId: string = '';
	let selectedRepo: any = null;
	let fileTree: any[] = [];
	let loadingFiles = false;

	onMount(async () => {
		// Get access token from sessionStorage
		accessToken = sessionStorage.getItem('gitlab_access_token');

		if (!accessToken) {
			// No token, redirect to login
			goto(`${base}/`);
			return;
		}

		try {
			// Fetch user's repositories
			const response = await fetch(`${GITLAB_URL}/api/v4/projects?membership=true&per_page=100&order_by=last_activity_at`, {
				headers: {
					Authorization: `Bearer ${accessToken}`
				}
			});

			if (!response.ok) {
				throw new Error('Failed to fetch repositories');
			}

			repositories = await response.json();
			loading = false;
		} catch (err) {
			console.error('Error fetching repos:', err);
			loading = false;
		}
	});

	async function handleRepoSelect() {
		if (!selectedRepoId || !accessToken) return;

		selectedRepo = repositories.find(r => r.id.toString() === selectedRepoId.toString());
		loadingFiles = true;
		fileTree = [];

		try {
			// Fetch repository file tree
			const response = await fetch(
				`${GITLAB_URL}/api/v4/projects/${selectedRepoId}/repository/tree?recursive=false&per_page=100`,
				{
					headers: {
						Authorization: `Bearer ${accessToken}`
					}
				}
			);

			if (!response.ok) {
				throw new Error('Failed to fetch file tree');
			}

			fileTree = await response.json();
		} catch (err) {
			console.error('Error fetching file tree:', err);
		} finally {
			loadingFiles = false;
		}
	}

	function getFileIcon(type: string, name: string) {
		if (type === 'tree') return '📁';

		// Simple file type detection by extension
		const ext = name.split('.').pop()?.toLowerCase();
		switch (ext) {
			case 'js':
			case 'ts':
			case 'jsx':
			case 'tsx':
				return '📜';
			case 'json':
				return '📋';
			case 'md':
				return '📝';
			case 'css':
			case 'scss':
				return '🎨';
			case 'html':
				return '🌐';
			case 'png':
			case 'jpg':
			case 'jpeg':
			case 'gif':
			case 'svg':
				return '🖼️';
			default:
				return '📄';
		}
	}

	function selectRepo() {
		if (!selectedRepo) return;

		// Store selected repo in sessionStorage
		sessionStorage.setItem('selected_repo', JSON.stringify(selectedRepo));

		// Navigate to dashboard
		goto(`${base}/dashboard`);
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
		<h1>Your GitLab Repositories</h1>
		<button class="logout-btn" onclick={logout}>Logout</button>
	</div>

	{#if loading}
		<div class="loading">
			<p>Loading repositories...</p>
		</div>
	{:else if repositories.length === 0}
		<div class="empty">
			<p>No repositories found</p>
			<a href="{base}/">Go back home</a>
		</div>
	{:else}
		<div class="repo-selector">
			<label for="repo-select">
				<strong>Select a repository:</strong>
			</label>
			<select id="repo-select" bind:value={selectedRepoId} onchange={handleRepoSelect}>
				<option value="">-- Choose a repository --</option>
				{#each repositories as repo}
					<option value={repo.id}>
						{repo.path_with_namespace}
						{#if repo.visibility === 'private'}(Private){/if}
					</option>
				{/each}
			</select>
		</div>

		{#if selectedRepo}
			<div class="repo-details">
				<div class="repo-header">
					<h2>{selectedRepo.name}</h2>
					<a href={selectedRepo.web_url} target="_blank" class="gitlab-link">
						View on GitLab →
					</a>
				</div>

				<button class="select-btn" onclick={selectRepo}>Select This Repository</button>

				{#if selectedRepo.description}
					<p class="description">{selectedRepo.description}</p>
				{/if}

				<div class="repo-stats">
					<div class="stat">
						<span class="label">Visibility:</span>
						<span class="value visibility-{selectedRepo.visibility}">
							{selectedRepo.visibility}
						</span>
					</div>
					<div class="stat">
						<span class="label">Default Branch:</span>
						<span class="value">{selectedRepo.default_branch || 'N/A'}</span>
					</div>
					<div class="stat">
						<span class="label">Stars:</span>
						<span class="value">⭐ {selectedRepo.star_count}</span>
					</div>
					<div class="stat">
						<span class="label">Forks:</span>
						<span class="value">🔱 {selectedRepo.forks_count}</span>
					</div>
					<div class="stat">
						<span class="label">Last Updated:</span>
						<span class="value">{new Date(selectedRepo.last_activity_at).toLocaleString()}</span>
					</div>
				</div>

				<div class="file-tree-section">
					<h3>Repository Files</h3>

					{#if loadingFiles}
						<p class="loading-files">Loading files...</p>
					{:else if fileTree.length === 0}
						<p class="empty-tree">No files found</p>
					{:else}
						<div class="file-tree">
							{#each fileTree as item}
								<div class="file-item {item.type}">
									<span class="icon">{getFileIcon(item.type, item.name)}</span>
									<span class="name">{item.name}</span>
									<span class="type-badge">{item.type}</span>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</div>
		{/if}
	{/if}
</div>

<style>
	.container {
		max-width: 1000px;
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
		color: #333;
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

	.loading, .empty {
		text-align: center;
		padding: 2rem;
	}

	.repo-selector {
		margin-bottom: 2rem;
		padding: 1.5rem;
		background-color: #f8f9fa;
		border-radius: 8px;
	}

	.repo-selector label {
		display: block;
		margin-bottom: 0.5rem;
		color: #333;
	}

	select {
		width: 100%;
		padding: 0.75rem;
		font-size: 1rem;
		border: 2px solid #e0e0e0;
		border-radius: 4px;
		background-color: white;
		cursor: pointer;
		transition: border-color 0.2s;
	}

	select:hover {
		border-color: #fc6d26;
	}

	select:focus {
		outline: none;
		border-color: #fc6d26;
		box-shadow: 0 0 0 3px rgba(252, 109, 38, 0.1);
	}

	.repo-details {
		background-color: white;
		border: 1px solid #e0e0e0;
		border-radius: 8px;
		padding: 2rem;
		margin-top: 2rem;
	}

	.repo-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
		flex-wrap: wrap;
		gap: 1rem;
	}

	.repo-header h2 {
		margin: 0;
		color: #333;
	}

	.gitlab-link {
		color: #fc6d26;
		text-decoration: none;
		font-weight: 600;
		padding: 0.5rem 1rem;
		border: 2px solid #fc6d26;
		border-radius: 4px;
		transition: all 0.2s;
	}

	.gitlab-link:hover {
		background-color: #fc6d26;
		color: white;
	}

	.description {
		color: #666;
		margin-bottom: 1.5rem;
		font-size: 1.1rem;
	}

	.repo-stats {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 1rem;
		margin-bottom: 2rem;
		padding: 1rem;
		background-color: #f8f9fa;
		border-radius: 6px;
	}

	.stat {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.stat .label {
		font-size: 0.85rem;
		color: #666;
		font-weight: 600;
	}

	.stat .value {
		font-size: 1rem;
		color: #333;
	}

	.value.visibility-private {
		color: #856404;
		font-weight: 600;
	}

	.value.visibility-public {
		color: #0c5460;
		font-weight: 600;
	}

	.file-tree-section {
		margin-top: 2rem;
	}

	.file-tree-section h3 {
		color: #333;
		margin-bottom: 1rem;
	}

	.loading-files, .empty-tree {
		text-align: center;
		color: #666;
		padding: 2rem;
		background-color: #f8f9fa;
		border-radius: 6px;
	}

	.file-tree {
		border: 1px solid #e0e0e0;
		border-radius: 6px;
		overflow: hidden;
		max-height: 500px;
		overflow-y: auto;
	}

	.file-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid #f0f0f0;
		transition: background-color 0.2s;
	}

	.file-item:last-child {
		border-bottom: none;
	}

	.file-item:hover {
		background-color: #f8f9fa;
	}

	.file-item.tree {
		font-weight: 600;
	}

	.file-item .icon {
		font-size: 1.2rem;
		flex-shrink: 0;
	}

	.file-item .name {
		flex: 1;
		color: #333;
	}

	.file-item.tree .name {
		color: #fc6d26;
	}

	.type-badge {
		font-size: 0.75rem;
		padding: 0.25rem 0.5rem;
		background-color: #e0e0e0;
		border-radius: 3px;
		color: #666;
		text-transform: uppercase;
	}

	.file-item.tree .type-badge {
		background-color: #fce8dd;
		color: #fc6d26;
	}

	a {
		color: #fc6d26;
		text-decoration: none;
	}

	a:hover {
		text-decoration: underline;
	}

	.select-btn {
		width: 100%;
		padding: 1rem 2rem;
		margin: 1.5rem 0;
		font-size: 1.2rem;
		background-color: #28a745;
		color: white;
		border: none;
		border-radius: 6px;
		cursor: pointer;
		font-weight: 700;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
		transition: all 0.2s;
	}

	.select-btn:hover {
		background-color: #218838;
		box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
		transform: translateY(-1px);
	}
</style>
