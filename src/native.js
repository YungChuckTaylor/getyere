import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Network } from '@capacitor/network';
import { Preferences } from '@capacitor/preferences';
import { PushNotifications } from '@capacitor/push-notifications';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SpeechRecognition } from '@capgo/capacitor-speech-recognition';
import { CapacitorSupabase } from '@capgo/capacitor-supabase';
import { createSpeechController } from './speech.js';

const enabled = Capacitor.isNativePlatform();
const platform = Capacitor.getPlatform();
if (enabled) document.documentElement.classList.add('native-app', `native-${platform}`);
const CACHE_PATH = 'yere/offline-v1.json';
const PUSH_TOKEN_KEY = 'yere.native.push-token';

let webClient = null;
let offlineCache = {};
let cacheWrite = Promise.resolve();
let pushToken = '';
let pushWaiters = [];
let authSyncing = false;
let lastNativeAccessToken = '';
let listenersInstalled = false;

function emit(name, detail = {}) {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

function asText(value) {
  return typeof value === 'string' ? value : '';
}

function nativeUserToWeb(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    created_at: user.createdAt,
    last_sign_in_at: user.lastSignInAt,
    user_metadata: user.userMetadata || {},
    app_metadata: user.appMetadata || {},
    aud: 'authenticated',
    role: 'authenticated'
  };
}

function nativeSessionToWeb(session) {
  if (!session) return null;
  return {
    access_token: session.accessToken,
    refresh_token: session.refreshToken,
    token_type: session.tokenType || 'bearer',
    expires_in: session.expiresIn,
    expires_at: session.expiresAt,
    user: nativeUserToWeb(session.user)
  };
}

async function applyNativeSessionToWeb(session) {
  if (!session || !webClient || authSyncing) return null;
  authSyncing = true;
  try {
    const current = await webClient.auth.getSession();
    if (current.data?.session?.access_token === session.accessToken) {
      lastNativeAccessToken = session.accessToken;
      return current.data.session;
    }
    const result = await webClient.auth.setSession({
      access_token: session.accessToken,
      refresh_token: session.refreshToken
    });
    if (result.error) throw result.error;
    lastNativeAccessToken = session.accessToken;
    return result.data.session;
  } finally {
    authSyncing = false;
  }
}

async function applyWebSessionToNative(session) {
  if (!session || authSyncing || session.access_token === lastNativeAccessToken) return;
  authSyncing = true;
  try {
    const result = await CapacitorSupabase.setSession({
      accessToken: session.access_token,
      refreshToken: session.refresh_token
    });
    lastNativeAccessToken = result.session?.accessToken || session.access_token;
  } catch (error) {
    console.warn('Yere could not mirror the refreshed session to native auth.', error);
  } finally {
    authSyncing = false;
  }
}

// Unscoped keys only ever held the browser demo workspace (seeded sample people and reminders).
// Native builds never sign in with them, so they are removed rather than restored. Account
// data is always stored under a user-scoped key such as "Yere.v2.<userId>".
const LEGACY_DEMO_KEYS = ['Yere.v1', 'Yere.v2'];

function purgeLegacyDemoStorage() {
  let changed = false;
  for (const key of LEGACY_DEMO_KEYS) {
    try { localStorage.removeItem(key); } catch (_) { /* storage unavailable */ }
    if (key in offlineCache) {
      delete offlineCache[key];
      changed = true;
    }
  }
  return changed;
}

async function hydrateOfflineCache() {
  if (!enabled) return;
  purgeLegacyDemoStorage();
  try {
    const result = await Filesystem.readFile({
      path: CACHE_PATH,
      directory: Directory.LibraryNoCloud,
      encoding: Encoding.UTF8
    });
    const parsed = JSON.parse(asText(result.data));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return;
    offlineCache = parsed;
    if (purgeLegacyDemoStorage()) writeOfflineCache();
    for (const [key, value] of Object.entries(offlineCache)) {
      if (!/^Yere(?:\.|$)/.test(key) || typeof value !== 'string') continue;
      if (LEGACY_DEMO_KEYS.includes(key)) continue;
      if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
    }
  } catch (error) {
    // A missing cache is expected on first launch. Other storage remains available.
    if (!String(error?.message || error).toLowerCase().includes('not exist')) {
      console.warn('Yere could not restore its native offline cache.', error);
    }
  }
}

function writeOfflineCache() {
  cacheWrite = cacheWrite
    .catch(() => undefined)
    .then(() => Filesystem.writeFile({
      path: CACHE_PATH,
      data: JSON.stringify(offlineCache),
      directory: Directory.LibraryNoCloud,
      encoding: Encoding.UTF8,
      recursive: true
    }))
    .catch((error) => console.warn('Yere could not update its native offline cache.', error));
  return cacheWrite;
}

function saveOfflineSnapshot(key, value) {
  if (!enabled || !/^Yere(?:\.|$)/.test(key) || typeof value !== 'string') return Promise.resolve();
  offlineCache[key] = value;
  return writeOfflineCache();
}

