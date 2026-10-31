-- #28: first-time initialization is distinct from #41 emergency recovery.
begin;
create or replace function public.gymbro_operation_valid(operation jsonb) returns boolean
language sql immutable set search_path='' as $$
select public.gymbro_domain_operation_valid(operation) or
  case when jsonb_typeof(operation)='array' then jsonb_array_length(operation)=2 and
    operation->>0 in ('restoreCompleteBackup','mergeHistoryBackup','initializeMigration') and
    not exists(select 1 from jsonb_array_elements(operation) v where jsonb_typeof(v)<>'string' or length(v#>>'{}')=0)
  else false end
$$;

create function public.gymbro_migration_initialize(packet jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare who uuid:=public.gymbro_request_owner(); snapshot jsonb; receipt public.gymbro_mutation_receipts;
  fingerprint text; op jsonb:=packet->'operation'; answer jsonb; saved jsonb; current_revision numeric;
begin
  if who is null or public.gymbro_request_permanent() is not true then
    raise exception 'Permanent authenticated owner required' using errcode='42501'; end if;
  if packet->'protocolVersion' is distinct from '1'::jsonb or packet->>'ownerId' is distinct from who::text or
    not coalesce(public.gymbro_operation_valid(op),false) or op->>0<>'initializeMigration' or
    packet->>'action' is distinct from 'initializeMigration' or jsonb_typeof(packet->'expectedRevision') is distinct from 'string' or
    packet->>'expectedRevision' !~ '^(0|[1-9][0-9]*)$' or jsonb_typeof(packet->'result') is distinct from 'object' then
    raise exception 'Invalid migration packet' using errcode='23514'; end if;
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
  snapshot:=public.gymbro_lifecycle_snapshot();current_revision:=(snapshot->>'revision')::numeric;
  if packet->'expectedRevision' is distinct from snapshot->'revision' or packet->'fingerprint' is distinct from snapshot->'fingerprint' or
    packet->'status' is distinct from snapshot->'status' or
    public.gymbro_workout_normalize(packet->'base') is distinct from public.gymbro_workout_normalize(snapshot->'rows') then
    return jsonb_build_object('code','CONFLICT','operation',op,'snapshot',snapshot); end if;
  -- Check every aggregate/catalog row under the same owner lock. No deletion.
  if snapshot->>'status'<>'uninitialized' or exists(select 1 from jsonb_each(snapshot->'rows') x where jsonb_array_length(value)<>0) then
    raise exception 'Migration destination must be empty' using errcode='23514'; end if;
  saved:=public.gymbro_workout_commit(null,packet->'next');
  if public.gymbro_lifecycle_readable(saved) is not true then raise exception 'Unreconstructable migration' using errcode='23514'; end if;
  insert into public.gymbro_workout_versions(owner_id,revision) values(who,current_revision+1)
    on conflict(owner_id) do update set revision=excluded.revision;
  insert into public.gymbro_mutation_receipts(owner_id,operation,protocol_version,status,fingerprint,committed_revision,result)
    values(who,op,1,'committed',fingerprint,current_revision+1,packet->'result');
  return jsonb_build_object('code','OK','operation',op,'operationRevision',(current_revision+1)::text,'result',packet->'result','snapshot',public.gymbro_lifecycle_snapshot());
end $$;
revoke all on function public.gymbro_migration_initialize(jsonb) from public,anon,authenticated;
grant execute on function public.gymbro_migration_initialize(jsonb) to authenticated;
grant create on schema public to gymbro_lifecycle_writer;
alter function public.gymbro_migration_initialize(jsonb) owner to gymbro_lifecycle_writer;
revoke create on schema public from gymbro_lifecycle_writer;
commit;
