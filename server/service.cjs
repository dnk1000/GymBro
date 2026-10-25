const { randomUUID } = require("node:crypto");
const { domain } = require("./domain.cjs");
const { digest } = require("./integrity.cjs");
const {
  READ,
  SCOPES,
  owner,
  permission,
  error,
} = require("../contracts/permissions.cjs");
const { UUID } = require("./auth.cjs");
const fail = (code, message, status = 409) => {
  throw error(code, message, status);
};
function revision(account, expected) {
  if (!Number.isSafeInteger(expected) || expected !== account.revision)
    fail(
      "REVISION_CONFLICT",
      "Data changed. Inspect current server state before trying again.",
    );
}
function summary(state) {
  return {
    sets: state.sets.length,
    sessions: state.sessions.length,
    bodyweights: state.bodyweights.length,
    imports: state.imports.length,
    activeSessionId: state.activeSessionId,
    schema: state.version,
  };
}
class Service {
  constructor(store, { oauth } = {}) {
    this.store = store;
    this.oauth = oauth;
  }
  async execute(auth, body) {
    if (!body || typeof body.op !== "string")
      fail("INVALID_REQUEST", "Operation required.", 400);
    return this.store.transaction(auth, async (tx) => {
      const { c, account } = tx,
        uid = auth.userId,
        d = domain();
      let grant = null;
      if (auth.clientId) {
        grant = (
          await c.query(
            "SELECT * FROM gymbro.grants WHERE user_id=$1 AND client_id=$2",
            [uid, auth.clientId],
          )
        ).rows[0];
        if (
          !grant ||
          grant.revoked_at ||
          auth.issuedAt < Number(grant.not_before)
        )
          fail(
            "FORBIDDEN",
            "Application authorization is missing or revoked.",
            403,
          );
      }
      const snapshot = () => ({
        state: account.state,
        revision: account.revision,
        digest: account.state ? digest(account.state) : null,
      });
      if (body.op === "state") {
        if (auth.clientId) permission(auth, "getWorkoutState", grant);
        return snapshot();
      }
      if (body.op === "grants") {
        owner(auth);
        return {
          grants: (
            await c.query(
              "SELECT client_id,name,scopes,not_before,revoked_at FROM gymbro.grants WHERE user_id=$1",
              [uid],
            )
          ).rows,
        };
      }
      if (body.op === "consent-details") {
        owner(auth);
        if (!UUID.test(body.authorizationId))
          fail("INVALID_REQUEST", "Invalid authorization ID.", 400);
        const details = await this.oauth(
          auth,
          "oauth/authorizations/" + body.authorizationId,
        );
        if (details.user && details.user.id !== uid)
          fail("FORBIDDEN", "Authorization user mismatch.", 403);
        return details;
      }
      if (body.op === "revoke") {
        owner(auth);
        if (!UUID.test(body.clientId))
          fail("INVALID_REQUEST", "Invalid client ID.", 400);
        await c.query(
          "UPDATE gymbro.grants SET revoked_at=now() WHERE user_id=$1 AND client_id=$2",
          [uid, body.clientId],
        );
        await tx.commit(); // Deny GymBro access even if upstream revocation is unavailable.
        let upstreamRevoked = true;
        try {
          await this.oauth(
            auth,
            "user/oauth/grants?client_id=" + body.clientId,
            "DELETE",
          );
        } catch {
          upstreamRevoked = false;
        }
        return { ok: true, upstreamRevoked };
      }
      if (body.op === "consent") {
        owner(auth);
        if (
          !UUID.test(body.authorizationId) ||
          !Array.isArray(body.scopes) ||
          !body.scopes.length ||
          body.scopes.some((s) => !SCOPES.includes(s)) ||
          new Set(body.scopes).size !== body.scopes.length
        )
          fail("INVALID_REQUEST", "Choose supported permissions.", 400);
        if (
          body.scopes.includes("history:modify") &&
          body.historyConsent !== true
        )
          fail(
            "CONSENT_REQUIRED",
            "History modification requires separate consent.",
            403,
          );
        const details = await this.oauth(
          auth,
          "oauth/authorizations/" + body.authorizationId,
        );
        if (
          !details.client ||
          details.user?.id !== uid ||
          !UUID.test(details.client.id)
        )
          fail(
            "INVALID_AUTHORIZATION",
            "Open a fresh authorization request.",
            400,
          );
        const approved = await this.oauth(
          auth,
          "oauth/authorizations/" + body.authorizationId + "/consent",
          "POST",
          { action: "approve" },
        );
        // New OAuth tokens are issued only when the client exchanges the returned code.
        const notBefore = Math.floor(Date.now() / 1000) + 1;
        await c.query(
          "INSERT INTO gymbro.grants(user_id,client_id,name,scopes,not_before) VALUES($1,$2,$3,$4,$5) ON CONFLICT(user_id,client_id) DO UPDATE SET name=excluded.name,scopes=excluded.scopes,not_before=excluded.not_before,revoked_at=NULL",
          [uid, details.client.id, details.client.name, body.scopes, notBefore],
        );
        return { ...approved, notBefore };
      }
      if (body.op === "import-preview") {
        owner(auth);
        if (account.state)
          fail(
            "ALREADY_CONNECTED",
            "This account already has data. Use its explicit backup workflow.",
          );
        let state;
        try {
          state = d.migrateData(body.state);
        } catch {
          fail(
            "VALIDATION_ERROR",
            "Invalid or unsupported workout backup.",
            400,
          );
        }
        const id = randomUUID(),
          hash = digest(state);
        await c.query("DELETE FROM gymbro.import_previews WHERE user_id=$1", [
          uid,
        ]);
        await c.query(
          "INSERT INTO gymbro.import_previews(user_id,id,state,digest,revision) VALUES($1,$2,$3,$4,$5)",
          [uid, id, state, hash, account.revision],
        );
        return {
          previewId: id,
          digest: hash,
          revision: account.revision,
          summary: summary(state),
          state,
        };
      }
      if (body.op === "action") {
        permission(auth, body.action, grant);
        if (!Array.isArray(body.args) || body.args.length > 3)
          fail("INVALID_REQUEST", "Action arguments must be an array.", 400);
        if (!account.state)
          fail(
            "IMPORT_REQUIRED",
            "Import or explicitly initialize your account first.",
          );
        if (READ.includes(body.action)) {
          const actions = d.createWorkoutActions({
            getState: () => account.state,
            setState: () => {
              throw Error("Read-only");
            },
            persist: () => {
              throw Error("Read-only");
            },
            createId: randomUUID,
          });
          return {
            result: actions[body.action](...body.args),
            revision: account.revision,
          };
        }
      } else if (
        !["import-commit", "restore", "merge", "reset"].includes(body.op)
      )
        fail("UNKNOWN_OPERATION", "Unsupported operation.", 400);
      else owner(auth);
      if (
        typeof body.requestId !== "string" ||
        body.requestId.length < 8 ||
        body.requestId.length > 160
      )
        fail("INVALID_REQUEST", "A stable request ID is required.", 400);
      const actor = auth.clientId || "owner",
        signature = digest({
          op: body.op,
          action: body.action ?? null,
          args: body.args ?? null,
          state: body.state ?? null,
          previewId: body.previewId ?? null,
          digest: body.digest ?? null,
          expectedRevision: body.expectedRevision,
        });
      const previous = (
        await c.query(
          "SELECT * FROM gymbro.receipts WHERE user_id=$1 AND actor=$2 AND request_id=$3",
          [uid, actor, body.requestId],
        )
      ).rows[0];
      const visible = (result) => {
        const response = { ...result, revision: account.revision };
        if (
          result.ok &&
          result.setId &&
          !account.state?.sets.some((set) => set.id === result.setId)
        )
          response.deleted = true;
        // Never leak full state through write results or validation errors to write-only clients.
        if (!auth.clientId || grant.scopes.includes("training:read"))
          response.state = account.state;
        else delete response.state;
        return response;
      };
      if (previous) {
        if (previous.signature !== signature)
          fail(
            "REQUEST_CONFLICT",
            "Request ID was used for different parameters.",
          );
        return visible({ ...previous.result, transportReplay: true });
      }
      if (
        auth.clientId &&
        body.action === "logSet" &&
        (!account.state.activeSessionId || body.args[0]?.sessionId === null)
      )
        fail(
          "FORBIDDEN",
          "Trainer workout logging requires an active session.",
          403,
        );
      revision(account, body.expectedRevision);
      async function persist(
        next,
        details = { ok: true, code: "OK", errors: [], changes: ["state"] },
      ) {
        d.validateData(next);
        await c.query(
          "UPDATE gymbro.accounts SET state=$2,revision=revision+1 WHERE user_id=$1",
          [uid, next],
        );
        await c.query(
          "INSERT INTO gymbro.receipts(user_id,actor,request_id,signature,result) VALUES($1,$2,$3,$4,$5)",
          [uid, actor, body.requestId, signature, details],
        );
        await tx.commit();
        account.state = next;
        account.revision++;
        return { ok: true };
      }
      if (body.op === "action") {
        let persistenceError = null;
        const actions = d.createWorkoutActions({
          getState: () => account.state,
          setState: (next) => {
            account.state = next;
          },
          createId: () => "m" + randomUUID(),
          persist: async (next, details) => {
            try {
              return await persist(next, {
                ok: true,
                code: "OK",
                errors: [],
                ...details,
              });
            } catch (error) {
              persistenceError = error;
              throw error;
            }
          },
        });
        const result = await actions[body.action](...body.args);
        if (persistenceError)
          fail(
            "PERSISTENCE_UNCERTAIN",
            "Save outcome could not be confirmed. Retry the same request ID.",
            503,
          );
        // No-op/replay successes still get transport receipts, without a workout-state write.
        if (
          result.ok &&
          (result.code === "NO_CHANGE" || result.code === "REPLAY")
        ) {
          const { state: ignoredState, ...receipt } = result;
          await c.query(
            "INSERT INTO gymbro.receipts(user_id,actor,request_id,signature,result) VALUES($1,$2,$3,$4,$5)",
            [uid, actor, body.requestId, signature, receipt],
          );
        }
        return visible(result);
      }
      let next;
      if (body.op === "import-commit") {
        if (account.state)
          fail(
            "ALREADY_CONNECTED",
            "Import cannot replace existing account data.",
          );
        if (!UUID.test(body.previewId) || body.confirm !== true)
          fail("CONFIRMATION_REQUIRED", "Confirm the reviewed import.", 400);
        const preview = (
          await c.query(
            "SELECT * FROM gymbro.import_previews WHERE user_id=$1 AND id=$2 AND expires_at>now()",
            [uid, body.previewId],
          )
        ).rows[0];
        if (
          !preview ||
          preview.digest !== body.digest ||
          Number(preview.revision) !== account.revision
        )
          fail("INVALID_PREVIEW", "Import preview expired or changed.");
        next = preview.state;
      } else {
        if (!account.state)
          fail(
            "IMPORT_REQUIRED",
            "Import a dataset before editing account data.",
          );
        if (body.confirm !== true)
          fail("CONFIRMATION_REQUIRED", "Confirm this account operation.", 400);
        try {
          next =
            body.op === "reset" ? d.emptyData() : d.migrateData(body.state);
          if (body.op === "reset") next.preferences = {};
          if (body.op === "merge")
            next = d.mergeHistoryData(account.state, next);
        } catch {
          fail(
            "VALIDATION_ERROR",
            "Invalid backup or conflicting history.",
            400,
          );
        }
      }
      await persist(next);
      return visible({ ok: true, code: "OK", digest: digest(next) });
    });
  }
}
module.exports = { Service, summary };
