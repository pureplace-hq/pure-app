import { writable } from 'svelte/store';
import type { User } from '$lib/providers/types';

interface AuthState {
	provider: 'gitlab' | 'github' | null;
	accessToken: string | null;
	refreshToken: string | null;
	user: User | null;
	isAuthenticated: boolean;
}

const createAuthStore = () => {
	const { subscribe, set, update } = writable<AuthState>({
		provider: null,
		accessToken: null,
		refreshToken: null,
		user: null,
		isAuthenticated: false
	});

	return {
		subscribe,
		setAuth: (provider: 'gitlab' | 'github', accessToken: string, refreshToken: string | null, user: User) => {
			// Store in sessionStorage
			sessionStorage.setItem(`${provider}_access_token`, accessToken);
			if (refreshToken) {
				sessionStorage.setItem(`${provider}_refresh_token`, refreshToken);
			}
			sessionStorage.setItem('current_provider', provider);

			// Update store
			update(() => ({
				provider,
				accessToken,
				refreshToken,
				user,
				isAuthenticated: true
			}));
		},
		loadFromStorage: () => {
			const provider = sessionStorage.getItem('current_provider') as 'gitlab' | 'github' | null;
			if (!provider) return;

			const accessToken = sessionStorage.getItem(`${provider}_access_token`);
			const refreshToken = sessionStorage.getItem(`${provider}_refresh_token`);

			if (accessToken) {
				update((state) => ({
					...state,
					provider,
					accessToken,
					refreshToken,
					isAuthenticated: true
				}));
			}
		},
		logout: () => {
			// Clear sessionStorage
			const provider = sessionStorage.getItem('current_provider');
			if (provider) {
				sessionStorage.removeItem(`${provider}_access_token`);
				sessionStorage.removeItem(`${provider}_refresh_token`);
			}
			sessionStorage.removeItem('current_provider');
			sessionStorage.removeItem('oauth_state');
			sessionStorage.removeItem('code_verifier');
			sessionStorage.removeItem('selected_repo');

			// Reset store
			set({
				provider: null,
				accessToken: null,
				refreshToken: null,
				user: null,
				isAuthenticated: false
			});
		}
	};
};

export const authStore = createAuthStore();
