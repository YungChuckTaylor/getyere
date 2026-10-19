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
  return error instanceof PushDeliveryError ? error.message : 'Push configuration or network error; inspect server configuration.';
}
