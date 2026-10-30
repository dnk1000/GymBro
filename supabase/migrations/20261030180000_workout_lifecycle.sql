-- #41: explicit owner-only complete restore. Existing migrations are unchanged.
begin;
do $$ begin
  if not exists(select 1 from pg_roles where rolname='gymbro_lifecycle_writer') then
    create role gymbro_lifecycle_writer nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
  elsif exists(select 1 from pg_roles where rolname='gymbro_lifecycle_writer' and
    (rolcanlogin or rolinherit or rolsuper or rolcreatedb or rolcreaterole or rolreplication or rolbypassrls)) or
    exists(select 1 from pg_auth_members where member='gymbro_lifecycle_writer'::regrole or
      (roleid='gymbro_lifecycle_writer'::regrole and member<>'postgres'::regrole)) then
    raise exception 'Unexpected lifecycle role capability';
  end if;
end $$;
grant usage on schema public to gymbro_lifecycle_writer;
grant execute on function public.gymbro_request_owner(),public.gymbro_request_permanent(),public.gymbro_workout_read(),
  public.gymbro_workout_tables(),public.gymbro_workout_keys(text),public.gymbro_workout_table(text),
  public.gymbro_workout_normalize(jsonb),public.gymbro_valid_date(text),public.gymbro_workout_snapshot(),
  public.gymbro_workout_commit(jsonb,jsonb) to gymbro_lifecycle_writer;

do $$ declare t text; tbl text; begin
  foreach t in array public.gymbro_workout_tables()||array['workout_versions','mutation_receipts'] loop
    tbl:=coalesce(public.gymbro_workout_table(t),'gymbro_'||t);
    execute format('grant select,insert on public.%I to gymbro_lifecycle_writer',tbl);
    if t<>'mutation_receipts' then execute format('grant update on public.%I to gymbro_lifecycle_writer',tbl); end if;
    if t=any(public.gymbro_workout_tables()) then execute format('grant delete on public.%I to gymbro_lifecycle_writer',tbl); end if;
    execute format('create policy lifecycle_owner on public.%I for all to gymbro_lifecycle_writer using ((select public.gymbro_request_owner())=owner_id) with check ((select public.gymbro_request_owner())=owner_id)',tbl);
    execute format('create policy lifecycle_permanent on public.%I as restrictive for all to gymbro_lifecycle_writer using ((select public.gymbro_request_permanent()) is true) with check ((select public.gymbro_request_permanent()) is true)',tbl);
  end loop;
end $$;
-- Replacement never updates receipt rows or deletes protocol history.
revoke update on public.gymbro_snapshot_slots,public.gymbro_guided_requests,public.gymbro_exercise_aliases from gymbro_lifecycle_writer;

-- Reconstruction metadata not covered by typed relational columns. This is a
-- server-owned qualification check, never a caller-supplied emergency flag.
-- The existing typed/FK/uniqueness/intent guards remain the graph authority.
create function public.gymbro_lifecycle_timestamp(v text) returns boolean
language plpgsql immutable set search_path='' as $$
declare p text[]; y integer; tail text;
begin
  p:=regexp_match(v,'^([0-9]{4}|[+-][0-9]{6})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2}):([0-9]{2})[.]([0-9]{3})Z$');
  if p is null then return false; end if;
  y:=p[1]::integer;
  if y < -271821 or y > 275760 or (left(p[1],1)='+' and y<10000) or (left(p[1],1)='-' and y=0) or
    p[4]::integer>23 or p[5]::integer>59 or p[6]::integer>59 or
    not public.gymbro_valid_date(lpad((((y%400)+400)%400)::text,4,'0')||'-'||p[2]||'-'||p[3]) then return false; end if;
  tail:=p[2]||'-'||p[3]||'T'||p[4]||':'||p[5]||':'||p[6]||'.'||p[7];
  return not ((y=275760 and tail>'09-13T00:00:00.000') or (y=-271821 and tail<'04-20T00:00:00.000'));
