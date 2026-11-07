-- Metadata only. Safe when application objects have not yet been installed.
-- No table contents, Auth users, credentials or provider settings are selected.
select jsonb_build_object(
  'postgres_version',current_setting('server_version'),
  'migration_ledger_present',to_regclass('supabase_migrations.schema_migrations') is not null,
  'schema_acl',(select nspacl::text from pg_namespace where nspname='public'),
  'tables',(select coalesce(jsonb_agg(jsonb_build_object('name',c.relname,'rls',c.relrowsecurity,
    'force_rls',c.relforcerowsecurity,'acl',c.relacl::text) order by c.relname),'[]'::jsonb)
    from pg_class c where c.relnamespace='public'::regnamespace and c.relkind='r' and c.relname like 'gymbro_%'),
  'columns',(select coalesce(jsonb_agg(jsonb_build_object('table',table_name,'name',column_name,
    'ordinal',ordinal_position,'type',udt_name,'nullable',is_nullable,'default',column_default)
    order by table_name,ordinal_position),'[]'::jsonb) from information_schema.columns
    where table_schema='public' and table_name like 'gymbro_%'),
  'constraints',(select coalesce(jsonb_agg(jsonb_build_object('table',c.conrelid::regclass::text,'name',c.conname,
    'type',c.contype,'validated',c.convalidated,'definition',pg_get_constraintdef(c.oid))
    order by c.conrelid::regclass::text,c.conname),'[]'::jsonb) from pg_constraint c join pg_class t on t.oid=c.conrelid
    where t.relnamespace='public'::regnamespace and t.relname like 'gymbro_%'),
  'policies',(select coalesce(jsonb_agg(to_jsonb(p) order by p.tablename,p.policyname),'[]'::jsonb)
    from pg_policies p where p.schemaname='public' and p.tablename like 'gymbro_%'),
  'grants',(select coalesce(jsonb_agg(to_jsonb(g) order by g.table_name,g.grantee,g.privilege_type),'[]'::jsonb)
    from (select table_name,grantee,privilege_type,is_grantable from information_schema.role_table_grants
      where table_schema='public' and table_name like 'gymbro_%') g),
  'triggers',(select coalesce(jsonb_agg(jsonb_build_object('table',c.relname,'name',t.tgname,'enabled',t.tgenabled,
    'definition',pg_get_triggerdef(t.oid)) order by c.relname,t.tgname),'[]'::jsonb) from pg_trigger t join pg_class c on c.oid=t.tgrelid
    where not t.tgisinternal and c.relnamespace='public'::regnamespace and c.relname like 'gymbro_%'),
  'indexes',(select coalesce(jsonb_agg(jsonb_build_object('table',c.relname,'definition',pg_get_indexdef(i.indexrelid))
    order by c.relname,pg_get_indexdef(i.indexrelid)),'[]'::jsonb) from pg_index i join pg_class c on c.oid=i.indrelid
    where c.relnamespace='public'::regnamespace and c.relname like 'gymbro_%'),
  'column_grants',(select coalesce(jsonb_agg(jsonb_build_object('table',c.relname,'column',a.attname,'acl',a.attacl::text)
    order by c.relname,a.attnum),'[]'::jsonb) from pg_attribute a join pg_class c on c.oid=a.attrelid
    where a.attnum>0 and not a.attisdropped and a.attacl is not null and c.relnamespace='public'::regnamespace and c.relname like 'gymbro_%'),
  'functions',(select coalesce(jsonb_agg(jsonb_build_object('name',p.proname,'arguments',pg_get_function_identity_arguments(p.oid),
    'owner',pg_get_userbyid(p.proowner),'definer',p.prosecdef,'settings',p.proconfig,'definition',pg_get_functiondef(p.oid),
    'acl',p.proacl::text) order by p.proname,pg_get_function_identity_arguments(p.oid)),'[]'::jsonb)
    from pg_proc p where p.pronamespace='public'::regnamespace and p.proname like 'gymbro_%'),
  'roles',(select coalesce(jsonb_agg(jsonb_build_object('name',r.rolname,'login',r.rolcanlogin,'superuser',r.rolsuper,
    'bypassrls',r.rolbypassrls,'inherit',r.rolinherit,'create_role',r.rolcreaterole,
    'browser_member',pg_has_role('authenticated',r.oid,'MEMBER')) order by r.rolname),'[]'::jsonb)
    from pg_roles r where r.rolname in ('gymbro_workout_writer','gymbro_lifecycle_writer'))
) as cutover_schema;
