// Generate pgTAP evidence from the *actual* identity converter and shipped seed.
// No credentials, browser storage, hosted target or application writes.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { webcrypto } = require("node:crypto");
const root = path.resolve(__dirname, "..");
async function buildSql() {
  const context = vm.createContext({ structuredClone, crypto: webcrypto, TextEncoder });
  for (const file of ["seed.js", "workout-data.js", "workout-sessions.js", "guided-workouts.js", "exercise-identity.js"])
    vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context);
  const identity = vm.runInContext("ExerciseIdentity", context);
  const source = vm.runInContext("migrateData(seed)", context);
  const document = await identity.migrateV2(source);
  const owner = "77777777-7777-4777-8777-777777777777";
  const rows = identity.databaseRows(document, owner);
  const literal = (value) => "'" + JSON.stringify(value).replaceAll("'", "''") + "'::jsonb";
  // A transaction-scoped test fact table demonstrates composite exercise references without
  // prematurely creating #39's authoritative set/session schema.
  return `begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(9);
insert into auth.users(id) values ('${owner}');
create temporary table identity_expected(rows jsonb, facts jsonb);
insert into identity_expected values (${literal(rows)}, ${literal(document.data.sets)});
create table public.gymbro_identity_test_facts (
  owner_id uuid not null, set_id text primary key, exercise_id uuid not null, fact jsonb not null,
  foreign key (owner_id, exercise_id) references public.gymbro_exercises(owner_id, exercise_id)
);
grant select on identity_expected to authenticated;
grant select, insert on gymbro_identity_test_facts to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub', '${owner}', true);
select set_config('request.jwt.claims', '{"sub":"${owner}","is_anonymous":false}', true);
insert into public.gymbro_exercises select x.* from identity_expected,
  jsonb_populate_recordset(null::public.gymbro_exercises, rows->'exercises') x;
insert into public.gymbro_exercise_aliases select x.* from identity_expected,
  jsonb_populate_recordset(null::public.gymbro_exercise_aliases, rows->'aliases') x on conflict (owner_id, label) do nothing;
insert into gymbro_identity_test_facts select '${owner}', fact->>'id', (fact->'exercise'->>'exerciseId')::uuid, fact
  from identity_expected, jsonb_array_elements(facts) fact;
select is((select jsonb_agg(to_jsonb(x) order by exercise_id) from public.gymbro_exercises x),
  (select jsonb_agg(x order by x->>'exercise_id') from identity_expected, jsonb_array_elements(rows->'exercises') x), 'every canonical field/unknown metadata roundtrips');
select is((select jsonb_agg(to_jsonb(x) order by label collate "C") from public.gymbro_exercise_aliases x),
  (select jsonb_agg(x order by (x->>'label') collate "C") from identity_expected, jsonb_array_elements(rows->'aliases') x), 'every alias/owner/relationship roundtrips');
select is((select jsonb_agg(fact order by set_id) from gymbro_identity_test_facts),
  (select jsonb_agg(x order by x->>'id') from identity_expected, jsonb_array_elements(facts) x), 'every source set fact preserved with canonical FK');
select is_empty('select * from gymbro_identity_test_facts f left join public.gymbro_exercises e using(owner_id, exercise_id) where e.exercise_id is null', 'all set relationships resolve');
insert into public.gymbro_exercises select x.* from identity_expected,
  jsonb_populate_recordset(null::public.gymbro_exercises, rows->'exercises') x on conflict (owner_id, exercise_id) do nothing;
insert into public.gymbro_exercise_aliases select x.* from identity_expected,
  jsonb_populate_recordset(null::public.gymbro_exercise_aliases, rows->'aliases') x on conflict (owner_id, label) do nothing;
select is((select count(*)::int from public.gymbro_exercises), ${rows.exercises.length}, 'exact replay does not duplicate exercises');
select is((select count(*)::int from public.gymbro_exercise_aliases), ${rows.aliases.length}, 'exact replay does not duplicate aliases');
select lives_ok($test$update public.gymbro_exercises set display_name = display_name || ' renamed for disposable test'$test$, 'canonical rename preserves referenced exercises');
select is((select jsonb_agg(fact order by set_id) from gymbro_identity_test_facts),
  (select jsonb_agg(x order by x->>'id') from identity_expected, jsonb_array_elements(facts) x), 'renaming leaves every original source fact/label unchanged');
select is_empty('select * from gymbro_identity_test_facts f left join public.gymbro_exercises e using(owner_id, exercise_id) where e.exercise_id is null', 'all historical references still resolve after rename');
reset role;
select * from finish();
rollback;
`;
}
if (require.main === module) buildSql().then((sql) => {
  const target = path.join(root, "test-results", "exercise-identity-migration.test.sql");
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, sql);
  console.log("Generated disposable seed/catalog/relationship pgTAP test: test-results/exercise-identity-migration.test.sql");
}).catch((error) => { console.error(error.message); process.exitCode = 1; });
module.exports = { buildSql };
