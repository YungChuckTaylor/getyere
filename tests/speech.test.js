import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import {
  SPEECH_ERROR_COPY,
  createSpeechController,
  pickSpeechLanguage,
  transcriptFromEvent,
  classifyNativeError
} from '../src/speech.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFile(path.join(root, file), 'utf8');

// Fast, deterministic timers for the controller safety nets.
const FAST = { startTimeoutMs: 40, stopTimeoutMs: 20, errorGraceMs: 10 };
const flush = async (times = 6) => {
  for (let index = 0; index < times; index += 1) await new Promise((resolve) => setImmediate(resolve));
};

/** Stand-in for @capgo/capacitor-speech-recognition that records every call and listener. */
function createFakePlugin(behavior = {}) {
  const listeners = new Map();
  const calls = {
    available: 0,
    checkPermissions: 0,
    requestPermissions: 0,
    getSupportedLanguages: 0,
    start: [],
    stop: 0,
    forceStop: 0,
    removeAllListeners: 0,
    addListener: []
  };
  const register = (name, handler) => {
    const list = listeners.get(name) || [];
    list.push(handler);
    listeners.set(name, list);
    calls.addListener.push(name);
    return {
      remove: async () => {
        const current = listeners.get(name) || [];
        const index = current.indexOf(handler);
        if (index >= 0) current.splice(index, 1);
      }
    };
  };

  const plugin = {
    calls,
    async available() {
      calls.available += 1;
      if (behavior.availableError) throw behavior.availableError;
      return { available: behavior.available !== false };
    },
    async checkPermissions() {
      calls.checkPermissions += 1;
      return { speechRecognition: behavior.permission ?? 'granted' };
    },
    async requestPermissions() {
      calls.requestPermissions += 1;
      return { speechRecognition: behavior.requestResult ?? 'granted' };
    },
    async getSupportedLanguages() {
      calls.getSupportedLanguages += 1;
      if (behavior.languagesError) throw behavior.languagesError;
      return { languages: behavior.languages ?? [] };
    },
    async start(options) {
      calls.start.push(options);
      if (behavior.hangStart) return new Promise(() => {});
      if (behavior.startError) throw behavior.startError;
      return {};
    },
    async stop() {
      calls.stop += 1;
      if (behavior.stopError) throw behavior.stopError;
    },
    async forceStop(options) {
      calls.forceStop += 1;
      return options;
    },
    async addListener(name, handler) {
      return register(name, handler);
    },
    async removeAllListeners() {
      calls.removeAllListeners += 1;
      listeners.clear();
    },
    async emit(name, event) {
      for (const handler of [...(listeners.get(name) || [])]) await handler(event);
      await flush();
    },
    listenerCount(name) {
      return (listeners.get(name) || []).length;
    },
    totalListeners() {
      return [...listeners.values()].reduce((total, list) => total + list.length, 0);
    }
  };
  return plugin;
}

function createHarness(behavior = {}, options = {}) {
  const plugin = createFakePlugin(behavior);
  const events = { partial: [], final: [], errors: [], states: [] };
  const controller = createSpeechController({
    plugin,
    isNative: options.isNative !== false,
    language: 'en-NG',
    log: { warn() {} },
    ...FAST,
    ...options
  });
  const handlers = {
    language: options.language ?? 'en-NG',
    onPartial: (text, meta) => events.partial.push({ text, meta }),
    onFinal: (text) => events.final.push(text),
    onError: (error) => events.errors.push(error),
    onState: (state) => events.states.push(state)
  };
  return { plugin, controller, events, handlers };
}

// ---------- 1. Availability ----------

test('native voice checks recognizer availability before starting and reports a specific error', async () => {
  const { plugin, controller, events, handlers } = createHarness({ available: false });
  const result = await controller.start(handlers);
  assert.equal(result.started, false);
  assert.equal(result.code, 'RECOGNIZER_UNAVAILABLE');
  assert.equal(plugin.calls.start.length, 0, 'the recognizer is never started when it is unavailable');
  assert.equal(events.errors.length, 1);
  assert.match(events.errors[0].message, /no speech recognition service/i);
  assert.equal(events.final.length, 0);
  assert.equal(plugin.totalListeners(), 0, 'no listener may survive a failed start');
  assert.equal(controller.listening, false);
});

test('availability can be checked on its own, before the user taps the mic', async () => {
  const { plugin, controller } = createHarness();
  assert.deepEqual(await controller.isAvailable(), { available: true });
  assert.equal(plugin.calls.start.length, 0);
  assert.equal(plugin.calls.checkPermissions, 0, 'checking availability never touches permissions');
  const unavailable = createHarness({ available: false });
  const result = await unavailable.controller.isAvailable();
  assert.equal(result.available, false);
  assert.equal(result.code, 'RECOGNIZER_UNAVAILABLE');
});

test('a web (non-native) controller refuses to start instead of pretending to listen', async () => {
  const { plugin, controller, events, handlers } = createHarness({}, { isNative: false });
  assert.equal(controller.supported, false);
  const result = await controller.start(handlers);
  assert.equal(result.started, false);
  assert.equal(result.code, 'UNSUPPORTED_PLATFORM');
  assert.equal(events.errors.length, 1);
  assert.equal(plugin.calls.start.length, 0);
  assert.equal(plugin.calls.addListener.length, 0);
});

