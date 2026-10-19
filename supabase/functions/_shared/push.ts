import webpush from 'npm:web-push@3.6.7';
import { PushDeliveryError, fcmErrorCode } from './push-errors.js';

export type PushRow = {
  id?: string;
  endpoint?: string | null;
  p256dh?: string | null;
  auth?: string | null;
  device_token?: string | null;
  platform?: 'web' | 'android' | 'ios' | string | null;
  provider?: 'webpush' | 'fcm' | 'apns' | string | null;
};

const encoder = new TextEncoder();
let vapidReady = false;
let firebaseAccess: { token: string; expiresAt: number } | null = null;
let apnsHttpClient: Deno.HttpClient | null = null;
let apnsAccess: { token: string; expiresAt: number } | null = null;

function required(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

function base64Url(input: Uint8Array | string) {
  const bytes = typeof input === 'string' ? encoder.encode(input) : input;
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function pemBytes(value: string) {
  const normalized = value.replace(/\\n/g, '\n').replace(/-----BEGIN [^-]+-----|-----END [^-]+-----|\s/g, '');
  const binary = atob(normalized);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function signedJwt(
  header: Record<string, unknown>,
  claims: Record<string, unknown>,
  privateKey: string,
  algorithm: RsaHashedImportParams | EcKeyImportParams,
  signAlgorithm: AlgorithmIdentifier | RsaPssParams | EcdsaParams
) {
  const unsigned = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(claims))}`;
  const key = await crypto.subtle.importKey('pkcs8', pemBytes(privateKey), algorithm, false, ['sign']);
  const signature = await crypto.subtle.sign(signAlgorithm, key, encoder.encode(unsigned));
  return `${unsigned}.${base64Url(new Uint8Array(signature))}`;
}

function prepareVapid() {
  if (vapidReady) return true;
  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY');
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY');
  const subject = Deno.env.get('VAPID_SUBJECT') || 'mailto:hello@getyere.com';
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidReady = true;
  return true;
}

export async function sendWebPush(subscription: PushRow, payload: Record<string, unknown>) {
  if (!subscription.endpoint || !subscription.p256dh || !subscription.auth) throw new Error('Web Push subscription is incomplete.');
  if (!prepareVapid()) throw new Error('Web Push VAPID keys are not configured.');
  try {
    await webpush.sendNotification({
      endpoint: subscription.endpoint,
      keys: { p256dh: subscription.p256dh, auth: subscription.auth }
    }, JSON.stringify(payload), { TTL: 3600, timeout: 15000 });
    return { provider: 'webpush', reference: null };
  } catch (error) {
    throw new PushDeliveryError('webpush', 'SEND_FAILED', Number((error as { statusCode?: number }).statusCode || 0));
  }
}

async function firebaseAccessToken() {
  if (firebaseAccess && firebaseAccess.expiresAt > Date.now() + 60_000) return firebaseAccess.token;
  const clientEmail = required('FIREBASE_CLIENT_EMAIL');
  const privateKey = required('FIREBASE_PRIVATE_KEY');
  const now = Math.floor(Date.now() / 1000);
  const assertion = await signedJwt(
    { alg: 'RS256', typ: 'JWT' },
    {
      iss: clientEmail,
      sub: clientEmail,
      aud: 'https://oauth2.googleapis.com/token',
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      iat: now,
      exp: now + 3600
    },
    privateKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    { name: 'RSASSA-PKCS1-v1_5' }
  );
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    signal: AbortSignal.timeout(15000),
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion })
  });
  const body = await response.json();
  if (!response.ok || !body.access_token) throw new PushDeliveryError('fcm', 'OAUTH_FAILED', response.status);
  firebaseAccess = { token: body.access_token, expiresAt: Date.now() + Number(body.expires_in || 3600) * 1000 };
  return firebaseAccess.token;
}

function stringData(payload: Record<string, unknown>) {
  const data: Record<string, string> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (value !== undefined && value !== null) data[key] = typeof value === 'string' ? value : String(value);
  }
  return data;
}

async function sendFcm(subscription: PushRow, payload: Record<string, unknown>) {
  if (!subscription.device_token) throw new Error('FCM device token is missing.');
  const projectId = required('FIREBASE_PROJECT_ID');
  const accessToken = await firebaseAccessToken();
  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/messages:send`, {
    method: 'POST',
    signal: AbortSignal.timeout(15000),
    headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      message: {
        token: subscription.device_token,
        data: stringData(payload),
        android: { priority: 'HIGH', ttl: '3600s' }
      }
    })
  });
  if (!response.ok) {
    const reason = await response.json().catch(() => ({}));
    if (response.status === 401) firebaseAccess = null;
    throw new PushDeliveryError('fcm', fcmErrorCode(reason), response.status);
  }
  const result = await response.json();
  return { provider: 'fcm', reference: result.name || null };
}

