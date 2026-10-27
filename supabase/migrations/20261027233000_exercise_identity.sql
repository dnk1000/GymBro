-- #16 identity foundation only. #39 owns template/session/set tables and their
-- composite (owner_id, exercise_id) references. No workout data is loaded here.
begin;
create table public.gymbro_exercises (
  owner_id uuid not null references auth.users(id),
  exercise_id uuid not null,
  display_name text collate "C" not null check (length(btrim(display_name)) > 0),
  primary_muscle text not null default '',
  secondary_muscles text[] not null default '{}' check (array_position(secondary_muscles, null) is null),
  movement_pattern text not null default '',
  equipment text not null default '',
  exercise_type text not null default '',
  state text not null default 'active' check (state in ('active', 'archived')),
  provenance text not null check (provenance in ('built-in', 'user-created', 'import-created', 'legacy')),
  metadata jsonb not null default '{}' check (jsonb_typeof(metadata) = 'object'),
  primary key (owner_id, exercise_id)
);
create table public.gymbro_exercise_aliases (
  owner_id uuid not null,
  label text collate "C" not null check (length(btrim(label)) > 0),
  exercise_id uuid not null,
  provenance text not null check (provenance in ('built-in', 'user-created', 'import-created', 'legacy')),
  primary key (owner_id, label),
  foreign key (owner_id, exercise_id) references public.gymbro_exercises(owner_id, exercise_id)
);
create index gymbro_exercise_aliases_identity on public.gymbro_exercise_aliases(owner_id, exercise_id);

create function public.gymbro_guard_exercise_identity() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.owner_id is distinct from old.owner_id or new.exercise_id is distinct from old.exercise_id then
    raise exception 'Exercise identity and owner are immutable' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger gymbro_exercise_identity_immutable before update on public.gymbro_exercises
  for each row execute function public.gymbro_guard_exercise_identity();

-- Display labels participate in the same exact-label namespace as aliases.
-- Keep old names as aliases. Collision aborts the entire rename/insert.
create function public.gymbro_register_exercise_name() returns trigger
language plpgsql set search_path = '' as $$
begin
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
create trigger gymbro_exercise_name_alias after insert or update of display_name on public.gymbro_exercises
  for each row execute function public.gymbro_register_exercise_name();
revoke all on function public.gymbro_guard_exercise_identity() from public, anon, authenticated;
revoke all on function public.gymbro_register_exercise_name() from public, anon, authenticated;

alter table public.gymbro_exercises enable row level security;
alter table public.gymbro_exercise_aliases enable row level security;
revoke all on public.gymbro_exercises, public.gymbro_exercise_aliases from public, anon, authenticated;
-- Historical identities/aliases are retained. Catalog deletion/reassignment and
-- account lifecycle semantics need #17/#41; archiving preserves references.
grant select, insert, update on public.gymbro_exercises to authenticated;
grant select, insert on public.gymbro_exercise_aliases to authenticated;
create policy exercises_permanent on public.gymbro_exercises
  as restrictive for all to authenticated
  using ((select auth.jwt()->>'is_anonymous') = 'false')
  with check ((select auth.jwt()->>'is_anonymous') = 'false');
create policy exercises_owner on public.gymbro_exercises for all to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy exercise_aliases_permanent on public.gymbro_exercise_aliases
  as restrictive for all to authenticated
  using ((select auth.jwt()->>'is_anonymous') = 'false')
  with check ((select auth.jwt()->>'is_anonymous') = 'false');
create policy exercise_aliases_owner on public.gymbro_exercise_aliases for all to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
comment on table public.gymbro_exercises is 'Canonical immutable per-owner exercise identity. Contextual role/order/duration belong to #39 relationships. Metadata preserves legacy input without interpreting it.';
comment on table public.gymbro_exercise_aliases is 'Exact labels, including current and former display names. No fuzzy/semantic matching; no cross-owner references or silent reassignment.';
commit;
