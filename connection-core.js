// Data authority is independent of authentication. No offline write queue.
function createConnectionController({
  storage,
  getState,
  setState,
  validate,
  request,
  localLoad,
  onChange = () => {},
}) {
  const key = "gymbroConnectedV3";
  let saved = null,
    session = null,
    busy = false,
    pending = null,
    preview = null,
    raw = null;
  let status = "local-only";
  try {
    raw = storage.getItem(key);
    if (raw) {
      saved = JSON.parse(raw);
      validate(saved.state);
      if (!saved.userId || !Number.isSafeInteger(saved.revision))
        throw Error("Invalid cache");
      setState(structuredClone(saved.state));
      pending = saved.pending || null;
      status = "cached connected data while unavailable";
    }
  } catch {
    if (raw) {
      saved = { userId: null, state: null, revision: 0 };
      status = "connected cache unavailable; explicitly choose a dataset";
      setState({
        ...getState(),
        sets: [],
        sessions: [],
        bodyweights: [],
        imports: [],
        preferences: {},
        activeSessionId: null,
      });
    }
  }
  const notify = () => onChange();
  const isLocal = () => saved === null;
  function authenticated() {
    if (!session) throw Error("Sign in to access server data.");
    if (saved && saved.userId !== session.user.id)
      throw Error(
        "The displayed dataset belongs to another account. Explicitly choose which dataset to use.",
      );
  }
  async function api(body) {
    authenticated();
    return request(body, session.access_token);
  }
  function persistEnvelope(envelope) {
    storage.setItem(key, JSON.stringify(envelope));
  }
  function adopt(state, revision) {
    validate(state);
    saved = { ...saved, state: structuredClone(state), revision };
    setState(structuredClone(state));
    try {
      persistEnvelope(saved);
    } catch {
      status =
        "connected/server-authoritative; browser cache could not be saved";
    }
    notify();
  }
  function auth(next) {
    const same = session?.user.id === next?.user.id;
    session = next;
    if (saved && (!same || !next))
      status = "cached connected data while unavailable";
    notify();
  }
  async function refresh() {
    if (busy) throw Error("Wait for the current operation.");
    authenticated();
    const userId = session.user.id;
    busy = true;
    try {
      const result = await api({ op: "state" });
      if (session?.user.id !== userId)
        throw Error("Authentication changed. Cached data retained.");
      if (!saved) return result;
      if (!result.state)
        throw Error("Server dataset unavailable. Cached data retained.");
      status = "connected/server-authoritative";
      adopt(result.state, result.revision);
      return result;
    } catch (error) {
      if (saved) status = "cached connected data while unavailable";
      throw error;
    } finally {
      busy = false;
      notify();
    }
  }
  async function switchConnected(result, userId) {
    if (!result.state) throw Error("No server dataset to use.");
    validate(result.state);
    const envelope = {
      userId,
      state: structuredClone(result.state),
      revision: result.revision,
    };
    persistEnvelope(envelope);
    saved = envelope;
    setState(structuredClone(result.state));
    status = "connected/server-authoritative";
    preview = null;
    pending = null;
    notify();
  }
  async function useServer() {
    if (busy) throw Error("Wait for the current operation.");
    if (!session) throw Error("Sign in first.");
    if (pending)
      throw Error("Resolve the pending save before switching datasets.");
    const userId = session.user.id,
      token = session.access_token;
    busy = true;
    try {
      const result = await request({ op: "state" }, token);
      if (session?.user.id !== userId)
        throw Error("Authentication changed. Dataset was not switched.");
      await switchConnected(result, userId);
    } finally {
      busy = false;
      notify();
    }
  }
  function useLocal() {
    if (pending)
      throw Error("Resolve the pending save before switching datasets.");
    if (busy) throw Error("Wait for the current operation.");
    const data = localLoad();
    validate(data);
    storage.removeItem(key);
    saved = null;
    pending = null;
    preview = null;
    setState(data);
    status = "local-only";
    notify();
  }
  async function importPreview(candidate) {
    if (busy) throw Error("Wait for the current operation.");
    if (!isLocal())
      throw Error("Switch explicitly to local-only mode before importing.");
    authenticated();
    const userId = session.user.id,
      originalLocal = JSON.stringify(getState());
    const state = structuredClone(candidate || getState());
    validate(state);
    busy = true;
    try {
      const result = await api({ op: "import-preview", state });
      if (
        session?.user.id !== userId ||
        JSON.stringify(getState()) !== originalLocal
      )
        throw Error("Local data or account changed. Preview again.");
      preview = { ...result, local: originalLocal, userId };
      return result;
    } finally {
      busy = false;
      notify();
    }
  }
  async function importCommit(integrity) {
    if (busy) throw Error("Wait for the current operation.");
    if (
      !preview ||
      !isLocal() ||
      preview.local !== JSON.stringify(getState()) ||
      preview.userId !== session?.user.id
    )
      throw Error("Local data or account changed. Preview again.");
    busy = true;
    const p = preview;
    try {
      const body =
        p.commitBody ||
        (p.commitBody = {
          op: "import-commit",
          previewId: p.previewId,
          digest: p.digest,
          expectedRevision: p.revision,
          confirm: true,
          requestId: crypto.randomUUID(),
        });
      const committed = await api(body);
      if (!committed.ok) throw Error("Import did not commit.");
      const readback = await api({ op: "state" });
      if (
        !readback.state ||
        readback.digest !== p.digest ||
        (await integrity(readback.state)) !== p.digest ||
        (await integrity(p.state)) !== p.digest
      )
        throw Error(
          "Server read-back differs from the reviewed import. Local mode retained.",
        );
      if (
        p.local !== JSON.stringify(getState()) ||
        p.userId !== session?.user.id
      )
        throw Error("Local data or account changed. Local mode retained.");
      // Final authority change is a single cache-envelope write after verified read-back.
      await switchConnected(readback, p.userId);
    } finally {
      busy = false;
      notify();
    }
  }
  async function mutate(intent) {
    if (busy)
      return {
        ok: false,
        code: "PERSISTENCE_BUSY",
        errors: ["A save is in progress."],
        changes: [],
      };
    try {
      authenticated();
      if (!saved) throw Error("Connected dataset required.");
      const signature = JSON.stringify(intent);
      if (pending && pending.signature !== signature)
        throw Error(
          "A previous save has an unknown outcome. Retry the same operation before starting another.",
        );
      if (!pending) {
        if (status !== "connected/server-authoritative")
          throw Error("Refresh connected data before saving.");
        pending = {
          signature,
          body: {
            ...intent,
            expectedRevision: saved.revision,
            requestId: crypto.randomUUID(),
          },
        };
        saved.pending = pending;
        try {
          persistEnvelope(saved);
        } catch (e) {
          pending = null;
          delete saved.pending;
          throw e;
        }
      }
      busy = true;
      const userId = session.user.id;
      let result;
      try {
        result = await api(pending.body);
      } catch (e) {
        status = "cached connected data while unavailable";
        if (e.definitive) {
          pending = null;
          delete saved.pending;
          persistEnvelope(saved);
        }
        throw e;
      }
      pending = null;
      delete saved.pending;
      if (result.state) {
        status =
          session?.user.id === userId
            ? "connected/server-authoritative"
            : "cached connected data while unavailable";
        adopt(result.state, result.revision);
      }
      return result;
    } catch (e) {
      return {
        ok: false,
        code: "CONNECTED_SAVE_FAILED",
        errors: [e.message],
        changes: [],
      };
    } finally {
      busy = false;
      notify();
    }
  }
  return {
    isLocal,
    auth,
    refresh,
    useServer,
    useLocal,
    importPreview,
    importCommit,
    mutate,
    api,
    retryPending: () =>
      pending
        ? mutate(JSON.parse(pending.signature))
        : Promise.resolve({ ok: false, errors: ["No pending save."] }),
    get pending() {
      return !!pending;
    },
    get status() {
      return status;
    },
    get busy() {
      return busy;
    },
    get preview() {
      return preview;
    },
    get session() {
      return session;
    },
    get ownerId() {
      return saved?.userId;
    },
  };
}
if (typeof module !== "undefined")
  module.exports = { createConnectionController };
