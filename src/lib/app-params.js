import { getAccessToken } from '@base44/sdk';

const isNode = typeof window === 'undefined';

const isClearAccessTokenRequested = () =>
	!isNode && new URLSearchParams(window.location.search).get("clear_access_token") === 'true';

const clearStoredAccessToken = () => {
	window.localStorage.removeItem('base44_access_token');
	window.localStorage.removeItem('token');
}

const getAppParams = () => {
	if (isClearAccessTokenRequested()) {
		clearStoredAccessToken();
	}
	// Fallbacks for builds made outside the platform (local dev, GitHub clone):
	// without them the SDK targets /api/apps/undefined/... and every data call fails.
	return {
		appId: import.meta.env.VITE_BASE44_APP_ID || '6aae3bd1fa32640256bb8573',
		token: getAccessToken(),
		functionsVersion: import.meta.env.VITE_BASE44_FUNCTIONS_VERSION,
		appBaseUrl: import.meta.env.VITE_BASE44_APP_BASE_URL || 'https://veyro-tech-prime.base44.app',
	}
}


export const appParams = {
	...getAppParams()
}