// ---------- 2. Permissions ----------

test('permissions are checked first and only requested when the OS will prompt', async () => {
  const granted = createHarness({ permission: 'granted' });
  const result = await granted.controller.start(granted.handlers);
  assert.equal(result.started, true);
  assert.equal(granted.plugin.calls.checkPermissions, 1);
  assert.equal(granted.plugin.calls.requestPermissions, 0, 'an already-granted permission is not requested again');

  const prompt = createHarness({ permission: 'prompt', requestResult: 'granted' });
  const promptResult = await prompt.controller.start(prompt.handlers);
  assert.equal(promptResult.started, true);
  assert.equal(prompt.plugin.calls.requestPermissions, 1, 'the prompt is answered with a real request');

  const rationale = createHarness({ permission: 'prompt-with-rationale', requestResult: 'granted' });
  await rationale.controller.start(rationale.handlers);
  assert.equal(rationale.plugin.calls.requestPermissions, 1);
});

test('a denied microphone permission blocks the session with settings guidance', async () => {
  const { plugin, controller, events, handlers } = createHarness({ permission: 'denied' });
  const result = await controller.start(handlers);
  assert.equal(result.started, false);
  assert.equal(result.code, 'PERMISSION_BLOCKED');
  assert.equal(plugin.calls.requestPermissions, 0, 'a denied permission is not re-requested in a loop');
  assert.equal(plugin.calls.start.length, 0);
  assert.match(events.errors[0].message, /Settings .* Permissions|blocked/i);
  assert.equal(plugin.totalListeners(), 0);
});

test('a permission request that is dismissed reports the prompt message, not a generic failure', async () => {
  const { controller, events, handlers } = createHarness({ permission: 'prompt', requestResult: 'denied' });
  const result = await controller.start(handlers);
  assert.equal(result.started, false);
  assert.equal(events.errors.length, 1);
  assert.match(events.errors[0].message, /Settings|blocked/i);
  assert.doesNotMatch(events.errors[0].message, /Mic error or permission denied/);
});

test('no permission is requested at boot: only start() asks', async () => {
  const source = await read('src/native.js');
  const initialize = source.slice(source.indexOf('async function initializeNative'), source.indexOf('const nativeAuth'));
  assert.doesNotMatch(initialize, /speech|SpeechRecognition/i, 'app start must not touch the microphone');
  const bridge = source.slice(source.indexOf('const speech = createSpeechController'));
  assert.match(bridge, /plugin: SpeechRecognition/);
  assert.match(bridge, /isNative: enabled/);
  assert.match(source, /speech,/);
});

// ---------- 3. Partial and final transcripts ----------

test('partial transcripts stream to the caller in order and merge accumulated segments', async () => {
  const { plugin, controller, events, handlers } = createHarness();
  const result = await controller.start(handlers);
  assert.equal(result.started, true);

  await plugin.emit('partialResults', { matches: ['Call'] });
  await plugin.emit('partialResults', { matches: ['Call Aunty'] });
  await plugin.emit('partialResults', { matches: ['tomorrow'], accumulated: 'Call Aunty' });
  await plugin.emit('partialResults', { matches: [], accumulatedText: 'Call Aunty tomorrow at 4pm' });
  await plugin.emit('partialResults', { matches: ['Call Aunty tomorrow at 4pm'] });

  assert.deepEqual(events.partial.map((entry) => entry.text), [
    'Call',
    'Call Aunty',
    'Call Aunty tomorrow',
    'Call Aunty tomorrow at 4pm'
  ], 'unchanged text is not re-emitted');
  assert.equal(events.final.length, 0);
  assert.equal(controller.transcript(), 'Call Aunty tomorrow at 4pm');
});

test('a final result delivers exactly one transcript and removes every native listener', async () => {
  const { plugin, controller, events, handlers } = createHarness();
  await controller.start(handlers);
  await plugin.emit('listeningState', { state: 'started', sessionId: 1, reason: 'userStart' });
  await plugin.emit('partialResults', { matches: ['Pay rent'] });
  await plugin.emit('partialResults', { matches: ['first thing'], accumulated: 'Pay rent' });
  await plugin.emit('listeningState', { state: 'stoppingListening', sessionId: 1, reason: 'results' });
  await plugin.emit('listeningState', { state: 'stopped', sessionId: 1, reason: 'results', status: 'stopped' });

  assert.deepEqual(events.final, ['Pay rent first thing']);
  assert.equal(events.errors.length, 0);
  assert.equal(plugin.calls.removeAllListeners, 1, 'the plugin is left with no Yere listeners');
  assert.equal(plugin.totalListeners(), 0);
  assert.equal(controller.activeListeners, 0);
  assert.equal(controller.listening, false);
  assert.ok(events.states.includes('started') && events.states.includes('stopped'));
  assert.equal(events.states.filter((state) => state === 'started').length, 1, 'start is reported once');
});

