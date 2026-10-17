import { readFile } from 'node:fs/promises';
import path from 'node:path';

const COOKIE_NAME = '__Host-yere-admin-session';

function cookieToken(req) {
  const header = req.headers.cookie || '';
  const part = header.split(';').map((value) => value.trim()).find((value) => value.startsWith(`${COOKIE_NAME}=`));
  if (!part) return '';
  try { return decodeURIComponent(part.slice(COOKIE_NAME.length + 1)); } catch { return ''; }
}

function noAccess(res) {
  res.statusCode = 404;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.end('<!doctype html><html><head><meta name="robots" content="noindex,nofollow"><title>Not found</title></head><body>Not found</body></html>');
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Vary', 'Cookie');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  if (req.method !== 'GET' && req.method !== 'HEAD') return res.status(404).end();
  const token = cookieToken(req);
  if (!token) return noAccess(res);

  try {
    const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
    const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
    if (!url || !anonKey) return noAccess(res);
    const check = await fetch(`${url}/functions/v1/admin-me`, {
      method: 'GET',
      headers: { apikey: anonKey, Authorization: `Bearer ${token}` }
    });
    if (!check.ok) return noAccess(res);

    const htmlPath = path.join(process.cwd(), 'dist', 'index.html');
    let html = await readFile(htmlPath, 'utf8');
    if (!/<meta\s+name=["']robots["']/i.test(html)) {
      html = html.replace(/<\/head>/i, '<meta name="robots" content="noindex,nofollow">\n</head>');
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Security-Policy', "frame-ancestors 'none'");
    if (req.method === 'HEAD') return res.status(200).end();
    return res.status(200).send(html);
  } catch (error) {
    console.error('admin-shell failed:', error);
    return noAccess(res);
  }
}
