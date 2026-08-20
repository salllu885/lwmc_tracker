-- Point H, revised per user direction: designation stays free text (a
-- cosmetic job title), but WHICH roles an AREA_MANAGER/ZO-tier user can
-- create is no longer hardcoded per role tier — it's driven by a separate,
-- admin-editable "authority level". Admin can add/remove authority levels
-- and change their creatable_roles set at any time (Admin -> Authority
-- Levels), instead of the exact GM LWMC/Town Manager/AC permission matrix
-- being nailed down in code.
create table if not exists public.authority_levels (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  role_tier app_role not null,
  creatable_roles app_role[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.authority_levels enable row level security;
grant select on public.authority_levels to authenticated;
grant insert, update, delete on public.authority_levels to authenticated;

drop policy if exists authority_levels_select on public.authority_levels;
create policy authority_levels_select on public.authority_levels for select to authenticated using (true);

drop policy if exists authority_levels_manage on public.authority_levels;
create policy authority_levels_manage on public.authority_levels for all to authenticated
  using (private.current_role() = 'ADMIN')
  with check (private.current_role() = 'ADMIN');

alter table public.profiles add column if not exists authority_id uuid references public.authority_levels(id);

-- Seeded to match what was previously hardcoded in the admin-create-user
-- Edge Function, so behavior doesn't regress on day one — admin can freely
-- edit/add/deactivate these afterward from the new Admin screen.
insert into public.authority_levels (name, role_tier, creatable_roles) values
  ('GM LWMC', 'AREA_MANAGER', array['ZO','SUPERVISOR','SURVEYOR','RECTIFIER']::app_role[]),
  ('Town Manager', 'AREA_MANAGER', array['SUPERVISOR','SURVEYOR','RECTIFIER']::app_role[]),
  ('AC', 'AREA_MANAGER', array['ZO','SUPERVISOR','SURVEYOR','RECTIFIER']::app_role[]),
  ('Zone Officer', 'ZO', array['SUPERVISOR','SURVEYOR','RECTIFIER']::app_role[])
on conflict (name) do nothing;

-- authority_id is a permission grant (it decides what its holder can in
-- turn create) — same sensitivity as role/username, Admin-only to change.
create or replace function public.profiles_protect_privileged_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.role is distinct from old.role or new.username is distinct from old.username or new.authority_id is distinct from old.authority_id)
     and private.current_role() <> 'ADMIN' then
    raise exception 'Only an admin can change role, username, or authority level.';
  end if;
  if new.is_active is distinct from old.is_active and not private.user_in_manage_scope(old.id) then
    raise exception 'You do not have permission to activate or deactivate this user.';
  end if;
  return new;
end;
$$;
