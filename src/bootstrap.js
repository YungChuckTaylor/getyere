import './style.css';
import { createClient } from '@supabase/supabase-js';

const url = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();
const configured = Boolean(url && anonKey && !url.includes('YOUR_PROJECT_REF') && !anonKey.includes('YOUR_'));

window.YERE_ENV = {
  supabaseConfigured: configured,
  vapidPublicKey: (import.meta.env.VITE_VAPID_PUBLIC_KEY || '').trim(),
  publicAppUrl: (import.meta.env.VITE_PUBLIC_APP_URL || window.location.origin).trim()
};

window.yereSupabaseReady = Promise.resolve(null);
if (configured) {
  try {
    window.yereSupabaseReady = Promise.resolve(createClient(url, anonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        flowType: 'pkce'
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
