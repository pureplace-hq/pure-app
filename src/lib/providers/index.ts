import type { OAuthProvider } from './types';
import { GitLabProvider } from './gitlab';
import { GitHubProvider } from './github';

// Provider registry
const providers = new Map<string, OAuthProvider>();

// Initialize GitLab provider
const gitlabClientId = import.meta.env.VITE_GITLAB_CLIENT_ID;
const gitlabUrl = import.meta.env.VITE_GITLAB_URL;
const gitlabRedirectUri = import.meta.env.VITE_GITLAB_REDIRECT_URI;

console.log('GitLab redirect URI from env:', gitlabRedirectUri);

if (gitlabClientId && gitlabUrl && gitlabRedirectUri) {
	providers.set('gitlab', new GitLabProvider(gitlabClientId, gitlabUrl, gitlabRedirectUri));
}

// Initialize GitHub provider
const githubClientId = import.meta.env.VITE_GITHUB_CLIENT_ID;
const githubRedirectUri = import.meta.env.VITE_GITHUB_REDIRECT_URI;

if (githubClientId && githubRedirectUri) {
	providers.set('github', new GitHubProvider(githubClientId, githubRedirectUri));
}

export function getProvider(name: 'gitlab' | 'github'): OAuthProvider {
	const provider = providers.get(name);
	if (!provider) {
		throw new Error(`Provider '${name}' not found or not configured`);
	}
	return provider;
}

export function hasProvider(name: string): boolean {
	return providers.has(name);
}

export { generateCodeVerifier, generateState } from 'arctic';
