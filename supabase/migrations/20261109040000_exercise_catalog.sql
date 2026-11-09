-- #17: reviewed catalog operations, identity v2, existing protocol-1 receipts.
begin;
do $$ begin
  if not exists(select 1 from pg_roles where rolname='gymbro_catalog_writer') then
    create role gymbro_catalog_writer nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
  elsif exists(select 1 from pg_roles where rolname='gymbro_catalog_writer' and
    (rolcanlogin or rolinherit or rolsuper or rolcreatedb or rolcreaterole or rolreplication or rolbypassrls)) or
    exists(select 1 from pg_auth_members where member='gymbro_catalog_writer'::regrole or
      (roleid='gymbro_catalog_writer'::regrole and member<>'postgres'::regrole)) then
    raise exception 'Unexpected catalog role capability';
  end if;
end $$;
grant usage on schema public to gymbro_catalog_writer;
grant gymbro_catalog_writer to postgres with inherit false;
do $$ declare t text; tbl text; begin
  foreach t in array public.gymbro_workout_tables()||array['workout_versions','mutation_receipts'] loop
    tbl:=coalesce(public.gymbro_workout_table(t),'gymbro_'||t);
    execute format('grant select on public.%I to gymbro_catalog_writer',tbl);
    execute format('create policy catalog_owner on public.%I for all to gymbro_catalog_writer using ((select public.gymbro_request_owner())=owner_id) with check ((select public.gymbro_request_owner())=owner_id)',tbl);
    execute format('create policy catalog_permanent on public.%I as restrictive for all to gymbro_catalog_writer using ((select public.gymbro_request_permanent()) is true) with check ((select public.gymbro_request_permanent()) is true)',tbl);
  end loop;
end $$;
grant update on public.gymbro_workout_state,public.gymbro_exercises,public.gymbro_exercise_aliases,
  public.gymbro_template_slots,public.gymbro_snapshot_slots,public.gymbro_sets,public.gymbro_guided_slots,
  public.gymbro_exercise_session_notes,public.gymbro_exercise_setup_notes,public.gymbro_workout_versions to gymbro_catalog_writer;
grant insert on public.gymbro_exercise_aliases,public.gymbro_mutation_receipts to gymbro_catalog_writer;

