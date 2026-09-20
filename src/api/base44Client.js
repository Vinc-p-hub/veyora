import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

// When the platform injects the env (normal deploy) requests stay same-origin.
// On a build without env (local dev, external host) they go to the real API origin.
const sameOrigin = Boolean(import.meta.env.VITE_BASE44_APP_ID);

export const base44 = createClient({
  appId,
  token,
  functionsVersion,
  serverUrl: sameOrigin ? '' : appBaseUrl,
  appBaseUrl
});