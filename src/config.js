// Shared, dependency-free configuration rules for Yere.
// Used by the browser bootstrap, the Vite build guard, and the CI validation script
// so that every layer agrees on what a "real cloud configuration" means.

export const CLOUD_ENV_KEYS = Object.freeze({
  url: 'VITE_SUPABASE_URL',
  anonKey: 'VITE_SUPABASE_ANON_KEY',
  vapidPublicKey: 'VITE_VAPID_PUBLIC_KEY',
  publicAppUrl: 'VITE_PUBLIC_APP_URL'
});

// Values copied from .env.example or documentation must never reach a real build.
const PLACEHOLDER_PATTERN = /YOUR_|REPLACE_|PROJECT_REF|your-project/i;

function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function decodeJwtPayload(token) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch (_) {
    return null;
  }
}

function projectRefFromUrl(url) {
  try {
    const host = new URL(url).hostname;
    return host.endsWith('.supabase.co') ? host.slice(0, -'.supabase.co'.length) : '';
  } catch (_) {
    return '';
  }
}

/**
 * Validates the Supabase URL and public key. Returns human-readable errors; an empty
 * array means the values are safe to embed in a client build.
 */
export function validateSupabaseConfig({ url, anonKey } = {}) {
  const errors = [];
  const supabaseUrl = clean(url);
  const key = clean(anonKey);

  if (!supabaseUrl) {
    errors.push(`${CLOUD_ENV_KEYS.url} is missing. Set it to your Supabase project URL, for example https://<project-ref>.supabase.co.`);
  } else if (PLACEHOLDER_PATTERN.test(supabaseUrl)) {
    errors.push(`${CLOUD_ENV_KEYS.url} still contains a placeholder value.`);
  } else {
    let parsed = null;
    try {
      parsed = new URL(supabaseUrl);
    } catch (_) {
      errors.push(`${CLOUD_ENV_KEYS.url} is not a valid URL.`);
    }
    if (parsed && parsed.protocol !== 'https:') {
      errors.push(`${CLOUD_ENV_KEYS.url} must use https:// so the native apps never send credentials in clear text.`);
    }
  }

  if (!key) {
    errors.push(`${CLOUD_ENV_KEYS.anonKey} is missing. Set it to the Supabase publishable (anon) key from Project Settings → API.`);
  } else if (PLACEHOLDER_PATTERN.test(key)) {
    errors.push(`${CLOUD_ENV_KEYS.anonKey} still contains a placeholder value.`);
  } else if (key.startsWith('sb_secret_')) {
    errors.push(`${CLOUD_ENV_KEYS.anonKey} is a Supabase SECRET key. Never ship it to a client; use the publishable key instead.`);
  } else if (key.startsWith('sb_publishable_')) {
    // Current publishable key format. Nothing else to check client-side.
  } else {
    const payload = decodeJwtPayload(key);
    if (!payload) {
      errors.push(`${CLOUD_ENV_KEYS.anonKey} is not a recognised Supabase key format (expected sb_publishable_… or a JWT anon key).`);
    } else if (payload.role === 'service_role') {
      errors.push(`${CLOUD_ENV_KEYS.anonKey} is a service_role key. Never ship it to a client; use the anon/publishable key instead.`);
    } else if (payload.role !== 'anon') {
      errors.push(`${CLOUD_ENV_KEYS.anonKey} has role "${payload.role || 'unknown'}"; expected the anon/publishable key.`);
    } else if (payload.ref && supabaseUrl && projectRefFromUrl(supabaseUrl) && payload.ref !== projectRefFromUrl(supabaseUrl)) {
      errors.push(`${CLOUD_ENV_KEYS.anonKey} belongs to project "${payload.ref}" but ${CLOUD_ENV_KEYS.url} points at "${projectRefFromUrl(supabaseUrl)}".`);
    }
  }

  return errors;
}

/** Non-blocking advice for optional browser values. */
export function optionalConfigWarnings({ vapidPublicKey, publicAppUrl } = {}) {
  const warnings = [];
  const vapid = clean(vapidPublicKey);
  const appUrl = clean(publicAppUrl);
  if (!vapid) warnings.push(`${CLOUD_ENV_KEYS.vapidPublicKey} is not set; web push subscriptions will be unavailable.`);
  else if (PLACEHOLDER_PATTERN.test(vapid)) warnings.push(`${CLOUD_ENV_KEYS.vapidPublicKey} still contains a placeholder value.`);
  if (!appUrl) warnings.push(`${CLOUD_ENV_KEYS.publicAppUrl} is not set; the native app will use https://www.getyere.com for links.`);
  else {
    try {
      if (new URL(appUrl).protocol !== 'https:') warnings.push(`${CLOUD_ENV_KEYS.publicAppUrl} should be an https:// URL.`);
    } catch (_) {
      warnings.push(`${CLOUD_ENV_KEYS.publicAppUrl} is not a valid URL.`);
    }
  }
  return warnings;
}

/**
 * Decides how the app must start.
 *  - native-cloud:   native shell with a valid Supabase configuration (the real product).
 *  - native-blocked: native shell without valid cloud config. Shows an error; never demo data.
 *  - web-cloud:      browser with valid cloud config.
 *  - web-demo:       browser without cloud config. The local demo is allowed here only.
 */
export function resolveRuntimeConfig(env = {}, { native = false } = {}) {
  const url = clean(env[CLOUD_ENV_KEYS.url]);
  const anonKey = clean(env[CLOUD_ENV_KEYS.anonKey]);
  const errors = validateSupabaseConfig({ url, anonKey });
  const configured = errors.length === 0;
  const mode = native
    ? (configured ? 'native-cloud' : 'native-blocked')
    : (configured ? 'web-cloud' : 'web-demo');
  return {
    mode,
    native,
    configured,
    errors,
    warnings: optionalConfigWarnings({
      vapidPublicKey: env[CLOUD_ENV_KEYS.vapidPublicKey],
      publicAppUrl: env[CLOUD_ENV_KEYS.publicAppUrl]
    }),
    url: configured ? url : '',
    anonKey: configured ? anonKey : '',
    vapidPublicKey: clean(env[CLOUD_ENV_KEYS.vapidPublicKey]),
    publicAppUrl: clean(env[CLOUD_ENV_KEYS.publicAppUrl])
  };
}
