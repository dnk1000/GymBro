// Explicit real PostgreSQL suite. Requires an isolated database; never point at production.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { Pool } = require("pg");
const { randomUUID } = require("node:crypto");
const fs = require("node:fs");
const { Store } = require("../server/store.cjs");
const { Service } = require("../server/service.cjs");
const { domain } = require("../server/domain.cjs");
const { digest } = require("../server/integrity.cjs");
const url = process.env.GYMBRO_TEST_DATABASE_URL;
if (!url)
  throw Error(
    "Set GYMBRO_TEST_DATABASE_URL to an isolated PostgreSQL test database (admin).",
  );
if (!["127.0.0.1", "localhost"].includes(new URL(url).hostname))
  throw Error(
    "This destructive fixture suite accepts loopback test databases only. Staging uses a separate controlled runbook.",
  );
let admin, pool, store, service;
const user = () => ({
  userId: randomUUID(),
  email: "synthetic@example.test",
  clientId: null,
  issuedAt: Math.floor(Date.now() / 1000) + 5,
});
const request = (op, extra = {}) => ({ op, requestId: randomUUID(), ...extra });
const authA = user(),
  authB = user();
let initial;
before(async () => {
  admin = new Pool({ connectionString: url });
  await admin.query(fs.readFileSync("migrations/001_integration.sql", "utf8"));
  await admin.query(fs.readFileSync("migrations/001_integration.sql", "utf8"));
  await admin.query(
    "DO $$ BEGIN IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='gymbro_test') THEN CREATE ROLE gymbro_test LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS; END IF; END $$; GRANT gymbro_api TO gymbro_test;",
  );
  const restricted = new URL(url);
  restricted.username = "gymbro_test";
  restricted.password = "";
  pool = new Pool({ connectionString: restricted.toString(), max: 4 });
  store = new Store(pool);
  service = new Service(store, {
    oauth: async (_auth, path, method) =>
      method === "DELETE"
        ? {}
        : path.endsWith("/consent")
          ? {
              redirect_url:
                "https://client.example.test/callback?code=synthetic",
            }
          : {
              authorization_id: "a",
              client: { id: clientId, name: "Synthetic client" },
              user: { id: authA.userId },
            },
  });
  initial = domain().emptyData();
  initial.preferences = {};
});
after(async () => {
  await pool?.end();
  await admin?.end();
});
async function importState(auth, state = initial) {
  const preview = await service.execute(auth, { op: "import-preview", state });
  const body = request("import-commit", {
    previewId: preview.previewId,
    digest: preview.digest,
    confirm: true,
    expectedRevision: preview.revision,
  });
  const committed = await service.execute(auth, body);
  return { preview, body, committed };
}
const clientId = randomUUID();
test("explicit import validates, previews without authority, commits and round-trips schema 7", async () => {
  await assert.rejects(
    service.execute(authA, { op: "import-preview", state: { version: 99 } }),
    /Invalid/,
  );
  const p = await service.execute(authA, {
    op: "import-preview",
    state: initial,
  });
  assert.equal((await service.execute(authA, { op: "state" })).state, null);
  const r = await importState(authA);
  assert.equal(r.committed.digest, digest(initial));
  assert.deepEqual(r.committed.state, JSON.parse(JSON.stringify(initial)));
  assert.equal(r.committed.state.version, 7);
  assert.equal((await service.execute(authA, r.body)).transportReplay, true);
  await assert.rejects(
    service.execute(authA, { op: "import-preview", state: initial }),
    /already has data/,
  );
  await importState(authB);
});
test("restricted role and RLS block cross-user SELECT INSERT UPDATE and missing context", async () => {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await c.query("SET LOCAL ROLE gymbro_api");
    assert.equal((await c.query("SELECT * FROM gymbro.accounts")).rowCount, 0);
    await c.query("SELECT set_config('gymbro.user_id',$1,true)", [
      authA.userId,
    ]);
    assert.equal(
      (
        await c.query("SELECT * FROM gymbro.accounts WHERE user_id=$1", [
          authB.userId,
        ])
      ).rowCount,
      0,
    );
    assert.equal(
      (
        await c.query(
          "UPDATE gymbro.accounts SET revision=999 WHERE user_id=$1",
          [authB.userId],
        )
      ).rowCount,
      0,
    );
    await assert.rejects(
      c.query("INSERT INTO gymbro.accounts(user_id) VALUES($1)", [
        randomUUID(),
      ]),
      /row-level security/,
    );
  } finally {
    await c.query("ROLLBACK");
    c.release();
  }
  const flags = (
    await admin.query(
      "SELECT rolsuper,rolbypassrls,rolcreaterole FROM pg_roles WHERE rolname='gymbro_api'",
    )
  ).rows[0];
  assert.deepEqual(flags, {
    rolsuper: false,
    rolbypassrls: false,
    rolcreaterole: false,
  });
  await assert.rejects(
    new Store(admin).transaction(authA, async () => {}),
    /must not bypass/,
  );
});
test("durable workout write, transport replay, changed request rejection and concurrent revision conflict", async () => {
  const args = [
    {
      date: "2026-10-25",
      templateId: initial.program.templates[0].id,
      duration: 30,
    },
  ];
  const body = request("action", {
    action: "startGuidedSession",
    args,
    expectedRevision: 1,
  });
  const results = await Promise.allSettled([
    service.execute(authA, body),
    service.execute(authA, { ...body, requestId: randomUUID() }),
  ]);
  assert.equal(results.filter((x) => x.status === "fulfilled").length, 1);
  assert.equal(results.filter((x) => x.status === "rejected").length, 1);
  const r = await service.execute(authA, body);
  assert.equal(r.transportReplay, true);
  assert.ok(r.sessionId);
  assert.equal(r.state.sessions.length, 1);
  await assert.rejects(
    service.execute(authA, { ...body, args: [{ ...args[0], duration: 60 }] }),
    /different parameters/,
  );
});
test("scope matrix, read/write separation, history consent and owner-only operations", async () => {
  const trainer = { ...authA, clientId };
  await assert.rejects(
    service.execute(trainer, { op: "state" }),
    /missing or revoked/,
  );
  const authorizationId = randomUUID();
  await assert.rejects(
    service.execute(authA, {
      op: "consent",
      authorizationId,
      scopes: ["history:modify"],
      historyConsent: false,
    }),
    /separate consent/,
  );
  await service.execute(authA, {
    op: "consent",
    authorizationId,
    scopes: ["workout:write"],
  });
  await assert.rejects(
    service.execute(trainer, { op: "state" }),
    /not authorized/,
  );
  const state = await service.execute(authA, { op: "state" });
  const active = state.state.sessions[0];
  const input = {
    sessionId: active.id,
    planSlotId: active.guided.currentSlotId,
    expectedRevision: active.guided.revision,
    requestId: randomUUID(),
    weight: 20,
    reps: 8,
  };
  const body = request("action", {
    action: "logGuidedSet",
    args: [input],
    expectedRevision: state.revision,
  });
  const result = await service.execute(trainer, body);
  assert.equal(result.ok, true);
  assert.equal(result.state, undefined);
  assert.ok(result.setId);
  await assert.rejects(
    service.execute(
      trainer,
      request("action", {
        action: "deleteSet",
        args: [result.setId],
        expectedRevision: 3,
      }),
    ),
    /not authorized/,
  );
  for (const op of [
    "restore",
    "merge",
    "reset",
    "import-preview",
    "import-commit",
    "grants",
    "consent",
    "revoke",
    "consent-details",
  ])
    await assert.rejects(service.execute(trainer, { op }), /GymBro account/);
  await service.execute(authA, {
    op: "consent",
    authorizationId: randomUUID(),
    scopes: ["training:read", "history:modify"],
    historyConsent: true,
  });
  assert.equal(
    (await service.execute(trainer, { op: "state" })).state.version,
    7,
  );
  await assert.rejects(service.execute(trainer, body), /not authorized/);
  const deleted = await service.execute(
    trainer,
    request("action", {
      action: "deleteSet",
      args: [result.setId],
      expectedRevision: 3,
    }),
  );
  assert.equal(deleted.ok, true);
  for (const op of ["restore", "reset", "import-commit"])
    await assert.rejects(service.execute(trainer, { op }), /GymBro account/);
});
test("revocation denies previously issued tokens without damaging workout history", async () => {
  const before = await service.execute(authA, { op: "state" });
  await service.execute(authA, { op: "revoke", clientId });
  await assert.rejects(
    service.execute({ ...authA, clientId }, { op: "state" }),
    /revoked/,
  );
  const after = await service.execute(authA, { op: "state" });
  assert.deepEqual(after, before);
});
test("guided revisions, domain replay/tombstone and completed session protections survive PostgreSQL", async () => {
  const state = await service.execute(authA, { op: "state" }),
    active = state.state.sessions[0];
  const input = {
    sessionId: active.id,
    planSlotId: active.guided.currentSlotId,
    expectedRevision: active.guided.revision,
    requestId: randomUUID(),
    weight: 30,
    reps: 10,
  };
  const write = await service.execute(
    authA,
    request("action", {
      action: "logGuidedSet",
      args: [input],
      expectedRevision: state.revision,
    }),
  );
  assert.equal(write.ok, true);
  const replay = await service.execute(
    authA,
    request("action", {
      action: "logGuidedSet",
      args: [input],
      expectedRevision: write.revision,
    }),
  );
  assert.equal(replay.code, "REPLAY");
  assert.equal(replay.revision, write.revision);
  const stale = await service.execute(
    authA,
    request("action", {
      action: "logGuidedSet",
      args: [{ ...input, requestId: randomUUID() }],
      expectedRevision: write.revision,
    }),
  );
  assert.equal(stale.code, "STALE_GUIDANCE");
  const deleted = await service.execute(
    authA,
    request("action", {
      action: "deleteSet",
      args: [write.setId],
      expectedRevision: write.revision,
    }),
  );
  const tombstone = await service.execute(
    authA,
    request("action", {
      action: "logGuidedSet",
      args: [input],
      expectedRevision: deleted.revision,
    }),
  );
  assert.equal(tombstone.deleted, true);
  const current = tombstone.state.sessions[0];
  const finished = await service.execute(
    authA,
    request("action", {
      action: "finishGuidedSession",
      args: [
        {
          sessionId: current.id,
          expectedRevision: current.guided.revision,
          allowPending: true,
        },
      ],
      expectedRevision: tombstone.revision,
    }),
  );
  assert.equal(finished.ok, true);
  const invalid = await service.execute(
    authA,
    request("action", {
      action: "logSet",
      args: [
        {
          date: current.date,
          exercise: "Bench Press",
          weight: 10,
          reps: 2,
          sessionId: current.id,
        },
      ],
      expectedRevision: finished.revision,
    }),
  );
  assert.equal(invalid.ok, false);
});
test("failed PostgreSQL transaction rolls back state and receipts together", async () => {
  const a = user();
  await importState(a);
  const before = await service.execute(a, { op: "state" });
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await c.query("SET LOCAL ROLE gymbro_api");
    await c.query("SELECT set_config('gymbro.user_id',$1,true)", [a.userId]);
    await c.query(
      "UPDATE gymbro.accounts SET revision=revision+1 WHERE user_id=$1",
      [a.userId],
    );
    await assert.rejects(
      c.query(
        "INSERT INTO gymbro.receipts(user_id,actor,request_id,signature,result) VALUES($1,'owner','x',NULL,'{}')",
        [a.userId],
      ),
    );
  } finally {
    await c.query("ROLLBACK");
    c.release();
  }
  assert.deepEqual(await service.execute(a, { op: "state" }), before);
});
test("first-party restore/merge/reset preserve schema and never clear mutation receipt history", async () => {
  const a = user();
  const { body } = await importState(a);
  let state = await service.execute(a, { op: "state" });
  const restored = await service.execute(
    a,
    request("restore", {
      state: state.state,
      expectedRevision: state.revision,
      confirm: true,
    }),
  );
  assert.equal(restored.ok, true);
  const merged = await service.execute(
    a,
    request("merge", {
      state: restored.state,
      expectedRevision: restored.revision,
      confirm: true,
    }),
  );
  assert.equal(merged.ok, true);
  const reset = await service.execute(
    a,
    request("reset", { expectedRevision: merged.revision, confirm: true }),
  );
  assert.equal(reset.state.sets.length, 0);
  assert.deepEqual(reset.state.preferences, {});
  assert.equal((await service.execute(a, body)).transportReplay, true);
});

test("API persistence failure retains a retryable receipt identity and rolls back actual SQL changes", async () => {
  const a = user();
  await importState(a);
  let failOnce = true;
  const faulty = new Service({
    transaction: (auth, fn) =>
      store.transaction(auth, (tx) =>
        fn({
          ...tx,
          c: {
            query: (sql, args) => {
              if (failOnce && sql.startsWith("INSERT INTO gymbro.receipts")) {
                failOnce = false;
                throw Error("synthetic lost persistence response");
              }
              return tx.c.query(sql, args);
            },
          },
        }),
      ),
  });
  const body = request("action", {
    action: "logSet",
    args: [
      { date: "2026-10-25", exercise: "Bench Press", weight: 12, reps: 8 },
    ],
    expectedRevision: 1,
  });
  await assert.rejects(
    faulty.execute(a, body),
    (e) => e.code === "PERSISTENCE_UNCERTAIN",
  );
  assert.equal(
    (await service.execute(a, { op: "state" })).state.sets.length,
    0,
  );
  const result = await faulty.execute(a, body);
  assert.equal(result.ok, true);
  assert.equal(result.state.sets.length, 1);
  assert.equal((await faulty.execute(a, body)).transportReplay, true);
});
