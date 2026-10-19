const COOKIE_NAME = '__Host-yere-admin-session';
const COOKIE_OPTIONS = 'Path=/; HttpOnly; Secure; SameSite=Strict';

function supabaseConfig() {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
  if (!url || !anonKey) throw new Error('Admin session service is not configured.');
  return { url, anonKey };
}

function cookieToken(req) {
  const header = req.headers.cookie || '';
  const part = header.split(';').map((value) => value.trim()).find((value) => value.startsWith(`${COOKIE_NAME}=`));
  if (!part) return '';
  try { return decodeURIComponent(part.slice(COOKIE_NAME.length + 1)); } catch { return ''; }
}

function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return false;
  const allowed = new Set(['https://getyere.com', 'https://www.getyere.com']);
  if (process.env.VERCEL_URL) allowed.add(`https://${process.env.VERCEL_URL}`);
  if (process.env.VERCEL_ENV !== 'production') {
    allowed.add('http://localhost:5173');
    allowed.add('http://127.0.0.1:5173');
  }
  return allowed.has(origin);
}

async function callEdge(functionName, token, body, extraHeaders = {}) {
  const { url, anonKey } = supabaseConfig();
  const method = functionName === 'admin-me' ? 'GET' : 'POST';
  const response = await fetch(`${url}/functions/v1/${functionName}`, {
    method,
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
      ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
      ...extraHeaders
    },
    ...(method === 'POST' ? { body: JSON.stringify(body || {}) } : {})
  });
  const text = await response.text();
  let payload;
  try { payload = text ? JSON.parse(text) : {}; } catch { payload = { error: 'Admin session request failed.' }; }
  return { response, payload };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Vary', 'Cookie, Origin');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  if (!['GET', 'POST', 'DELETE'].includes(req.method || '')) return res.status(405).json({ error: 'Method not allowed.' });
  if (req.method !== 'GET' && !sameOrigin(req)) return res.status(403).json({ error: 'Request origin not allowed.' });

  const cookie = cookieToken(req);
  try {
    if (req.method === 'POST') {
      const token = typeof req.body?.accessToken === 'string' ? req.body.accessToken : '';
      if (token.length < 100 || token.length > 5000 || !token.includes('.')) return res.status(400).json({ error: 'A valid sign-in session is required.' });
      const forwardedFor = req.headers['x-forwarded-for'] || '';
      const headers = {
        'x-forwarded-for': String(forwardedFor).slice(0, 500),
        'user-agent': String(req.headers['user-agent'] || '').slice(0, 512)
      };
      if (cookie && cookie !== token) headers['x-yere-previous-admin-token'] = cookie;
      const { response, payload } = await callEdge('admin-session-create', token, {}, headers);
      if (!response.ok) return res.status(response.status).json(payload);
      res.setHeader('Set-Cookie', `${COOKIE_NAME}=${encodeURIComponent(token)}; ${COOKIE_OPTIONS}; Max-Age=3600`);
      return res.status(200).json(payload);
    }

    if (!cookie) {
      res.setHeader('Set-Cookie', `${COOKIE_NAME}=; ${COOKIE_OPTIONS}; Max-Age=0`);
      return res.status(404).json({ error: 'Not found.' });
    }
    if (req.method === 'DELETE') {
      const { response, payload } = await callEdge('admin-session-revoke', cookie, {}, {
        'x-forwarded-for': String(req.headers['x-forwarded-for'] || '').slice(0, 500),
        'user-agent': String(req.headers['user-agent'] || '').slice(0, 512)
      });
      res.setHeader('Set-Cookie', `${COOKIE_NAME}=; ${COOKIE_OPTIONS}; Max-Age=0`);
      return res.status(response.ok ? 200 : response.status).json(response.ok ? { ok: true } : payload);
    }
    const { response, payload } = await callEdge('admin-me', cookie, {});
    return res.status(response.status).json(payload);
  } catch (error) {
    console.error('admin-session API failed:', error);
    return res.status(500).json({ error: 'Admin session service is unavailable.' });
  }
}
