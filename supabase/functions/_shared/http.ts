import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-yere-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
  'Vary': 'Origin'
};

export function jsonResponse(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, ...extra } });
}

export function preflight(req: Request) {
  return req.method === 'OPTIONS' ? new Response('ok', { headers: corsHeaders }) : null;
}

export function env(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing server configuration: ${name}`);
  return value;
}

export function adminClient(): SupabaseClient {
  return createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

export async function authenticatedUser(req: Request) {
  const authorization = req.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return { user: null, error: new Error('Sign in to continue.') };
  const client = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data, error } = await client.auth.getUser();
  return { user: data.user, error };
}

export async function readJson(req: Request, maxBytes = 12000) {
  const text = await req.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) throw new Error('Request is too large.');
  try { return JSON.parse(text); }
  catch { throw new Error('Request body must be valid JSON.'); }
}

export async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function randomInviteCode() {
  // 32 symbols allow an unbiased 5-bit mapping: eight characters provide 40 bits.
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const raw = [...bytes].map((byte) => alphabet[byte & 31]).join('');
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

export function randomToken(bytes = 32) {
  const value = new Uint8Array(bytes);
  crypto.getRandomValues(value);
  return btoa(String.fromCharCode(...value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function safeAppOrigin() {
  const configured = Deno.env.get('PUBLIC_APP_URL') || 'https://getyere.com';
  const url = new URL(configured);
  const localDevelopmentOrigin = ['localhost', '127.0.0.1'].includes(url.hostname);
  if (url.protocol !== 'https:' && !localDevelopmentOrigin) throw new Error('PUBLIC_APP_URL must use HTTPS.');
  return url.origin;
}

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] || char);
}

export async function consumeRateLimit(client: SupabaseClient, key: string, action: string, limit: number, seconds: number) {
  const { data, error } = await client.rpc('consume_rate_limit', {
    p_bucket_key: key,
    p_action: action,
    p_limit: limit,
    p_window_seconds: seconds
  });
  if (error) throw error;
  return Boolean(data);
}

export function normalizedPhone(value: unknown) {
  if (typeof value !== 'string') return null;
  const phone = value.trim().replace(/[\s()-]/g, '');
  return /^\+[1-9]\d{7,14}$/.test(phone) ? phone : null;
}

export function normalizedEmail(value: unknown) {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  if (email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}