alter function public.gymbro_operation_valid(jsonb) rename to gymbro_pre_catalog_operation_valid;
create function public.gymbro_operation_valid(operation jsonb) returns boolean
language sql immutable set search_path='' as $$
select public.gymbro_pre_catalog_operation_valid(operation) or
  case when jsonb_typeof(operation)='array' then jsonb_array_length(operation)=2 and
    operation->>0 in ('editCatalogExercise','addCatalogAlias','mergeCatalogExercises') and
    not exists(select 1 from jsonb_array_elements(operation) v where jsonb_typeof(v)<>'string' or length(v#>>'{}')=0)
  else false end $$;

-- Build the entire permitted row transformation from authoritative rows/input.
-- The submitted next bundle cannot authorize unrelated facts or metadata edits.
create function public.gymbro_catalog_candidate(rows jsonb, action text, input jsonb, who uuid, operation jsonb, stamp text)
returns jsonb language plpgsql set search_path='' as $$
declare result jsonb:=rows; src jsonb; dst jsonb; changed jsonb; aliases jsonb; affected jsonb:='{}';
  t text; k text; col text; keys text[]; inventory jsonb; audit jsonb; name text;
begin
  select e into src from jsonb_array_elements(rows->'exercises') e where e->>'exercise_id'=input->>'exerciseId';
  if src is null or src#>'{metadata,gymbroMerge}' is not null then raise exception 'Select an unmerged source' using errcode='23514'; end if;
  result:=jsonb_set(result,'{workout_state,0,document_extra,identityVersion}','2'); changed:=src;
  if action='editCatalogExercise' then
    if exists(select 1 from jsonb_object_keys(input) k where k<>all(array['exerciseId','displayName','primary','secondary','pattern','equipment','type','state'])) then raise exception 'Unexpected catalog field' using errcode='23514'; end if;
    name:=input->>'displayName';
    if name is null or length(btrim(name))=0 then raise exception 'Name required' using errcode='23514'; end if;
    changed:=jsonb_set(changed,'{display_name}',to_jsonb(name));
    for k,col in select * from jsonb_each_text('{"primary":"primary_muscle","secondary":"secondary_muscles","pattern":"movement_pattern","equipment":"equipment","type":"exercise_type","state":"state"}') loop
      if input ? k then changed:=jsonb_set(changed,array[col],input->k); end if;
    end loop;
  elsif action='addCatalogAlias' then
    if (select count(*) from jsonb_object_keys(input))<>2 or not input ?& array['exerciseId','label'] then raise exception 'Unexpected alias field' using errcode='23514'; end if;
    name:=input->>'label';
    if name is null or length(btrim(name))=0 then raise exception 'Alias required' using errcode='23514'; end if;
  elsif action='mergeCatalogExercises' then
    if (select count(*) from jsonb_object_keys(input))<>4 or not input ?& array['exerciseId','targetId','confirmed','keepNameAlias'] or
      input->'confirmed' is distinct from 'true'::jsonb or jsonb_typeof(input->'keepNameAlias') is distinct from 'boolean' then raise exception 'Explicit merge review required' using errcode='23514'; end if;
    select e into dst from jsonb_array_elements(rows->'exercises') e where e->>'exercise_id'=input->>'targetId';
    if dst is null or dst->'exercise_id'=src->'exercise_id' or dst#>'{metadata,gymbroMerge}' is not null then raise exception 'Invalid destination' using errcode='23514'; end if;
    foreach t in array array['template_slots','snapshot_slots','sets','guided_slots','exercise_session_notes','exercise_setup_notes'] loop
      keys:=array_remove(public.gymbro_workout_keys(t),'owner_id');
      select coalesce(jsonb_agg(v order by v::text),'[]') into inventory from (
        select (select jsonb_agg(r->key order by ordinal) from unnest(keys) with ordinality q(key,ordinal)) v
        from jsonb_array_elements(rows->t) r where r->'exercise_id'=src->'exercise_id') q;
      affected:=affected||jsonb_build_object(t,inventory);
      select coalesce(jsonb_agg(case when r->'exercise_id'=src->'exercise_id' then jsonb_set(r,'{exercise_id}',dst->'exercise_id') else r end),'[]') into inventory from jsonb_array_elements(rows->t) r;
      result:=jsonb_set(result,array[t],inventory);
    end loop;
    select coalesce(jsonb_agg(a order by a->>'label' collate "C"),'[]') into aliases from jsonb_array_elements(rows->'aliases') a where a->'exercise_id'=src->'exercise_id';
    audit:=jsonb_build_object('sourceId',src->'exercise_id','targetId',dst->'exercise_id','sourceName',src->'display_name','targetName',dst->'display_name',
      'ownerId',who::text,'operation',operation,'mergedAt',stamp,'previous',src,'aliases',aliases,'affected',affected,
      'excludedLabel',case when input->'keepNameAlias'='true'::jsonb then 'null'::jsonb else src->'display_name' end);
    changed:=jsonb_set(jsonb_set(src,'{state}','"archived"'),'{metadata}',(src->'metadata')||jsonb_build_object('gymbroMerge',audit));
    select coalesce(jsonb_agg(case when a->'exercise_id'=src->'exercise_id' then jsonb_set(a,'{exercise_id}',dst->'exercise_id') else a end),'[]') into aliases from jsonb_array_elements(rows->'aliases') a;
    result:=jsonb_set(result,'{aliases}',aliases);
  else raise exception 'Unsupported catalog action' using errcode='23514'; end if;
  if name is not null then
    if exists(select 1 from jsonb_array_elements(rows->'aliases') a where a->>'label'=name and a->'exercise_id'<>src->'exercise_id') then raise exception 'Alias collision' using errcode='23505'; end if;
    if not exists(select 1 from jsonb_array_elements(rows->'aliases') a where a->>'label'=name) then
      result:=jsonb_set(result,'{aliases}',(rows->'aliases')||jsonb_build_array(jsonb_build_object('owner_id',who::text,'label',name,'exercise_id',src->'exercise_id','provenance','user-created')));
    end if;
  end if;
  select jsonb_agg(case when e->'exercise_id'=src->'exercise_id' then changed else e end) into inventory from jsonb_array_elements(rows->'exercises') e;
  return jsonb_set(result,'{exercises}',inventory);
end $$;

create function public.gymbro_catalog_mutate(packet jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare who uuid:=public.gymbro_request_owner(); snap jsonb; op jsonb:=packet->'operation'; action text:=packet->>'action';
  expected jsonb; saved jsonb; receipt public.gymbro_mutation_receipts; fingerprint text; answer jsonb; input jsonb:=packet#>'{args,0}';
  source uuid; target uuid; e jsonb; a jsonb; stamp text; response_result jsonb;
begin
  if who is null or public.gymbro_request_permanent() is not true then raise exception 'Permanent authenticated owner required' using errcode='42501'; end if;
  if packet->'protocolVersion' is distinct from '1'::jsonb or packet->>'ownerId' is distinct from who::text or
    not coalesce(public.gymbro_operation_valid(op),false) or action is distinct from op->>0 or
    action<>all(array['editCatalogExercise','addCatalogAlias','mergeCatalogExercises']) or jsonb_typeof(packet->'args') is distinct from 'array' or jsonb_array_length(packet->'args')<>1 or
    jsonb_typeof(input) is distinct from 'object' or jsonb_typeof(packet->'result') is distinct from 'object' or
    jsonb_typeof(packet->'expectedRevision') is distinct from 'string' or packet->>'expectedRevision' !~ '^(0|[1-9][0-9]*)$' then raise exception 'Invalid catalog packet' using errcode='23514'; end if;
  fingerprint:=encode(sha256(convert_to(packet::text,'UTF8')),'hex');
  perform pg_advisory_xact_lock(hashtextextended(who::text,39));
  select * into receipt from public.gymbro_mutation_receipts where owner_id=who and operation=op;
  if found then
    if receipt.status='cancelled' then answer:=jsonb_build_object('code','CANCELLED');
    elsif receipt.fingerprint<>fingerprint then answer:=jsonb_build_object('code','REQUEST_CONFLICT');
    else answer:=jsonb_build_object('code','REPLAY','operationRevision',receipt.committed_revision::text,'result',receipt.result); end if;
    return answer||jsonb_build_object('operation',op,'snapshot',public.gymbro_lifecycle_snapshot());
  end if;
  snap:=public.gymbro_lifecycle_snapshot();
  if snap->>'status'<>'healthy' then raise exception 'Healthy catalog required' using errcode='23514'; end if;
  if snap->'revision' is distinct from packet->'expectedRevision' or public.gymbro_workout_normalize(snap->'rows') is distinct from public.gymbro_workout_normalize(packet->'base') then
    return jsonb_build_object('code','CONFLICT','operation',op,'snapshot',snap); end if;
  expected:=public.gymbro_catalog_candidate(snap->'rows',action,input,who,op,null);
  if public.gymbro_workout_normalize(expected) is distinct from public.gymbro_workout_normalize(packet->'next') then raise exception 'Catalog changed unrelated facts' using errcode='23514'; end if;
  source:=(input->>'exerciseId')::uuid;
  response_result:=jsonb_build_object('changes',jsonb_build_array('catalog'),'exerciseId',coalesce(input->>'targetId',input->>'exerciseId'));
  set constraints all deferred;
  if action='mergeCatalogExercises' then
    target:=(input->>'targetId')::uuid;
    stamp:=to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
    expected:=public.gymbro_catalog_candidate(snap->'rows',action,input,who,op,stamp);
    -- No deletes, snapshot rebuilding, broad replacement, or unchecked grants.
    update public.gymbro_exercise_aliases set exercise_id=target where owner_id=who and exercise_id=source;
    update public.gymbro_template_slots set exercise_id=target where owner_id=who and exercise_id=source;
    update public.gymbro_snapshot_slots set exercise_id=target where owner_id=who and exercise_id=source;
    update public.gymbro_sets set exercise_id=target where owner_id=who and exercise_id=source;
    update public.gymbro_guided_slots set exercise_id=target where owner_id=who and exercise_id=source;
    update public.gymbro_exercise_session_notes set exercise_id=target where owner_id=who and exercise_id=source;
    update public.gymbro_exercise_setup_notes set exercise_id=target where owner_id=who and exercise_id=source;
    response_result:=response_result||jsonb_build_object('mergedAt',stamp);
  end if;
  select value into e from jsonb_array_elements(expected->'exercises') where value->>'exercise_id'=source::text;
  update public.gymbro_exercises set display_name=e->>'display_name',primary_muscle=e->>'primary_muscle',
    secondary_muscles=array(select jsonb_array_elements_text(e->'secondary_muscles')),movement_pattern=e->>'movement_pattern',
    equipment=e->>'equipment',exercise_type=e->>'exercise_type',state=e->>'state',metadata=e->'metadata' where owner_id=who and exercise_id=source;
  for a in select * from jsonb_array_elements(expected->'aliases') loop
    insert into public.gymbro_exercise_aliases(owner_id,label,exercise_id,provenance) values(who,a->>'label',(a->>'exercise_id')::uuid,a->>'provenance') on conflict do nothing;
  end loop;
  update public.gymbro_workout_state set document_extra=expected#>'{workout_state,0,document_extra}' where owner_id=who;
  set constraints all immediate;
  saved:=public.gymbro_workout_read();
  if public.gymbro_workout_normalize(saved) is distinct from public.gymbro_workout_normalize(expected) or public.gymbro_lifecycle_readable(saved) is not true then raise exception 'Catalog acknowledgement mismatch' using errcode='23514'; end if;
  update public.gymbro_workout_versions set revision=revision+1 where owner_id=who;
  insert into public.gymbro_mutation_receipts(owner_id,operation,protocol_version,status,fingerprint,committed_revision,result)
    values(who,op,1,'committed',fingerprint,(snap->>'revision')::numeric+1,response_result);
  return jsonb_build_object('code','OK','operation',op,'operationRevision',((snap->>'revision')::numeric+1)::text,'result',response_result,'snapshot',public.gymbro_lifecycle_snapshot());
end $$;

-- Guard/readability updates are appended below by the source-preserving builder.

create or replace function public.gymbro_workout_guard() returns trigger language plpgsql set search_path='' as $$
declare n jsonb := to_jsonb(new); o jsonb := to_jsonb(old); key text; parent public.gymbro_sessions;
begin
  if current_user='gymbro_catalog_writer' and tg_op='UPDATE' and
    tg_table_name in ('gymbro_template_slots','gymbro_snapshot_slots','gymbro_sets','gymbro_guided_slots','gymbro_exercise_session_notes','gymbro_exercise_setup_notes') and
    n-'exercise_id'=o-'exercise_id' then return new; end if;
  if tg_op='UPDATE' then
    foreach key in array tg_argv loop
      if n->key is distinct from o->key then raise exception 'Workout identity or historical intent is immutable' using errcode='23514'; end if;
    end loop;
  end if;
  if tg_table_name='gymbro_sessions' then
    if tg_op='INSERT' then new.creation_transaction:=pg_current_xact_id(); end if;
    if tg_op='UPDATE' and old.status='completed' and new is distinct from old then
      raise exception 'Completed session lifecycle is immutable' using errcode='23514';
    end if;
  end if;
  if tg_table_name in ('gymbro_snapshot_slots','gymbro_guidance','gymbro_guided_slots','gymbro_guided_requests') then
    select * into parent from public.gymbro_sessions where owner_id=new.owner_id and session_id=new.session_id;
    if parent.creation_transaction<>pg_current_xact_id() then
      if tg_table_name='gymbro_snapshot_slots' or parent.status='completed' then
        raise exception 'Historical plan or completed guidance cannot be extended' using errcode='23514';
      end if;
    end if;
  end if;
  if tg_table_name='gymbro_sets' then
    if tg_op='UPDATE' and old.session_id is not null and
      (new.session_id,new.plan_slot_id,new.workout_date) is distinct from (old.session_id,old.plan_slot_id,old.workout_date) then
      raise exception 'Set membership is immutable' using errcode='23514';
    end if;
    if ((tg_op='INSERT' and not exists(select 1 from public.gymbro_sets s where s.owner_id=new.owner_id and s.set_id=new.set_id)) or
      (tg_op='UPDATE' and old.session_id is distinct from new.session_id)) and new.session_id is not null then
      select * into parent from public.gymbro_sessions where owner_id=new.owner_id and session_id=new.session_id;
      -- A new historical bundle may contain completed facts. Existing completed
      -- sessions never acquire new members. #28 owns personal migration.
      if parent.status<>'active' and parent.creation_transaction<>pg_current_xact_id() then
        raise exception 'Cannot add membership to a completed session' using errcode='23514';
      end if;
    end if;
    if tg_op='INSERT' and exists(select 1 from public.gymbro_guided_requests r where r.owner_id=new.owner_id and r.set_id=new.set_id) and
      not exists(select 1 from public.gymbro_sets s where s.owner_id=new.owner_id and s.set_id=new.set_id) then
      raise exception 'Submitted set identity cannot be reused' using errcode='23514';
    end if;
  end if;
  return new;
end; $$;
create or replace function public.gymbro_register_exercise_name() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.state='archived' and new.metadata#>>'{gymbroMerge,sourceId}'=new.exercise_id::text then return new; end if;
  insert into public.gymbro_exercise_aliases(owner_id, label, exercise_id, provenance)
    values (new.owner_id, new.display_name, new.exercise_id,
      case when tg_op = 'UPDATE' then 'user-created' else new.provenance end)
    on conflict (owner_id, label) do nothing;
  if not exists (select 1 from public.gymbro_exercise_aliases
    where owner_id = new.owner_id and label = new.display_name and exercise_id = new.exercise_id) then
    raise exception 'Exercise label already belongs to another identity' using errcode = '23505';
  end if;
  return new;
end;
$$;

create function public.gymbro_catalog_audit_guard() returns trigger language plpgsql set search_path='' as $$
begin
  if current_user not in ('gymbro_catalog_writer','gymbro_lifecycle_writer') and
    ((tg_op='INSERT' and new.metadata ? 'gymbroMerge') or
     (tg_op='UPDATE' and (new.metadata->'gymbroMerge' is distinct from old.metadata->'gymbroMerge' or
       (old.metadata ? 'gymbroMerge' and new is distinct from old)))) then
    raise exception 'Merge audit is immutable outside checked catalog/restore' using errcode='23514'; end if;
  return new;
end $$;
create trigger catalog_audit_guard before insert or update on public.gymbro_exercises for each row execute function public.gymbro_catalog_audit_guard();

alter function public.gymbro_lifecycle_readable(jsonb) rename to gymbro_identity_v1_readable;
create function public.gymbro_lifecycle_readable(rows jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare adjusted jsonb:=rows; exercise jsonb; merge jsonb; replacements jsonb:='[]'; match_id jsonb;
begin
  if rows#>'{workout_state,0,document_extra,identityVersion}'='1'::jsonb then return public.gymbro_identity_v1_readable(rows); end if;
  if rows#>'{workout_state,0,document_extra,identityVersion}' is distinct from '2'::jsonb then return false; end if;
  for exercise in select * from jsonb_array_elements(rows->'exercises') loop
    merge:=exercise#>'{metadata,gymbroMerge}';
    if merge is not null then
      if jsonb_typeof(merge) is distinct from 'object' or exercise->>'state'<>'archived' or
        merge->'sourceId' is distinct from exercise->'exercise_id' or merge->'sourceName' is distinct from exercise->'display_name' or
        merge->'sourceId'=merge->'targetId' or merge->>'ownerId' is distinct from exercise->>'owner_id' or
        jsonb_typeof(merge->'previous') is distinct from 'object' or jsonb_typeof(merge->'aliases') is distinct from 'array' or jsonb_typeof(merge->'affected') is distinct from 'object' or
        not coalesce(case when jsonb_typeof(merge->'operation')='array' then jsonb_array_length(merge->'operation')=2 and
          not exists(select 1 from jsonb_array_elements(merge->'operation') v where jsonb_typeof(v)<>'string' or length(v#>>'{}')=0) else false end,false) or
        merge#>>'{operation,0}' is distinct from 'mergeCatalogExercises' or
        not coalesce(public.gymbro_lifecycle_timestamp(merge->>'mergedAt'),false) or
        (merge->'excludedLabel' is distinct from 'null'::jsonb and merge->'excludedLabel' is distinct from exercise->'display_name') or
        not exists(select 1 from jsonb_array_elements(rows->'exercises') target where target->'exercise_id'=merge->'targetId') then return false; end if;
      select a->'exercise_id' into match_id from jsonb_array_elements(rows->'aliases') a where a->'label'=exercise->'display_name';
      if match_id is null then return false; end if;
      exercise:=jsonb_set(exercise,'{exercise_id}',match_id);
    end if;
    replacements:=replacements||jsonb_build_array(exercise);
  end loop;
  adjusted:=jsonb_set(jsonb_set(adjusted,'{exercises}',replacements),'{workout_state,0,document_extra,identityVersion}','1');
  return public.gymbro_identity_v1_readable(adjusted);
end $$;

revoke all on function public.gymbro_catalog_candidate(jsonb,text,jsonb,uuid,jsonb,text),public.gymbro_catalog_mutate(jsonb),
  public.gymbro_catalog_audit_guard(),public.gymbro_operation_valid(jsonb),public.gymbro_lifecycle_readable(jsonb) from public,anon,authenticated;
grant execute on function public.gymbro_request_owner(),public.gymbro_request_permanent(),public.gymbro_workout_tables(),public.gymbro_workout_keys(text),
  public.gymbro_workout_table(text),public.gymbro_workout_normalize(jsonb),public.gymbro_workout_read(),public.gymbro_lifecycle_snapshot(),public.gymbro_lifecycle_readable(jsonb),
  public.gymbro_catalog_candidate(jsonb,text,jsonb,uuid,jsonb,text),public.gymbro_operation_valid(jsonb),public.gymbro_pre_catalog_operation_valid(jsonb),
  public.gymbro_domain_operation_valid(jsonb),public.gymbro_identity_v1_readable(jsonb),public.gymbro_lifecycle_timestamp(text) to gymbro_catalog_writer;
grant execute on function public.gymbro_operation_valid(jsonb),public.gymbro_lifecycle_readable(jsonb) to gymbro_workout_writer,gymbro_lifecycle_writer;
grant execute on function public.gymbro_lifecycle_readable(jsonb) to authenticated;
grant execute on function public.gymbro_catalog_mutate(jsonb) to authenticated;
grant create on schema public to gymbro_catalog_writer;
alter function public.gymbro_catalog_mutate(jsonb) owner to gymbro_catalog_writer;
revoke create on schema public from gymbro_catalog_writer;
commit;
