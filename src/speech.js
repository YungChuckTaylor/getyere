// Native speech recognition controller for Yere.
//
// The installed Android/iOS apps cannot use window.SpeechRecognition: Android WebView has no
// implementation, which is why voice capture failed in the APK even with RECORD_AUDIO granted.
// Native builds therefore drive @capgo/capacitor-speech-recognition through this controller.
//
// Responsibilities:
//   - check recognizer availability before a session starts;
//   - check/request microphone + speech permissions only when a session is started (i.e. after
//     the user pressed the mic button), never at boot;
//   - stream partial transcripts to the caller and deliver exactly one terminal outcome
//     (final transcript or one specific error);
//   - let the caller stop or cancel an active session;
//   - remove every native listener after success, stop, or failure.
//
// Yere only ever handles transcript text. Raw audio stays inside the OS recognizer and is not
// stored, cached, or uploaded by this module.
//
// This file deliberately has no DOM or Capacitor imports so it can be unit-tested in Node with a
// fake plugin. src/native.js injects the real plugin.

/** User-facing copy for every failure the recognizer can report. */
export const SPEECH_ERROR_COPY = Object.freeze({
  UNSUPPORTED_PLATFORM: 'Voice capture is only available in the installed Yere app.',
  RECOGNIZER_UNAVAILABLE: 'This device has no speech recognition service. Enable or install Google speech services and try again.',
  PERMISSION_DENIED: 'Yere needs microphone access to take a reminder by voice. Allow it, then tap the mic again.',
  PERMISSION_BLOCKED: 'Microphone access is blocked for Yere. Open Settings → Apps → Yere → Permissions, allow the microphone, then try again.',
  INSUFFICIENT_PERMISSIONS: 'Microphone access is blocked for Yere. Open Settings → Apps → Yere → Permissions, allow the microphone, then try again.',
  MICROPHONE_PERMISSION_DENIED: 'Microphone access is blocked for Yere. Open Settings → Apps → Yere → Permissions, allow the microphone, then try again.',
  SESSION_ACTIVE: 'Voice capture is already running. Tap the mic to stop it first.',
  START_TIMEOUT: 'The speech recognizer did not start. Close Yere, reopen it, and try again.',
  START_FAILED: 'Voice capture could not start on this device. Try again, or type the reminder instead.',
  STOP_TIMEOUT: 'The speech recognizer did not respond. Try again, or type the reminder instead.',
  STOPPED_WITHOUT_RESULT: 'Voice capture stopped before any words were recognized. Tap the mic and speak a little louder.',
  NO_SPEECH: 'We did not hear any words. Tap the mic and try again.',
  SPEECH_TIMEOUT: 'We did not hear any words. Tap the mic and try again.',
  NO_MATCH: 'We could not make out those words. Tap the mic and say it again, or type the reminder.',
  NETWORK: 'Speech recognition needs an internet connection. Reconnect and tap the mic again.',
  NETWORK_TIMEOUT: 'The speech service took too long to answer. Check your connection and try again.',
  SERVER: 'The speech service returned an error. Please try again in a moment.',
  SERVER_DISCONNECTED: 'The speech service dropped the connection. Please try again.',
  RECOGNIZER_BUSY: 'The speech recognizer is still busy. Wait a moment and tap the mic again.',
  AUDIO: 'The microphone could not be read. Close other recording apps and try again.',
  AUDIO_SESSION_FAILED: 'The microphone could not start. Close other recording apps and try again.',
  AUDIO_ENGINE_START_FAILED: 'The microphone could not start. Close other recording apps and try again.',
  CLIENT: 'The speech recognizer stopped unexpectedly. Please try again.',
  UNSUPPORTED_LOCALE: 'This device has no speech model for that language. Type the reminder, or switch the device language.',
  MODEL_DOWNLOAD_SCHEDULED: 'This device is still downloading its speech language model. Try again in a few minutes.',
  ON_DEVICE_RECOGNITION_UNAVAILABLE: 'On-device speech recognition is unavailable for that language on this device.',
  RECREATE_FAILED: 'The speech recognizer needs a moment to reset. Please try again.',
  MODERN_START_FAILED: 'Voice capture could not start on this iOS version. Try again, or type the reminder instead.',
  ABORTED: '',
  UNKNOWN: 'Voice capture did not work this time. You can type the reminder instead.'
});

