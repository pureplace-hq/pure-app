// Shared types for OAuth providers

export interface User {
	id: string | number;
	username: string;
	name: string;
	email: string | null;
	avatar_url: string | null;
	web_url: string;
}

export interface Repo {
	id: string | number;
	name: string;
	full_name: string;
	description: string | null;
	web_url: string;
	default_branch: string;
	last_activity_at?: string;
	updated_at?: string;
}

export interface TokenData {
	access_token: string;
	refresh_token?: string;
	token_type: string;
	scope?: string;
}

export interface FileTreeItem {
	id?: string;
	name: string;
	type: 'tree' | 'blob';
	path: string;
	mode?: string;
}

export interface CommitData {
	branch: string;
	message: string;
	actions: CommitAction[];
}

export interface CommitAction {
	action: 'create' | 'update' | 'delete';
	file_path: string;
	content?: string;
}

export interface OAuthProvider {
	readonly name: 'gitlab' | 'github';
	readonly displayName: string;

	// OAuth flow
	createAuthUrl(state: string, codeVerifier: string): URL;
	exchangeToken(code: string, codeVerifier: string): Promise<TokenData>;

	// User operations
	getUser(token: string): Promise<User>;

	// Repository operations
	listRepos(token: string): Promise<Repo[]>;
	getFileTree(token: string, repoId: string | number, path?: string, ref?: string): Promise<FileTreeItem[]>;
	getFile(token: string, repoId: string | number, filePath: string, ref?: string): Promise<any>;
	createCommit(token: string, repoId: string | number, commit: CommitData): Promise<any>;
}
