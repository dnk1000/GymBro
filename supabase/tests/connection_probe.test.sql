begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(13);
select has_table('public', 'gymbro_connection_probe', 'diagnostic baseline exists');
select columns_are('public', 'gymbro_connection_probe', array['owner_id', 'value'], 'no workout columns');
select col_is_pk('public', 'gymbro_connection_probe', 'owner_id', 'one row per owner');
select col_is_fk('public', 'gymbro_connection_probe', 'owner_id', 'owner references Auth');
select ok((select relrowsecurity from pg_class where oid = 'public.gymbro_connection_probe'::regclass), 'RLS enabled');
select is((select count(*)::integer from pg_policies where schemaname = 'public' and tablename = 'gymbro_connection_probe'), 3, 'three policies');
select ok(not has_table_privilege('anon', 'public.gymbro_connection_probe', 'SELECT'), 'anon cannot read');
select ok(not has_table_privilege('authenticated', 'public.gymbro_connection_probe', 'DELETE'), 'no client delete');
insert into auth.users (id) values
  ('11111111-1111-4111-8111-111111111111'), ('22222222-2222-4222-8222-222222222222');
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
insert into public.gymbro_connection_probe values ('11111111-1111-4111-8111-111111111111', 'disposable-a');
select is((select count(*)::integer from public.gymbro_connection_probe), 1, 'owner can read own row');
select throws_ok($$insert into public.gymbro_connection_probe values ('22222222-2222-4222-8222-222222222222', 'wrong-owner')$$,
  '42501', 'new row violates row-level security policy for table "gymbro_connection_probe"', 'cannot insert for another owner');
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
select is((select count(*)::integer from public.gymbro_connection_probe), 0, 'second owner cannot read first row');
update public.gymbro_connection_probe set value = 'forbidden';
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select is((select value from public.gymbro_connection_probe), 'disposable-a', 'cross-owner update changes nothing');
select throws_ok($$update public.gymbro_connection_probe set owner_id = '22222222-2222-4222-8222-222222222222'$$,
  '42501', 'new row violates row-level security policy for table "gymbro_connection_probe"', 'cannot transfer ownership');
reset role;
select * from finish();
rollback;
