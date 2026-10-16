import { adminClient, authenticatedUser, jsonResponse, preflight } from '../_shared/http.ts';
import { sendPush } from '../_shared/push.ts';

Deno.serve(async (req) => {
  const options = preflight(req);
  if (options) return options;
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405);
  try {
    const { user, error: authError } = await authenticatedUser(req);
    if (authError || !user) return jsonResponse({ error: 'Sign in to test notifications.' }, 401);
    const admin = adminClient();
    const { data: subscriptions, error } = await admin.from('push_subscriptions').select('id,endpoint,p256dh,auth,device_token,platform,provider').eq('owner_id', user.id);
    if (error) throw error;
    if (!subscriptions?.length) return jsonResponse({ error: 'No push subscription is registered on this device. Turn on push from Yere settings first.' }, 409);
    const payload = { title: 'Yere · It works!', body: 'Your reminders can reach you on this device.', url: '/', tag: `yere-test-${Date.now()}` };
    const results = await Promise.allSettled(subscriptions.map((subscription) => sendPush(subscription, payload)));
    const failed = results.map((result, index) => ({ result, subscription: subscriptions[index] })).filter(({ result }) => result.status === 'rejected');
    for (const { result, subscription } of failed) {
      const message = result.status === 'rejected' ? String(result.reason?.message || result.reason) : '';
      if (/410|404|expired|unregistered|baddevicetoken|device token.*inactive/i.test(message)) await admin.from('push_subscriptions').delete().eq('id', subscription.id);
    }
    if (failed.length === subscriptions.length) return jsonResponse({ error: 'The push service could not deliver to this device. Check VAPID, FCM, or APNs configuration in the function logs.' }, 502);
    return jsonResponse({ ok: true, delivered: subscriptions.length - failed.length });
  } catch (error) {
    console.error('test-notification:', error);
    return jsonResponse({ error: error instanceof Error ? error.message : 'Test notification failed.' }, 400);
  }
});
