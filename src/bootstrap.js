import './style.css';
import { createClient } from '@supabase/supabase-js';

const adminRoute = window.location.pathname === '/admin-access'
  || window.location.pathname === '/admin'
  || window.location.pathname.startsWith('/admin/');
const adminQuery = new URLSearchParams(window.location.search);
const adminHash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
window.YERE_ADMIN_INVITE_CALLBACK = adminRoute && (
  adminQuery.get('flow') === 'invite' || adminQuery.get('type') === 'invite' || adminHash.get('type') === 'invite'
);
window.YERE_ADMIN_PASSWORD_RECOVERY_CALLBACK = adminRoute && (
  adminQuery.get('flow') === 'recovery' || adminQuery.get('type') === 'recovery' || adminHash.get('type') === 'recovery'
);
const url = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();
const configured = Boolean(url && anonKey && !url.includes('YOUR_PROJECT_REF') && !anonKey.includes('YOUR_'));
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

window.YERE_ENV = {
  supabaseConfigured: configured,
  vapidPublicKey: (import.meta.env.VITE_VAPID_PUBLIC_KEY || '').trim(),
  publicAppUrl
};

window.yereSupabaseReady = Promise.resolve(null);
if (configured) {
  try {
    window.yereSupabaseReady = Promise.resolve(createClient(url, anonKey, {
      auth: {
        autoRefreshToken: true,
        // Admin refresh credentials are scoped to this tab; Vercel also uses a separate HttpOnly session cookie.
        persistSession: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
        ...(adminRoute ? { storage: adminAuthStorage, storageKey: 'yere-admin-auth' } : {})
      },
      realtime: { params: { eventsPerSecond: 10 } }
    })).then((client) => {
      window.yereSupabase = client;
      return client;
    }).catch((error) => {
      console.error('Yere could not initialize Supabase.', error);
      return null;
    });
  } catch (error) {
    console.error('Yere could not initialize Supabase.', error);
  }
}

if (adminRoute) {
  import('./admin.js').then(({ mountAdmin }) => mountAdmin()).catch((error) => {
    console.error('Yere admin interface could not load.', error);
    document.body.innerHTML = '<main style="padding:2rem;font-family:Arial,sans-serif">Admin interface unavailable.</main>';
  });
}