test('a repeated terminal event cannot produce a second confirmation', async () => {
  const { plugin, controller, events, handlers } = createHarness();
  await controller.start(handlers);
  await plugin.emit('partialResults', { matches: ['Water the plants'] });
  await plugin.emit('listeningState', { state: 'stopped', reason: 'results' });
  await plugin.emit('listeningState', { state: 'stopped', reason: 'results' });
  await plugin.emit('partialResults', { matches: ['Water the plants again'] });

  assert.deepEqual(events.final, ['Water the plants']);
  assert.equal(plugin.calls.removeAllListeners, 1);
});

test('transcript extraction prefers accumulatedText and joins earlier segments', () => {
  assert.equal(transcriptFromEvent({ matches: ['a'], accumulatedText: 'a b' }), 'a b');
  assert.equal(transcriptFromEvent({ matches: ['b'], accumulated: 'a' }), 'a b');
  assert.equal(transcriptFromEvent({ matches: ['a b'], accumulated: 'a b' }), 'a b');
  assert.equal(transcriptFromEvent({ matches: ['', '  ', 'third'] }), 'third');
  assert.equal(transcriptFromEvent({}), '');
  assert.equal(transcriptFromEvent(null), '');
});

// ---------- 4. Stopping ----------

test('stopping an active session hands the captured transcript to the confirmation flow', async () => {
  const { plugin, controller, events, handlers } = createHarness();
  await controller.start(handlers);
  await plugin.emit('partialResults', { matches: ['Call the dentist at 2'] });

  const stopResult = await controller.stop();
  assert.equal(stopResult.stopped, true);
  assert.equal(plugin.calls.stop, 1);

  await plugin.emit('listeningState', { state: 'stopped', reason: 'userStop', status: 'stopped' });
  assert.deepEqual(events.final, ['Call the dentist at 2']);
  assert.equal(events.errors.length, 0);
  assert.equal(plugin.totalListeners(), 0);
});

test('a stop that never reports a terminal state still finishes and cleans up', async () => {
  const { plugin, controller, events, handlers } = createHarness();
  await controller.start(handlers);
  await plugin.emit('partialResults', { matches: ['Buy bread'] });
  await controller.stop();
  await new Promise((resolve) => setTimeout(resolve, 60));
  assert.deepEqual(events.final, ['Buy bread'], 'the watchdog settles the session');
  assert.equal(plugin.totalListeners(), 0);
  assert.equal(controller.listening, false);
});

test('a recognizer that ignores stop() is force-stopped', async () => {
  const { plugin, controller, events, handlers } = createHarness({ stopError: new Error('Recognizer is busy') });
  await controller.start(handlers);
  await plugin.emit('partialResults', { matches: ['Submit the report'] });
  await controller.stop();
  assert.equal(plugin.calls.forceStop, 1);
  await plugin.emit('listeningState', { state: 'stopped', reason: 'forceStop' });
  assert.deepEqual(events.final, ['Submit the report']);
  assert.equal(events.errors.length, 0);
});

test('stopping with nothing captured reports "no speech" instead of an empty confirmation', async () => {
  const { plugin, controller, events, handlers } = createHarness();
  await controller.start(handlers);
  await controller.stop();
  await plugin.emit('listeningState', { state: 'stopped', reason: 'userStop' });
  assert.equal(events.final.length, 0);
  assert.equal(events.errors.length, 1);
  assert.equal(events.errors[0].code, 'NO_SPEECH');
  assert.match(events.errors[0].message, /did not hear/i);
});

test('cancel tears the session down without a confirmation or an error notification', async () => {
  const { plugin, controller, events, handlers } = createHarness();
  await controller.start(handlers);
  await plugin.emit('partialResults', { matches: ['Half spoken reminder'] });
  const result = await controller.cancel();
  assert.equal(result.cancelled, true);
  assert.equal(plugin.calls.stop, 1);
  assert.equal(events.final.length, 0);
  assert.equal(events.errors.length, 0);
  assert.equal(plugin.totalListeners(), 0);
  assert.equal(plugin.calls.removeAllListeners, 1);
  assert.equal(controller.listening, false);
});

test('stopping or cancelling with no session is a no-op', async () => {
  const { plugin, controller } = createHarness();
  assert.deepEqual(await controller.stop(), { stopped: false });
  assert.deepEqual(await controller.cancel(), { cancelled: false });
  assert.equal(plugin.calls.stop, 0);
});

// ---------- 5. Duplicate sessions and listener hygiene ----------

test('a second start cannot stack a duplicate session or duplicate listeners', async () => {
  const { plugin, controller, events } = createHarness();
  const first = await controller.start({ onPartial: () => {}, onFinal: () => {}, onError: (error) => events.errors.push(error) });
  assert.equal(first.started, true);
  assert.equal(plugin.calls.addListener.length, 3, 'partialResults, listeningState, error');

  const second = await controller.start({ onError: (error) => events.errors.push(error) });
  assert.equal(second.started, false);
  assert.equal(second.code, 'SESSION_ACTIVE');
  assert.equal(plugin.calls.addListener.length, 3, 'no extra listener is registered');
  assert.equal(plugin.calls.start.length, 1);
  assert.equal(events.errors.length, 1);
  assert.match(events.errors[0].message, /already running/i);
  assert.equal(controller.activeListeners, 3);
});

