-- #17 forward repair: disambiguate the catalog edit field allowlist.
-- Preserves all grants, identity/data rules, receipts and the applied migration.
begin;
create or replace function public.gymbro_catalog_candidate(rows jsonb, action text, input jsonb, who uuid, operation jsonb, stamp text)
returns jsonb language plpgsql set search_path='' as $$
declare result jsonb:=rows; src jsonb; dst jsonb; changed jsonb; aliases jsonb; affected jsonb:='{}';
  t text; k text; col text; keys text[]; inventory jsonb; audit jsonb; name text;
begin
  select e into src from jsonb_array_elements(rows->'exercises') e where e->>'exercise_id'=input->>'exerciseId';
  if src is null or src#>>'{metadata,gymbroMerge,kind}'='gymbro-catalog-merge-v2' then raise exception 'Select an unmerged source' using errcode='23514'; end if;
  result:=jsonb_set(result,'{workout_state,0,document_extra,identityVersion}','2'); changed:=src;
  if action='editCatalogExercise' then
    if exists(select 1 from jsonb_object_keys(input) as fields(field_name) where fields.field_name<>all(array['exerciseId','displayName','primary','secondary','pattern','equipment','type','state'])) then raise exception 'Unexpected catalog field' using errcode='23514'; end if;
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
    if src->'metadata' ? 'gymbroMerge' then raise exception 'Preserved merge namespace occupied' using errcode='23514'; end if;
    select e into dst from jsonb_array_elements(rows->'exercises') e where e->>'exercise_id'=input->>'targetId';
    if dst is null or dst->'exercise_id'=src->'exercise_id' or dst#>>'{metadata,gymbroMerge,kind}'='gymbro-catalog-merge-v2' then raise exception 'Invalid destination' using errcode='23514'; end if;
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
    audit:=jsonb_build_object('kind','gymbro-catalog-merge-v2','sourceId',src->'exercise_id','targetId',dst->'exercise_id','sourceName',src->'display_name','targetName',dst->'display_name',
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
commit;