function removeOfflineSnapshot(key) {
  if (!enabled || !/^Yere(?:\.|$)/.test(key)) return Promise.resolve();
  delete offlineCache[key];
  return writeOfflineCache();
}

function normalizeNotification(notification = {}, actionId = 'tap') {
  const data = notification.data || {};
  return {
    actionId,
    id: data.reminderId || data.reminder_id || notification.id || '',
    reminderId: data.reminderId || data.reminder_id || '',
    action: data.action || (/snooze/i.test(actionId) ? 'snooze' : /done|complete/i.test(actionId) ? 'done' : 'view'),
    direct: /snooze|done|complete/i.test(actionId),
    minutes: Number(data.minutes || (/10/.test(actionId) ? 10 : /60|hour/i.test(actionId) ? 60 : 0)) || 0,
    title: notification.title || data.title || '',
    body: notification.body || data.body || '',
    url: data.url || ''
  };
}

function rememberNotificationIntent(intent) {
  nativeBridge.pendingNotification = intent;
  emit('yere:native-notification-action', intent);
}

function resolvePushWaiters(value, error = null) {
  const waiters = pushWaiters;
  pushWaiters = [];
  for (const waiter of waiters) {
    clearTimeout(waiter.timer);
    if (error) waiter.reject(error);
    else waiter.resolve(value);
  }
}

async function installNativeListeners() {
  if (!enabled || listenersInstalled) return;
  listenersInstalled = true;

  await PushNotifications.addListener('registration', async ({ value }) => {
    pushToken = value;
    await Preferences.set({ key: PUSH_TOKEN_KEY, value });
    const registration = nativeBridge.getPushRegistration();
    emit('yere:native-push-token', registration);
    resolvePushWaiters(registration);
  });
  await PushNotifications.addListener('registrationError', (error) => {
    const problem = new Error(error?.error || 'Native push registration failed.');
    emit('yere:native-push-error', { message: problem.message });
    resolvePushWaiters(null, problem);
  });
  await PushNotifications.addListener('pushNotificationReceived', (notification) => {
    emit('yere:native-notification-received', normalizeNotification(notification, 'foreground'));
  });
  await PushNotifications.addListener('pushNotificationActionPerformed', ({ actionId, notification }) => {
    rememberNotificationIntent(normalizeNotification(notification, actionId));
  });

  await Network.addListener('networkStatusChange', (status) => {
    const changed = nativeBridge.online !== status.connected;
    nativeBridge.online = status.connected;
    nativeBridge.connectionType = status.connectionType;
    if (changed) emit('yere:native-network', status);
  });

  await App.addListener('appUrlOpen', ({ url }) => {
    nativeBridge.pendingUrl = url;
    emit('yere:native-url', { url });
  });
  await App.addListener('backButton', ({ canGoBack }) => emit('yere:native-back', { canGoBack }));
  await App.addListener('resume', async () => {
    const status = await Network.getStatus();
    nativeBridge.online = status.connected;
    nativeBridge.connectionType = status.connectionType;
    emit('yere:native-resume', status);
  });
}

async function initializeNative({ supabaseUrl, supabaseKey, client }) {
  if (!enabled) return;
  webClient = client || null;
  await hydrateOfflineCache();
  await installNativeListeners();

  const [{ value: savedToken }, network, launch] = await Promise.all([
    Preferences.get({ key: PUSH_TOKEN_KEY }),
    Network.getStatus(),
    App.getLaunchUrl().catch(() => undefined)
  ]);
  pushToken = savedToken || '';
  nativeBridge.online = network.connected;
  nativeBridge.connectionType = network.connectionType;
  if (launch?.url) nativeBridge.pendingUrl = launch.url;

  await Promise.allSettled([
    StatusBar.setStyle({ style: Style.Dark }),
    StatusBar.setBackgroundColor({ color: '#0e1220' }),
    StatusBar.setOverlaysWebView({ overlay: false })
  ]);

  if (supabaseUrl && supabaseKey && webClient) {
    await CapacitorSupabase.initialize({ supabaseUrl, supabaseKey });
    const nativeResult = await CapacitorSupabase.getSession();
    if (nativeResult.session) {
      await applyNativeSessionToWeb(nativeResult.session);
    } else {
      const webResult = await webClient.auth.getSession();
      if (webResult.data?.session) await applyWebSessionToNative(webResult.data.session);
    }

    await CapacitorSupabase.addListener('authStateChange', async ({ event, session }) => {
      if (session) await applyNativeSessionToWeb(session);
      else if (event === 'SIGNED_OUT' && !authSyncing) await webClient.auth.signOut();
    });
    webClient.auth.onAuthStateChange((event, session) => {
      if (session && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED')) {
        applyWebSessionToNative(session);
      }
    });
  }

  const finishLaunch = () => SplashScreen.hide().catch(() => undefined);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', finishLaunch, { once: true });
  else finishLaunch();
}

