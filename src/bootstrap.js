import './style.css';
import { createClient } from '@supabase/supabase-js';
import { nativeBridge } from './native.js';
import { resolveRuntimeConfig } from './config.js';

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
        persistSession: true,
        detectSessionInUrl: !nativeBridge.enabled,
        flowType: 'pkce'
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
  publicAppUrl: runtime.publicAppUrl || (nativeBridge.enabled ? 'https://www.getyere.com' : window.location.origin),
  native: nativeBridge.enabled,
  platform: nativeBridge.platform
};
window.YERE_NATIVE = nativeBridge;

window.yereNativeReady = nativeBridge.initialize({
  supabaseUrl: client ? runtime.url : '',
  supabaseKey: client ? runtime.anonKey : '',
  client
}).catch((error) => {
  // Keep the web client usable if a native SDK is temporarily unavailable.
  console.error('Yere could not initialize one or more native services.', error);
});

window.yereSupabaseReady = window.yereNativeReady.then(() => client);
