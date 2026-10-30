-- #40 protocol 1. Additive metadata; existing workout/model/schema facts unchanged.
begin;
-- Local database reset can retain cluster roles. Reuse only the exact narrow
-- role; unexpected capabilities/memberships fail closed instead of adopting it.
do $$ begin
  if not exists(select 1 from pg_roles where rolname='gymbro_workout_writer') then
    create role gymbro_workout_writer nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
  elsif exists(select 1 from pg_roles where rolname='gymbro_workout_writer' and
    (rolcanlogin or rolinherit or rolsuper or rolcreatedb or rolcreaterole or rolreplication or rolbypassrls)) or
    exists(select 1 from pg_auth_members where member='gymbro_workout_writer'::regrole or
      (roleid='gymbro_workout_writer'::regrole and member<>'postgres'::regrole)) then
    raise exception 'Unexpected writer role capabilities or membership';
  end if;
end $$;
grant usage on schema public,auth to gymbro_workout_writer;
grant execute on function auth.uid(),auth.jwt() to gymbro_workout_writer;

create table public.gymbro_workout_versions (
  owner_id uuid primary key references auth.users(id),
  revision numeric not null default 0 check(revision>=0 and scale(revision)=0)
);
insert into public.gymbro_workout_versions(owner_id) select owner_id from public.gymbro_workout_state;
create table public.gymbro_mutation_receipts (
  owner_id uuid not null references public.gymbro_workout_versions(owner_id),
  operation jsonb not null check(jsonb_typeof(operation)='array'),
  protocol_version integer not null check(protocol_version=1),
  status text not null check(status in ('committed','cancelled')),
  fingerprint text,
  committed_revision numeric,
  result jsonb,
  primary key(owner_id,operation),
  check((status='cancelled' and fingerprint is null and committed_revision is null and result is null) or
    (status='committed' and fingerprint is not null and committed_revision is not null and result is not null and fingerprint ~ '^[0-9a-f]{64}$' and committed_revision>=0 and scale(committed_revision)=0 and jsonb_typeof(result)='object'))
);

-- Keep all accepted relationship/intent guards. Browser writes must pass the
-- new entry point; the old invoker commit is an internal constrained helper.
do $$ declare t text; tbl text; begin
  foreach t in array public.gymbro_workout_tables()||array['workout_versions','mutation_receipts'] loop
    tbl:=public.gymbro_workout_table(t);
    if tbl is null then tbl:='gymbro_'||t; end if;
    execute format('alter table public.%I enable row level security',tbl);
    execute format('revoke all on public.%I from public,anon,authenticated',tbl);
    execute format('grant select on public.%I to authenticated',tbl);
    execute format('grant select,insert on public.%I to gymbro_workout_writer',tbl);
    if t not in ('snapshot_slots','guided_requests','aliases','mutation_receipts') then
      execute format('grant update on public.%I to gymbro_workout_writer',tbl);
    end if;
    if t in ('sets','template_slots') then execute format('grant delete on public.%I to gymbro_workout_writer',tbl); end if;
    execute format('create policy protocol_owner on public.%I for all to gymbro_workout_writer using ((select auth.uid())=owner_id) with check ((select auth.uid())=owner_id)',tbl);
    execute format('create policy protocol_permanent on public.%I as restrictive for all to gymbro_workout_writer using ((select auth.jwt()->>''is_anonymous'')=''false'') with check ((select auth.jwt()->>''is_anonymous'')=''false'')',tbl);
    if t in ('workout_versions','mutation_receipts') then
      execute format('create policy read_owner on public.%I for select to authenticated using ((select auth.uid())=owner_id and (select auth.jwt()->>''is_anonymous'')=''false'')',tbl);
    end if;
  end loop;
