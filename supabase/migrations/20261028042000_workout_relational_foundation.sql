-- #39 only: additive, opt-in foundation. No personal data import or UI cutover.
begin;
create function public.gymbro_valid_date(v text) returns boolean
language plpgsql immutable set search_path = '' as $$
declare y int; m int; d int; days int[] := array[31,28,31,30,31,30,31,31,30,31,30,31];
begin
  if v is null or v !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then return false; end if;
  y := substring(v,1,4)::int; m := substring(v,6,2)::int; d := substring(v,9,2)::int;
  if m < 1 or m > 12 then return false; end if;
  if y % 4 = 0 and (y % 100 <> 0 or y % 400 = 0) then days[2] := 29; end if;
  return d >= 1 and d <= days[m];
end; $$;

create table public.gymbro_workout_state (
  owner_id uuid primary key references auth.users(id),
  model_version int not null check (model_version = 1),
  selected_template_id text, duration int not null check (duration in (30,60)),
  document_extra jsonb not null check (jsonb_typeof(document_extra) = 'object'),
  extra jsonb not null check (jsonb_typeof(extra) = 'object'),
  program_extra jsonb not null check (jsonb_typeof(program_extra) = 'object'),
  notes_extra jsonb not null check (jsonb_typeof(notes_extra) = 'object')
);
create table public.gymbro_templates (
  owner_id uuid not null references auth.users(id), template_id text not null check (template_id <> ''),
  name text not null, focus text not null, intensity text not null,
  position bigint not null check (position >= 0), present text[] not null, extra jsonb not null check (jsonb_typeof(extra)='object'),
  primary key(owner_id,template_id), unique(owner_id,position) deferrable initially deferred
);
alter table public.gymbro_workout_state add foreign key(owner_id,selected_template_id)
  references public.gymbro_templates(owner_id,template_id) deferrable initially deferred;
