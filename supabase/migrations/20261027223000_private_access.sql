-- #27: minimal disposable ownership evidence, not a workout schema.
begin;
create table public.gymbro_private_access (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  value text not null check (char_length(btrim(value)) between 1 and 120)
);
alter table public.gymbro_private_access enable row level security;
revoke all on public.gymbro_private_access from public, anon, authenticated;
grant select, insert, update, delete on public.gymbro_private_access to authenticated;
create policy private_access_permanent on public.gymbro_private_access
  as restrictive for all to authenticated
  using ((select auth.jwt()->>'is_anonymous') = 'false')
  with check ((select auth.jwt()->>'is_anonymous') = 'false');
create policy private_access_owner on public.gymbro_private_access
  for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
comment on table public.gymbro_private_access is 'Disposable access-check marker only. #39 must apply the documented owner contract to workout tables.';
commit;
