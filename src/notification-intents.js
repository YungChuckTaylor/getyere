/** A notification may arrive before auth/cloud restoration. Never act on a timer. */
export function normalizeNotification(notification = {}, actionId = 'tap') {
  if (actionId === 'dismiss') return null;
  const data = notification.data || {};
  const action = /snooze/i.test(actionId) ? 'snooze' : /done|complete/i.test(actionId) ? 'done' : 'view';
  return {
    actionId, action, direct: action !== 'view',
    reminderId: data.reminderId || data.reminder_id || '',
    ownerId: data.ownerId || '', dueAt: data.dueAt || '',
    eventId: data.tag || notification.id || '',
    minutes: action === 'snooze' ? Number(data.minutes || 10) : 0,
    title: notification.title || data.title || '', body: notification.body || data.body || '', url: data.url || ''
  };
}

export function createNotificationIntentQueue({ getContext, execute, now = Date.now }) {
  const pending = [], seen = new Map();
  let running = false;
  const keyFor = intent => [intent.reminderId, intent.action || 'view', (intent.dueAt && Number.isFinite(Date.parse(intent.dueAt)) ? Date.parse(intent.dueAt) : intent.eventId || ''), intent.minutes || 0].join('|');
  return {
    enqueue(intent) {
      if (!intent?.reminderId || intent.actionId === 'dismiss') return false;
      const key = keyFor(intent), context = getContext();
      for (const [old, at] of seen) if (now() > at) seen.delete(old);
      if (seen.has(key) || pending.some(item => item.key === key)) return false;
      if (pending.length >= 20) pending.shift();
      pending.push({ key, intent: { ...intent, ownerId: intent.ownerId || context.userId || '' }, at: now() });
      return true;
    },
    flush() {
      if (running) return;
      const context = getContext();
      if (!context.ready || !context.userId) return;
      running = true;
      try {
        for (const item of [...pending]) {
          if (now() - item.at > 86400000 || (item.intent.ownerId && item.intent.ownerId !== context.userId)) {
            pending.splice(pending.indexOf(item), 1); continue;
          }
          // false means data/network is not ready yet; retain until the next refresh.
          if (execute(item.intent) === false) continue;
          seen.set(item.key, now() + (item.intent.action === 'view' ? 1000 : 86400000));
          pending.splice(pending.indexOf(item), 1);
        }
      } finally { running = false; }
    },
    clear() { pending.length = 0; seen.clear(); },
    get size() { return pending.length; }
  };
}