-- A composite label+identity FK prevents contradictory provenance mappings.
alter table public.gymbro_exercise_aliases add unique(owner_id,label,exercise_id);
create table public.gymbro_template_slots (
  owner_id uuid not null references auth.users(id), template_id text not null,
  position bigint not null check(position>=0), exercise_id uuid not null, original_label text collate "C" not null,
  role text not null check(role in ('core','accessory','substitute')), short boolean not null,
  present text[] not null, extra jsonb not null check(jsonb_typeof(extra)='object'),
  primary key(owner_id,template_id,position),
  foreign key(owner_id,template_id) references public.gymbro_templates(owner_id,template_id) deferrable initially deferred,
  foreign key(owner_id,original_label,exercise_id) references public.gymbro_exercise_aliases(owner_id,label,exercise_id) deferrable initially deferred
);
create table public.gymbro_sessions (
  owner_id uuid not null references auth.users(id), session_id text not null check(session_id<>''),
  workout_date text not null check(public.gymbro_valid_date(workout_date)),
  status text not null check(status in ('active','completed')),
  created_at text collate "C" not null check(created_at ~ '^([0-9]{4}|[+-][0-9]{6})-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$'),
  completed_at text collate "C" check(completed_at ~ '^([0-9]{4}|[+-][0-9]{6})-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$' and completed_at>=created_at),
  template_origin_id text, duration int not null check(duration in (30,60)),
  snapshot_name text, snapshot_extra jsonb,
  position bigint not null check(position>=0), present text[] not null, extra jsonb not null check(jsonb_typeof(extra)='object'),
  primary key(owner_id,session_id), unique(owner_id,session_id,workout_date),
  unique(owner_id,position) deferrable initially deferred,
  check ((status='active' and completed_at is null) or (status='completed' and completed_at is not null)),
  check ((template_origin_id is null and snapshot_name is null and snapshot_extra is null) or
    (template_origin_id is not null and template_origin_id<>'' and snapshot_name is not null and jsonb_typeof(snapshot_extra)='object'))
);
create unique index gymbro_one_active_session on public.gymbro_sessions(owner_id) where status='active';
create table public.gymbro_snapshot_slots (
  owner_id uuid not null references auth.users(id), session_id text not null, plan_slot_id text not null check(plan_slot_id<>''),
  exercise_id uuid not null, original_label text collate "C" not null, role text not null check(role in ('core','accessory','substitute')),
  position bigint not null check(position>=0), present text[] not null, extra jsonb not null check(jsonb_typeof(extra)='object'),
  primary key(owner_id,session_id,plan_slot_id), unique(owner_id,session_id,position) deferrable initially deferred,
  foreign key(owner_id,session_id) references public.gymbro_sessions(owner_id,session_id) deferrable initially deferred,
  foreign key(owner_id,original_label,exercise_id) references public.gymbro_exercise_aliases(owner_id,label,exercise_id) deferrable initially deferred
);
create table public.gymbro_sets (
  owner_id uuid not null references auth.users(id), set_id text not null check(set_id<>''),
  exercise_id uuid not null, original_label text collate "C" not null,
  workout_date text not null check(public.gymbro_valid_date(workout_date)),
  weight double precision check(weight >= 0 and weight < 'Infinity'::float8),
  unit text not null check(unit in ('lb','lb/side','assist lb','bodyweight')),
  reps double precision check(reps>=1 and reps<'Infinity'::float8 and reps=floor(reps)),
  rpe double precision check(rpe between 1 and 10), rir double precision check(rir between 0 and 10 and rir=floor(rir)),
  pain double precision check(pain between 0 and 10), pain_area text not null, notes text not null, source text not null,
  complete boolean not null, session_id text, plan_slot_id text, session_position bigint,
  position bigint not null check(position>=0), present text[] not null, extra jsonb not null check(jsonb_typeof(extra)='object'),
  primary key(owner_id,set_id), unique(owner_id,position) deferrable initially deferred,
  unique(owner_id,session_id,session_position) deferrable initially deferred,
  check(not complete or (weight is not null and reps is not null)),
  check(weight is null or reps is null or weight*reps < 'Infinity'::float8),
  check((session_id is null and plan_slot_id is null and session_position is null) or (session_id is not null and session_position is not null and session_position>=0)),
  foreign key(owner_id,session_id,workout_date) references public.gymbro_sessions(owner_id,session_id,workout_date) deferrable initially deferred,
  foreign key(owner_id,session_id,plan_slot_id) references public.gymbro_snapshot_slots(owner_id,session_id,plan_slot_id) deferrable initially deferred,
  foreign key(owner_id,original_label,exercise_id) references public.gymbro_exercise_aliases(owner_id,label,exercise_id) deferrable initially deferred
);
create table public.gymbro_bodyweights (
  owner_id uuid not null references auth.users(id), bodyweight_id text not null check(bodyweight_id<>''),
  workout_date text not null check(public.gymbro_valid_date(workout_date)), value double precision not null check(value>0 and value<'Infinity'::float8),
  position bigint not null check(position>=0), present text[] not null, extra jsonb not null check(jsonb_typeof(extra)='object'),
  primary key(owner_id,bodyweight_id), unique(owner_id,position) deferrable initially deferred
);
create table public.gymbro_guidance (
  owner_id uuid not null references auth.users(id), session_id text not null, current_slot_id text not null,
  revision bigint not null check(revision between 0 and 9007199254740991), position bigint not null check(position=0),
  present text[] not null, extra jsonb not null check(jsonb_typeof(extra)='object'),
  primary key(owner_id,session_id),
  foreign key(owner_id,session_id,current_slot_id) references public.gymbro_snapshot_slots(owner_id,session_id,plan_slot_id) deferrable initially deferred
);
create table public.gymbro_guided_slots (
  owner_id uuid not null references auth.users(id), session_id text not null, plan_slot_id text not null,
  exercise_id uuid not null, original_label text collate "C" not null,
  status text not null check(status in ('pending','completed','skipped')),
  position bigint not null check(position>=0), present text[] not null, extra jsonb not null check(jsonb_typeof(extra)='object'),
  primary key(owner_id,session_id,plan_slot_id), unique(owner_id,session_id,position) deferrable initially deferred,
  foreign key(owner_id,session_id) references public.gymbro_guidance(owner_id,session_id) deferrable initially deferred,
  foreign key(owner_id,session_id,plan_slot_id) references public.gymbro_snapshot_slots(owner_id,session_id,plan_slot_id) deferrable initially deferred,
  foreign key(owner_id,original_label,exercise_id) references public.gymbro_exercise_aliases(owner_id,label,exercise_id) deferrable initially deferred
);
create table public.gymbro_guided_requests (
  owner_id uuid not null references auth.users(id), session_id text not null, request_id text not null check(request_id<>''),
  set_id text not null check(set_id<>''), signature text not null check(signature<>''),
  position bigint not null check(position>=0), present text[] not null, extra jsonb not null check(jsonb_typeof(extra)='object'),
  primary key(owner_id,session_id,request_id), unique(owner_id,session_id,set_id), unique(owner_id,session_id,position) deferrable initially deferred,
  foreign key(owner_id,session_id) references public.gymbro_guidance(owner_id,session_id) deferrable initially deferred
);
create table public.gymbro_imports (
  owner_id uuid not null references auth.users(id), import_id text not null check(import_id<>''),
  workout_date text not null check(public.gymbro_valid_date(workout_date)), set_count double precision not null check(set_count>=0 and set_count<'Infinity'::float8 and set_count=floor(set_count)),
  position bigint not null check(position>=0), present text[] not null, extra jsonb not null check(jsonb_typeof(extra)='object'),
  primary key(owner_id,import_id), unique(owner_id,position) deferrable initially deferred
);
create table public.gymbro_session_notes (
  owner_id uuid not null references auth.users(id), session_id text not null, text text not null,
  position bigint not null check(position>=0), present text[] not null, extra jsonb not null check(jsonb_typeof(extra)='object'),
  primary key(owner_id,session_id), unique(owner_id,position) deferrable initially deferred,
  foreign key(owner_id,session_id) references public.gymbro_sessions(owner_id,session_id) deferrable initially deferred
);
create table public.gymbro_exercise_session_notes (
  owner_id uuid not null references auth.users(id), session_id text not null, exercise_id uuid not null,
  original_label text collate "C" not null, plan_slot_id text, text text not null,
  position bigint not null check(position>=0), present text[] not null, extra jsonb not null check(jsonb_typeof(extra)='object'),
  unique nulls not distinct(owner_id,session_id,exercise_id,plan_slot_id), unique(owner_id,position) deferrable initially deferred,
  foreign key(owner_id,session_id) references public.gymbro_sessions(owner_id,session_id) deferrable initially deferred,
  foreign key(owner_id,session_id,plan_slot_id) references public.gymbro_snapshot_slots(owner_id,session_id,plan_slot_id) deferrable initially deferred,
  foreign key(owner_id,original_label,exercise_id) references public.gymbro_exercise_aliases(owner_id,label,exercise_id) deferrable initially deferred
);
create table public.gymbro_exercise_setup_notes (
  owner_id uuid not null references auth.users(id), exercise_id uuid not null, original_label text collate "C" not null, text text not null,
  position bigint not null check(position>=0), present text[] not null, extra jsonb not null check(jsonb_typeof(extra)='object'),
  primary key(owner_id,exercise_id), unique(owner_id,position) deferrable initially deferred,
  foreign key(owner_id,original_label,exercise_id) references public.gymbro_exercise_aliases(owner_id,label,exercise_id) deferrable initially deferred
);