async function apnsAccessToken() {
  if (apnsAccess && apnsAccess.expiresAt > Date.now() + 60_000) return apnsAccess.token;
  const now = Math.floor(Date.now() / 1000);
  const token = await signedJwt(
    { alg: 'ES256', kid: required('APNS_KEY_ID') },
    { iss: required('APNS_TEAM_ID'), iat: now },
    required('APNS_PRIVATE_KEY'),
    { name: 'ECDSA', namedCurve: 'P-256' },
    { name: 'ECDSA', hash: 'SHA-256' }
  );
  apnsAccess = { token, expiresAt: Date.now() + 50 * 60 * 1000 };
  return token;
}

async function sendApns(subscription: PushRow, payload: Record<string, unknown>) {
  if (!subscription.device_token) throw new Error('APNs device token is missing.');
  const token = await apnsAccessToken();
  const sandbox = /^true$/i.test(Deno.env.get('APNS_USE_SANDBOX') || '');
  const host = sandbox ? 'https://api.sandbox.push.apple.com' : 'https://api.push.apple.com';
  // APNs is HTTP/2-only; do not depend on the runtime's default HTTP/1 client.
  apnsHttpClient ||= Deno.createHttpClient({ http2: true });
  const { title, body, ...data } = payload;
  const response = await fetch(`${host}/3/device/${encodeURIComponent(subscription.device_token)}`, {
    method: 'POST',
    signal: AbortSignal.timeout(15000),
    client: apnsHttpClient,
    headers: {
      authorization: `bearer ${token}`,
      'apns-topic': Deno.env.get('APNS_BUNDLE_ID') || 'com.getyere.app',
      'apns-push-type': 'alert',
      'apns-priority': '10',
      'apns-expiration': String(Math.floor(Date.now() / 1000) + 3600),
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      aps: {
        alert: {
          title: String(title || 'A reminder from Yere'),
          body: String(body || 'It is time for a reminder you wanted to keep.')
        },
        sound: 'default',
        category: payload.reminderId ? 'YERE_REMINDER' : undefined,
        'thread-id': payload.reminderId ? `yere-${payload.reminderId}` : 'yere-reminders'
      },
      ...data
    })
  });
  if (!response.ok) {
    const reason = await response.json().catch(() => ({}));
    if (reason.reason === 'ExpiredProviderToken') apnsAccess = null;
    throw new PushDeliveryError('apns', reason.reason || 'PROVIDER_ERROR', response.status);
  }
  return { provider: 'apns', reference: response.headers.get('apns-id') };
}

/** Send through the transport represented by a push_subscriptions row. */
export async function sendPush(subscription: PushRow, payload: Record<string, unknown>) {
  // Long reminder notes must not exceed the providers' 4 KB payload limit.
  payload = { ...payload,
    title: Array.from(String(payload.title || 'A reminder from Yere')).slice(0, 120).join(''),
    body: Array.from(String(payload.body || 'It is time for a reminder you wanted to keep.')).slice(0, 240).join('')
  };
  if (subscription.provider === 'fcm' || (subscription.platform === 'android' && subscription.device_token)) {
    return sendFcm(subscription, payload);
  }
  if (subscription.provider === 'apns' || (subscription.platform === 'ios' && subscription.device_token)) {
    return sendApns(subscription, payload);
  }
  return sendWebPush(subscription, payload);
}