test('every registered listener is removed after success, stop, and failure', async () => {
  const success = createHarness();
  await success.controller.start(success.handlers);
  await success.plugin.emit('partialResults', { matches: ['Success path'] });
  await success.plugin.emit('listeningState', { state: 'stopped', reason: 'results' });
  assert.equal(success.plugin.totalListeners(), 0);
  assert.equal(success.controller.activeListeners, 0);

  const stopped = createHarness();
  await stopped.controller.start(stopped.handlers);
  await stopped.controller.stop();
  await stopped.plugin.emit('listeningState', { state: 'stopped', reason: 'userStop' });
  assert.equal(stopped.plugin.totalListeners(), 0);

  const failed = createHarness();
  await failed.controller.start(failed.handlers);
  await failed.plugin.emit('error', { code: 'NETWORK', message: 'Network error', sessionId: 1 });
  await failed.plugin.emit('listeningState', { state: 'stopped', reason: 'error', errorCode: 'NETWORK' });
  assert.equal(failed.plugin.totalListeners(), 0);
  assert.equal(failed.plugin.calls.removeAllListeners, 1);
});

test('a new session can start immediately after the previous one ends', async () => {
  const { plugin, controller, events, handlers } = createHarness();
  await controller.start(handlers);
  await plugin.emit('partialResults', { matches: ['First reminder'] });
  await plugin.emit('listeningState', { state: 'stopped', reason: 'results' });
  assert.deepEqual(events.final, ['First reminder']);

  const second = await controller.start(handlers);
  assert.equal(second.started, true);
  await plugin.emit('partialResults', { matches: ['Second reminder'] });
  await plugin.emit('listeningState', { state: 'stopped', reason: 'results' });
  assert.deepEqual(events.final, ['First reminder', 'Second reminder']);
});

// ---------- 6. Specific errors ----------

test('denied permission, unavailable recognizer, no speech, network, and missing model each have their own message', async () => {
  const seen = new Map();
  const scenarios = [
    { behavior: { permission: 'denied' }, expected: 'PERMISSION_BLOCKED' },
    { behavior: { available: false }, expected: 'RECOGNIZER_UNAVAILABLE' },
    { behavior: {}, event: { code: 'NETWORK', message: 'Network error' }, expected: 'NETWORK' },
    // The native SPEECH_TIMEOUT code is preserved for diagnostics and uses the "no speech" wording.
    { behavior: {}, event: { code: 'SPEECH_TIMEOUT', message: 'No speech input' }, expected: 'SPEECH_TIMEOUT' },
    { behavior: {}, event: { code: 'MODEL_DOWNLOAD_SCHEDULED', message: 'Model download scheduled' }, expected: 'MODEL_DOWNLOAD_SCHEDULED' },
    { behavior: {}, event: { code: 'UNSUPPORTED_LOCALE', message: 'Unsupported locale: en-NG' }, expected: 'UNSUPPORTED_LOCALE' }
  ];

  for (const scenario of scenarios) {
    const { plugin, controller, events, handlers } = createHarness(scenario.behavior);
    await controller.start(handlers);
    if (scenario.event) {
      await plugin.emit('error', { ...scenario.event, sessionId: 1 });
      await plugin.emit('listeningState', { state: 'stopped', reason: 'error', errorCode: scenario.event.code });
    }
    assert.equal(events.errors.length, 1, `${scenario.expected} reports exactly one error`);
    const error = events.errors[0];
    assert.equal(error.code, scenario.expected);
    assert.ok(error.message.length > 20, `${scenario.expected} has an actionable message`);
    assert.doesNotMatch(error.message, /Mic error or permission denied/);
    seen.set(scenario.expected, error.message);
    assert.equal(plugin.totalListeners(), 0);
  }

  const messages = [...seen.values()];
  assert.equal(new Set(messages).size, messages.length, 'each failure is worded differently');
  assert.match(seen.get('NETWORK'), /internet connection/i);
  assert.match(seen.get('SPEECH_TIMEOUT'), /did not hear/i);
  assert.match(seen.get('MODEL_DOWNLOAD_SCHEDULED'), /language model/i);
  assert.match(seen.get('UNSUPPORTED_LOCALE'), /speech model|language/i);
  assert.match(seen.get('PERMISSION_BLOCKED'), /Permissions/i);
  assert.match(seen.get('RECOGNIZER_UNAVAILABLE'), /speech recognition service/i);
});

test('the platform aliases for a blocked microphone all point at system settings', async () => {
  for (const code of ['INSUFFICIENT_PERMISSIONS', 'MICROPHONE_PERMISSION_DENIED']) {
    const { plugin, controller, events, handlers } = createHarness();
    await controller.start(handlers);
    await plugin.emit('error', { code, message: code, sessionId: 1 });
    await plugin.emit('listeningState', { state: 'stopped', reason: 'error', errorCode: code });
    assert.equal(events.errors.length, 1);
    assert.equal(events.errors[0].code, code);
    assert.equal(events.errors[0].message, SPEECH_ERROR_COPY.PERMISSION_BLOCKED);
    assert.match(events.errors[0].message, /Settings .* Permissions/i);
  }
  assert.ok(SPEECH_ERROR_COPY.NO_SPEECH);
  assert.ok(SPEECH_ERROR_COPY.NETWORK);
  assert.ok(SPEECH_ERROR_COPY.UNSUPPORTED_LOCALE);
  assert.ok(SPEECH_ERROR_COPY.MODEL_DOWNLOAD_SCHEDULED);
});