create function public.gymbro_workout_guard() returns trigger language plpgsql set search_path='' as $$
declare n jsonb := to_jsonb(new); o jsonb := to_jsonb(old); key text; parent public.gymbro_sessions;
begin
  if tg_op='UPDATE' then
    foreach key in array tg_argv loop
      if n->key is distinct from o->key then raise exception 'Workout identity or historical intent is immutable' using errcode='23514'; end if;
    end loop;
  end if;
  if tg_table_name='gymbro_sessions' then
    if tg_op='UPDATE' and old.status='completed' and new is distinct from old then
      raise exception 'Completed session lifecycle is immutable' using errcode='23514';
    end if;
  end if;
  if tg_table_name in ('gymbro_snapshot_slots','gymbro_guidance','gymbro_guided_slots','gymbro_guided_requests') then
    select * into parent from public.gymbro_sessions where owner_id=new.owner_id and session_id=new.session_id;
    if exists(select 1 from public.gymbro_sessions s where s.owner_id=new.owner_id and s.session_id=new.session_id and s.xmin<>pg_current_xact_id()::text::xid) then
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
    if (tg_op='INSERT' or old.session_id is distinct from new.session_id) and new.session_id is not null then
      select * into parent from public.gymbro_sessions where owner_id=new.owner_id and session_id=new.session_id;
      -- A new historical bundle may contain completed facts. Existing completed
      -- sessions never acquire new members. #28 owns personal migration.
      if parent.status<>'active' and not exists(select 1 from public.gymbro_sessions s where s.owner_id=new.owner_id and s.session_id=new.session_id and s.xmin=pg_current_xact_id()::text::xid) then
        raise exception 'Cannot add membership to a completed session' using errcode='23514';
      end if;
    end if;
    if tg_op='INSERT' and exists(select 1 from public.gymbro_guided_requests r where r.owner_id=new.owner_id and r.set_id=new.set_id and r.xmin<>pg_current_xact_id()::text::xid) then
      raise exception 'Submitted set identity cannot be reused' using errcode='23514';
    end if;
  end if;
  return new;