/** Reasons that mean "the session ended normally", so a captured transcript is worth confirming. */
const NORMAL_END_REASONS = new Set(['results', 'userStop', 'forceStop', 'silence', 'unknown']);

/** Errors that are worth confirming anyway when the recognizer already produced usable text. */
const RECOVERABLE_ERROR_CODES = new Set(['NO_MATCH', 'SPEECH_TIMEOUT']);

const NATIVE_MESSAGE_CODES = [
  { pattern: /not available|unavailable/i, code: 'RECOGNIZER_UNAVAILABLE' },
  { pattern: /already (running|started|listening)/i, code: 'SESSION_ACTIVE' },
  { pattern: /stopped before final results/i, code: 'STOPPED_WITHOUT_RESULT' },
  { pattern: /permission/i, code: 'PERMISSION_DENIED' },
  { pattern: /on-device/i, code: 'ON_DEVICE_RECOGNITION_UNAVAILABLE' }
];

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/** Friendly message for a recognizer code, with `{language}` interpolation support. */
export function copyFor(code, vars = {}) {
  let message = SPEECH_ERROR_COPY[code] || SPEECH_ERROR_COPY.UNKNOWN;
  for (const [key, value] of Object.entries(vars)) {
    message = message.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
  }
  return message;
}

/** Maps a native plugin rejection (message-only) onto one of the known codes. */
export function classifyNativeError(error) {
  const rawCode = text(error?.code) || text(error?.errorCode);
  if (rawCode) return rawCode.toUpperCase();
  const message = String(error?.message || error || '');
  for (const rule of NATIVE_MESSAGE_CODES) {
    if (rule.pattern.test(message)) return rule.code;
  }
  return 'UNKNOWN';
}

/** Builds the single error shape handed to callers: a stable code plus a message a person can act on. */
export function speechFailure(code, detail = '', vars = {}) {
  return {
    code: code || 'UNKNOWN',
    message: copyFor(code, vars),
    detail: text(detail) || String(detail || '')
  };
}

/**
 * Extracts the best transcript from a `partialResults` event.
 * Android and iOS both send `matches`, plus `accumulatedText` (final) or `accumulated`
 * (earlier continuous segments) when a session produced more than one chunk.
 */
export function transcriptFromEvent(event) {
  if (!event || typeof event !== 'object') return '';
  const matches = Array.isArray(event.matches) ? event.matches : [];
  const best = matches.map((match) => text(match)).filter(Boolean)[0] || '';
  const accumulatedText = text(event.accumulatedText);
  if (accumulatedText) return accumulatedText;
  const accumulated = text(event.accumulated);
  if (accumulated && best && !accumulated.endsWith(best)) return `${accumulated} ${best}`.trim();
  return accumulated || best;
}

/**
 * Chooses the locale to recognize. Returns '' when the preferred tag has no matching model, which
 * lets the platform fall back to the device locale instead of failing with UNSUPPORTED_LOCALE.
 */
export function pickSpeechLanguage({ preferred = '', supported = [] } = {}) {
  const tag = text(preferred);
  if (!tag) return '';
  const list = Array.isArray(supported) ? supported.map((entry) => text(entry)).filter(Boolean) : [];
  if (!list.length) return tag;
  const lower = tag.toLowerCase();
  const exact = list.find((entry) => entry.toLowerCase() === lower);
  if (exact) return exact;
  const base = lower.split('-')[0];
  return list.find((entry) => entry.toLowerCase().split('-')[0] === base) || '';
}

