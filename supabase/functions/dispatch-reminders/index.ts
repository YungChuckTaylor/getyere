import { adminClient, env, escapeHtml, jsonResponse, safeAppOrigin } from '../_shared/http.ts';
import { sendYereEmail } from '../_shared/email.ts';
import { sendPush } from '../_shared/push.ts';
import { isRetiredSubscription, safePushError } from '../_shared/push-errors.js';

function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405);
  try {
    if (!constantTimeEqual(env('YERE_CRON_SECRET'), req.headers.get('x-yere-cron-secret') || '')) return jsonResponse({ error: 'Unauthorized.' }, 401);
    const admin = adminClient();
    // SQL atomically claims only due/retryable rows, preventing overlapping cron workers.
    const { data: fires, error } = await admin.rpc('claim_due_reminder_fires', { p_limit: 10 });
    if (error) throw error;
    const appOrigin = safeAppOrigin();
    let accepted = 0, failed = 0, skipped = 0;
    for (const fire of fires || []) {
      const deliveryState: Record<string, boolean> = { ...fire.delivery_state };
      // Every checkpoint is fenced by the lease. A stale worker cannot overwrite a newer attempt.
      const checkpoint = async (changes: Record<string, unknown>) => {
        const { data, error } = await admin.from('reminder_fires').update({ delivery_state: deliveryState, ...changes })
          .eq('id', fire.id).eq('lease_id', fire.lease_id).gt('lease_until', new Date().toISOString()).select('id');
        if (error || !data?.length) throw new Error('Delivery lease/checkpoint unavailable.');
      };
      try {
        const { data: reminder, error: reminderError } = await admin.from('reminders').select('id,owner_id,title,notes,due_at,delivery_channel,is_completed,approval_status').eq('id', fire.reminder_id).maybeSingle();
        if (reminderError) throw reminderError;
        if (!reminder || reminder.is_completed || reminder.approval_status !== 'approved' || reminder.delivery_channel === 'none'
          || new Date(reminder.due_at).getTime() !== new Date(fire.due_at).getTime()) {
          await checkpoint({ delivery_status: 'skipped', next_attempt_at: null, lease_id: null, lease_until: null });
          skipped++; continue;
        }
        const { data: profile, error: profileError } = await admin.from('profiles').select('settings').eq('id', reminder.owner_id).maybeSingle();
        if (profileError) throw profileError;
        const wantsPush = ['push', 'both'].includes(reminder.delivery_channel);
        const wantsEmail = ['email', 'both'].includes(reminder.delivery_channel)
          || (reminder.delivery_channel === 'push' && profile?.settings?.emailReminders === true);
        const errors: string[] = [];
        const logs: Record<string, unknown>[] = [];
        let pushSent = Object.entries(deliveryState).some(([key, value]) => key.startsWith('push:') && value), emailSent = Boolean(deliveryState.email);
        if (wantsPush) {
          const pushErrors: string[] = [];
          const { data: subscriptions, error: subsError } = await admin.from('push_subscriptions')
            .select('id,endpoint,p256dh,auth,device_token,platform,provider').eq('owner_id', reminder.owner_id);
          if (subsError) throw subsError;
          if (!subscriptions?.length) pushErrors.push('No active push subscription.');
          for (const subscription of subscriptions || []) {
            const key = `push:${subscription.id}`;
            if (deliveryState[key]) { pushSent = true; continue; }
            // Revalidate ownership/existence immediately before sending (logout/account switch).
            const { data: current, error: currentError } = await admin.from('push_subscriptions').select('id')
              .eq('id', subscription.id).eq('owner_id', reminder.owner_id).maybeSingle();
            if (currentError) throw currentError;
            if (!current) continue;
            const payload = { title: `Yere · ${reminder.title}`, body: reminder.notes || 'A reminder you wanted to keep is due now.',
              reminderId: reminder.id, ownerId: reminder.owner_id, dueAt: reminder.due_at,
              url: `/?reminder=${encodeURIComponent(reminder.id)}`, tag: `yere-${reminder.id}-${new Date(reminder.due_at).getTime()}` };
            await checkpoint({ lease_until: new Date(Date.now() + 300000).toISOString() });
            try {
              await sendPush(subscription, payload);
            } catch (error) {
              pushErrors.push(`${subscription.platform || 'web'}/${subscription.provider || 'webpush'}: ${safePushError(error)}`);
              if (isRetiredSubscription(error)) {
                const { error: deleteError } = await admin.from('push_subscriptions').delete().eq('id', subscription.id).eq('owner_id', reminder.owner_id);
                if (deleteError) throw deleteError;
              }
              continue;
            }
            deliveryState[key] = true; pushSent = true;
            // Persist each accepted target immediately; retry only targets not already accepted.
            await checkpoint({});
          }
          if (!pushSent && !pushErrors.length) pushErrors.push('No active push subscription.');
          errors.push(...pushErrors);
          logs.push({ channel: 'push', status: pushSent ? (pushErrors.length ? 'partial' : 'sent') : 'failed', error_message: pushErrors.join(' | ').slice(0,2000) || null });
        }
        if (wantsEmail && !emailSent) {
          try {
            const { data: authUser, error: userError } = await admin.auth.admin.getUserById(reminder.owner_id);
            if (userError || !authUser?.user?.email) throw new Error('No email address.');
            const url = `${appOrigin}/?reminder=${encodeURIComponent(reminder.id)}`;
            await checkpoint({ lease_until: new Date(Date.now() + 300000).toISOString() });
            const response = await sendYereEmail(authUser.user.email, `Yere reminder: ${reminder.title}`,
              `<div style="font-family:Arial,sans-serif;padding:28px"><h1>${escapeHtml(reminder.title)}</h1><p>${escapeHtml(reminder.notes || 'A reminder you wanted to keep is due now.')}</p><a href="${url}">Open Yere</a></div>`,
              `${reminder.title}\n${reminder.notes || ''}\nOpen Yere: ${url}`, `yere-reminder-${fire.id}`);
            deliveryState.email = true; emailSent = true;
            // Only non-sensitive provider IDs are logged, never provider response bodies or tokens.
            logs.push({ channel: 'email', status: 'sent', provider_reference: typeof response?.id === 'string' ? response.id.slice(0,300) : null });
          } catch {
            errors.push('Email: provider/configuration failure.');
            logs.push({ channel: 'email', status: 'failed', error_message: 'Email: provider/configuration failure.' });
          }
          await checkpoint({});
        }
        const anyAccepted = pushSent || emailSent;
        const status = errors.length ? (anyAccepted ? 'partial' : 'failed') : 'sent';
        if (logs.length) {
          const { error: logError } = await admin.from('notification_logs').insert(logs.map(log => ({
            ...log, reminder_fire_id: fire.id, reminder_id: reminder.id, user_id: reminder.owner_id, attempt: fire.attempt_count
          })));
          if (logError) throw logError;
        }
        const retryAt = errors.length && fire.attempt_count < 3 ? new Date(Date.now() + (fire.attempt_count === 1 ? 60000 : 300000)).toISOString() : null;
        await checkpoint({ delivery_status: status, error_message: errors.join(' | ').slice(0,1000) || null,
          next_attempt_at: retryAt, lease_id: null, lease_until: null, fired_at: new Date().toISOString() });
        if (anyAccepted) accepted++; else failed++;
      } catch {
        // Leave this lease to expire. Checkpointed successes survive a timeout/worker crash.
        console.error('dispatch-reminders: attempt interrupted; bounded lease recovery will retry.');
        failed++;
      }
    }
    return jsonResponse({ ok: true, checked: fires?.length || 0, accepted, failed, skipped, deliveryVerified: false });
  } catch {
    console.error('dispatch-reminders: configuration or claim failure.');
    return jsonResponse({ error: 'Reminder dispatch unavailable. Check server configuration and notification migrations.' }, 500);
  }
});
