const CACHE_PREFIX = 'yere-shell-';
const CACHE_NAME = `${CACHE_PREFIX}v1`;
const APP_URL = new URL(self.registration.scope);

async function precacheShell() {
  const cache = await caches.open(CACHE_NAME);
  const response = await fetch(APP_URL.href, { cache: 'reload' });
  if (!response.ok) throw new Error('Unable to cache the Yere app shell.');
  const html = await response.clone().text();
  await cache.put(APP_URL.href, response);

  const assets = new Set([
    new URL('manifest.webmanifest', APP_URL).href,
    new URL('yere-mark.svg', APP_URL).href,
    new URL('icons/icon-192.png', APP_URL).href,
    new URL('icons/icon-512.png', APP_URL).href,
    new URL('icons/icon-maskable-512.png', APP_URL).href
  ]);
  for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
    try {
      const asset = new URL(match[1], APP_URL);
      if (asset.origin === APP_URL.origin && asset.pathname.startsWith('/assets/')) assets.add(asset.href);
    } catch { /* Ignore non-URL HTML attributes. */ }
  }
  await Promise.allSettled([...assets].map((asset) => cache.add(asset)));
}

self.addEventListener('install', (event) => {
  event.waitUntil(precacheShell().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== APP_URL.origin || url.pathname.endsWith('/sw.js')) return;
  // Never serve a cached public shell for the protected server-guarded admin routes.
  if (url.pathname === '/admin' || url.pathname.startsWith('/admin/') || url.pathname === '/admin-access' || url.pathname.startsWith('/admin-api/')) return;

  // Public legal documents must never fall back to the signed-in app shell.
  // Let the browser navigate normally (including showing an honest offline error).
  if (['/privacy-policy', '/termsofuse', '/privacy.html', '/terms.html'].includes(url.pathname.replace(/\/$/, ''))) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok && url.pathname === APP_URL.pathname) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(APP_URL.href, response.clone());
        }
        return response;
      } catch {
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match(APP_URL.href)) || Response.error();
      }
    })());
    return;
  }

  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/') || url.pathname.endsWith('.svg') || url.pathname.endsWith('.webmanifest')) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      } catch {
        return Response.error();
      }
    })());
  }
});

self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; }
  catch { payload = { body: event.data ? event.data.text() : '' }; }
  const reminderId = payload.reminderId || payload.id || '';
  event.waitUntil(self.registration.showNotification(payload.title || 'A reminder from Yere', {
    body: payload.body || 'It is time for a reminder you wanted to keep.',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: payload.tag || `yere-${reminderId || Date.now()}`,
    renotify: false,
    requireInteraction: true,
    data: { reminderId, url: payload.url || '/', dueAt: payload.dueAt || null },
    actions: [
      { action: 'snooze-10m', title: 'Snooze 10 min' },
      { action: 'snooze-1h', title: 'Snooze 1 hour' }
    ]
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const target = new URL(data.url || '/', APP_URL);
  if (data.reminderId) target.searchParams.set('reminder', data.reminderId);
  if (event.action === 'snooze-10m' || event.action === 'snooze-1h') {
    target.searchParams.set('notificationAction', 'snooze');
    target.searchParams.set('minutes', event.action === 'snooze-10m' ? '10' : '60');
  }
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find((client) => new URL(client.url).origin === APP_URL.origin);
    if (existing && 'focus' in existing) {
      await existing.focus();
      if (event.action) existing.postMessage({
        type: 'YERE_NOTIFICATION_ACTION',
        action: 'snooze',
        reminderId: data.reminderId,
        minutes: event.action === 'snooze-10m' ? 10 : 60
      });
      else existing.navigate(target.href);
      return;
    }
    await self.clients.openWindow(target.href);
  })());
});
