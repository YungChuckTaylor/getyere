import './style.css';
import { createClient } from '@supabase/supabase-js';
import { nativeBridge } from './native.js';

const url = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();
const configured = Boolean(url && anonKey && !url.includes('YOUR_PROJECT_REF') && !anonKey.includes('YOUR_'));

window.YERE_ENV = {
  supabaseConfigured: configured,
  vapidPublicKey: (import.meta.env.VITE_VAPID_PUBLIC_KEY || '').trim(),
  publicAppUrl: (import.meta.env.VITE_PUBLIC_APP_URL || (nativeBridge.enabled ? 'https://www.getyere.com' : window.location.origin)).trim(),
  native: nativeBridge.enabled,
  platform: nativeBridge.platform
};
window.YERE_NATIVE = nativeBridge;

let client = null;
if (configured) {
  try {
    client = createClient(url, anonKey, {
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
    console.error('Yere could not initialize Supabase.', error);
  }
}

window.yereNativeReady = nativeBridge.initialize({
  supabaseUrl: configured ? url : '',
  supabaseKey: configured ? anonKey : '',
  client
}).catch((error) => {
  // Keep the web client usable if a native SDK is temporarily unavailable.
  console.error('Yere could not initialize one or more native services.', error);
});

window.yereSupabaseReady = window.yereNativeReady.then(() => client);
