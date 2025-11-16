import type { OAuthProvider, User, Repo, TokenData, FileTreeItem, CommitData } from './types';

// Helper to create S256 code challenge
async function createS256CodeChallenge(codeVerifier: string): Promise<string> {
	const encoder = new TextEncoder();
	const data = encoder.encode(codeVerifier);
	const hash = await crypto.subtle.digest('SHA-256', data);
	const bytes = new Uint8Array(hash);
	let binary = '';
	for (let i = 0; i < bytes.length; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export class GitHubProvider implements OAuthProvider {
	readonly name = 'github' as const;
	readonly displayName = 'GitHub';

	private clientId: string;
	private redirectUri: string;

	constructor(clientId: string, redirectUri: string) {
		this.clientId = clientId;
		this.redirectUri = redirectUri;
	}

	async createAuthUrl(state: string, codeVerifier: string): Promise<URL> {
		const codeChallenge = await createS256CodeChallenge(codeVerifier);
		const url = new URL('https://github.com/login/oauth/authorize');

		url.searchParams.set('client_id', this.clientId);
		url.searchParams.set('redirect_uri', this.redirectUri);
		url.searchParams.set('response_type', 'code');
		url.searchParams.set('state', state);
		url.searchParams.set('code_challenge', codeChallenge);
		url.searchParams.set('code_challenge_method', 'S256');
		url.searchParams.set('scope', 'repo user');

		return url;
	}

	async exchangeToken(code: string, codeVerifier: string): Promise<TokenData> {
		console.log('GitHub token exchange request:', {
			client_id: this.clientId,
			code: code.substring(0, 10) + '...',
			redirect_uri: this.redirectUri,
			has_code_verifier: !!codeVerifier
		});

		let response;
		try {
			response = await fetch('https://github.com/login/oauth/access_token', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Accept': 'application/json'
				},
				body: JSON.stringify({
					client_id: this.clientId,
					code: code,
					redirect_uri: this.redirectUri,
					code_verifier: codeVerifier
				})
			});
		} catch (fetchError: any) {
			console.error('Fetch error:', fetchError);
			throw new Error(`Network error during token exchange: ${fetchError.message}`);
		}

		console.log('GitHub token exchange response status:', response.status);

		const responseText = await response.text();
		console.log('GitHub token exchange response body:', responseText);

		if (!response.ok) {
			throw new Error(`Token exchange failed: ${response.status} ${responseText}`);
		}

		try {
			const data = JSON.parse(responseText);

			// GitHub may return errors in the response body even with 200 status
			if (data.error) {
				throw new Error(`GitHub OAuth error: ${data.error} - ${data.error_description || ''}`);
			}

			return data;
		} catch (parseError: any) {
			console.error('Failed to parse response:', parseError);
			throw new Error(`Failed to parse token response: ${responseText}`);
		}
	}

	async getUser(token: string): Promise<User> {
		const response = await fetch('https://api.github.com/user', {
			headers: {
				Authorization: `Bearer ${token}`,
				'Accept': 'application/vnd.github.v3+json'
			}
		});

		if (!response.ok) {
			throw new Error('Failed to fetch user info');
		}

		const data = await response.json();
		return {
			id: data.id,
			username: data.login,
			name: data.name || data.login,
			email: data.email || null,
			avatar_url: data.avatar_url || null,
			web_url: data.html_url
		};
	}

	async listRepos(token: string): Promise<Repo[]> {
		const response = await fetch(
			'https://api.github.com/user/repos?per_page=100&sort=updated',
			{
				headers: {
					Authorization: `Bearer ${token}`,
					'Accept': 'application/vnd.github.v3+json'
				}
			}
		);

		if (!response.ok) {
			throw new Error('Failed to fetch repositories');
		}

		const data = await response.json();
		return data.map((repo: any) => ({
			id: repo.id,
			name: repo.name,
			full_name: repo.full_name,
			description: repo.description || null,
			web_url: repo.html_url,
			default_branch: repo.default_branch || 'main',
			updated_at: repo.updated_at
		}));
	}

	async getFileTree(
		token: string,
		repoId: string | number,
		path: string = '',
		ref?: string
	): Promise<FileTreeItem[]> {
		// For GitHub, we need the repo full_name (owner/repo), not just the ID
		// This is a limitation - we'll need to pass the full_name instead
		throw new Error('GitHub getFileTree requires full_name, not ID. Use getFileTreeByName instead.');
	}

	async getFileTreeByName(
		token: string,
		repoFullName: string,
		path: string = '',
		ref?: string
	): Promise<FileTreeItem[]> {
		const branch = ref || 'main';
		const url = path
			? `https://api.github.com/repos/${repoFullName}/contents/${path}?ref=${branch}`
			: `https://api.github.com/repos/${repoFullName}/contents?ref=${branch}`;

		const response = await fetch(url, {
			headers: {
				Authorization: `Bearer ${token}`,
				'Accept': 'application/vnd.github.v3+json'
			}
		});

		if (!response.ok) {
			throw new Error('Failed to fetch file tree');
		}

		const data = await response.json();
		return data.map((item: any) => ({
			name: item.name,
			type: item.type === 'dir' ? 'tree' : 'blob',
			path: item.path
		}));
	}

	async getFile(
		token: string,
		repoId: string | number,
		filePath: string,
		ref?: string
	): Promise<any> {
		// For GitHub, we need the repo full_name (owner/repo), not just the ID
		throw new Error('GitHub getFile requires full_name, not ID. Use getFileByName instead.');
	}

	async getFileByName(
		token: string,
		repoFullName: string,
		filePath: string,
		ref?: string
	): Promise<any> {
		const branch = ref || 'main';
		const response = await fetch(
			`https://api.github.com/repos/${repoFullName}/contents/${filePath}?ref=${branch}`,
			{
				headers: {
					Authorization: `Bearer ${token}`,
					'Accept': 'application/vnd.github.v3+json'
				}
			}
		);

		if (!response.ok) {
			throw new Error(`Failed to fetch file: ${filePath}`);
		}

		return await response.json();
	}

	async createCommit(token: string, repoId: string | number, commit: CommitData): Promise<any> {
		// GitHub doesn't have a single-commit API like GitLab
		// We need to use the Git Data API which is more complex
		// For now, throw an error - this needs special implementation
		throw new Error('GitHub createCommit requires full_name and uses Git Data API. Not yet implemented.');
	}

	async createCommitByName(
		token: string,
		repoFullName: string,
		commit: CommitData
	): Promise<any> {
		// GitHub's commit API is more complex - requires creating blobs, trees, and commits separately
		// This is a simplified version that won't work for multiple files
		throw new Error('GitHub multi-file commits require Git Data API implementation (complex).');
	}
}