end; $$;
create function public.gymbro_workout_integrity() returns trigger language plpgsql set search_path='' as $$
declare who uuid := coalesce(new.owner_id,old.owner_id);
begin
  if exists(select 1 from public.gymbro_snapshot_slots p join public.gymbro_sessions s using(owner_id,session_id)
    where p.owner_id=who and s.snapshot_name is null) then raise exception 'Unplanned session has snapshot slots' using errcode='23514'; end if;
  if exists(select 1 from public.gymbro_guidance g where g.owner_id=who and
    ((select count(*) from public.gymbro_guided_slots x where x.owner_id=who and x.session_id=g.session_id) <>
     (select count(*) from public.gymbro_snapshot_slots x where x.owner_id=who and x.session_id=g.session_id))) or
    exists(select 1 from public.gymbro_guided_slots g join public.gymbro_snapshot_slots p using(owner_id,session_id,plan_slot_id) where g.owner_id=who and g.position<>p.position)
    then raise exception 'Guidance must exactly cover snapshot order' using errcode='23514'; end if;
  if exists(select 1 from public.gymbro_guided_requests r join public.gymbro_sets s using(owner_id,set_id)
    where r.owner_id=who and (s.session_id is distinct from r.session_id or s.plan_slot_id is null)) then
    raise exception 'Guided request references contradictory set membership' using errcode='23514'; end if;
  return null;
end; $$;

-- One definition of table inventory/keys is shared by constrained RPCs.
create function public.gymbro_workout_keys(t text) returns text[] language sql immutable set search_path='' as $$
select case t
when 'workout_state' then array['owner_id'] when 'templates' then array['owner_id','template_id']
when 'template_slots' then array['owner_id','template_id','position'] when 'sessions' then array['owner_id','session_id']
when 'snapshot_slots' then array['owner_id','session_id','plan_slot_id'] when 'sets' then array['owner_id','set_id']
when 'bodyweights' then array['owner_id','bodyweight_id'] when 'guidance' then array['owner_id','session_id']
when 'guided_slots' then array['owner_id','session_id','plan_slot_id'] when 'guided_requests' then array['owner_id','session_id','request_id']
when 'imports' then array['owner_id','import_id'] when 'session_notes' then array['owner_id','session_id']
when 'exercise_session_notes' then array['owner_id','session_id','exercise_id','plan_slot_id']
when 'exercise_setup_notes' then array['owner_id','exercise_id'] when 'exercises' then array['owner_id','exercise_id']
when 'aliases' then array['owner_id','label'] end
$$;
create function public.gymbro_workout_tables() returns text[] language sql immutable set search_path='' as $$
select array['workout_state','templates','template_slots','sessions','snapshot_slots','sets','bodyweights','guidance','guided_slots',
 'guided_requests','imports','session_notes','exercise_session_notes','exercise_setup_notes','exercises','aliases']