end $$;
create function public.gymbro_lifecycle_readable(rows jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare root jsonb:=rows->'workout_state'->0; doc jsonb; r jsonb; t text; key text; col text;
  spec jsonb; mapping jsonb; required text[]; omitted text[]; present text[]; expected text[]; meta jsonb;
begin
  if jsonb_array_length(rows->'workout_state') is distinct from 1 then return false; end if;
  doc:=root->'document_extra';
  if doc->'identityVersion' is distinct from '1'::jsonb or doc->'sourceSchemaVersion' is distinct from '8'::jsonb or
    jsonb_typeof(doc->'legacyExerciseLibrary') is distinct from 'object' or doc ?| array['data','catalog'] or
    root->'extra' ?| array['sets','bodyweights','sessions','activeSessionId','program','imports','noteScopes','version','exerciseLibrary'] or
    root->'program_extra' ?| array['templates','activeTemplateId','activeDuration'] or
    root->'notes_extra' ?| array['session','exerciseSession','exercise'] or
    jsonb_typeof(root#>'{extra,preferences}') is distinct from 'object' then return false; end if;
  if exists(select 1 from jsonb_each(root#>'{extra,preferences}') x where jsonb_typeof(value)<>'string') then return false; end if;
  if exists(select 1 from jsonb_array_elements(rows->'exercises') e where e->>'display_name' ~ '^[[:space:]]*$' or
    not exists(select 1 from jsonb_array_elements(rows->'aliases') a where a->'label'=e->'display_name' and a->'exercise_id'=e->'exercise_id')) then return false; end if;
  for key,meta in select * from jsonb_each(doc->'legacyExerciseLibrary') loop
    if key ~ '^[[:space:]]*$' or key=any(array['__proto__','constructor','prototype']) or jsonb_typeof(meta)<>'object' or
      not exists(select 1 from jsonb_array_elements(rows->'aliases') a where a->>'label'=key) then return false; end if;
    foreach col in array array['primary','pattern','type','status'] loop
      if jsonb_typeof(meta->col) is distinct from 'string' then return false; end if;
    end loop;
    if jsonb_typeof(meta->'secondary') is distinct from 'array' then return false; end if;
    if exists(select 1 from jsonb_array_elements(meta->'secondary') v where jsonb_typeof(v)<>'string') then return false; end if;
  end loop;
  -- The keys below are the same accepted pack/unpack source-column contract.
  for t,spec in select * from jsonb_each('{
    "templates":{"map":{"id":"template_id","name":"name","focus":"focus","intensity":"intensity"},"required":["id","name","focus","intensity","slots"],"omitted":["slots"]},
    "template_slots":{"map":{"role":"role","short":"short"},"required":["exercise","role","short"],"omitted":["exercise"]},
    "sessions":{"map":{"id":"session_id","date":"workout_date","status":"status","createdAt":"created_at","completedAt":"completed_at","templateId":"template_origin_id","duration":"duration"},"required":["id","date","status","createdAt","completedAt","templateId","duration","planSnapshot","setIds"],"omitted":["planSnapshot","setIds","guided"]},
    "snapshot_slots":{"map":{"id":"plan_slot_id","role":"role"},"required":["id","exercise","role"],"omitted":["exercise"]},
    "sets":{"map":{"id":"set_id","date":"workout_date","weight":"weight","unit":"unit","reps":"reps","rpe":"rpe","rir":"rir","pain":"pain","painArea":"pain_area","notes":"notes","source":"source","complete":"complete","sessionId":"session_id","planSlotId":"plan_slot_id"},"required":["id","date","exercise","unit","notes","painArea","source","complete"],"omitted":["exercise"]},
    "bodyweights":{"map":{"date":"workout_date","value":"value"},"required":["date","value"],"omitted":[]},
    "guidance":{"map":{"currentSlotId":"current_slot_id","revision":"revision"},"required":["currentSlotId","revision","slots","requests"],"omitted":["slots","requests"]},
    "guided_slots":{"map":{"planSlotId":"plan_slot_id","status":"status"},"required":["planSlotId","status","actualExercise"],"omitted":["actualExercise"]},
    "guided_requests":{"map":{"id":"request_id","setId":"set_id","signature":"signature"},"required":["id","setId","signature"],"omitted":[]},
    "imports":{"map":{"importId":"import_id","date":"workout_date","setCount":"set_count"},"required":["importId","date","setCount"],"omitted":[]},
    "session_notes":{"map":{"sessionId":"session_id","text":"text"},"required":["sessionId","text"],"omitted":[]},
    "exercise_session_notes":{"map":{"sessionId":"session_id","planSlotId":"plan_slot_id","text":"text"},"required":["sessionId","planSlotId","exercise","text"],"omitted":["exercise"]},
    "exercise_setup_notes":{"map":{"text":"text"},"required":["exercise","text"],"omitted":["exercise"]}
  }'::jsonb) loop
    mapping:=spec->'map';
    select array_agg(value) into required from jsonb_array_elements_text(spec->'required');
    select coalesce(array_agg(value),'{}') into omitted from jsonb_array_elements_text(spec->'omitted');
    if exists(select 1 from (
      select (entry.value->>'position')::numeric p,row_number() over(partition by case
        when t='template_slots' then entry.value->'template_id'
        when t in ('snapshot_slots','guidance','guided_slots','guided_requests') then entry.value->'session_id' else 'null'::jsonb end
        order by (entry.value->>'position')::numeric)-1 ordinal from jsonb_array_elements(rows->t) entry(value)
      ) positions where positions.p<>positions.ordinal) then return false; end if;
    for r in select * from jsonb_array_elements(rows->t) loop
      select coalesce(array_agg(value order by value),'{}') into present from jsonb_array_elements_text(r->'present');
      if not present @> required or cardinality(present)<>(select count(distinct value) from jsonb_array_elements_text(r->'present')) or
        exists(select 1 from jsonb_object_keys(r->'extra') k where mapping ? k or k=any(omitted)) then return false; end if;
      select array_agg(k order by k) into expected from (
        select jsonb_object_keys(r->'extra') k union
        select k from jsonb_object_keys(mapping) k where k=any(present) union
        select k from unnest(omitted) k where k=any(present)) x;
      if present is distinct from expected then return false; end if;
      for key,col in select * from jsonb_each_text(mapping) loop
        if not key=any(present) and r->col<>'null'::jsonb then return false; end if;
      end loop;
      if t in ('template_slots','snapshot_slots','sets','guided_slots','exercise_session_notes','exercise_setup_notes') and
        (r->>'original_label' ~ '^[[:space:]]*$' or r->>'original_label'=any(array['__proto__','constructor','prototype'])) then return false; end if;
      if t in ('guided_slots','exercise_session_notes','exercise_setup_notes') and not (doc->'legacyExerciseLibrary' ? (r->>'original_label')) then return false; end if;
      if t='snapshot_slots' and exists(select 1 from jsonb_array_elements(rows->'guidance') g where g->'session_id'=r->'session_id') and
        not (doc->'legacyExerciseLibrary' ? (r->>'original_label')) then return false; end if;
      if t='sets' and (r->'session_id'='null'::jsonb and 'planSlotId'=any(present) or
        r->'plan_slot_id'='null'::jsonb and 'planSlotId'=any(present)) then return false; end if;
      if t='sessions' then
        if not public.gymbro_lifecycle_timestamp(r->>'created_at') or (r->>'status'='completed' and not public.gymbro_lifecycle_timestamp(r->>'completed_at')) then return false; end if;
        if ('guided'=any(present)) is distinct from exists(select 1 from jsonb_array_elements(rows->'guidance') g where g->'session_id'=r->'session_id') then return false; end if;
        if r->'snapshot_extra'<>'null'::jsonb and r->'snapshot_extra' ?| array['name','slots'] then return false; end if;
        if r->>'status'='completed' and r->>'completed_at'<r->>'created_at' then return false; end if;
      end if;
      if t='guidance' and not exists(select 1 from jsonb_array_elements(rows->'snapshot_slots') s where s->'session_id'=r->'session_id') then return false; end if;
      if t='imports' then
        foreach key in array array['template','batch','notes','committedAt'] loop
          if r->'extra' ? key and jsonb_typeof(r#>array['extra',key]) not in ('null','string') then return false; end if;
        end loop;
        if r#>'{extra,duration}' is not null and r#>'{extra,duration}'<>'null'::jsonb and
          (jsonb_typeof(r#>'{extra,duration}')<>'number' or (r#>>'{extra,duration}')::numeric<=0) then return false; end if;
      end if;
      if t='session_notes' and r->'extra' ?| array['exercise','planSlotId'] then return false; end if;
      if t='exercise_setup_notes' and r->'extra' ?| array['sessionId','planSlotId'] then return false; end if;
    end loop;
  end loop;
  if exists(select 1 from (
    select (entry.value->>'session_position')::numeric p,row_number() over(partition by entry.value->'session_id' order by (entry.value->>'session_position')::numeric)-1 ordinal
    from jsonb_array_elements(rows->'sets') entry(value) where entry.value->'session_id'<>'null'::jsonb
    ) positions where positions.p<>positions.ordinal) then return false; end if;
  return true;
exception when invalid_text_representation or invalid_parameter_value or numeric_value_out_of_range then return false;
end $$;

create function public.gymbro_lifecycle_snapshot() returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare snapshot jsonb:=public.gymbro_workout_snapshot(); rows jsonb:=snapshot->'rows'; status text;
begin
  if not exists(select 1 from jsonb_each(rows) x where jsonb_array_length(value)>0) then status:='uninitialized';
  elsif public.gymbro_lifecycle_readable(rows) then status:='healthy'; else status:='unreadable'; end if;
  return snapshot||jsonb_build_object('status',status,'fingerprint',encode(sha256(convert_to(public.gymbro_workout_normalize(rows)::text,'UTF8')),'hex'));
end $$;

-- Extend terminal recovery identity, never the ordinary writer's privileges.
alter function public.gymbro_operation_valid(jsonb) rename to gymbro_domain_operation_valid;
create function public.gymbro_operation_valid(operation jsonb) returns boolean
language sql immutable set search_path='' as $$
select public.gymbro_domain_operation_valid(operation) or
  case when jsonb_typeof(operation)='array' then jsonb_array_length(operation)=2 and
    operation->>0 in ('restoreCompleteBackup','mergeHistoryBackup') and
    not exists(select 1 from jsonb_array_elements(operation) v where jsonb_typeof(v)<>'string' or length(v#>>'{}')=0)
  else false end
$$;

create function public.gymbro_lifecycle_mutate(packet jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare who uuid:=public.gymbro_request_owner(); snapshot jsonb; receipt public.gymbro_mutation_receipts;
  fingerprint text; op jsonb:=packet->'operation'; answer jsonb; t text; tbl text; saved jsonb; current_revision numeric;
begin
  if who is null or public.gymbro_request_permanent() is not true then raise exception 'Permanent authenticated owner required' using errcode='42501'; end if;
  if packet->'protocolVersion' is distinct from '1'::jsonb or packet->>'ownerId' is distinct from who::text or
    not coalesce(public.gymbro_operation_valid(op),false) or op->>0 not in ('restoreCompleteBackup','mergeHistoryBackup') or
    packet->>'action' is distinct from op->>0 or jsonb_typeof(packet->'expectedRevision') is distinct from 'string' or
    packet->>'expectedRevision' !~ '^(0|[1-9][0-9]*)$' or jsonb_typeof(packet->'result') is distinct from 'object' then
    raise exception 'Invalid lifecycle packet' using errcode='23514'; end if;
  if not packet ? 'sourceOwnerId' or (packet->'sourceOwnerId'<>'null'::jsonb and packet->>'sourceOwnerId' is distinct from who::text) then
    raise exception 'Backup account mismatch' using errcode='42501'; end if;
  fingerprint:=encode(sha256(convert_to(packet::text,'UTF8')),'hex');
  perform pg_advisory_xact_lock(hashtextextended(who::text,39));
  select * into receipt from public.gymbro_mutation_receipts where owner_id=who and operation=op;
  if found then
    if receipt.status='cancelled' then answer:=jsonb_build_object('code','CANCELLED');
    elsif receipt.fingerprint<>fingerprint then answer:=jsonb_build_object('code','REQUEST_CONFLICT');
    else answer:=jsonb_build_object('code','REPLAY','operationRevision',receipt.committed_revision::text,'result',receipt.result); end if;
    return answer||jsonb_build_object('operation',op,'snapshot',public.gymbro_lifecycle_snapshot());
  end if;
  snapshot:=public.gymbro_lifecycle_snapshot(); current_revision:=(snapshot->>'revision')::numeric;
  if packet->'expectedRevision' is distinct from snapshot->'revision' or packet->'fingerprint' is distinct from snapshot->'fingerprint' or
    packet->'status' is distinct from snapshot->'status' or
    public.gymbro_workout_normalize(packet->'base') is distinct from public.gymbro_workout_normalize(snapshot->'rows') then
    return jsonb_build_object('code','CONFLICT','operation',op,'snapshot',snapshot); end if;
  if packet->>'action'='restoreCompleteBackup' then
    if snapshot->>'status'='healthy' and packet->'safety' is distinct from
      jsonb_build_object('ownerId',who::text,'revision',snapshot->>'revision','fingerprint',snapshot->>'fingerprint') then
      raise exception 'Current recovery backup binding required' using errcode='23514'; end if;
    -- Emergency qualification is re-evaluated from the server snapshot here.
    if snapshot->>'status' not in ('healthy','unreadable','uninitialized') then raise exception 'Recovery unavailable' using errcode='23514'; end if;
    set constraints all deferred;
    foreach t in array array['sets','guided_requests','guided_slots','guidance','exercise_session_notes','session_notes','exercise_setup_notes',
      'snapshot_slots','sessions','template_slots','workout_state','templates','aliases','exercises','bodyweights','imports'] loop
      execute format('delete from public.%I where owner_id=$1',public.gymbro_workout_table(t)) using who;
    end loop;
    -- Insert using the existing constrained helper after complete deletion.
    -- Insert ordering is essential for immutable parent/child guards.
    saved:=public.gymbro_workout_commit(null,packet->'next');
  else
    if snapshot->>'status'<>'healthy' then raise exception 'Merge requires healthy data' using errcode='23514'; end if;
    -- Server-side preservation checks: no deletion or rewrite of existing facts,
    -- settings/templates/catalog. Bodyweight/import additions remain constrained.
    foreach t in array public.gymbro_workout_tables() loop
      if t='workout_state' then
        if (snapshot->'rows'->t->0 #- '{document_extra,legacyExerciseLibrary}') is distinct from
          (packet->'next'->t->0 #- '{document_extra,legacyExerciseLibrary}') or
          exists(select 1 from jsonb_each(snapshot#>'{rows,workout_state,0,document_extra,legacyExerciseLibrary}') old
            where packet#>array['next','workout_state','0','document_extra','legacyExerciseLibrary',old.key] is distinct from old.value) then
          raise exception 'Merge changed settings' using errcode='23514'; end if;
      elsif t in ('templates','template_slots') then
        if public.gymbro_workout_normalize(jsonb_build_object(t,snapshot->'rows'->t)) is distinct from
          public.gymbro_workout_normalize(jsonb_build_object(t,packet->'next'->t)) then raise exception 'Merge changed program' using errcode='23514'; end if;
      elsif t='imports' then
        if exists(select 1 from jsonb_array_elements(snapshot->'rows'->t) r where not exists(select 1 from jsonb_array_elements(packet->'next'->t) n where
          n-'set_count'=r-'set_count' and (n->'set_count'=r->'set_count' or (r#>'{extra,batch}' is not null and r#>'{extra,batch}'<>'null'::jsonb and
            (n->>'set_count')::numeric=(select count(*) from jsonb_array_elements(packet#>'{next,sets}') s where s#>'{extra,importBatch}'=r#>'{extra,batch}'))))) then
          raise exception 'Merge changed import metadata' using errcode='23514'; end if;
      elsif exists(select 1 from jsonb_array_elements(snapshot->'rows'->t) r where not exists(select 1 from jsonb_array_elements(packet->'next'->t) n where n=r)) then
        raise exception 'Merge rewrote existing content' using errcode='23514';
      end if;
    end loop;
    if public.gymbro_workout_normalize(snapshot->'rows') is not distinct from public.gymbro_workout_normalize(packet->'next') then
      return jsonb_build_object('code','NO_CHANGE','operation',op,'snapshot',snapshot); end if;
    saved:=public.gymbro_workout_commit(snapshot->'rows',packet->'next');
  end if;
  if public.gymbro_lifecycle_readable(saved) is not true then raise exception 'Unreconstructable replacement' using errcode='23514'; end if;
  insert into public.gymbro_workout_versions(owner_id,revision) values(who,current_revision+1)
    on conflict(owner_id) do update set revision=excluded.revision;
  insert into public.gymbro_mutation_receipts(owner_id,operation,protocol_version,status,fingerprint,committed_revision,result)
    values(who,op,1,'committed',fingerprint,current_revision+1,packet->'result');
  return jsonb_build_object('code','OK','operation',op,'operationRevision',(current_revision+1)::text,'result',packet->'result','snapshot',public.gymbro_lifecycle_snapshot());
end $$;

create function public.gymbro_lifecycle_resolve(operation jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare who uuid:=public.gymbro_request_owner(); receipt public.gymbro_mutation_receipts; answer jsonb;
begin
  if who is null or public.gymbro_request_permanent() is not true then raise exception 'Permanent authenticated owner required' using errcode='42501'; end if;
  if not coalesce(public.gymbro_operation_valid(operation),false) then raise exception 'Invalid operation identity' using errcode='23514'; end if;
  perform pg_advisory_xact_lock(hashtextextended(who::text,39));
  select * into receipt from public.gymbro_mutation_receipts r where r.owner_id=who and r.operation=gymbro_lifecycle_resolve.operation;
  if not found then
    insert into public.gymbro_workout_versions(owner_id) values(who) on conflict do nothing;
    insert into public.gymbro_mutation_receipts(owner_id,operation,protocol_version,status) values(who,operation,1,'cancelled');answer:=jsonb_build_object('code','CANCELLED');
  elsif receipt.status='cancelled' then answer:=jsonb_build_object('code','CANCELLED');
  else answer:=jsonb_build_object('code','REPLAY','operationRevision',receipt.committed_revision::text,'result',receipt.result); end if;
  return answer||jsonb_build_object('operation',operation,'snapshot',public.gymbro_lifecycle_snapshot());
end $$;
revoke all on function public.gymbro_lifecycle_timestamp(text),public.gymbro_lifecycle_readable(jsonb),public.gymbro_lifecycle_snapshot(),public.gymbro_lifecycle_mutate(jsonb),
  public.gymbro_lifecycle_resolve(jsonb),public.gymbro_operation_valid(jsonb) from public,anon,authenticated;
grant execute on function public.gymbro_domain_operation_valid(jsonb),public.gymbro_operation_valid(jsonb) to gymbro_workout_writer,gymbro_lifecycle_writer;
grant execute on function public.gymbro_lifecycle_timestamp(text),public.gymbro_lifecycle_readable(jsonb),public.gymbro_lifecycle_snapshot() to authenticated,gymbro_lifecycle_writer;
grant execute on function public.gymbro_lifecycle_mutate(jsonb),public.gymbro_lifecycle_resolve(jsonb) to authenticated;
grant gymbro_lifecycle_writer to postgres with inherit false;
grant create on schema public to gymbro_lifecycle_writer;
alter function public.gymbro_lifecycle_mutate(jsonb) owner to gymbro_lifecycle_writer;
alter function public.gymbro_lifecycle_resolve(jsonb) owner to gymbro_lifecycle_writer;
revoke create on schema public from gymbro_lifecycle_writer;
commit;