test('an error event with no terminal state still settles the session once', async () => {
  const { plugin, controller, events, handlers } = createHarness();
  await controller.start(handlers);
  await plugin.emit('error', { code: 'SERVER_DISCONNECTED', message: 'Server disconnected', sessionId: 4 });
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(events.errors.length, 1);
  assert.equal(events.errors[0].code, 'SERVER_DISCONNECTED');
  assert.equal(plugin.totalListeners(), 0);
  assert.equal(controller.listening, false);
});

test('NO_MATCH after usable speech confirms the transcript instead of discarding it', async () => {
  const { plugin, controller, events, handlers } = createHarness();
  await controller.start(handlers);
  await plugin.emit('partialResults', { matches: ['Call Aunty tomorrow'] });
  await plugin.emit('error', { code: 'NO_MATCH', message: 'No match', sessionId: 2 });
  await plugin.emit('listeningState', { state: 'stopped', reason: 'error', errorCode: 'NO_MATCH' });
  assert.deepEqual(events.final, ['Call Aunty tomorrow']);
  assert.equal(events.errors.length, 0);
});

test('silence with nothing captured is reported as no speech', async () => {
  const { plugin, controller, events, handlers } = createHarness();
  await controller.start(handlers);
  await plugin.emit('listeningState', { state: 'stopped', reason: 'silence' });
  assert.equal(events.errors.length, 1);
  assert.equal(events.errors[0].code, 'NO_SPEECH');
  assert.equal(events.final.length, 0);
});

test('a recognizer that never reports "started" fails instead of leaving the mic stuck', async () => {
  const { controller, events } = createHarness({ hangStart: true });
  // plugin.start() never settles on a wedged recognizer; the safety net must still end the session.
  void controller.start({ onError: (error) => events.errors.push(error) });
  await new Promise((resolve) => setTimeout(resolve, 90));
  assert.equal(events.errors.length, 1);
  assert.equal(events.errors[0].code, 'START_TIMEOUT');
  assert.match(events.errors[0].message, /did not start/i);
  assert.equal(controller.listening, false);
  assert.equal(controller.activeListeners, 0);
});

test('native plugin rejections are classified onto known codes', () => {
  assert.equal(classifyNativeError(new Error('Speech recognition service is not available.')), 'RECOGNIZER_UNAVAILABLE');
  assert.equal(classifyNativeError(new Error('Missing permission')), 'PERMISSION_DENIED');
  assert.equal(classifyNativeError(new Error('Speech recognition is already running.')), 'SESSION_ACTIVE');
  assert.equal(classifyNativeError(new Error('Recognition stopped before final results were produced.')), 'STOPPED_WITHOUT_RESULT');
  assert.equal(classifyNativeError({ code: 'NETWORK_TIMEOUT' }), 'NETWORK_TIMEOUT');
  assert.equal(classifyNativeError(new Error('something odd')), 'UNKNOWN');
});

test('start options always stream partials inline and never open the system popup', async () => {
  const { plugin, controller, handlers } = createHarness({ languages: ['en-US', 'en-GB', 'yo-NG'] });
  await controller.start({ ...handlers, language: 'en-NG' });
  const options = plugin.calls.start[0];
  assert.equal(options.partialResults, true);
  assert.equal(options.popup, false);
  assert.equal(options.maxResults, 1);
  assert.equal(options.language, 'en-US', 'an unsupported tag falls back to a matching model');
});

test('the recognized language is resolved from the device list when one is exposed', () => {
  assert.equal(pickSpeechLanguage({ preferred: 'en-NG', supported: [] }), 'en-NG');
  assert.equal(pickSpeechLanguage({ preferred: 'en-NG', supported: ['en-NG', 'yo-NG'] }), 'en-NG');
  assert.equal(pickSpeechLanguage({ preferred: 'en-NG', supported: ['en-US', 'fr-FR'] }), 'en-US');
  assert.equal(pickSpeechLanguage({ preferred: 'ig-NG', supported: ['en-US', 'fr-FR'] }), '', 'no model: use the device locale');
  assert.equal(pickSpeechLanguage({ preferred: '', supported: ['en-US'] }), '');
});

// ---------- 7. Native versus web routing in the shared UI ----------

const html = await read('index.html');
const inlineScripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map((match) => match[1]);
const appSource = inlineScripts.sort((a, b) => b.length - a.length)[0];

function createUiElement(id = '') {
  const classes = new Set();
  const element = {
    id,
    value: '',
    textContent: '',
    innerHTML: '',
    style: {},
    scrollHeight: 42,
    children: [],
    queryChild: { innerHTML: '' },
    classList: {
      add: (...names) => names.forEach((name) => classes.add(name)),
      remove: (...names) => names.forEach((name) => classes.delete(name)),
      contains: (name) => classes.has(name),
      toggle: (name, force) => {
        const shouldAdd = force === undefined ? !classes.has(name) : Boolean(force);
        if (shouldAdd) classes.add(name);
        else classes.delete(name);
        return shouldAdd;
      }
    },
    appendChild(child) {
      element.children.push(child);
      return child;
    },
    remove() {},
    querySelector() {
      return element.queryChild;
    },
    focus() {},
    closest() {
      return null;
    },
    addEventListener() {}
  };
  return element;
}