$$;
create function public.gymbro_workout_table(t text) returns text language sql immutable set search_path='' as $$
select case when t='aliases' then 'gymbro_exercise_aliases' when t=any(public.gymbro_workout_tables()) then 'gymbro_'||t end
$$;
do $$
declare t text; tbl text; keys text[];
begin
  foreach t in array public.gymbro_workout_tables() loop
    if t in ('exercises','aliases') then continue; end if;
    tbl := public.gymbro_workout_table(t); keys := public.gymbro_workout_keys(t);
    execute format('alter table public.%I enable row level security',tbl);
    if t<>'workout_state' then execute format('alter table public.%I add foreign key(owner_id) references public.gymbro_workout_state(owner_id) deferrable initially deferred',tbl); end if;
    execute format('revoke all on public.%I from public,anon,authenticated',tbl);
    execute format('grant select,insert,update on public.%I to authenticated',tbl);
    if t in ('sets','template_slots') then execute format('grant delete on public.%I to authenticated',tbl); end if;
    execute format('create policy permanent on public.%I as restrictive for all to authenticated using ((select auth.jwt()->>''is_anonymous'')=''false'') with check ((select auth.jwt()->>''is_anonymous'')=''false'')',tbl);
    execute format('create policy owner on public.%I for all to authenticated using ((select auth.uid())=owner_id) with check ((select auth.uid())=owner_id)',tbl);
    execute format('create trigger identity_guard before insert or update on public.%I for each row execute function public.gymbro_workout_guard(%s)',tbl,
      (select string_agg(quote_literal(k),',') from unnest(keys) k));
    execute format('create constraint trigger workout_integrity after insert or update or delete on public.%I deferrable initially deferred for each row execute function public.gymbro_workout_integrity()',tbl);
  end loop;
end; $$;
-- Snapshot facts and original request payloads have append-only grants.
revoke update on public.gymbro_snapshot_slots,public.gymbro_guided_requests from authenticated;
create trigger session_intent_guard before update on public.gymbro_sessions for each row execute function public.gymbro_workout_guard('workout_date','created_at','template_origin_id','duration','snapshot_name','snapshot_extra');

create function public.gymbro_workout_normalize(rows jsonb) returns jsonb language sql immutable set search_path='' as $$
select jsonb_object_agg(key,coalesce((select jsonb_agg(x order by x::text) from jsonb_array_elements(value) x),'[]'::jsonb)) from jsonb_each(rows)
$$;
create function public.gymbro_workout_read() returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare t text; data jsonb; result jsonb := '{}'; who uuid := auth.uid();
begin
  if who is null or (auth.jwt()->>'is_anonymous') is distinct from 'false' then raise exception 'Permanent authenticated owner required' using errcode='42501'; end if;
  foreach t in array public.gymbro_workout_tables() loop
    execute format('select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),''[]''::jsonb) from public.%I r where owner_id=$1',public.gymbro_workout_table(t)) into data using who;
    result := result||jsonb_build_object(t,data);
  end loop;
  return result;
