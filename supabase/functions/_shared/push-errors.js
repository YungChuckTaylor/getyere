/** Only explicit, transport-specific retirement codes may delete a subscription. */
export class PushDeliveryError extends Error {
  constructor(provider, code, status = 0) {
    super(`${provider}: ${code} (${status || 'configuration/network'}).`);
    this.name = 'PushDeliveryError';
    this.provider = provider;
    this.code = code;
    this.status = status;
    this.invalidSubscription = (provider === 'webpush' && [404, 410].includes(status))
      || (provider === 'fcm' && status === 404 && code === 'UNREGISTERED')
      || (provider === 'apns' && status === 410 && code === 'Unregistered');
  }
}

export function isRetiredSubscription(error) {
  return error instanceof PushDeliveryError && error.invalidSubscription === true;
}

export function fcmErrorCode(body) {
  return body?.error?.details?.find(detail => detail['@type'] === 'type.googleapis.com/google.firebase.fcm.v1.FcmError')?.errorCode
    || body?.error?.status || 'PROVIDER_ERROR';
}

export function safePushError(error) {
  if (!(error instanceof PushDeliveryError)) return 'Push configuration or network error; inspect server configuration.';
  const label = error.provider === 'apns' ? 'iOS' : error.provider === 'fcm' ? 'Android' : 'Browser';
  if (error.code === 'CONFIGURATION_MISSING') return `${label} notifications are not configured on the Yere server. Contact Yere support; changing phone permission will not fix this.`;
  if (error.code === 'CREDENTIALS_INVALID') return `${label} notification server credentials could not be used. Contact Yere support; your device permission is separate.`;
  if (error.code === 'TRANSPORT_UNAVAILABLE') return `${label} notification transport is unavailable on the Yere server. Contact Yere support.`;
  return error.message;
}

export function pushFailureDetails(error) {
  const typed = error instanceof PushDeliveryError;
  const code = typed && /^[a-z]+$/.test(error.provider) && /^[A-Za-z_0-9]{1,64}$/.test(error.code) ? `${error.provider.toUpperCase()}_${error.code}` : 'PUSH_SERVICE_ERROR';
  return { error: safePushError(error), code, retryable: !typed || error.status === 429 || error.status >= 500,
    registrationExpired: isRetiredSubscription(error) };
}