function createUiContext({ native = true, webSpeech = false } = {}) {
  const elements = new Map();
  for (const id of ['quickInput', 'micBtn', 'micIcon', 'micWave', 'toasts', 'livePreview', 'modal', 'modalCard']) {
    elements.set(id, createUiElement(id));
  }
  const toasts = elements.get('toasts');
  const confirmCalls = [];
  const speechInstances = [];

  const plugin = createFakePlugin(native === 'unavailable' ? { available: false } : {});
  const controller = createSpeechController({
    plugin,
    isNative: Boolean(native),
    language: 'en-NG',
    log: { warn() {} },
    ...FAST
  });

  class FakeWebSpeechRecognition {
    constructor() {
      speechInstances.push(this);
      this.lang = '';
      this.interimResults = false;
      this.continuous = false;
    }
    start() {
      this.started = true;
      this.onstart?.();
    }
    stop() {
      this.stopped = true;
      this.onend?.();
    }
    abort() {
      this.aborted = true;
      this.onend?.();
    }
  }

  const windowStub = {
    YERE_NATIVE: native
      ? { enabled: true, platform: 'android', speech: controller, isOnline: () => true }
      : { enabled: false, speech: controller },
    YERE_SPEECH_COPY: SPEECH_ERROR_COPY,
    addEventListener() {},
    location: { origin: 'https://www.getyere.com' }
  };
  if (webSpeech) windowStub.SpeechRecognition = FakeWebSpeechRecognition;

  const context = vm.createContext({
    console: { log() {}, warn() {}, error() {} },
    crypto: webcrypto,
    btoa: (value) => Buffer.from(value, 'binary').toString('base64'),
    atob: (value) => Buffer.from(value, 'base64').toString('binary'),
    document: {
      addEventListener() {},
      documentElement: { lang: 'en', classList: { toggle() {}, add() {}, remove() {}, contains: () => false } },
      body: { style: {} },
      activeElement: { tagName: 'BODY' },
      getElementById: (id) => elements.get(id) || null,
      createElement: () => createUiElement(),
      querySelector: () => null
    },
    window: windowStub,
    navigator: { language: 'en-NG', onLine: true },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    setTimeout: () => 0,
    clearTimeout() {},
    setInterval: () => 0,
    clearInterval() {},
    Date
  });

  vm.runInContext(
    `${appSource}
    openConfirmFromInput = () => { globalThis.__confirmCalls.push(document.getElementById('quickInput').value); };
    globalThis.__confirmCalls = [];
    globalThis.__voiceTest = {
      toggleVoice, stopVoice, cancelVoice, setMicUI, notifyVoiceError, applyVoiceTranscript,
      completeVoice, failVoice, nativeSpeech, webSpeechCtor, voiceErrorMessage,
      get listening() { return listening; },
      get voiceEngine() { return voiceEngine; },
      get voiceBusy() { return voiceBusy; },
      get voiceHandledFinal() { return voiceHandledFinal; }
    };`,
    context
  );
  context.__confirmCalls = confirmCalls;

  return {
    context,
    elements,
    toasts,
    confirmCalls,
    speechInstances,
    plugin,
    controller,
    windowStub,
    toastMessages: () => toasts.children.map((child) => child.textContent),
    invoke: (expression) => vm.runInContext(expression, context),
    voice: () => vm.runInContext('__voiceTest', context)
  };
}

test('native platforms route the mic button to the native recognizer, not window.SpeechRecognition', async () => {
  const ui = createUiContext({ native: true, webSpeech: true });
  const result = await ui.invoke('toggleVoice()');
  await flush();
  assert.equal(ui.plugin.calls.start.length, 1, 'the native recognizer started');
  assert.equal(ui.speechInstances.length, 0, 'window.SpeechRecognition is not used on a native platform');
  assert.equal(ui.plugin.calls.start[0].partialResults, true);
  assert.equal(ui.voice().voiceEngine, 'native');
  assert.equal(ui.voice().listening, true);
  assert.equal(ui.elements.get('micBtn').classList.contains('listening'), true, 'the mic animation is preserved');
  assert.equal(ui.elements.get('micWave').classList.contains('hidden'), false);
  assert.equal(ui.elements.get('micIcon').classList.contains('hidden'), true);
  void result;
});

test('the browser keeps window.SpeechRecognition as its only fallback', async () => {
  const ui = createUiContext({ native: false, webSpeech: true });
  await ui.invoke('toggleVoice()');
  await flush();
  assert.equal(ui.speechInstances.length, 1, 'the Web Speech API is used in the browser');
  assert.equal(ui.plugin.calls.start.length, 0, 'the native plugin is never started on the web');
  assert.equal(ui.speechInstances[0].lang, 'en-CA');
  assert.equal(ui.speechInstances[0].interimResults, true);
  assert.equal(ui.voice().voiceEngine, 'web');
  assert.equal(ui.elements.get('micBtn').classList.contains('listening'), true);
});

test('a browser with neither engine explains that voice capture is unavailable', async () => {
  const ui = createUiContext({ native: false, webSpeech: false });
  await ui.invoke('toggleVoice()');
  await flush();
  assert.equal(ui.toastMessages().length, 1);
  assert.match(ui.toastMessages()[0], /no speech recognition service/i);
  assert.equal(ui.voice().listening, false);
});

