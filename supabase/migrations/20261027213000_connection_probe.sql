-- Versioned baseline of the existing optional diagnostic. No workout schema/data.
begin;
create table if not exists public.gymbro_connection_probe (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  value text not null check (char_length(btrim(value)) between 1 and 120)
);
alter table public.gymbro_connection_probe enable row level security;
revoke all on table public.gymbro_connection_probe from public, anon, authenticated;
grant select, insert, update on table public.gymbro_connection_probe to authenticated;

drop policy if exists gymbro_probe_select on public.gymbro_connection_probe;
create policy gymbro_probe_select on public.gymbro_connection_probe
  for select to authenticated using ((select auth.uid()) = owner_id);
drop policy if exists gymbro_probe_insert on public.gymbro_connection_probe;
create policy gymbro_probe_insert on public.gymbro_connection_probe
  for insert to authenticated with check ((select auth.uid()) = owner_id);
drop policy if exists gymbro_probe_update on public.gymbro_connection_probe;
create policy gymbro_probe_update on public.gymbro_connection_probe
  for update to authenticated using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
comment on table public.gymbro_connection_probe is 'Optional GymBro connection diagnostic. No workout data.';
commit;
