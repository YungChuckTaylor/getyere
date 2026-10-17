import './style.css';
import { enhancePasswordFields, startSocialSignIn } from './auth-ui.js';
window.YERE_AUTH = { enhancePasswordFields, startSocialSignIn };
import { createClient } from '@supabase/supabase-js';
import { nativeBridge } from './native.js';
import { resolveRuntimeConfig } from './config.js';
import { SPEECH_ERROR_COPY } from './speech.js';

// The admin console is served from Vercel routes. A native build serves its bundle from the
// Capacitor origin, where neither these paths nor the /api/admin-* proxy exist, so the console is
// deliberately unreachable inside the Android and iOS apps.
const adminRoute = !nativeBridge.enabled && (
  window.location.pathname === '/admin-access'
  || window.location.pathname === '/admin'
  || window.location.pathname.startsWith('/admin/')
);
const adminQuery = new URLSearchParams(window.location.search);
const adminHash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
window.YERE_ADMIN_INVITE_CALLBACK = adminRoute && (
  adminQuery.get('flow') === 'invite' || adminQuery.get('type') === 'invite' || adminHash.get('type') === 'invite'
);
window.YERE_ADMIN_PASSWORD_RECOVERY_CALLBACK = adminRoute && (
  adminQuery.get('flow') === 'recovery' || adminQuery.get('type') === 'recovery' || adminHash.get('type') === 'recovery'
);

const adminAuthStorage = (() => {
  try {
    const storage = window.sessionStorage;
    const testKey = '__yere_admin_storage_test__';
    storage.setItem(testKey, '1'); storage.removeItem(testKey);
    return storage;
  } catch {
    const values = new Map();
    return {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key)
    };
  }
})();

const defaultPublicAppUrl = import.meta.env.DEV ? window.location.origin : 'https://getyere.com';
const configuredPublicAppUrl = (import.meta.env.VITE_PUBLIC_APP_URL || '').trim();
const publicAppUrl = (() => {
  const candidate = configuredPublicAppUrl || defaultPublicAppUrl;
  try {
    const url = new URL(candidate);
    const localDevelopmentOrigin = import.meta.env.DEV && ['localhost', '127.0.0.1'].includes(url.hostname);
    if (url.protocol === 'https:' || localDevelopmentOrigin) return url.origin;
  } catch { /* Use the safe default for invalid build configuration. */ }
  return defaultPublicAppUrl;
})();

// Vite inlines these public VITE_ values at build time. Nothing else from the environment is read.
const runtime = resolveRuntimeConfig({
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
  VITE_VAPID_PUBLIC_KEY: import.meta.env.VITE_VAPID_PUBLIC_KEY,
  VITE_PUBLIC_APP_URL: import.meta.env.VITE_PUBLIC_APP_URL
}, { native: nativeBridge.enabled });
let client = null;
let clientError = '';

if (runtime.configured) {
  try {
    client = createClient(runtime.url, runtime.anonKey, {
      auth: {
        autoRefreshToken: true,
        // Admin refresh credentials are scoped to this tab; Vercel also uses a separate HttpOnly session cookie.
        persistSession: true,
        detectSessionInUrl: !nativeBridge.enabled,
        flowType: 'pkce',
        ...(adminRoute ? { storage: adminAuthStorage, storageKey: 'yere-admin-auth' } : {})
      },
      realtime: { params: { eventsPerSecond: 10 } }
    });
    window.yereSupabase = client;
  } catch (error) {
    clientError = 'Yere could not initialize its cloud client.';
    console.error(clientError, error);
  }
}

// The mode is derived from the client that actually exists. A native build without a
// working client must never fall back to demo data.
const errors = [...runtime.errors, ...(clientError ? [clientError] : [])];
const mode = client ? runtime.mode : (runtime.native ? 'native-blocked' : 'web-demo');

window.YERE_ENV = {
  mode,
  errors,
  warnings: runtime.warnings,
  supabaseConfigured: Boolean(client),
  vapidPublicKey: runtime.vapidPublicKey,
  // Email and deep links use the canonical apex origin; the Android manifest and the iOS
  // entitlements verify app links on both getyere.com and www.getyere.com. The browser keeps the
  // validated origin it is actually served from.
  publicAppUrl: runtime.publicAppUrl || (nativeBridge.enabled ? 'https://getyere.com' : publicAppUrl),
  native: nativeBridge.enabled,
  platform: nativeBridge.platform
};
window.YERE_NATIVE = nativeBridge;
// Shared wording for voice-capture failures so the browser Web Speech fallback reports the same
// specific problems (denied permission, unavailable recognizer, no speech, network, missing
// language model) as the native recognizer instead of one generic message.
window.YERE_SPEECH_COPY = SPEECH_ERROR_COPY;

window.yereNativeReady = nativeBridge.initialize({
  supabaseUrl: client ? runtime.url : '',
  supabaseKey: client ? runtime.anonKey : '',
  client
}).catch((error) => {
  // Keep the web client usable if a native SDK is temporarily unavailable.
  console.error('Yere could not initialize one or more native services.', error);
});

window.yereSupabaseReady = window.yereNativeReady.then(() => client);

if (adminRoute) {
  import('./admin.js').then(({ mountAdmin }) => mountAdmin()).catch((error) => {
    console.error('Yere admin interface could not load.', error);
    document.body.innerHTML = '<main style="padding:2rem;font-family:Arial,sans-serif">Admin interface unavailable.</main>';
  });
}
