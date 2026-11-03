import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
import {
  createNativePushController,
  resolveDevicePushPreference,
} from "../src/native-push-controller.js";
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const pause = () => new Promise((resolve) => setImmediate(resolve));

function controllerHarness({
  permission = "granted",
  registrationError = false,
  savingError = false,
} = {}) {
  const context = { ownerId: "alice", enabled: true, signingOut: false },
    calls = [],
    states = [];
  let savedPrompt = false;
  const controller = createNativePushController({
    getContext: () => context,
    getBridge: () => ({
      getPushPermission: async () => permission,
      registerPush: async () => {
        calls.push("native");
        if (registrationError)
          throw new Error("Build configuration unavailable");
        return {
          granted: true,
          token: "fresh-token",
          platform: "ios",
          provider: "apns",
        };
      },
    }),
    register: async () => {
      calls.push("save");
      if (savingError) throw new Error("Registration could not be saved");
      return true;
    },
    onState: (s) => states.push(s),
    hasPrompted: () => savedPrompt,
    markPrompted: () => {
      savedPrompt = true;
    },
  });
  return { controller, context, calls, states };
}

test("new native installs default on; browser defaults and every stored off choice remain off", () => {
  assert.equal(resolveDevicePushPreference(null, true), true);
  assert.equal(resolveDevicePushPreference(undefined, true), true);
  assert.equal(resolveDevicePushPreference("0", true), false);
  assert.equal(resolveDevicePushPreference("1", true), true);
  assert.equal(resolveDevicePushPreference(null, false), false);
  assert.equal(resolveDevicePushPreference("unexpected", true), false);
});
test("default-on setup registers once after permission; concurrent operations share the result", async () => {
  const h = controllerHarness();
  const results = await Promise.all([
    h.controller.ensure(),
    h.controller.ensure(),
  ]);
  assert.deepEqual(h.calls, ["native", "save"]);
  assert.equal(results[0].token, "fresh-token");
  assert.equal(results[0], results[1]);
  assert.equal(h.controller.getState().registered, true);
});
test("default-on never bypasses denied permission or automatically repeats rationale prompts", async () => {
  for (const permission of ["denied", "prompt-with-rationale"]) {
    const h = controllerHarness({ permission });
    assert.equal(await h.controller.ensure(), false);
    assert.deepEqual(h.calls, []);
    assert.equal(h.controller.getState().registered, false);
  }
});
test("automatic prompt happens once, and a later explicit retry can request permission", async () => {
  const h = controllerHarness({ permission: "prompt" });
  await h.controller.ensure();
  assert.equal(await h.controller.ensure(), false);
  await h.controller.ensure({ interactive: true });
  assert.deepEqual(h.calls, ["native", "save", "native", "save"]);
});
test("existing off and sign-out never register; permission remains unknown until checked", async () => {
  const h = controllerHarness();
  assert.equal(h.controller.getState().permission, "unknown");
  h.context.enabled = false;
  assert.equal(await h.controller.ensure(), false);
  h.context.enabled = true;
  h.context.signingOut = true;
  assert.equal(await h.controller.ensure(), false);
  assert.deepEqual(h.calls, []);
});
test("registration/configuration failures retain the on preference and do not pretend registration succeeded", async () => {
  for (const option of ["registrationError", "savingError"]) {
    const h = controllerHarness({ [option]: true });
    await assert.rejects(h.controller.ensure());
    assert.equal(h.context.enabled, true);
    assert.equal(h.controller.getState().registered, false);
    assert.equal(h.controller.getState().phase, "error");
  }
});
test("late setup cannot enable/save after off-on cancellation or an account switch", async () => {
  for (const action of ["off-on", "account-switch"]) {
    const context = { ownerId: "alice", enabled: true },
      calls = [];
    let release;
    const controller = createNativePushController({
      getContext: () => context,
      getBridge: () => ({
        getPushPermission: () =>
          new Promise((resolve) => {
            release = resolve;
          }),
        registerPush: async () => {
          calls.push("native");
          return { granted: true, token: "token" };
        },
      }),
      register: async () => {
        calls.push("save");
        return true;
      },
    });
    const pending = controller.ensure();
    await pause();
    if (action === "off-on") {
      context.enabled = false;
      controller.reset();
      context.enabled = true;
    } else context.ownerId = "bob";
    release("granted");
    assert.equal(await pending, false);
    assert.deepEqual(calls, []);
  }
});

