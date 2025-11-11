<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import * as YAML from 'yaml';

	const GITLAB_URL = import.meta.env.VITE_GITLAB_URL;

	interface ImageUpload {
		id: string;
		file: File;
		preview: string;
		caption: string;
	}

	let selectedRepo: any = null;
	let images: ImageUpload[] = [];
	let fileInput: HTMLInputElement;
	let postDatetime: string = '';
	let postTitle: string = '';
	let accessToken: string | null = null;
	let pureYmlContent: any = null;
	let isSubmitting: boolean = false;
	let statusMessage: string = '';
	let errorMessage: string = '';

	onMount(async () => {
		// Get selected repo from sessionStorage
		const repoData = sessionStorage.getItem('selected_repo');

		if (!repoData) {
			// No repo selected, redirect to repos page
			goto(`${base}/repos`);
			return;
		}

		selectedRepo = JSON.parse(repoData);

		// Get access token
		accessToken = sessionStorage.getItem('gitlab_access_token');

		if (!accessToken) {
			goto(`${base}/`);
			return;
		}

		// Set default datetime to now
		const now = new Date();
		// Format as YYYY-MM-DDTHH:mm for datetime-local input
		postDatetime = now.toISOString().slice(0, 16);

		// Fetch pure.yml file from the repository
		await fetchPureYml();
	});

	async function fetchPureYml() {
		if (!accessToken || !selectedRepo) return;

		try {
			const response = await fetch(
				`${GITLAB_URL}/api/v4/projects/${selectedRepo.id}/repository/files/pure.yml?ref=${selectedRepo.default_branch || 'main'}`,
				{
					headers: {
						Authorization: `Bearer ${accessToken}`
					}
				}
			);

			if (!response.ok) {
				console.error('Failed to fetch pure.yml');
				return;
			}

			const data = await response.json();
			// Decode base64 content
			const content = atob(data.content);
			pureYmlContent = YAML.parse(content);
			console.log('Loaded pure.yml:', pureYmlContent);
		} catch (err) {
			console.error('Error fetching pure.yml:', err);
		}
	}

	function handleFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		const files = input.files;

		if (!files) return;

		for (let i = 0; i < files.length; i++) {
			const file = files[i];

			// Only accept image files
			if (!file.type.startsWith('image/')) {
				continue;
			}

			// Create preview URL
			const preview = URL.createObjectURL(file);

			// Add to images array
			images = [
				...images,
				{
					id: crypto.randomUUID(),
					file,
					preview,
					caption: ''
				}
			];
		}

		// Reset file input
		input.value = '';
	}

	function removeImage(id: string) {
		const image = images.find((img) => img.id === id);
		if (image) {
			// Revoke preview URL to free memory
			URL.revokeObjectURL(image.preview);
		}

		images = images.filter((img) => img.id !== id);
	}

	async function handleDone() {
		if (images.length === 0) return;

		statusMessage = '';
		errorMessage = '';
		isSubmitting = true;

		try {
			statusMessage = 'Preparing files...';

			// Parse the selected datetime
			const postDate = new Date(postDatetime);
			const dateFolder = postDate.toISOString().split('T')[0]; // YYYY-MM-DD
			const isoTimestamp = postDate.toISOString(); // Full ISO format

			console.log('=== PREPARING GITLAB SINGLE COMMIT API CALL ===');
			console.log('Post Date:', dateFolder);
			console.log('ISO Timestamp:', isoTimestamp);

			// Prepare actions array for single commit
			const actions = [];
			const imageObjects = [];

		// Add image file actions
		for (const image of images) {
			const filePath = `${dateFolder}/${image.file.name}`;

			// Read file as base64
			const base64Content = await fileToBase64(image.file);

			actions.push({
				action: 'create',
				file_path: filePath,
				content: base64Content,
				encoding: 'base64'
			});

			// Build image object for pure.yml
			const imageObj: any = {
				path: filePath
			};
			if (image.caption) {
				imageObj.caption = image.caption;
			}
			imageObjects.push(imageObj);
		}

		// Prepare pure.yml update
		const updatedYml = { ...pureYmlContent };
		if (!updatedYml.posts) {
			updatedYml.posts = [];
		}

		const newPost = {
			timestamp: isoTimestamp,
			title: postTitle,
			images: imageObjects
		};

		// Add new post as first element
		updatedYml.posts.unshift(newPost);

		const updatedYmlString = YAML.stringify(updatedYml);
		const ymlBase64 = btoa(updatedYmlString);

		// Add pure.yml update action
		actions.push({
			action: 'update',
			file_path: 'pure.yml',
			content: ymlBase64,
			encoding: 'base64'
		});

		// Build single commit API request
		const commitRequest = {
			url: `${GITLAB_URL}/api/v4/projects/${selectedRepo.id}/repository/commits`,
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${accessToken}`,
				'Content-Type': 'application/json'
			},
			body: {
				branch: selectedRepo.default_branch || 'main',
				commit_message: `Add post for ${dateFolder}`,
				actions: actions
			}
		};

		console.log('\n=== SINGLE COMMIT API REQUEST ===');
		console.log('URL:', commitRequest.url);
		console.log('Method:', commitRequest.method);
		console.log('Headers:', commitRequest.headers);
		console.log('Body:', commitRequest.body);

		console.log('\n=== ACTIONS ===');
		actions.forEach((action, idx) => {
			console.log(`\nAction ${idx + 1}:`, {
				action: action.action,
				file_path: action.file_path,
				encoding: action.encoding,
				content_length: action.content.length
			});
		});

		console.log('\n=== NEW POST OBJECT ===');
		console.log(newPost);

		console.log('\n=== UPDATED PURE.YML CONTENT ===');
		console.log(updatedYmlString);

			// Actually make the API call
			statusMessage = 'Creating commit on GitLab...';

			const response = await fetch(commitRequest.url, {
				method: commitRequest.method,
				headers: commitRequest.headers,
				body: JSON.stringify(commitRequest.body)
			});

			if (!response.ok) {
				const errorData = await response.json();
				console.error('GitLab API Error:', errorData);
				// Create detailed error message with all available information
				let detailedError = `API call failed (Status ${response.status})`;
				if (errorData.message) {
					detailedError += `\n${errorData.message}`;
				}
				if (errorData.error) {
					detailedError += `\nError: ${errorData.error}`;
				}
				if (errorData.error_description) {
					detailedError += `\nDescription: ${errorData.error_description}`;
				}
				// Include full error object as JSON for debugging
				const errorObj = new Error(detailedError);
				(errorObj as any).fullResponse = errorData;
				throw errorObj;
			}

			const result = await response.json();
			console.log('\n=== COMMIT SUCCESSFUL ===');
			console.log('Commit ID:', result.id);
			console.log('Commit URL:', result.web_url);
			console.log('Full response:', result);

			statusMessage = `Post created successfully! Commit: ${result.id}`;

			// Clean up preview URLs
			images.forEach((img) => URL.revokeObjectURL(img.preview));

			// Navigate back to dashboard after showing success
			setTimeout(() => {
				goto(`${base}/dashboard`);
			}, 2000);

		} catch (error: any) {
			console.error('\n=== COMMIT FAILED ===');
			console.error('Error:', error);
			console.error('Full error response:', error?.fullResponse);

			// Display detailed error message
			if (error?.fullResponse) {
				errorMessage = `Failed to create post:\n${error.message}\n\nFull error details: ${JSON.stringify(error.fullResponse, null, 2)}`;
			} else {
				errorMessage = `Failed to create post: ${error?.message || 'Unknown error'}`;
			}
			statusMessage = '';
		} finally {
			isSubmitting = false;
		}
	}

	async function fileToBase64(file: File): Promise<string> {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => {
				const result = reader.result as string;
				// Remove data URL prefix (e.g., "data:image/png;base64,")
				const base64 = result.split(',')[1];
				resolve(base64);
			};
			reader.onerror = reject;
			reader.readAsDataURL(file);
		});
	}

	function cancel() {
		// Clean up preview URLs
		images.forEach((img) => URL.revokeObjectURL(img.preview));
		goto(`${base}/dashboard`);
	}
</script>

<div class="container">
	<h1>New Post</h1>

	{#if selectedRepo}
		<div class="repo-info">
			<p>Repository: <strong>{selectedRepo.path_with_namespace}</strong></p>
		</div>
	{/if}

	<div class="post-info-section">
		<h2>Post Details</h2>

		<label>
			<span>Post Title:</span>
			<input
				type="text"
				bind:value={postTitle}
				placeholder="Enter post title..."
				required
			/>
		</label>

		<label>
			<span>Date & Time:</span>
			<input
				type="datetime-local"
				bind:value={postDatetime}
				required
			/>
		</label>
	</div>

	<div class="upload-section">
		<h2>Upload Images</h2>

		<input
			type="file"
			bind:this={fileInput}
			onchange={handleFileSelect}
			accept="image/*"
			multiple
			style="display: none"
		/>

		<button class="upload-btn" onclick={() => fileInput.click()}>Choose Images</button>
	</div>

	{#if images.length > 0}
		<div class="images-section">
			<h2>Images ({images.length})</h2>

			<div class="images-list">
				{#each images as image (image.id)}
					<div class="image-item">
						<img src={image.preview} alt="Preview" />

						<div class="image-controls">
							<label>
								<span>Caption (optional):</span>
								<input
									type="text"
									bind:value={image.caption}
									placeholder="Enter caption..."
								/>
							</label>

							<button class="remove-btn" onclick={() => removeImage(image.id)}>
								Remove
							</button>
						</div>

						<div class="image-meta">
							<p>File: {image.file.name}</p>
							<p>Size: {(image.file.size / 1024).toFixed(2)} KB</p>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	{#if statusMessage}
		<div class="status-message success">
			{statusMessage}
		</div>
	{/if}

	{#if errorMessage}
		<div class="status-message error">
			{errorMessage}
		</div>
	{/if}

	<div class="actions">
		<button class="done-btn" onclick={handleDone} disabled={images.length === 0 || !postTitle.trim() || isSubmitting}>
			{isSubmitting ? 'Creating Post...' : 'Done'}
		</button>
		<button class="cancel-btn" onclick={cancel} disabled={isSubmitting}>Cancel</button>
	</div>
</div>

<style>
	.container {
		max-width: 900px;
		margin: 2rem auto;
		padding: 2rem;
	}

	h1 {
		margin-bottom: 1rem;
	}

	h2 {
		margin-bottom: 1rem;
	}

	.repo-info {
		background-color: #f8f9fa;
		padding: 1rem;
		border-radius: 4px;
		margin-bottom: 2rem;
	}

	.repo-info p {
		margin: 0;
	}

	.post-info-section {
		background-color: #f8f9fa;
		padding: 1.5rem;
		border-radius: 4px;
		margin-bottom: 2rem;
	}

	.post-info-section h2 {
		margin-top: 0;
		margin-bottom: 1rem;
	}

	.post-info-section label {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-bottom: 1rem;
	}

	.post-info-section label:last-of-type {
		margin-bottom: 0;
	}

	.post-info-section label span {
		font-weight: 600;
		color: #333;
	}

	.post-info-section input[type='text'],
	.post-info-section input[type='datetime-local'] {
		padding: 0.75rem;
		border: 1px solid #e0e0e0;
		border-radius: 4px;
		font-size: 1rem;
		font-family: inherit;
	}

	.post-info-section input[type='text']:focus,
	.post-info-section input[type='datetime-local']:focus {
		outline: none;
		border-color: #fc6d26;
		box-shadow: 0 0 0 3px rgba(252, 109, 38, 0.1);
	}

	.upload-section {
		margin-bottom: 2rem;
	}

	.upload-btn {
		padding: 1rem 2rem;
		background-color: #fc6d26;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-weight: 600;
		font-size: 1rem;
	}

	.upload-btn:hover {
		background-color: #e24329;
	}

	.images-section {
		margin-bottom: 2rem;
	}

	.images-list {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.image-item {
		border: 1px solid #e0e0e0;
		border-radius: 4px;
		padding: 1rem;
		background-color: #fff;
	}

	.image-item img {
		width: 100%;
		max-width: 400px;
		height: auto;
		border-radius: 4px;
		margin-bottom: 1rem;
	}

	.image-controls {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		margin-bottom: 1rem;
	}

	.image-controls label {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.image-controls label span {
		font-weight: 600;
	}

	.image-controls input[type='text'] {
		padding: 0.5rem;
		border: 1px solid #e0e0e0;
		border-radius: 4px;
		font-size: 1rem;
	}

	.remove-btn {
		padding: 0.5rem 1rem;
		background-color: #dc3545;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-weight: 600;
		align-self: flex-start;
	}

	.remove-btn:hover {
		background-color: #c82333;
	}

	.image-meta {
		font-size: 0.85rem;
		color: #666;
	}

	.image-meta p {
		margin: 0.25rem 0;
	}

	.status-message {
		padding: 1rem;
		border-radius: 4px;
		margin-bottom: 1rem;
		font-weight: 600;
		text-align: center;
	}

	.status-message.success {
		background-color: #d4edda;
		color: #155724;
		border: 1px solid #c3e6cb;
	}

	.status-message.error {
		background-color: #f8d7da;
		color: #721c24;
		border: 1px solid #f5c6cb;
		white-space: pre-wrap;
		text-align: left;
		font-family: monospace;
		font-size: 0.9rem;
		max-height: 400px;
		overflow-y: auto;
	}

	.actions {
		display: flex;
		gap: 1rem;
		margin-top: 2rem;
	}

	.done-btn {
		padding: 1rem 2rem;
		background-color: #28a745;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-weight: 600;
		font-size: 1.1rem;
	}

	.done-btn:hover:not(:disabled) {
		background-color: #218838;
	}

	.done-btn:disabled {
		background-color: #6c757d;
		cursor: not-allowed;
	}

	.cancel-btn {
		padding: 1rem 2rem;
		background-color: #6c757d;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-weight: 600;
		font-size: 1.1rem;
	}

	.cancel-btn:hover {
		background-color: #5a6268;
	}
</style>