/**
 * Creates the native speech session controller.
 *
 * @param {object} options
 * @param {object} options.plugin        The @capgo/capacitor-speech-recognition plugin instance.
 * @param {boolean} options.isNative     Only native platforms may start a session.
 * @param {string} [options.language]    Preferred BCP-47 tag (usually navigator.language).
 * @param {number} [options.startTimeoutMs] Safety net when the recognizer never reports "started".
 * @param {number} [options.stopTimeoutMs]  Safety net when a stop never produces a terminal event.
 * @param {number} [options.errorGraceMs]   How long an error event waits for the terminal state event.
 * @param {object} [options.log]         Logger for diagnostics (never receives audio).
 */
export function createSpeechController(options = {}) {
  const {
    plugin = null,
    isNative = false,
    language = '',
    startTimeoutMs = 10000,
    stopTimeoutMs = 2500,
    errorGraceMs = 600,
    log = console
  } = options;

  const supported = Boolean(isNative && plugin);
  let session = null;
  let sessionSeq = 0;
  let listenerCount = 0;

  function emitState(target, state) {
    if (typeof target?.onState === 'function') {
      try {
        target.onState(state);
      } catch (error) {
        log.warn?.('Yere voice state handler failed.', error);
      }
    }
  }

  async function addListener(name, handler) {
    const handle = await plugin.addListener(name, handler);
    listenerCount += 1;
    if (!session) return handle;
    session.handles.push(handle);
    return handle;
  }

  /** Removes every listener registered for this session; safe to call more than once. */
  async function teardown(target) {
    const handles = target.handles.splice(0, target.handles.length);
    target.active = false;
    clearTimeout(target.startTimer);
    clearTimeout(target.stopTimer);
    clearTimeout(target.errorTimer);
    if (session === target) session = null;
    await Promise.allSettled(handles.map((handle) => (typeof handle?.remove === 'function' ? handle.remove() : Promise.resolve())));
    // The plugin tracks listeners globally, so make sure nothing is left registered for Yere.
    if (!session && typeof plugin?.removeAllListeners === 'function') {
      await plugin.removeAllListeners().catch(() => undefined);
    }
    emitState(target.callbacks, 'stopped');
  }

  /**
   * Ends a session exactly once, reporting either the final transcript or one specific error.
   * This is the only place terminal callbacks fire, which prevents duplicate confirmation
   * screens and stacked error notifications.
   */
  async function settle(target, reason, errorCode = '') {
    if (target.settled) return;
    target.settled = true;
    target.active = false;

    const transcript = text(target.transcript);
    const failure = target.lastError || (errorCode ? speechFailure(errorCode) : null);
    const code = failure?.code || '';

    if (target.cancelled) {
      await teardown(target);
      return;
    }

    let outcome = null;
    if (transcript && (NORMAL_END_REASONS.has(reason) || RECOVERABLE_ERROR_CODES.has(code))) {
      outcome = { type: 'final', transcript };
    } else if (failure) {
      outcome = { type: 'error', failure };
    } else if (transcript) {
      outcome = { type: 'final', transcript };
    } else {
      outcome = { type: 'error', failure: speechFailure('NO_SPEECH', reason) };
    }

    if (outcome.type === 'final') {
      if (typeof target.callbacks.onFinal === 'function') {
        try {
          target.callbacks.onFinal(outcome.transcript);
        } catch (error) {
          log.warn?.('Yere voice final handler failed.', error);
        }
      }
    } else if (typeof target.callbacks.onError === 'function') {
      try {
        target.callbacks.onError(outcome.failure);
      } catch (error) {
        log.warn?.('Yere voice error handler failed.', error);
      }
    }

    await teardown(target);
  }

  async function fail(target, code, detail = '', vars = {}) {
    if (!target || target.settled) return speechFailure(code, detail, vars);
    target.lastError = speechFailure(code, detail, vars);
    await settle(target, 'error', code);
    return target.lastError;
  }

  /**
   * Recognizer availability. Callers may check this before showing voice UI; start() checks again.
   */
  async function isAvailable() {
    if (!supported) return { available: false, ...speechFailure('UNSUPPORTED_PLATFORM') };
    try {
      const result = await plugin.available();
      if (result?.available) return { available: true };
      return { available: false, ...speechFailure('RECOGNIZER_UNAVAILABLE') };
    } catch (error) {
      const code = classifyNativeError(error);
      return { available: false, ...speechFailure(code, error?.message || '') };
    }
  }

  /** Current permission state without prompting the user. */
  async function checkPermission() {
    if (!supported) return { granted: false, state: 'unsupported' };
    try {
      const status = await plugin.checkPermissions();
      const state = text(status?.speechRecognition) || 'prompt';
      return { granted: state === 'granted', state };
    } catch (error) {
      return { granted: false, state: 'unknown', detail: String(error?.message || error || '') };
    }
  }

  /**
   * Requests permissions only when the OS will actually show a prompt. Called from start(), so the
   * request always follows a deliberate tap on the mic button.
   */
  async function ensurePermission() {
    const current = await checkPermission();
    if (current.granted) return current;
    if (current.state !== 'prompt' && current.state !== 'prompt-with-rationale') return current;
    try {
      const requested = await plugin.requestPermissions();
      const state = text(requested?.speechRecognition) || 'denied';
      return { granted: state === 'granted', state };
    } catch (error) {
      return { granted: false, state: 'denied', detail: String(error?.message || error || '') };
    }
  }

  async function resolveLanguage(preferred) {
    const wanted = text(preferred) || text(language);
    if (!wanted || typeof plugin?.getSupportedLanguages !== 'function') return wanted;
    try {
      const result = await plugin.getSupportedLanguages();
      return pickSpeechLanguage({ preferred: wanted, supported: result?.languages || [] });
    } catch (_) {
      // Android 13+ does not expose the list; the device locale is used instead.
      return wanted;
    }
  }

  /**
   * Starts a recognition session.
   *
   * Handlers: onPartial(transcript), onFinal(transcript), onError({code,message,detail}),
   * onState('starting'|'started'|'stopping'|'stopped').
   *
   * Resolves { started: true } when the recognizer is capturing, or { started: false, ...failure }
   * when the session could not run. Failures are always reported through onError exactly once, so
   * callers must not show a second notification for a rejected start.
   */
  async function start(handlers = {}) {
    if (!supported) {
      const failure = speechFailure('UNSUPPORTED_PLATFORM');
      handlers.onError?.(failure);
      return { started: false, ...failure };
    }
    if (session) {
      const failure = speechFailure('SESSION_ACTIVE');
      handlers.onError?.(failure);
      return { started: false, ...failure };
    }

    const target = {
      id: (sessionSeq += 1),
      active: false,
      settled: false,
      cancelled: false,
      startedEmitted: false,
      stopRequested: false,
      transcript: '',
      lastError: null,
      handles: [],
      callbacks: {
        onPartial: typeof handlers.onPartial === 'function' ? handlers.onPartial : null,
        onFinal: typeof handlers.onFinal === 'function' ? handlers.onFinal : null,
        onError: typeof handlers.onError === 'function' ? handlers.onError : null,
        onState: typeof handlers.onState === 'function' ? handlers.onState : null
      },
      startTimer: null,
      stopTimer: null,
      errorTimer: null
    };
    session = target;
    emitState(target.callbacks, 'starting');

    const availability = await isAvailable();
    if (!availability.available) return { started: false, ...(await fail(target, availability.code, availability.detail)) };

    const permission = await ensurePermission();
    if (!permission.granted) {
      const code = permission.state === 'denied' ? 'PERMISSION_BLOCKED' : 'PERMISSION_DENIED';
      return { started: false, ...(await fail(target, code, permission.state)) };
    }

    try {
      await addListener('partialResults', (event) => {
        if (target.settled) return;
        const transcript = transcriptFromEvent(event);
        if (!transcript || transcript === target.transcript) return;
        target.transcript = transcript;
        target.active = true;
        clearTimeout(target.startTimer);
        if (typeof target.callbacks.onPartial === 'function') {
          try {
            target.callbacks.onPartial(transcript, { forced: Boolean(event?.forced) });
          } catch (error) {
            log.warn?.('Yere voice partial handler failed.', error);
          }
        }
      });

      await addListener('listeningState', (event) => {
        if (target.settled) return;
        const state = text(event?.state) || text(event?.status);
        const reason = text(event?.reason);
        if (state === 'started') {
          target.active = true;
          clearTimeout(target.startTimer);
          if (!target.startedEmitted) {
            target.startedEmitted = true;
            emitState(target.callbacks, 'started');
          }
          return;
        }
        if (state === 'stoppingListening' || state === 'stopping') {
          emitState(target.callbacks, 'stopping');
          return;
        }
        if (state === 'stopped') {
          settle(target, reason || (target.stopRequested ? 'userStop' : 'unknown'), text(event?.errorCode));
        }
      });

      await addListener('error', (event) => {
        if (target.settled) return;
        const code = classifyNativeError(event);
        target.lastError = speechFailure(code, event?.message || '', { language: text(event?.language) });
        // Terminal states normally follow an error event. If one never arrives, report the error.
        clearTimeout(target.errorTimer);
        target.errorTimer = setTimeout(() => settle(target, 'error', code), errorGraceMs);
      });
    } catch (error) {
      return { started: false, ...(await fail(target, 'START_FAILED', error?.message || '')) };
    }

    // Safety net: a recognizer that never reports "started" must not leave the mic UI stuck.
    target.startTimer = setTimeout(() => {
      if (!target.settled && !target.active) settle(target, 'error', 'START_TIMEOUT');
    }, startTimeoutMs);

    try {
      await plugin.start({
        language: await resolveLanguage(handlers.language),
        maxResults: 1,
        partialResults: true,
        popup: false,
        prompt: text(handlers.prompt) || undefined
      });
    } catch (error) {
      const code = classifyNativeError(error);
      return { started: false, ...(await fail(target, code, error?.message || '')) };
    }

    if (target.settled) return { started: false, ...(target.lastError || speechFailure('START_FAILED')) };
    target.active = true;
    if (!target.startedEmitted) {
      target.startedEmitted = true;
      emitState(target.callbacks, 'started');
    }
    return { started: true, sessionId: target.id };
  }

  /**
   * Stops the active session. Any transcript captured so far is delivered through onFinal, which is
   * what a user expects when they tap the mic again to finish dictating.
   */
  async function stop() {
    const target = session;
    if (!target) return { stopped: false };
    target.stopRequested = true;
    emitState(target.callbacks, 'stopping');
    try {
      await plugin.stop();
    } catch (error) {
      // Some recognizers ignore a normal stop; forceStop tears the session down.
      try {
        await plugin.forceStop({ timeout: 800 });
      } catch (_) {
        log.warn?.('Yere could not stop native speech recognition.', error);
      }
    }
    clearTimeout(target.stopTimer);
    target.stopTimer = setTimeout(() => settle(target, 'userStop'), stopTimeoutMs);
    return { stopped: true, transcript: text(target.transcript) };
  }

  /** Stops the active session and discards its transcript without notifying handlers. */
  async function cancel() {
    const target = session;
    if (!target) return { cancelled: false };
    target.cancelled = true;
    target.stopRequested = true;
    try {
      await plugin.stop();
    } catch (_) {
      try {
        await plugin.forceStop({ timeout: 500 });
      } catch (__) {
        /* the session is discarded either way */
      }
    }
    await settle(target, 'userStop');
    return { cancelled: true };
  }

  return {
    supported,
    get active() {
      return Boolean(session && session.active && !session.settled);
    },
    get listening() {
      return Boolean(session && !session.settled);
    },
    get activeListeners() {
      return session ? session.handles.length : 0;
    },
    get registeredListeners() {
      return listenerCount;
    },
    transcript() {
      return session ? text(session.transcript) : '';
    },
    /** Lets the shared UI reuse the same wording for browser Web Speech API failures. */
    messageFor(code, vars = {}) {
      return copyFor(code, vars);
    },
    isAvailable,
    checkPermission,
    ensurePermission,
    start,
    stop,
    cancel
  };
}
