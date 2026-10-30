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

test("exercise occurrences follow authoritative order before filtering and stay detached", () => {
  const source = data();
  source.sets = [
    { id: "a2", exercise: "A", source: "manual", sessionId: "first" },
    { id: "b", exercise: "B", source: "chatgpt", sessionId: "first" },
    { id: "a1", exercise: "A", source: "chatgpt", sessionId: "first" },
    { id: "a3", exercise: "A", source: "manual", sessionId: "first" },
    ...["A", "A", "B", "A"].map((exercise, i) => ({
      id: `l${i}`, date: "2026-10-23", exercise,
      source: i === 2 ? "chatgpt" : "manual",
    })),
  ];
  source.sessions = [{ ...source.sessions[0], setIds: ["a1", "a2", "b", "a3"] }];
  const original = structuredClone(source);
  const all = plain(groups(source));
  assert.deepEqual(all[0].exerciseGroups.map(run => run.sets.map(set => set.id)), [["a1", "a2"], ["b"], ["a3"]]);
  assert.deepEqual(all[1].exerciseGroups.map(run => run.sets.map(set => set.id)), [["l0", "l1"], ["l2"], ["l3"]]);
  const manual = plain(groups(source, "manual"));
  assert.deepEqual(manual[0].exerciseGroups.map(run => [run.firstSetId, run.sets.map(set => set.id)]), [["a1", ["a2"]], ["a3", ["a3"]]]);
  assert.deepEqual(manual[1].exerciseGroups.map(run => run.sets.map(set => set.id)), [["l0", "l1"], ["l3"]]);
  assert.equal(manual[1].session, undefined);
  all[0].exerciseGroups[0].sets[0].exercise = "changed";
  assert.deepEqual(source, original);
});

test('History exercise/workout/date filters intersect without inferred identity or reordered facts', () => {
  const source = data();
  source.sets.forEach(set => { set.exercise = set.id === 'b' ? 'Bench press' : 'Bench Press'; });
  const original = structuredClone(source);
  const selected = plain(groups(source, 'all', { exercise: 'Bench Press', from: '2026-10-23', to: '2026-10-23' }));
  assert.deepEqual(selected.map(g => g.session?.id || g.kind), ['second', 'first', 'legacy']);
  assert.deepEqual(selected[1].sets.map(s => s.id), ['a']);
  assert.equal(selected[1].totalSetCount, 2);
  assert.deepEqual(plain(groups(source, 'all', { exercise: 'Bench press' })).map(g => g.sets.map(s => s.id)), [['b']]);
  assert.deepEqual(plain(groups(source, 'manual', { exercise: 'Bench Press' })).map(g => g.session.id), ['second']);
  assert.deepEqual(plain(groups(source, 'all', { workout: 'session:saved plan' })).map(g => g.session.id), ['first']);
  assert.deepEqual(plain(groups(source, 'all', { workout: 'session:Unplanned workout' })).map(g => g.session.id), ['empty', 'second']);
  assert.deepEqual(plain(groups(source, 'all', { workout: 'legacy' })).map(g => g.kind), ['legacy']);
  assert.equal(plain(groups(source, 'all', { from: '2026-10-24' })).length, 1);
  assert.equal(plain(groups(source, 'all', { to: '2026-10-22' })).length, 0);
  assert.equal(plain(groups(source, 'all', { from: '2026-10-24', to: '2026-10-23' })).length, 0);
  assert.deepEqual(source, original);
});

test('exercise filtering never combines non-consecutive occurrences hidden by that filter', () => {
  const source = data();
  source.sessions = [source.sessions[0]];
  source.sessions[0].setIds = ['a', 'b', 'c'];
  source.sets = ['A','B','A'].map((exercise, i) => ({ id: ['a','b','c'][i], date: '2026-10-23', sessionId: 'first', source: 'manual', exercise }));
  const filtered = plain(groups(source, 'all', { exercise: 'A' }));
  assert.deepEqual(filtered[0].sets.map(s => s.id), ['a','c']);
  assert.deepEqual(filtered[0].exerciseGroups.map(g => g.firstSetId), ['a','c']);
});