test('native partials stream into quickInput and run the existing live parser', async () => {
  const ui = createUiContext({ native: true });
  await ui.invoke('toggleVoice()');
  await ui.plugin.emit('partialResults', { matches: ['Call Aunty tomorrow at 4pm'] });

  const input = ui.elements.get('quickInput');
  const preview = ui.elements.get('livePreview');
  assert.equal(input.value, 'Call Aunty tomorrow at 4pm');
  assert.equal(preview.classList.contains('hidden'), false, 'the live parse chips are shown');
  assert.match(preview.queryChild.innerHTML, /Call Aunty/);
  assert.match(preview.queryChild.innerHTML, /Tomorrow/);
  assert.match(preview.queryChild.innerHTML, /4:00\s*p\.?m\.?/);
});

test('the native final transcript goes through the existing reminder confirmation flow once', async () => {
  const ui = createUiContext({ native: true });
  await ui.invoke('toggleVoice()');
  await ui.plugin.emit('partialResults', { matches: ['Pay school fees on Friday'] });
  await ui.plugin.emit('listeningState', { state: 'stopped', reason: 'results' });
  await ui.plugin.emit('listeningState', { state: 'stopped', reason: 'results' });

  assert.deepEqual(ui.confirmCalls, ['Pay school fees on Friday'], 'one confirmation screen');
  assert.equal(ui.voice().listening, false);
  assert.equal(ui.elements.get('micBtn').classList.contains('listening'), false);
  assert.equal(ui.plugin.totalListeners(), 0, 'listeners are cleaned up after success');
});

test('tapping the mic again stops the active native session and confirms what was captured', async () => {
  const ui = createUiContext({ native: true });
  await ui.invoke('toggleVoice()');
  await ui.plugin.emit('partialResults', { matches: ['Call the dentist'] });
  assert.equal(ui.voice().listening, true);

  await ui.invoke('toggleVoice()');
  assert.equal(ui.plugin.calls.stop, 1);

  await ui.plugin.emit('listeningState', { state: 'stopped', reason: 'userStop' });
  assert.deepEqual(ui.confirmCalls, ['Call the dentist']);
  assert.equal(ui.voice().listening, false);
  assert.equal(ui.plugin.totalListeners(), 0);
});

test('rapid mic taps do not start overlapping native sessions', async () => {
  const ui = createUiContext({ native: true });
  await Promise.all([ui.invoke('toggleVoice()'), ui.invoke('toggleVoice()'), ui.invoke('toggleVoice()')]);
  await flush();
  assert.ok(ui.plugin.calls.start.length <= 1, `at most one session starts (got ${ui.plugin.calls.start.length})`);
  assert.equal(ui.plugin.calls.addListener.length <= 3, true);
});

test('native failures surface one specific notification and reset the mic UI', async () => {
  const ui = createUiContext({ native: true });
  await ui.invoke('toggleVoice()');
  await ui.plugin.emit('error', { code: 'NETWORK', message: 'Network error', sessionId: 1 });
  await ui.plugin.emit('error', { code: 'NETWORK', message: 'Network error', sessionId: 1 });
  await ui.plugin.emit('listeningState', { state: 'stopped', reason: 'error', errorCode: 'NETWORK' });

  const messages = ui.toastMessages();
  assert.equal(messages.length, 1, 'the same failure is never stacked');
  assert.match(messages[0], /internet connection/i);
  assert.equal(ui.voice().listening, false);
  assert.equal(ui.elements.get('micBtn').classList.contains('listening'), false);
  assert.equal(ui.confirmCalls.length, 0);
  assert.equal(ui.plugin.totalListeners(), 0);
});

test('an unavailable native recognizer explains itself without touching permissions', async () => {
  const ui = createUiContext({ native: 'unavailable', webSpeech: true });
  await ui.invoke('toggleVoice()');
  await flush();
  assert.equal(ui.plugin.calls.start.length, 0);
  assert.equal(ui.plugin.calls.checkPermissions, 0);
  assert.equal(ui.speechInstances.length, 0, 'a broken native recognizer does not silently downgrade mid-session');
  assert.match(ui.toastMessages()[0], /no speech recognition service/i);
});

test('browser voice failures are specific too: permission, no speech, network, and language model', async () => {
  const cases = [
    ['not-allowed', /Microphone access is blocked/i],
    ['no-speech', /did not hear/i],
    ['network', /internet connection/i],
    ['language-not-supported', /speech model|language/i],
    ['audio-capture', /microphone could not be read/i]
  ];
  const seen = [];
  for (const [code, pattern] of cases) {
    const ui = createUiContext({ native: false, webSpeech: true });
    await ui.invoke('toggleVoice()');
    const instance = ui.speechInstances[0];
    instance.onerror({ error: code });
    const messages = ui.toastMessages();
    assert.equal(messages.length, 1, `${code} produces one notification`);
    assert.match(messages[0], pattern);
    assert.doesNotMatch(messages[0], /Mic error or permission denied/);
    seen.push(messages[0]);
  }
  assert.equal(new Set(seen).size, seen.length, 'browser failures are worded differently from each other');
});

