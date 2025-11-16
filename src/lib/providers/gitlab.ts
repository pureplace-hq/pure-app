import type { OAuthProvider, User, Repo, TokenData, FileTreeItem, CommitData } from './types';
import { GitLab } from 'arctic';

export class GitLabProvider implements OAuthProvider {
	readonly name = 'gitlab' as const;
	readonly displayName = 'GitLab';

	private clientId: string;
	private baseUrl: string;
	private redirectUri: string;
	private arctic: GitLab;

	constructor(clientId: string, baseUrl: string, redirectUri: string) {
		this.clientId = clientId;
		this.baseUrl = baseUrl;
		this.redirectUri = redirectUri;
		this.arctic = new GitLab(baseUrl, clientId, null, redirectUri);
	}

	createAuthUrl(state: string, codeVerifier: string): URL {
		// Use Arctic for creating auth URL (same as current implementation)
		return (this.arctic as any).client.createAuthorizationURLWithPKCE(
			(this.arctic as any).authorizationEndpoint,
			state,
			0, // CodeChallengeMethod.S256
			codeVerifier,
			['api']
		);
	}

	async exchangeToken(code: string, codeVerifier: string): Promise<TokenData> {
		const response = await fetch(`${this.baseUrl}/oauth/token`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded'
			},
			body: new URLSearchParams({
				client_id: this.clientId,
				code: code,
				grant_type: 'authorization_code',
				redirect_uri: this.redirectUri,
				code_verifier: codeVerifier
			})
		});

		if (!response.ok) {
			const errorData = await response.text();
			throw new Error(`Token exchange failed: ${response.status} ${errorData}`);
		}

		return await response.json();
	}

	async getUser(token: string): Promise<User> {
		const response = await fetch(`${this.baseUrl}/api/v4/user`, {
			headers: {
				Authorization: `Bearer ${token}`
			}
		});

		if (!response.ok) {
			throw new Error('Failed to fetch user info');
		}

		const data = await response.json();
		return {
			id: data.id,
			username: data.username,
			name: data.name,
			email: data.email || null,
			avatar_url: data.avatar_url || null,
			web_url: data.web_url
		};
	}

	async listRepos(token: string): Promise<Repo[]> {
		const response = await fetch(
			`${this.baseUrl}/api/v4/projects?membership=true&per_page=100&order_by=last_activity_at`,
			{
				headers: {
					Authorization: `Bearer ${token}`
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
			full_name: repo.path_with_namespace,
			description: repo.description || null,
			web_url: repo.web_url,
			default_branch: repo.default_branch,
			last_activity_at: repo.last_activity_at
		}));
	}

	async getFileTree(
		token: string,
		repoId: string | number,
		path: string = '',
		ref?: string
	): Promise<FileTreeItem[]> {
		const params = new URLSearchParams({
			recursive: 'false',
			per_page: '100'
		});

		if (path) params.set('path', path);
		if (ref) params.set('ref', ref);

		const response = await fetch(
			`${this.baseUrl}/api/v4/projects/${repoId}/repository/tree?${params}`,
			{
				headers: {
					Authorization: `Bearer ${token}`
				}
			}
		);

		if (!response.ok) {
			throw new Error('Failed to fetch file tree');
		}

		const data = await response.json();
		return data.map((item: any) => ({
			id: item.id,
			name: item.name,
			type: item.type,
			path: item.path,
			mode: item.mode
		}));
	}

	async getFile(
		token: string,
		repoId: string | number,
		filePath: string,
		ref?: string
	): Promise<any> {
		const encodedPath = encodeURIComponent(filePath);
		const params = new URLSearchParams();
		if (ref) params.set('ref', ref);

		const response = await fetch(
			`${this.baseUrl}/api/v4/projects/${repoId}/repository/files/${encodedPath}?${params}`,
			{
				headers: {
					Authorization: `Bearer ${token}`
				}
			}
		);

		if (!response.ok) {
			throw new Error(`Failed to fetch file: ${filePath}`);
		}

		return await response.json();
	}

	async createCommit(token: string, repoId: string | number, commit: CommitData): Promise<any> {
		const response = await fetch(`${this.baseUrl}/api/v4/projects/${repoId}/repository/commits`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${token}`
			},
			body: JSON.stringify(commit)
		});

		if (!response.ok) {
			const errorData = await response.text();
			throw new Error(`Failed to create commit: ${response.status} ${errorData}`);
		}

		return await response.json();
	}
}
