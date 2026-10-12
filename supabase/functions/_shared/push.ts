import webpush from 'npm:web-push@3.6.7';

export type PushRow = {
  id?: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

let vapidReady = false;
function prepareVapid() {
  if (vapidReady) return true;
  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY');
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY');
  const subject = Deno.env.get('VAPID_SUBJECT') || 'mailto:hello@getyere.app';
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidReady = true;
  return true;
}

export async function sendWebPush(subscription: PushRow, payload: Record<string, unknown>) {
  if (!prepareVapid()) throw new Error('Web Push VAPID keys are not configured.');
  const serialized = JSON.stringify(payload);
  await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, serialized);
}