test('an aborted browser session stays quiet', async () => {
  const ui = createUiContext({ native: false, webSpeech: true });
  await ui.invoke('toggleVoice()');
  ui.speechInstances[0].onerror({ error: 'aborted' });
  assert.equal(ui.toastMessages().length, 0);
});

test('cancelVoice stops native capture without opening a confirmation', async () => {
  const ui = createUiContext({ native: true });
  await ui.invoke('toggleVoice()');
  await ui.plugin.emit('partialResults', { matches: ['Half a reminder'] });
  await ui.invoke('cancelVoice()');
  await flush();
  assert.equal(ui.confirmCalls.length, 0);
  assert.equal(ui.voice().listening, false);
  assert.equal(ui.plugin.totalListeners(), 0);
  assert.equal(ui.elements.get('micBtn').classList.contains('listening'), false);
});

// ---------- 8. Static guarantees ----------

test('the shared UI keeps the Web Speech API strictly as a browser fallback', () => {
  const voice = html.slice(html.indexOf('/* ---------- Voice ----------'), html.indexOf('function setMicUI(on)'));
  const toggle = voice.slice(voice.indexOf('async function toggleVoice()'), voice.indexOf('async function startNativeVoice'));
  const nativeCheck = toggle.indexOf('nativeSpeech()');
  const webCheck = toggle.indexOf('webSpeechCtor()');
  assert.ok(nativeCheck > 0, 'the mic button consults the native recognizer');
  assert.ok(webCheck > nativeCheck, 'window.SpeechRecognition is only reached when there is no native recognizer');
  assert.match(voice, /window\.SpeechRecognition\|\|window\.webkitSpeechRecognition/);
  assert.doesNotMatch(html, /Mic error or permission denied/, 'the generic failure message is gone');
  assert.doesNotMatch(html, /Speech recognition not supported in this browser/);
});

test('voice capture never records, stores, or uploads audio', async () => {
  const [speech, native] = await Promise.all([read('src/speech.js'), read('src/native.js')]);
  assert.doesNotMatch(speech, /Filesystem|writeFile|MediaRecorder|getUserMedia|base64|blob/i);
  assert.match(speech, /only ever handles transcript text|Raw audio stays inside the OS recognizer/);
  const speechBridge = native.slice(
    native.indexOf('const speech = createSpeechController'),
    native.indexOf('const nativeBridge = {')
  );
  assert.ok(speechBridge.length > 0);
  assert.doesNotMatch(speechBridge, /Filesystem|writeFile|Preferences|saveOfflineSnapshot/);
});

test('the Capacitor 8 speech plugin is installed for Android and iOS', async () => {
  const pkg = JSON.parse(await read('package.json'));
  const dependency = pkg.dependencies['@capgo/capacitor-speech-recognition'];
  assert.ok(dependency, 'the plugin is a runtime dependency');
  assert.match(dependency, /^\^8\./, 'the plugin major version matches Capacitor 8');

  const lock = JSON.parse(await read('package-lock.json'));
  const locked = lock.packages['node_modules/@capgo/capacitor-speech-recognition'];
  assert.ok(locked, 'the plugin is locked');
  assert.match(locked.version, /^8\./);

  const [androidSettings, androidBuild, iosPackage] = await Promise.all([
    read('android/capacitor.settings.gradle'),
    read('android/app/capacitor.build.gradle'),
    read('ios/App/CapApp-SPM/Package.swift')
  ]);
  assert.match(androidSettings, /capgo-capacitor-speech-recognition/);
  assert.match(androidSettings, /@capgo\/capacitor-speech-recognition\/android/);
  assert.match(androidBuild, /implementation project\(':capgo-capacitor-speech-recognition'\)/);
  assert.match(iosPackage, /CapgoCapacitorSpeechRecognition/);
});

test('Android keeps RECORD_AUDIO and declares the speech recognizer query for package visibility', async () => {
  const manifest = await read('android/app/src/main/AndroidManifest.xml');
  assert.match(manifest, /android\.permission\.RECORD_AUDIO/);
  assert.match(manifest, /<queries>[\s\S]*android\.speech\.RecognitionService[\s\S]*<\/queries>/);
});

test('iOS keeps its microphone and speech recognition usage descriptions', async () => {
  const info = await read('ios/App/App/Info.plist');
  assert.match(info, /NSMicrophoneUsageDescription/);
  assert.match(info, /NSSpeechRecognitionUsageDescription/);
  assert.match(info, /only when you choose voice capture/);
});

test('the native bridge exposes speech without requesting permissions at boot', async () => {
  const native = await read('src/native.js');
  assert.match(native, /import \{ SpeechRecognition \} from '@capgo\/capacitor-speech-recognition'/);
  assert.match(native, /import \{ createSpeechController \} from '\.\/speech\.js'/);
  assert.match(native, /createSpeechController\(\{[\s\S]*?plugin: SpeechRecognition[\s\S]*?isNative: enabled/);
  assert.doesNotMatch(native, /requestPermissions\(\)[\s\S]{0,40}speech/i);
  assert.doesNotMatch(native, /SERVICE_ROLE|FIREBASE_PRIVATE_KEY|APNS_PRIVATE_KEY/);
});
