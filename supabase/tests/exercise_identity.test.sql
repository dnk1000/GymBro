begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(36);
select has_table('public', 'gymbro_exercises', 'canonical exercises exist');
select has_table('public', 'gymbro_exercise_aliases', 'exact aliases exist');
select ok((select relrowsecurity from pg_class where oid = 'public.gymbro_exercises'::regclass), 'exercise RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.gymbro_exercise_aliases'::regclass), 'alias RLS');
select ok(not has_table_privilege('anon', 'public.gymbro_exercises', 'SELECT'), 'signed-out exercise read denied');
select ok(not has_table_privilege('anon', 'public.gymbro_exercise_aliases', 'INSERT'), 'signed-out alias write denied');
select ok(not has_table_privilege('authenticated', 'public.gymbro_exercises', 'DELETE'), 'historical identities cannot be deleted');
select ok(not has_table_privilege('authenticated', 'public.gymbro_exercise_aliases', 'UPDATE'), 'aliases cannot be silently reassigned');
select ok(not has_table_privilege('authenticated', 'public.gymbro_exercise_aliases', 'DELETE'), 'original labels cannot be deleted');
insert into auth.users(id) values ('55555555-5555-4555-8555-555555555555'), ('66666666-6666-4666-8666-666666666666');
set local role gymbro_workout_writer;
select set_config('request.jwt.claim.sub', '55555555-5555-4555-8555-555555555555', true);
select set_config('request.jwt.claims', '{"sub":"55555555-5555-4555-8555-555555555555","is_anonymous":false}', true);
select lives_ok($$insert into public.gymbro_exercises(owner_id, exercise_id, display_name, provenance, metadata)
  values ('55555555-5555-4555-8555-555555555555', '11111111-1111-8111-8111-111111111111', 'Rope Triceps Pressdown', 'legacy', '{"status":"core","unknown":{"zero":0}}')$$, 'owner creates canonical exercise');
select is((select exercise_id::text from public.gymbro_exercise_aliases where label = 'Rope Triceps Pressdown'), '11111111-1111-8111-8111-111111111111', 'display name registered atomically');
select lives_ok($$insert into public.gymbro_exercise_aliases values ('55555555-5555-4555-8555-555555555555', 'Rope Triceps Pushdown', '11111111-1111-8111-8111-111111111111', 'user-created')$$, 'explicit second label');
select is((select count(distinct exercise_id)::int from public.gymbro_exercise_aliases), 1, 'two labels resolve to one ID');
select lives_ok($$update public.gymbro_exercises set display_name = 'Cable Rope Extension'$$, 'rename succeeds');
select is((select count(*)::int from public.gymbro_exercise_aliases), 3, 'rename retains both old labels');
select is((select exercise_id::text from public.gymbro_exercises), '11111111-1111-8111-8111-111111111111', 'renamed ID unchanged');
select throws_ok($$update public.gymbro_exercises set exercise_id = '22222222-2222-8222-8222-222222222222'$$, '23514', 'Exercise identity and owner are immutable', 'ID change rejected');
select throws_ok($$update public.gymbro_exercises set owner_id = '66666666-6666-4666-8666-666666666666'$$, '23514', 'Exercise identity and owner are immutable', 'owner change rejected');
select lives_ok($$update public.gymbro_exercises set state = 'archived'$$, 'archive keeps identity');
select is((select metadata->'unknown'->>'zero' from public.gymbro_exercises), '0', 'legacy metadata preserved');
select throws_ok($$insert into public.gymbro_exercises(owner_id, exercise_id, display_name, provenance)
  values ('55555555-5555-4555-8555-555555555555', '22222222-2222-8222-8222-222222222222', 'Rope Triceps Pushdown', 'user-created')$$, '23505', 'Exercise label already belongs to another identity', 'canonical name cannot steal alias');
select is((select count(*)::int from public.gymbro_exercises), 1, 'failed collision creates no orphan exercise');
select throws_ok($$insert into public.gymbro_exercise_aliases values ('55555555-5555-4555-8555-555555555555', 'orphan', '99999999-9999-8999-8999-999999999999', 'legacy')$$,
  '23503', 'insert or update on table "gymbro_exercise_aliases" violates foreign key constraint "gymbro_exercise_aliases_owner_id_exercise_id_fkey"', 'orphan alias rejected');
select set_config('request.jwt.claim.sub', '66666666-6666-4666-8666-666666666666', true);
select set_config('request.jwt.claims', '{"sub":"66666666-6666-4666-8666-666666666666","is_anonymous":false}', true);
select is_empty('select * from public.gymbro_exercises', 'second user sees no exercise rows');
select is_empty('select * from public.gymbro_exercise_aliases', 'second user sees no alias rows');
select is_empty($$update public.gymbro_exercises set display_name = 'intrusion' returning *$$, 'cross-user update affects zero');
select throws_ok($$insert into public.gymbro_exercise_aliases values ('66666666-6666-4666-8666-666666666666', 'cross-owner', '11111111-1111-8111-8111-111111111111', 'legacy')$$,
  '23503', 'insert or update on table "gymbro_exercise_aliases" violates foreign key constraint "gymbro_exercise_aliases_owner_id_exercise_id_fkey"', 'bare other-user ID cannot satisfy composite FK');
select throws_ok($$insert into public.gymbro_exercises(owner_id, exercise_id, display_name, provenance)
  values ('55555555-5555-4555-8555-555555555555', '22222222-2222-8222-8222-222222222222', 'wrong owner', 'legacy')$$,
  '42501', 'new row violates row-level security policy for table "gymbro_exercises"', 'cross-owner insert rejected');
select lives_ok($$insert into public.gymbro_exercises(owner_id, exercise_id, display_name, provenance)
  values ('66666666-6666-4666-8666-666666666666', '11111111-1111-8111-8111-111111111111', 'Rope Triceps Pressdown', 'user-created')$$, 'another owner may reuse the same label and UUID privately');
select is((select count(*)::int from public.gymbro_exercises), 1, 'second owner sees only its own exercise');
select set_config('request.jwt.claims', '{"sub":"66666666-6666-4666-8666-666666666666","is_anonymous":true}', true);
select is_empty('select * from public.gymbro_exercises', 'anonymous Auth identity cannot read exercises');
select is_empty('select * from public.gymbro_exercise_aliases', 'anonymous Auth identity cannot read aliases');
select throws_ok($$insert into public.gymbro_exercise_aliases values ('66666666-6666-4666-8666-666666666666', 'anonymous alias', '11111111-1111-8111-8111-111111111111', 'user-created')$$,
  '42501', 'new row violates row-level security policy "protocol_permanent" for table "gymbro_exercise_aliases"', 'anonymous alias insert denied');
select set_config('request.jwt.claims', '{}', true);
select is_empty('select * from public.gymbro_exercises', 'missing permanent-user claim fails closed');
select set_config('request.jwt.claim.sub', '55555555-5555-4555-8555-555555555555', true);
select set_config('request.jwt.claims', '{"sub":"55555555-5555-4555-8555-555555555555","is_anonymous":false}', true);
select is((select display_name from public.gymbro_exercises), 'Cable Rope Extension', 'original owner unchanged after attacks');
select is((select count(*)::int from public.gymbro_exercise_aliases), 3, 'all original owner aliases intact');
reset role;
select * from finish();
rollback;
