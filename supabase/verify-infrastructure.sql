-- One read-only SELECT works with both local prepared queries and hosted queries.
-- Returns metadata only: never diagnostic values, users or credentials.
select jsonb_build_object(
  'postgres_version', current_setting('server_version'),
  'migrations', (select coalesce(jsonb_agg(m order by version), '[]'::jsonb)
    from (select version, name from supabase_migrations.schema_migrations) m),
  'probe_rls_enabled', (select relrowsecurity from pg_class
    where oid = 'public.gymbro_connection_probe'::regclass),
  'policies', (select coalesce(jsonb_agg(p order by policyname), '[]'::jsonb)
    from (select policyname, roles, cmd, qual, with_check from pg_policies
      where schemaname = 'public' and tablename = 'gymbro_connection_probe') p),
  'private_access', jsonb_build_object(
    'rls_enabled', (select relrowsecurity from pg_class where oid = to_regclass('public.gymbro_private_access')),
    'policies', (select coalesce(jsonb_agg(p order by policyname), '[]'::jsonb)
      from (select policyname, permissive, roles, cmd, qual, with_check from pg_policies
        where schemaname = 'public' and tablename = 'gymbro_private_access') p),
    'grants', (select coalesce(jsonb_agg(g order by grantee, privilege_type), '[]'::jsonb)
      from (select grantee, privilege_type from information_schema.role_table_grants
        where table_schema = 'public' and table_name = 'gymbro_private_access') g)),
  'exercise_identity', jsonb_build_object(
    'tables', (select coalesce(jsonb_agg(t order by relname), '[]'::jsonb)
      from (select relname, relrowsecurity from pg_class where oid in
        (to_regclass('public.gymbro_exercises'), to_regclass('public.gymbro_exercise_aliases'))) t),
    'policies', (select coalesce(jsonb_agg(p order by tablename, policyname), '[]'::jsonb)
      from (select tablename, policyname, permissive, roles, cmd, qual, with_check from pg_policies
        where schemaname = 'public' and tablename in ('gymbro_exercises', 'gymbro_exercise_aliases')) p)),
  'grants', (select coalesce(jsonb_agg(g order by grantee, privilege_type), '[]'::jsonb)
    from (select grantee, privilege_type from information_schema.role_table_grants
      where table_schema = 'public' and table_name = 'gymbro_connection_probe') g)
) as infrastructure;
