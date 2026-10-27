// Supabase persistence only. Workout validation/actions remain in the existing domain.
function createSupabaseTransport(client) {
  async function tokenFor(userId) {
    const { data, error } = await client.auth.getSession();
    if (error || data.session?.user.id !== userId)
      throw Error("Sign in to the same GymBro account before saving.");
    return data.session.access_token;
  }
  return {
    async read(userId) {
      const token = await tokenFor(userId);
      const { data, error } = await client
        .from("gymbro_workout_state")
        .select("state,revision")
        .eq("user_id", userId)
        .maybeSingle()
        .setHeader("Authorization", "Bearer " + token);
      if (error)
        throw Error(
          "Could not read Supabase workout data. Check the database migration and connection.",
        );
      return data;
    },
    async write(userId, body) {
      const token = await tokenFor(userId);
      const { data, error } = await client
        .rpc("gymbro_save", body)
        .setHeader("Authorization", "Bearer " + token);
      if (error)
        throw Error(
          "Database save could not be confirmed. Keep your input and use Resolve save to retry.",
        );
      return data;
    },
  };
}
function createSupabaseStore({ transport, storage, validate }) {
  const key = "gymbroPendingDatabaseSave";
  let userId = null,
    revision = 0,
    busy = false,
    ready = false,
    hasState = false,
    initializing = false,
    loading = false,
    readEpoch = 0;
  function pending() {
    const raw = storage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }
  function assertUser(expected) {
    if (userId !== expected)
      throw Error(
        "Account changed during the operation. Reload your account data.",
      );
  }
  async function open(id) {
    if (busy || initializing) throw Error("Wait for the current save.");
    const epoch = ++readEpoch;
    userId = id;
    ready = false;
    loading = true;
    try {
      const row = await transport.read(id);
      assertUser(id);
      if (epoch !== readEpoch)
        throw Error("Database read was superseded. Reload your account.");
      if (row) {
        validate(row.state);
        if (
          !Number.isSafeInteger(Number(row.revision)) ||
          Number(row.revision) < 1
        )
          throw Error("Invalid database revision.");
      }
      revision = row ? Number(row.revision) : 0;
      hasState = !!row;
      ready = true;
      return row ? structuredClone(row.state) : null;
    } finally {
      if (epoch === readEpoch) loading = false;
    }
  }
  function signOut() {
    ++readEpoch;
    loading = false;
    userId = null;
    ready = false;
  }
  async function write(candidate, { initialize = false } = {}) {
    if (busy || loading || (initializing && !initialize))
      return { ok: false, errors: ["A database save is in progress."] };
    busy = true;
    const id = userId;
    try {
      if (!id || !ready || (!hasState && !initialize))
        throw Error("Sign in and load your database before editing.");
      validate(candidate);
      let attempt = pending();
      if (attempt) {
        if (attempt.userId !== id)
          throw Error(
            "An unresolved save belongs to another account. Sign in to that account to resolve it.",
          );
        if (JSON.stringify(attempt.body.p_state) !== JSON.stringify(candidate))
          throw Error(
            "Resolve the previous save before starting a different write.",
          );
      } else {
        if (initialize && hasState)
          throw Error(
            "This account already contains data. Use the explicit backup restore workflow.",
          );
        attempt = {
          userId: id,
          body: {
            p_state: structuredClone(candidate),
            p_expected_revision: revision,
            p_request_id: crypto.randomUUID(),
          },
        };
        storage.setItem(key, JSON.stringify(attempt));
      }
      const result = await transport.write(id, attempt.body);
      assertUser(id);
      if (!result || result.ok !== true) {
        storage.removeItem(key);
        ready = false;
        throw Error(
          result?.code === "REVISION_CONFLICT"
            ? "Another tab or device changed your data. Reload database data and inspect your input before saving."
            : "Request identity conflict. Inspect database data before saving again.",
        );
      }
      storage.removeItem(key);
      if (Number(result.current_revision) !== Number(result.revision)) {
        ready = false;
        throw Error(
          "This save already committed, but newer database changes exist. Reload database data; do not re-enter the saved set.",
        );
      }
      revision = Number(result.revision);
      hasState = true;
      return { ok: true };
    } catch (error) {
      return { ok: false, errors: [error.message] };
    } finally {
      busy = false;
    }
  }
  async function initialize(candidate, integrity) {
    if (busy || loading || initializing)
      throw Error("Wait for the current save.");
    initializing = true;
    try {
      const original = JSON.stringify(candidate),
        expectedUser = userId;
      const saved = await write(candidate, { initialize: true });
      if (!saved.ok) throw Error(saved.errors.join("\n"));
      ready = false;
      const row = await transport.read(expectedUser);
      assertUser(expectedUser);
      if (!row)
        throw Error(
          "Database read-back failed. The original local data is unchanged.",
        );
      validate(row.state);
      if (
        integrity(row.state) !== integrity(candidate) ||
        JSON.stringify(candidate) !== original
      )
        throw Error(
          "Database read-back differs from the reviewed import. Original local data is unchanged.",
        );
      revision = Number(row.revision);
      hasState = true;
      ready = true;
      return structuredClone(row.state);
    } finally {
      initializing = false;
    }
  }
  async function resolve() {
    const attempt = pending();
    if (!attempt) throw Error("No unresolved save remains.");
    if (attempt.userId !== userId)
      throw Error("Sign in to the account that made this save.");
    const result = await write(attempt.body.p_state, { initialize: !hasState });
    if (!result.ok) throw Error(result.errors.join("\n"));
    return open(userId);
  }
  return {
    open,
    write,
    initialize,
    resolve,
    signOut,
    get busy() {
      return busy || initializing || loading;
    },
    get ready() {
      return ready;
    },
    get hasState() {
      return hasState;
    },
    get userId() {
      return userId;
    },
  };
}
function canonicalWorkoutJSON(value) {
  if (Array.isArray(value))
    return "[" + value.map(canonicalWorkoutJSON).join(",") + "]";
  if (value && typeof value === "object")
    return (
      "{" +
      Object.keys(value)
        .sort()
        .map((k) => JSON.stringify(k) + ":" + canonicalWorkoutJSON(value[k]))
        .join(",") +
      "}"
    );
  return JSON.stringify(value);
}
if (typeof module !== "undefined")
  module.exports = {
    createSupabaseStore,
    createSupabaseTransport,
    canonicalWorkoutJSON,
  };
