import { adminClient, authenticatedUser, jsonResponse, preflight, readJson, consumeRateLimit } from '../_shared/http.ts';
import { sendPush } from '../_shared/push.ts';
import { isRetiredSubscription, safePushError } from '../_shared/push-errors.js';

Deno.serve(async (req) => {
  const options = preflight(req);
  if (options) return options;
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405);
  try {
    const { user, error: authError } = await authenticatedUser(req);
    if (authError || !user) return jsonResponse({ error: 'Sign in to test notifications.' }, 401);
    const body = await readJson(req, 8000);
    if (!body || !['android', 'ios', 'web'].includes(body.platform)
      || (body.platform === 'web' ? typeof body.endpoint !== 'string' || !body.endpoint : typeof body.deviceToken !== 'string' || !body.deviceToken)) {
      return jsonResponse({ error: 'Select this device’s push registration. Enable push here, then try again.' }, 400);
    }
    const admin = adminClient();
    if (!await consumeRateLimit(admin, user.id, 'test-notification', 5, 60)) return jsonResponse({ error: 'Please wait a minute before testing again.' }, 429);
    let query = admin.from('push_subscriptions').select('id,endpoint,p256dh,auth,device_token,platform,provider').eq('owner_id', user.id).eq('platform', body.platform);
    query = body.platform === 'web' ? query.eq('endpoint', body.endpoint) : query.eq('device_token', body.deviceToken);
    const { data: subscriptions, error } = await query;
    if (error) throw error;
    if (!subscriptions?.length) return jsonResponse({ error: 'No push registration exists for this device/account. Turn push on here first.' }, 409);
    const subscription = subscriptions[0];
    const payload = { title: 'Yere · Notification test', body: 'If you can see this notification, this device received the test.', url: '/', tag: `yere-test-${Date.now()}` };
    try {
      const receipt = await sendPush(subscription, payload);
      return jsonResponse({ ok: true, accepted: true, platform: subscription.platform, provider: receipt?.provider || subscription.provider, providerReference: receipt?.reference || null,
        deliveryVerified: false, message: 'The push provider accepted this device’s test. Confirm it appeared on the phone.' });
    } catch (error) {
      if (isRetiredSubscription(error)) await admin.from('push_subscriptions').delete().eq('id', subscription.id).eq('owner_id', user.id);
      return jsonResponse({ error: safePushError(error), accepted: false, platform: subscription.platform, provider: subscription.provider }, 502);
    }
  } catch {
    return jsonResponse({ error: 'Notification test failed. Check the request and server configuration.' }, 400);
  }
});
