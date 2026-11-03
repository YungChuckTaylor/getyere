// Native notification preference is device/account scoped. Never infer OS consent
// or successful delivery from the preference alone. Existing explicit off wins.
export function resolveDevicePushPreference(stored, native) {
  return stored === "1" || (stored == null && native);
}

export function createNativePushController({
  getContext,
  getBridge,
  register,
  onState = () => {},
  hasPrompted = () => false,
  markPrompted = () => {},
}) {
  let epoch = 0;
  let flight = null;
  const prompted = new Set();
  let status = {
    ownerId: null,
    phase: "idle",
    permission: "unknown",
    registered: false,
    error: "",
  };
  function context() {
    return getContext() || {};
  }
  function valid(ownerId, version) {
    const c = context();
    return Boolean(
      ownerId &&
      c.ownerId === ownerId &&
      c.enabled &&
      !c.signingOut &&
      epoch === version,
    );
  }
  function report(ownerId, patch) {
    if (status.ownerId !== ownerId)
      status = {
        ownerId,
        phase: "idle",
        permission: "unknown",
        registered: false,
        error: "",
      };
    status = { ...status, ...patch };
    onState({ ...status });
  }
  function reset() {
    epoch++;
    flight = null;
    status = {
      ownerId: context().ownerId || null,
      phase: "idle",
      permission: "unknown",
      registered: false,
      error: "",
    };
    onState({ ...status });
  }
  function ensure({ interactive = false } = {}) {
    const { ownerId, enabled, signingOut } = context();
    const version = epoch;
    if (!ownerId || !enabled || signingOut) return Promise.resolve(false);
    if (flight?.ownerId === ownerId && flight.version === version) {
      flight.interactive ||= interactive;
      return flight.promise;
    }
    const entry = { ownerId, version, interactive, promise: null };
    // Defer execution until flight is assigned, even if a dependency throws immediately.
    entry.promise = Promise.resolve()
      .then(async () => {
        if (!valid(ownerId, version)) return false;
        report(ownerId, { phase: "registering", error: "", registered: false });
        const bridge = getBridge();
        const permission = await bridge.getPushPermission();
        if (!valid(ownerId, version)) return false;
        report(ownerId, { permission });
        if (permission === "denied") {
          report(ownerId, {
            phase: "blocked",
            error:
              "Allow notifications for Yere in your phone’s settings. Your notification preference is still on.",
          });
          return false;
        }
        const promptable =
          permission === "prompt" || permission === "prompt-with-rationale";
        if (
          promptable &&
          !entry.interactive &&
          (permission === "prompt-with-rationale" ||
            prompted.has(ownerId) ||
            hasPrompted(ownerId))
        ) {
          report(ownerId, {
            phase: "blocked",
            error:
              "Notification permission is still needed. Use Retry notification setup when you are ready.",
          });
          return false;
        }
        if (promptable) {
          prompted.add(ownerId);
          markPrompted(ownerId);
        }
        // Automatic setup asks once, never repeatedly on resume after a dismissal/denial.
        const registration = await bridge.registerPush();
        if (!valid(ownerId, version)) return false;
        report(ownerId, {
          permission: registration.granted
            ? "granted"
            : registration.permission || "prompt",
        });
        if (!registration.granted) {
          report(ownerId, {
            phase: "blocked",
            error:
              "Notification permission was not granted. You can allow it in your phone’s settings.",
          });
          return false;
        }
        if (
          typeof registration.token !== "string" ||
          !registration.token.trim()
        )
          throw new Error(
            "No device notification token was returned. Please retry setup.",
          );
        report(ownerId, { phase: "saving" });
        const saved = await register(registration);
        if (!valid(ownerId, version)) return false;
        if (saved === false)
          throw new Error(
            "This device’s notification registration was not saved. Retry setup.",
          );
        report(ownerId, { phase: "ready", registered: true, error: "" });
        return registration;
      })
      .catch((error) => {
        if (!valid(ownerId, version)) return false;
        report(ownerId, {
          phase: "error",
          error: error?.message || "Notification setup failed. Please retry.",
        });
        throw error;
      })
      .finally(() => {
        if (flight === entry) flight = null;
      });
    flight = entry;
    return entry.promise;
  }
  function deliveryError(message) {
    const { ownerId, enabled, signingOut } = context();
    if (ownerId && enabled && !signingOut) report(ownerId, { error: message });
  }
  return { ensure, reset, deliveryError, getState: () => ({ ...status }) };
}
