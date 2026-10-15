const COOKIE_NAME = '__Host-yere-admin-session';
const ALLOWED_FUNCTIONS = new Set([
  'admin-me', 'admin-overview', 'admin-users-list', 'admin-user-detail',
  'admin-reminders-list', 'admin-reminder-detail', 'admin-audit-list', 'admin-notification-list',
  'admin-admin-list', 'admin-admin-invite', 'admin-admin-role-update', 'admin-admin-session-revoke',
  'admin-user-action', 'admin-reminder-action', 'admin-support-list', 'admin-support-update',
  'admin-settings'
]);

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

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Vary', 'Cookie, Origin');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  const functionName = typeof req.query?.function === 'string' ? req.query.function : '';
  if (!ALLOWED_FUNCTIONS.has(functionName)) return res.status(404).json({ error: 'Not found.' });
  if (!['GET', 'POST'].includes(req.method || '')) return res.status(405).json({ error: 'Method not allowed.' });
  if (req.method === 'POST' && !sameOrigin(req)) return res.status(403).json({ error: 'Request origin not allowed.' });
  const token = cookieToken(req);
  if (!token) return res.status(404).json({ error: 'Not found.' });

  try {
    const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
    const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
    if (!url || !anonKey) return res.status(500).json({ error: 'Admin API is not configured.' });
    const headers = { apikey: anonKey, Authorization: `Bearer ${token}` };
    let body;
    if (req.method === 'POST') {
      body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
      if (Buffer.byteLength(body, 'utf8') > 12000) return res.status(413).json({ error: 'Request is too large.' });
      headers['Content-Type'] = 'application/json';
    }
    const response = await fetch(`${url}/functions/v1/${functionName}`, { method: req.method, headers, ...(body ? { body } : {}) });
    const text = await response.text();
    res.statusCode = response.status;
    res.setHeader('Content-Type', response.headers.get('content-type') || 'application/json; charset=utf-8');
    return res.end(text);
  } catch (error) {
    console.error('admin-proxy failed:', error);
    return res.status(502).json({ error: 'Admin service is temporarily unavailable.' });
  }
}
