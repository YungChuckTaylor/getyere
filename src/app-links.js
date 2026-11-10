// Email links only navigate. Notification action buttons use their separate trusted event path.
export function reminderFromAppLink(rawUrl) {
  try {
    const url = new URL(rawUrl);
    const web = url.protocol === 'https:' && ['getyere.com', 'www.getyere.com'].includes(url.hostname);
    const custom = url.protocol === 'yere:';
    if ((!web && !custom) || url.username || url.password || (web && url.port)) return null;
    let id;
    if (web) {
      if (url.pathname !== '/') return null;
      id = url.searchParams.get('reminder');
    } else if (url.hostname === 'reminder') {
      id = url.searchParams.get('reminder') || decodeURIComponent(url.pathname.slice(1));
    } else if (url.hostname === 'app' && (url.pathname === '' || url.pathname === '/')) {
      id = url.searchParams.get('reminder');
    } else return null;
    if (!id || id.length > 160 || !/^[a-zA-Z0-9_-]+$/.test(id)) return null;
    return { reminderId: id, action: 'view', ownerId: url.searchParams.get('ownerId') || '' };
  } catch { return null; }
}
