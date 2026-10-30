// Protocol presentation state only. No workout storage, timers or automatic retry.
const WorkoutConcurrency = (() => {
  const clone = value => structuredClone(value);
  const messages = Object.freeze({
    PENDING: "A save is awaiting confirmation. Your entry is still here.",
    OUTCOME_UNKNOWN: "Save confirmation was lost. Your entry is still here. Check the result or retry this same request before submitting it again.",
    CONFLICT: "Another tab or device changed this workout. Your entry has been kept. Refresh saved data, review the change, then submit again.",
    REQUEST_CONFLICT: "This request identity was used with different input. Your entry has been kept. Check the original result before submitting again.",
    CANCELLED: "The unresolved submission did not commit and was cancelled. Review saved data before submitting a new request.",
    RECOVERY_ERROR: "Request recovery could not be recorded. Nothing was sent. Keep your entry and restore session storage before retrying.",
    LOAD_ERROR: "Saved data could not be refreshed. Your entry has been kept; saving is paused.",
    AUTHORIZATION_ERROR: "Account access could not be verified. Your entry has been kept; saving is paused.",
    VALIDATION_ERROR: "The request was rejected. Your entry has been kept.",
    DISPOSED: "This account view is no longer active.",
  });
  const revision = value => typeof value === "string" && /^(0|[1-9][0-9]*)$/.test(value);
  const actions = Object.freeze(["initialize","logSet","editSet","deleteSet","logBodyweight","selectPlan","clearPlan","toggleSlotShort","cycleSlotRole","addSlot","removeSlot","createSession","completeSession","attachSetToSession","startGuidedSession","enableGuidance","selectGuidedSlot","moveGuidedSlot","setGuidedSlotStatus","substituteGuidedExercise","logGuidedSet","finishGuidedSession","saveScopedNote","commitImport"]);
  const validOperation = op => Array.isArray(op) && actions.includes(op[0]) &&
    op.length === (op[0] === "logGuidedSet" ? 3 : 2) && op.every(v=>typeof v === "string" && v.length > 0);
  function create({ initial, repository, prepare, ownerId = repository.ownerId,
    recoveryStorage = globalThis.sessionStorage, createRequestId = () => crypto.randomUUID() }) {
    if (!revision(initial.revision) || initial.protocolVersion !== 1 || initial.ownerId !== ownerId)
      throw Error("A verified protocol-1 load handle is required.");
    let committed = clone(initial), phase = "READY", alive = true, generation = 0, refreshSequence = 0;
    let packet = null, operation = null, awaiting = false;
    const key = `gymbro-request-recovery-v1-${ownerId}`;
    const state = () => committed.document ? clone(committed.document) : null;
    const result = (code, extra = {}) => ({ ok: ["OK","REPLAY","NO_CHANGE"].includes(code), code,
      errors: messages[code] ? [messages[code]] : [], changes: [], ...extra, state: state() });
    try {
      const raw = recoveryStorage.getItem(key);
      if (raw !== null) {
        const marker = JSON.parse(raw);
        if (marker.protocolVersion !== 1 || marker.ownerId !== ownerId || !validOperation(marker.operation)) throw Error("marker");
        operation = clone(marker.operation); phase = "OUTCOME_UNKNOWN";
      }
    } catch { phase = "RECOVERY_ERROR"; }
    function mark(op) {
      const raw = JSON.stringify({ protocolVersion: 1, ownerId, operation: op });
      recoveryStorage.setItem(key, raw);
      if (recoveryStorage.getItem(key) !== raw) throw Error("marker");
    }
    function clear() {
      recoveryStorage.removeItem(key);
      if (recoveryStorage.getItem(key) !== null) throw Error("marker");
    }
    function adopt(handle) {
      if (handle.protocolVersion !== 1 || handle.ownerId !== ownerId || !revision(handle.revision)) throw Error("snapshot");
      if (BigInt(handle.revision) >= BigInt(committed.revision)) committed = clone(handle);
    }
    async function send(resolving = false) {
      if (!alive) return result("DISPOSED");
      if (awaiting) return result("PENDING");
      if (!operation || (!resolving && !packet)) return result(phase);
      const currentGeneration = generation;
      awaiting = true; phase = "PENDING";
      let response;
      try {
        response = resolving ? await repository.resolve(operation) : await repository.submit(packet);
        if (!alive || currentGeneration !== generation) return result("DISPOSED");
        if (!["OK","REPLAY","NO_CHANGE","CANCELLED","CONFLICT","REQUEST_CONFLICT","VALIDATION_ERROR","AUTHORIZATION_ERROR"].includes(response.code)) throw Error("response");
        if (response.code === "REQUEST_CONFLICT") { phase = "REQUEST_CONFLICT"; return result("REQUEST_CONFLICT"); }
        if (["OK","REPLAY","NO_CHANGE","CANCELLED"].includes(response.code)) adopt(response.saved);
        // Clear only an acknowledged terminal operation. Failure to clear leaves
        // the recovery marker and request frozen so a reload remains safe.
        clear();
        phase = response.code === "CONFLICT" ? "CONFLICT" : response.code === "AUTHORIZATION_ERROR" ? "AUTHORIZATION_ERROR" : "READY";
        packet = null; operation = null;
        return result(response.code, { ...response.result, operationRevision: response.operationRevision,
          revision: committed.revision, changes: response.code === "OK" ? response.result?.changes ?? [] : [] });
      } catch {
        if (!alive || currentGeneration !== generation) return result("DISPOSED");
        phase = "OUTCOME_UNKNOWN";
        return result("OUTCOME_UNKNOWN");
      } finally { awaiting = false; }
    }
    return Object.freeze({
      getWorkoutState: state,
      getStatus: () => ({ phase, revision: committed.revision, canRetry: !!packet && !awaiting,
        canResolve: !!operation && !awaiting, operation: clone(operation), message: messages[phase] ?? "" }),
      async execute(name, ...args) {
        if (!alive) return result("DISPOSED");
        if (phase !== "READY") return result(phase);
        phase = "PENDING";
        const currentGeneration = generation;
        const base = clone(committed);
        try {
          const prepared = await prepare(base, name, clone(args));
          if (!alive || currentGeneration !== generation) return result("DISPOSED");
          if (!prepared.candidate) {
            if (["REPLAY","NO_CHANGE"].includes(prepared.result.code)) {
              try {
                const loaded = await repository.load();
                if (!alive || currentGeneration !== generation) return result("DISPOSED");
                adopt(loaded);
                const replay = await prepare(clone(committed),name,clone(args));
                if (!alive || currentGeneration !== generation) return result("DISPOSED");
                if (replay.candidate || replay.result.code !== prepared.result.code) { phase="CONFLICT";return result("CONFLICT"); }
                phase="READY";return { ...replay.result,state:state() };
              } catch { phase="LOAD_ERROR";return result("LOAD_ERROR"); }
            }
            phase = "READY"; return { ...prepared.result, state: state() };
          }
          const op = name === "logGuidedSet" ? [name,args[0].sessionId,args[0].requestId] : [name,createRequestId()];
          if (!validOperation(op)) throw Error("operation");
          packet = repository.prepare(base, prepared.candidate, { action: name, args, operation: op, result: prepared.result });
          operation = op;
          try { mark(op); } catch { packet = null; operation = null; phase = "RECOVERY_ERROR"; return result("RECOVERY_ERROR"); }
        } catch { phase = "READY"; return result("VALIDATION_ERROR"); }
        return send();
      },
      retry: () => send(),
      resolve: () => send(true),
      async refresh() {
        if (!alive) return result("DISPOSED");
        const sequence = ++refreshSequence, currentGeneration = generation;
        try {
          const loaded = await repository.load();
          if (!alive || currentGeneration !== generation) return result("DISPOSED");
          if (sequence !== refreshSequence) return result("NO_CHANGE");
          adopt(loaded);
          if (!operation && !awaiting && phase !== "RECOVERY_ERROR") phase = "READY";
          return result("NO_CHANGE", { revision: committed.revision });
        } catch {
          if (!alive || currentGeneration !== generation) return result("DISPOSED");
          if (!operation && !awaiting) phase = "LOAD_ERROR";
          return result("LOAD_ERROR");
        }
      },
      dispose() { alive = false; generation++; phase = "DISPOSED"; packet = null; operation = null; },
    });
  }
  return Object.freeze({ create, revision, validOperation, messages });
})();