function appHarness({
  stored = null,
  permission = "granted",
  invokeError = null,
  invokeThrows = false,
  registrationError = false,
} = {}) {
  const calls = { native: 0, rpc: [], test: [], toasts: [] },
    storage = new Map();
  if (stored !== null) storage.set("Yere.deviceNotifications.alice", stored);
  const bridge = {
    enabled: true,
    getPushPermission: async () => permission,
    registerPush: async () => {
      calls.native++;
      if (registrationError)
        throw new Error("Notifications unavailable in this build");
      return {
        granted: permission === "granted",
        permission,
        token: "fresh-token",
        platform: "ios",
        provider: "apns",
      };
    },
    getPushRegistration: () => ({
      token: "stale-cached-token",
      platform: "ios",
      provider: "apns",
    }),
    unregisterPush: async () => {},
  };
  const context = vm.createContext({
    currentSession: { user: { id: "alice" } },
    signOutInProgress: false,
    state: { settings: { pushEnabled: false, notif: false } },
    view: "today",
    navigator: { userAgent: "test" },
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
    },
    window: {
      YERE_NATIVE: bridge,
      YERE_PUSH: { createNativePushController, resolveDevicePushPreference },
    },
    isNativeApp: () => true,
    deviceNotificationKey: () =>
      `Yere.deviceNotifications.${context.currentSession?.user?.id || "local"}`,
    saveLocalCache() {},
    persist() {},
    render() {},
    toast: (message) => calls.toasts.push(message),
    esc: (s) => s,
    supabase: {
      rpc: async (...args) => {
        calls.rpc.push(args);
        return { error: null };
      },
      functions: {
        invoke: async (...args) => {
          calls.test.push(args);
          if (invokeThrows) throw new Error("Connection lost");
          return {
            data: invokeError ? null : { accepted: true },
            error: invokeError,
          };
        },
      },
    },
  });
  const preference = html.slice(
    html.indexOf("const deviceNotificationChoices=new Map();"),
    html.indexOf("function accountSettingsForCloud(){"),
  );
  const push = html.slice(
    html.indexOf("let nativePushTask=Promise.resolve();"),
    html.indexOf("async function registerPWA(){"),
  );
  vm.runInContext(preference + push, context);
  context.restoreDeviceNotificationSettings();
  return {
    context,
    calls,
    storage,
    bridge,
    status: () => vm.runInContext("nativePushState", context),
  };
}
test("native sign-in automatically prepares the restored preference, including offline-cache startup", () => {
  const startup = html.slice(
    html.indexOf("async function startCloudWorkspace"),
    html.indexOf("function startRealtimeSync"),
  );
  assert.match(startup, /load\(false\);restoreDeviceNotificationSettings\(\)/);
  assert.match(
    startup,
    /isNativeApp\(\)&&state.settings.pushEnabled\)ensureNativePushRegistration\(\)/,
  );
});
test("app default-on is not shown as permission granted before the real permission check", async () => {
  const h = appHarness();
  assert.equal(h.context.state.settings.pushEnabled, true);
  assert.equal(h.context.state.settings.notif, false);
  await h.context.ensureNativePushRegistration();
  assert.equal(h.context.state.settings.notif, true);
  assert.equal(h.status().registered, true);
});
test("test uses a freshly registered token, not a cached token; rapid taps make one request", async () => {
  const h = appHarness();
  await Promise.all([
    h.context.sendTestNotification(),
    h.context.sendTestNotification(),
  ]);
  assert.equal(h.calls.test.length, 1);
  assert.equal(h.calls.test[0][1].body.deviceToken, "fresh-token");
  assert.equal(h.calls.toasts.length, 1);
  assert.match(h.calls.toasts[0], /accepted/);
});
test("explicit test from off prepares the device once, without a second native registration", async () => {
  const h = appHarness({ stored: "0" });
  await h.context.sendTestNotification();
  assert.equal(h.calls.native, 1);
  assert.equal(h.calls.test.length, 1);
});
test("test cannot send after denied permission or native registration failure", async () => {
  for (const options of [
    { permission: "denied" },
    { registrationError: true },
  ]) {
    const h = appHarness(options);
    await h.context.sendTestNotification();
    assert.equal(h.calls.test.length, 0);
    assert.equal(h.status().registered, false);
  }
});
test("network exceptions and structured server errors are caught and remain visible without turning preference off", async () => {
  for (const options of [
    { invokeThrows: true },
    {
      invokeError: {
        context: {
          json: async () => ({
            error: "iOS notifications are not configured on the Yere server.",
          }),
        },
      },
    },
  ]) {
    const h = appHarness(options);
    await h.context.sendTestNotification();
    assert.equal(h.calls.toasts.length, 1);
    assert.ok(h.status().error);
    assert.equal(h.context.state.settings.pushEnabled, true);
    assert.equal(
      vm.runInContext("nativeNotificationTestPending", h.context),
      false,
    );
  }
});
test("late test results never toast into another account", async () => {
  const h = appHarness();
  let finish;
  h.context.supabase.functions.invoke = async () =>
    new Promise((resolve) => {
      finish = resolve;
    });
  const pending = h.context.sendTestNotification();
  await pause();
  h.context.currentSession = { user: { id: "bob" } };
  finish({ data: { accepted: true }, error: null });
  await pending;
  assert.equal(h.calls.toasts.length, 0);
});
test("explicit opt-out persists, cancels setup and is not re-enabled by a background retry", async () => {
  const h = appHarness();
  await h.context.ensureNativePushRegistration();
  h.bridge.getPushRegistration = () => ({ token: "" });
  await h.context.togglePushNotifications();
  assert.equal(h.context.state.settings.pushEnabled, false);
  assert.equal(h.storage.get("Yere.deviceNotifications.alice"), "0");
  h.context.restoreDeviceNotificationSettings();
  assert.equal(await h.context.ensureNativePushRegistration(), false);
  assert.equal(h.context.state.settings.pushEnabled, false);
});