end; $$;
create function public.gymbro_workout_commit(previous_rows jsonb,next_rows jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare current_rows jsonb; t text; tbl text; item jsonb; prior jsonb; keys text[]; key_match text; columns text; updates text; who uuid := auth.uid();
begin
  if who is null or (auth.jwt()->>'is_anonymous') is distinct from 'false' then raise exception 'Permanent authenticated owner required' using errcode='42501'; end if;
  -- Foundation equality precondition only; no automatic retry/rebase or #40
  -- revision protocol. Serialize even the first synthetic initialization.
  perform pg_advisory_xact_lock(hashtextextended(who::text,39));
  current_rows := public.gymbro_workout_read();
  if previous_rows is null then
    if jsonb_array_length(current_rows->'workout_state')<>0 then raise exception 'Account already initialized' using errcode='40001'; end if;
    previous_rows := current_rows;
  elsif public.gymbro_workout_normalize(current_rows) is distinct from public.gymbro_workout_normalize(previous_rows) then
    raise exception 'Saved workout differs from prepared base' using errcode='40001';
  end if;
  if (select array_agg(key order by key) from jsonb_object_keys(next_rows) key) is distinct from
    (select array_agg(q.name order by q.name) from unnest(public.gymbro_workout_tables()) q(name)) or jsonb_array_length(next_rows->'workout_state')<>1 then
    raise exception 'Incomplete workout bundle' using errcode='23514'; end if;
  foreach t in array public.gymbro_workout_tables() loop
    if jsonb_typeof(next_rows->t)<>'array' or exists(select 1 from jsonb_array_elements(next_rows->t) r where (r->>'owner_id') is distinct from who::text) then
      raise exception 'Wrong owner or malformed row bundle' using errcode='42501'; end if;
  end loop;
  -- Remove only explicitly removed facts for supported deletion operations.
  foreach t in array array['sets','template_slots'] loop
    tbl:=public.gymbro_workout_table(t); keys:=public.gymbro_workout_keys(t);
    select string_agg(format('r.%I is not distinct from ($1->>%L)::%s',k,k,
      case when k='owner_id' then 'uuid' when k='position' then 'bigint' else 'text' end),' and ') into key_match from unnest(keys) k;
    for item in select value from jsonb_array_elements(previous_rows->t) loop
      if not exists(select 1 from jsonb_array_elements(next_rows->t) n where (select bool_and(n->key is not distinct from item->key) from unnest(keys) key)) then
        execute format('delete from public.%I r where %s',tbl,key_match) using item;
      end if;
    end loop;
  end loop;
  foreach t in array public.gymbro_workout_tables() loop
    tbl:=public.gymbro_workout_table(t); keys:=public.gymbro_workout_keys(t);
    select string_agg(quote_ident(a.attname),',' order by a.attnum),
      string_agg(format('%I=excluded.%I',a.attname,a.attname),',' order by a.attnum) filter(where not a.attname=any(keys))
      into columns,updates from pg_attribute a where a.attrelid=format('public.%I',tbl)::regclass and a.attnum>0 and not a.attisdropped;
    for item in select value from jsonb_array_elements(next_rows->t) loop
      select value into prior from jsonb_array_elements(previous_rows->t) n where
        (select bool_and(n.value->key is not distinct from item->key) from unnest(keys) key);
      if prior is not distinct from item then continue; end if;
      if t in ('snapshot_slots','guided_requests','aliases') and prior is not null then raise exception 'Append-only fact changed' using errcode='23514'; end if;
      if t='snapshot_slots' and exists(select 1 from jsonb_array_elements(previous_rows->'sessions') s where s->>'session_id'=item->>'session_id') then
        raise exception 'Existing session snapshot cannot be extended' using errcode='23514';
      end if;
      execute format('insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I,$1) on conflict (%s) %s',
        tbl,columns,columns,tbl,(select string_agg(quote_ident(key),',') from unnest(keys) key),
        case when updates is null or t in ('snapshot_slots','guided_requests','aliases') then 'do nothing' else 'do update set '||updates end) using item;
    end loop;
  end loop;
  set constraints all immediate;
  current_rows:=public.gymbro_workout_read();
  if public.gymbro_workout_normalize(current_rows) is distinct from public.gymbro_workout_normalize(next_rows) then
    raise exception 'Incomplete or contradictory commit acknowledgement' using errcode='23514'; end if;
  return current_rows;
end; $$;
revoke all on function public.gymbro_workout_read(),public.gymbro_workout_commit(jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.gymbro_workout_read(),public.gymbro_workout_commit(jsonb,jsonb) to authenticated;
revoke all on function public.gymbro_workout_guard(),public.gymbro_workout_integrity() from public,anon,authenticated;
-- Invoker RPC helpers contain no data and do not elevate privileges.
revoke all on function public.gymbro_valid_date(text),public.gymbro_workout_keys(text),public.gymbro_workout_tables(),public.gymbro_workout_table(text),public.gymbro_workout_normalize(jsonb) from public,anon;
grant execute on function public.gymbro_valid_date(text),public.gymbro_workout_keys(text),public.gymbro_workout_tables(),public.gymbro_workout_table(text),public.gymbro_workout_normalize(jsonb) to authenticated;
commit;
