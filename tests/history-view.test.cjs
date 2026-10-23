const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");
const runtime = vm.createContext({});
vm.runInContext(
  fs.readFileSync(path.join(__dirname, "..", "history-view.js"), "utf8"),
  runtime,
);
const groups = vm.runInContext("getHistoryGroups", runtime);
const plain = (value) => JSON.parse(JSON.stringify(value));
function data() {
  return {
    sets: [
      {
        id: "b",
        date: "2026-10-23",
        sessionId: "first",
        source: "manual",
        notes: "metadata",
      },
      { id: "legacy", date: "2026-10-23", source: "imported", complete: false },
      { id: "a", date: "2026-10-23", sessionId: "first", source: "chatgpt" },
      { id: "c", date: "2026-10-23", sessionId: "second", source: "manual" },
    ],
    sessions: [
      {
        id: "first",
        date: "2026-10-23",
        createdAt: "2026-10-23T10:00:00.000Z",
        setIds: ["a", "b"],
        planSnapshot: { name: "saved plan" },
      },
      {
        id: "second",
        date: "2026-10-23",
        createdAt: "2026-10-23T11:00:00.000Z",
        setIds: ["c"],
      },
      {
        id: "empty",
        date: "2026-10-24",
        createdAt: "2026-10-24T10:00:00.000Z",
        setIds: [],
      },
    ],
  };
}
test("history grouping retains explicit identity/order and legacy records without mutation or DOM", () => {
  const source = data(),
    original = structuredClone(source);
  const result = plain(groups(source));
  assert.deepEqual(
    result.map((group) => group.session?.id ?? group.kind),
    ["empty", "second", "first", "legacy"],
  );
  assert.deepEqual(
    result[2].sets.map((set) => set.id),
    ["a", "b"],
  );
  assert.deepEqual(result[3].sets, [source.sets[1]]);
  assert.equal(result[3].session, undefined);
  result[2].session.planSnapshot.name = "changed snapshot";
  result[2].sets[1].notes = "changed set";
  assert.deepEqual(source, original);
  assert.deepEqual(plain(groups(source)), plain(groups(source)));
});
test("source filtering preserves set order, original totals, and sessionless records", () => {
  const source = data();
  const manual = plain(groups(source, "manual"));
  assert.deepEqual(
    manual.map((group) => group.session.id),
    ["second", "first"],
  );
  assert.deepEqual(
    manual[1].sets.map((set) => set.id),
    ["b"],
  );
  assert.equal(manual[1].totalSetCount, 2);
  const imported = plain(groups(source, "imported"));
  assert.equal(imported.length, 1);
  assert.equal(imported[0].kind, "legacy");
  assert.equal(imported[0].sets[0].complete, false);
  assert.deepEqual(plain(groups(source, "unknown")), []);
});
