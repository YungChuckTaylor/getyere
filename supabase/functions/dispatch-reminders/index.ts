import { adminClient, env, escapeHtml, jsonResponse, safeAppOrigin } from '../_shared/http.ts';
import { sendYereEmail } from '../_shared/email.ts';
import { sendWebPush } from '../_shared/push.ts';

function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405);
  try {
    const expected = env('YERE_CRON_SECRET');
    const supplied = req.headers.get('x-yere-cron-secret') || '';
    if (!constantTimeEqual(expected, supplied)) return jsonResponse({ error: 'Unauthorized.' }, 401);

    const admin = adminClient();
    const now = new Date();
    const windowStart = new Date(now.getTime() - 2 * 60 * 1000);
    const { data: reminders, error } = await admin.from('reminders')
      .select('id,owner_id,title,notes,due_at,delivery_channel,from_contact_id')
      .eq('is_completed', false)
      .eq('approval_status', 'approved')
      .neq('delivery_channel', 'none')
      .gte('due_at', windowStart.toISOString())
      .lte('due_at', now.toISOString())
      .limit(250);
    if (error) throw error;
    const ownerIds=[...new Set((reminders||[]).map(reminder=>reminder.owner_id))];
    const { data: profiles, error: profileError } = ownerIds.length
      ? await admin.from('profiles').select('id,settings').in('id',ownerIds)
      : { data: [], error: null };
    if (profileError) throw profileError;
    const profileByOwner=new Map((profiles||[]).map(profile=>[profile.id,profile]));
    const appOrigin=safeAppOrigin();

    let checked = 0, delivered = 0, skipped = 0;
    for (const reminder of reminders || []) {
      checked++;
      const { data: fire, error: fireError } = await admin.from('reminder_fires').upsert({
        reminder_id: reminder.id, owner_id: reminder.owner_id, due_at: reminder.due_at,
        channel: reminder.delivery_channel, delivery_status: 'queued'
      }, { onConflict: 'reminder_id,due_at', ignoreDuplicates: true }).select('id').maybeSingle();
      if (fireError) throw fireError;
      if (!fire?.id) { skipped++; continue; }

      let pushSent = false, emailSent = false;
      const errors: string[] = [];
      const notificationAttempts: Array<{
        channel: 'push' | 'email';
        status: 'sent' | 'partial' | 'failed';
        providerReference: string | null;
        errorMessage: string | null;
      }> = [];
      const wantsPush = reminder.delivery_channel === 'push' || reminder.delivery_channel === 'both';
      const wantsEmail = reminder.delivery_channel === 'email' || reminder.delivery_channel === 'both'
        || (reminder.delivery_channel === 'push' && profileByOwner.get(reminder.owner_id)?.settings?.emailReminders === true);

      if (wantsPush) {
        const pushErrors: string[] = [];
        const { data: subscriptions, error: subsError } = await admin.from('push_subscriptions').select('id,endpoint,p256dh,auth').eq('owner_id', reminder.owner_id);
        if (subsError) pushErrors.push(subsError.message);
        else if (subscriptions?.length) {
          const payload = {
            title: `Yere · ${reminder.title}`,
            body: reminder.notes || 'A reminder you wanted to keep is due now.',
            reminderId: reminder.id,
            dueAt: reminder.due_at,
            url: `/?reminder=${encodeURIComponent(reminder.id)}`,
            tag: `yere-${reminder.id}-${reminder.due_at}`
          };
          const results = await Promise.allSettled(subscriptions.map((subscription) => sendWebPush(subscription, payload)));
          pushSent = results.some((result) => result.status === 'fulfilled');
          for (let i = 0; i < results.length; i++) {
            const result = results[i];
            if (result.status === 'rejected') {
              const message = String(result.reason?.message || result.reason).slice(0, 160);
              pushErrors.push(message);
              if (/410|404|expired/i.test(message)) await admin.from('push_subscriptions').delete().eq('id', subscriptions[i].id);
            }
          }
        } else pushErrors.push('No active push subscription.');
        errors.push(...pushErrors.map((message) => `Push: ${message}`));
        notificationAttempts.push({
          channel: 'push',
          status: pushSent ? (pushErrors.length ? 'partial' : 'sent') : 'failed',
          providerReference: null,
          errorMessage: pushErrors.length ? pushErrors.join(' | ').slice(0, 2000) : null
        });
      }

      if (wantsEmail) {
        const emailErrors: string[] = [];
        let providerReference: string | null = null;
        const { data: authUser, error: userError } = await admin.auth.admin.getUserById(reminder.owner_id);
        const email = authUser?.user?.email;
        if (userError || !email) emailErrors.push('The account has no deliverable email address.');
        else {
          try {
            const title = escapeHtml(reminder.title);
            const why = escapeHtml(reminder.notes || 'It is time for a reminder you wanted to keep.');
            const url = `${appOrigin}/?reminder=${encodeURIComponent(reminder.id)}`;
            const providerResponse = await sendYereEmail(email, `Yere reminder: ${reminder.title}`,
              `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:28px;color:#1a2033"><p style="color:#4f46e5;font-weight:bold">YERE REMINDER</p><h1>${title}</h1><p>${why}</p><p><a href="${url}" style="color:#4f46e5">Open Yere</a></p></div>`,
              `${reminder.title}\n${reminder.notes || 'It is time for a reminder you wanted to keep.'}\nOpen Yere: ${url}`);
            providerReference = typeof providerResponse?.id === 'string' ? providerResponse.id.slice(0, 300) : null;
            emailSent = true;
          } catch (emailError) {
            emailErrors.push(String(emailError instanceof Error ? emailError.message : emailError).slice(0, 160));
          }
        }
        errors.push(...emailErrors.map((message) => `Email: ${message}`));
        notificationAttempts.push({
          channel: 'email',
          status: emailSent ? (emailErrors.length ? 'partial' : 'sent') : 'failed',
          providerReference,
          errorMessage: emailErrors.length ? emailErrors.join(' | ').slice(0, 2000) : null
        });
      }

      const sent = pushSent || emailSent;
      const status = sent ? (errors.length ? 'partial' : 'sent') : 'failed';
      const { error: updateError } = await admin.from('reminder_fires').update({
        fired_at: new Date().toISOString(), delivery_status: status,
        error_message: errors.length ? errors.join(' | ').slice(0, 1000) : null
      }).eq('id', fire.id);
      if (updateError) throw updateError;
      const { error: logError } = await admin.from('notification_logs').insert(notificationAttempts.map((attempt) => ({
        reminder_fire_id: fire.id,
        reminder_id: reminder.id,
        user_id: reminder.owner_id,
        channel: attempt.channel,
        status: attempt.status,
        attempt: 1,
        provider_reference: attempt.providerReference,
        error_message: attempt.errorMessage
      })));
      if (logError) throw logError;
      if (sent) delivered++;
    }
    return jsonResponse({ ok: true, checked, delivered, skipped });
  } catch (error) {
    console.error('dispatch-reminders:', error);
    return jsonResponse({ error: error instanceof Error ? error.message : 'Reminder dispatch failed.' }, 500);
  }
});
