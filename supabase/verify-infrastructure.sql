-- Read-only verification. No values, users or credentials are returned.
begin read only;
select current_setting('server_version') as postgres_version;
select version, name from supabase_migrations.schema_migrations order by version;
select relrowsecurity as probe_rls_enabled
from pg_class where oid = 'public.gymbro_connection_probe'::regclass;
select policyname, roles, cmd, qual, with_check
from pg_policies where schemaname = 'public' and tablename = 'gymbro_connection_probe'
order by policyname;
select grantee, privilege_type from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'gymbro_connection_probe'
order by grantee, privilege_type;
commit;