end $$;
revoke all on function public.gymbro_workout_commit(jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.gymbro_workout_commit(jsonb,jsonb),public.gymbro_workout_read(),
  public.gymbro_workout_tables(),public.gymbro_workout_keys(text),public.gymbro_workout_table(text),
  public.gymbro_workout_normalize(jsonb),public.gymbro_valid_date(text) to gymbro_workout_writer;

create function public.gymbro_operation_valid(operation jsonb) returns boolean
language sql immutable set search_path='' as $$
select case when jsonb_typeof(operation)='array' then
  jsonb_array_length(operation) in (2,3) and
  operation->>0=any(array['initialize','logSet','editSet','deleteSet','logBodyweight','selectPlan','clearPlan',
    'toggleSlotShort','cycleSlotRole','addSlot','removeSlot','createSession','completeSession','attachSetToSession',
    'startGuidedSession','enableGuidance','selectGuidedSlot','moveGuidedSlot','setGuidedSlotStatus',
    'substituteGuidedExercise','logGuidedSet','finishGuidedSession','saveScopedNote','commitImport']) and
  not exists(select 1 from jsonb_array_elements(operation) v where jsonb_typeof(v)<>'string' or length(v#>>'{}')=0) and
  ((operation->>0='logGuidedSet' and jsonb_array_length(operation)=3) or
   (operation->>0<>'logGuidedSet' and jsonb_array_length(operation)=2))
else false end
$$;

-- STABLE read functions see the same statement snapshot for revision and facts.
create function public.gymbro_workout_snapshot() returns jsonb
language sql stable security invoker set search_path='' as $$
select jsonb_build_object('protocolVersion',1,'ownerId',auth.uid(),
  'revision',coalesce((select revision::text from public.gymbro_workout_versions where owner_id=auth.uid()),'0'),
  'rows',public.gymbro_workout_read())
$$;

create function public.gymbro_workout_mutate(packet jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare who uuid:=auth.uid(); receipt public.gymbro_mutation_receipts; current_revision numeric;
  fingerprint text; answer jsonb; saved jsonb; op jsonb:=packet->'operation';
begin
  if who is null or (auth.jwt()->>'is_anonymous') is distinct from 'false' then
    raise exception 'Permanent authenticated owner required' using errcode='42501'; end if;
  if jsonb_typeof(packet) is distinct from 'object' or packet->>'protocolVersion' is distinct from '1' or
    packet->>'ownerId' is distinct from who::text or not coalesce(public.gymbro_operation_valid(op),false) or
    packet->>'action' is distinct from op->>0 or jsonb_typeof(packet->'args') is distinct from 'array' or
    jsonb_typeof(packet->'result') is distinct from 'object' or jsonb_typeof(packet->'expectedRevision') is distinct from 'string' or
    (packet->>'expectedRevision') !~ '^(0|[1-9][0-9]*)$' or
    not (packet ?& array['base','next']) then
    raise exception 'Invalid mutation packet' using errcode='23514'; end if;
  if op->>0='logGuidedSet' and ((op->>1) is distinct from packet#>>'{args,0,sessionId}' or
    (op->>2) is distinct from packet#>>'{args,0,requestId}') then
    raise exception 'Invalid guided operation identity' using errcode='23514'; end if;
  -- PostgreSQL jsonb text has deterministic object-key ordering. Include every
  -- packet property; hash on the server, never trust a client hash claim.
  fingerprint:=encode(sha256(convert_to(packet::text,'UTF8')),'hex');
  perform pg_advisory_xact_lock(hashtextextended(who::text,39));
  select * into receipt from public.gymbro_mutation_receipts where owner_id=who and operation=op;
  if found then
    if receipt.status='cancelled' then answer:=jsonb_build_object('code','CANCELLED');
    elsif receipt.fingerprint<>fingerprint then answer:=jsonb_build_object('code','REQUEST_CONFLICT');
    else answer:=jsonb_build_object('code','REPLAY','operationRevision',receipt.committed_revision::text,'result',receipt.result); end if;
    return answer||jsonb_build_object('operation',op,'snapshot',public.gymbro_workout_snapshot());
  end if;
  select revision into current_revision from public.gymbro_workout_versions where owner_id=who;
  current_revision:=coalesce(current_revision,0);
  if current_revision::text<>packet->>'expectedRevision' or
    (packet->'base'<>'null'::jsonb and public.gymbro_workout_normalize(public.gymbro_workout_read()) is distinct from public.gymbro_workout_normalize(packet->'base')) or
    (packet->'base'='null'::jsonb and jsonb_array_length(public.gymbro_workout_read()->'workout_state')<>0) then
    return jsonb_build_object('code','CONFLICT','operation',op,'snapshot',public.gymbro_workout_snapshot()); end if;
  if public.gymbro_workout_normalize(public.gymbro_workout_read()) is not distinct from public.gymbro_workout_normalize(packet->'next') then
    return jsonb_build_object('code','NO_CHANGE','operation',op,'snapshot',public.gymbro_workout_snapshot()); end if;
  -- The original helper retains exact-base, ownership, graph/intent constraints,
  -- supported-deletion diff and full acknowledgement verification.
  saved:=public.gymbro_workout_commit(nullif(packet->'base','null'::jsonb),packet->'next');
  insert into public.gymbro_workout_versions(owner_id,revision) values(who,current_revision+1)
    on conflict(owner_id) do update set revision=excluded.revision;
  insert into public.gymbro_mutation_receipts(owner_id,operation,protocol_version,status,fingerprint,committed_revision,result)
    values(who,op,1,'committed',fingerprint,current_revision+1,packet->'result');
  return jsonb_build_object('code','OK','operation',op,'operationRevision',(current_revision+1)::text,
    'result',packet->'result','snapshot',public.gymbro_workout_snapshot());
end $$;

create function public.gymbro_workout_resolve(operation jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare who uuid:=auth.uid(); receipt public.gymbro_mutation_receipts; answer jsonb;
begin
  if who is null or (auth.jwt()->>'is_anonymous') is distinct from 'false' then
    raise exception 'Permanent authenticated owner required' using errcode='42501'; end if;
  if not coalesce(public.gymbro_operation_valid(operation),false) then raise exception 'Invalid operation identity' using errcode='23514'; end if;
  perform pg_advisory_xact_lock(hashtextextended(who::text,39));
  select * into receipt from public.gymbro_mutation_receipts r where r.owner_id=who and r.operation=gymbro_workout_resolve.operation;
  if not found then
    insert into public.gymbro_workout_versions(owner_id) values(who) on conflict do nothing;
    insert into public.gymbro_mutation_receipts(owner_id,operation,protocol_version,status) values(who,operation,1,'cancelled');
    answer:=jsonb_build_object('code','CANCELLED');
  elsif receipt.status='cancelled' then answer:=jsonb_build_object('code','CANCELLED');
  else answer:=jsonb_build_object('code','REPLAY','operationRevision',receipt.committed_revision::text,'result',receipt.result); end if;
  return answer||jsonb_build_object('operation',operation,'snapshot',public.gymbro_workout_snapshot());
end $$;

revoke all on function public.gymbro_operation_valid(jsonb),public.gymbro_workout_snapshot(),
  public.gymbro_workout_mutate(jsonb),public.gymbro_workout_resolve(jsonb) from public,anon,authenticated;
grant execute on function public.gymbro_operation_valid(jsonb),public.gymbro_workout_snapshot() to gymbro_workout_writer;
grant execute on function public.gymbro_workout_snapshot(),public.gymbro_workout_mutate(jsonb),public.gymbro_workout_resolve(jsonb) to authenticated;
-- Ownership transfer needs CREATE temporarily. No browser membership is granted.
grant gymbro_workout_writer to postgres with inherit false;
grant create on schema public to gymbro_workout_writer;
alter function public.gymbro_workout_mutate(jsonb) owner to gymbro_workout_writer;
alter function public.gymbro_workout_resolve(jsonb) owner to gymbro_workout_writer;
revoke create on schema public from gymbro_workout_writer;
-- Keep the existing privileged operator able to manage these functions and run
-- constraint audits. Only explicit SET ROLE, never inherited/browser access.
comment on table public.gymbro_mutation_receipts is 'Protocol 1 terminal request history. No expiry/pruning/reset. Not workout-performance data.';
commit;