const nativeAuth = {
  async signInWithPassword({ email, password }) {
    const result = await CapacitorSupabase.signInWithPassword({ email, password });
    const session = await applyNativeSessionToWeb(result.session);
    return { data: { session, user: session?.user || nativeUserToWeb(result.user) }, error: null };
  },
  async signUp({ email, password, options = {} }) {
    const result = await CapacitorSupabase.signUp({ email, password, data: options.data || {} });
    const session = await applyNativeSessionToWeb(result.session);
    return { data: { session, user: session?.user || nativeUserToWeb(result.user) }, error: null };
  },
  async signInWithOAuth({ provider }) {
    if (provider !== 'google') throw new Error('Unsupported sign-in provider.');
    if (!webClient) throw new Error('Cloud sign-in is not configured yet.');
    // Use the shared client's PKCE verifier so the callback can exchange the code
    // in the same storage, then the existing auth listener syncs the native session.
    const { data, error } = await webClient.auth.signInWithOAuth({
      provider,
      options: { redirectTo: 'yere://auth/callback', skipBrowserRedirect: true }
    });
    if (error) throw error;
    if (!data?.url) throw new Error('Could not start social sign-in.');
    await Browser.open({ url: data.url });
  },
  async closeOAuthBrowser() {
    await Browser.close().catch(() => undefined);
  },
  async completeOAuth(code) {
    await this.closeOAuthBrowser();
    return webClient.auth.exchangeCodeForSession(code);
  },
  async signInWithApple() {
    await CapacitorSupabase.signInWithOAuth({ provider: 'apple', redirectTo: 'yere://auth/callback' });
  },
  async signOut() {
    try {
      await CapacitorSupabase.signOut();
    } finally {
      if (webClient) await webClient.auth.signOut();
      lastNativeAccessToken = '';
    }
  }
};

// Voice capture for the installed apps. Android WebView exposes no window.SpeechRecognition, so
// native builds drive the platform recognizer instead. Availability, microphone/speech
// permissions, streaming partials, the single terminal result, stopping, and listener cleanup all
// live in src/speech.js; nothing here is requested until the user taps the mic button.
const speech = createSpeechController({
  plugin: SpeechRecognition,
  isNative: enabled,
  language: typeof navigator === 'undefined' ? '' : (navigator.language || ''),
  log: console
});

const nativeBridge = {
  enabled,
  platform,
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  connectionType: 'unknown',
  pendingNotification: null,
  pendingUrl: '',
  auth: nativeAuth,
  speech,
  initialize: initializeNative,
  saveOfflineSnapshot,
  removeOfflineSnapshot,
  isOnline() {
    return enabled ? this.online : navigator.onLine;
  },
  getPushRegistration() {
    return {
      token: pushToken,
      platform,
      provider: platform === 'ios' ? 'apns' : 'fcm'
    };
  },
  async getPushPermission() {
    if (!enabled) return 'prompt';
    const result = await PushNotifications.checkPermissions();
    return result.receive;
  },
  async registerPush() {
    if (!enabled) throw new Error('Native push is only available in the installed app.');
    let permission = await PushNotifications.checkPermissions();
    if (permission.receive === 'prompt' || permission.receive === 'prompt-with-rationale') {
      permission = await PushNotifications.requestPermissions();
    }
    if (permission.receive !== 'granted') return { granted: false, permission: permission.receive };

    if (platform === 'android') {
      await PushNotifications.createChannel({
        id: 'yere_reminders',
        name: 'Yere reminders',
        description: 'Reminders you have chosen to receive from Yere.',
        importance: 5,
        visibility: 1,
        vibration: true,
        lights: true,
        lightColor: '#6366F1'
      });
    }

    const savedToken = pushToken;
    const tokenPromise = new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => {
        pushWaiters = pushWaiters.filter((entry) => entry.timer !== timer);
        if (savedToken) resolve(this.getPushRegistration());
        else reject(new Error('Push registration timed out. Check this app’s notification and signing configuration.'));
      }, savedToken ? 5000 : 20000);
      pushWaiters.push({ resolve, reject, timer });
    });
    await PushNotifications.register();
    const registration = await tokenPromise;
    return { granted: true, ...registration };
  },
  async unregisterPush() {
    const previous = this.getPushRegistration();
    await PushNotifications.unregister();
    pushToken = '';
    await Preferences.remove({ key: PUSH_TOKEN_KEY });
    return previous;
  },
  consumeNotificationIntent() {
    const value = this.pendingNotification;
    this.pendingNotification = null;
    return value;
  },
  consumeLaunchUrl() {
    const value = this.pendingUrl;
    this.pendingUrl = '';
    return value;
  },
  async setTheme(theme) {
    if (!enabled) return;
    const dark = theme !== 'light';
    await Promise.allSettled([
      StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }),
      StatusBar.setBackgroundColor({ color: dark ? '#0e1220' : '#f4f6fb' })
    ]);
  },
  selectionHaptic() {
    if (enabled) Haptics.selectionChanged().catch(() => undefined);
  },
  successHaptic() {
    if (enabled) Haptics.notification({ type: NotificationType.Success }).catch(() => undefined);
  },
  impactHaptic() {
    if (enabled) Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined);
  },
  exitApp() {
    if (enabled && platform === 'android') return App.exitApp();
    return Promise.resolve();
  }
};

export { nativeBridge };
