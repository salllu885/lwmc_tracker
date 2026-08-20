-- 0005_hierarchy_v2: District/Town hierarchy, live location tracking, and
-- attendance/distance derived from activity.
--
-- The 6-tier role model itself (ADMIN/AREA_MANAGER/ZO/SUPERVISOR/SURVEYOR/
-- RECTIFIER), profiles.designation, and the manage-vs-view RLS split for
-- reports/resolutions now live directly in 0001-0003 — nothing had been
-- deployed yet when this was designed, so those went straight into the
-- base schema instead of an add-then-migrate dance (which also hits a real
-- Postgres restriction: a brand-new enum value can't be used in the same
-- transaction that added it, and the SQL editor runs a whole pasted script
-- as one transaction). This file covers what's genuinely NEW on top of
-- that: districts, live tracking, and the two attendance/distance views —
-- plus the two RLS policies (profiles, user_assignments) whose full
-- manage-scope logic depends on helper functions defined further down in
-- this same file.

-- ── Districts, Tehsil/Town unification ──────────────────────────────────
-- "Tehsil" and "Town" are the same tier of the hierarchy under two
-- different local-government naming conventions — one table, tagged by
-- area_type, rather than two parallel tables.

create table if not exists public.districts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

do $$ begin
  create type tehsil_area_type as enum ('TEHSIL', 'TOWN');
exception when duplicate_object then null;
end $$;

alter table public.tehsils add column if not exists district_id uuid references public.districts(id);
alter table public.tehsils add column if not exists area_type tehsil_area_type not null default 'TEHSIL';
create index if not exists tehsils_district_id_idx on public.tehsils(district_id);

grant select, insert, update, delete on public.districts to authenticated;
alter table public.districts enable row level security;

drop policy if exists districts_select on public.districts;
create policy districts_select on public.districts for select to authenticated using (true);
drop policy if exists districts_write on public.districts;
create policy districts_write on public.districts for all to authenticated
  using (private.current_role() = 'ADMIN') with check (private.current_role() = 'ADMIN');

-- ── Scope-resolution helpers ─────────────────────────────────────────────
-- An assignment row only ever carries the MOST SPECIFIC level directly (a
-- UC-level row has uc_id set, not zone_id/tehsil_id) — these walk it up to
-- its owning Zone/Tehsil so manage-scope checks work regardless of which
-- level the caller or the target sits at.

create or replace function private.resolve_zone_id(p_uc_id uuid, p_zone_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select coalesce(p_zone_id, (select zone_id from public.ucs where id = p_uc_id));
$$;

create or replace function private.resolve_tehsil_id(p_uc_id uuid, p_zone_id uuid, p_tehsil_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select coalesce(
    p_tehsil_id,
    (select tehsil_id from public.zones where id = p_zone_id),
    (select tehsil_id from public.ucs where id = p_uc_id)
  );
$$;

grant execute on function private.resolve_zone_id(uuid, uuid) to authenticated;
grant execute on function private.resolve_tehsil_id(uuid, uuid, uuid) to authenticated;

-- Can the caller manage (add/remove/activate) this target user? Admin
-- anywhere, Area Manager within their own Tehsil/Town, ZO within their own
-- Zone, everyone else never — this is where "Supervisor can't add/remove,
-- it's up to ZO" actually gets enforced.
create or replace function private.user_in_manage_scope(p_user_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select
    private.current_role() = 'ADMIN'
    or (
      private.current_role() = 'AREA_MANAGER'
      and exists (
        select 1 from public.user_assignments ua
        where ua.user_id = p_user_id and ua.is_active = true
          and private.resolve_tehsil_id(ua.uc_id, ua.zone_id, ua.tehsil_id) in (select private.assigned_tehsil_ids())
      )
    )
    or (
      private.current_role() = 'ZO'
      and exists (
        select 1 from public.user_assignments ua
        where ua.user_id = p_user_id and ua.is_active = true
          and private.resolve_zone_id(ua.uc_id, ua.zone_id) in (select private.assigned_zone_ids())
      )
    );
$$;

grant execute on function private.user_in_manage_scope(uuid) to authenticated;

-- ── profiles / user_assignments: manage-scope-aware policies ───────────
-- These supersede the ADMIN-only versions from 0002_rls.sql now that the
-- helper functions above exist.

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated using (
  id = auth.uid()
  or private.current_role() in ('ADMIN', 'AREA_MANAGER')
  or private.user_in_manage_scope(id)
  or exists (
    select 1 from public.user_assignments ua
    where ua.user_id = profiles.id and ua.is_active = true
      and (
        (private.current_role() = 'ZO' and private.resolve_zone_id(ua.uc_id, ua.zone_id) in (select private.assigned_zone_ids()))
        or (private.current_role() in ('SUPERVISOR', 'SURVEYOR', 'RECTIFIER') and ua.uc_id in (select private.assigned_uc_ids()))
      )
  )
  or exists (
    select 1 from public.reports r
    where (r.reported_by = profiles.id or r.assigned_supervisor_id = profiles.id or r.assigned_zo_id = profiles.id)
      and private.can_view_report(r.id)
  )
);

drop policy if exists profiles_write_admin on public.profiles;
drop policy if exists profiles_manage on public.profiles;
create policy profiles_manage on public.profiles for all to authenticated
  using (private.user_in_manage_scope(id)) with check (private.user_in_manage_scope(id));
-- profiles_update_self (from 0002_rls.sql) is untouched: everyone can still
-- edit their own row, with role/username/is_active locked down by the
-- profiles_protect_privileged_fields trigger regardless of which policy
-- let the UPDATE through.

drop policy if exists user_assignments_select on public.user_assignments;
create policy user_assignments_select on public.user_assignments for select to authenticated using (
  user_id = auth.uid()
  or private.current_role() in ('ADMIN', 'AREA_MANAGER')
  or (private.current_role() = 'ZO' and private.resolve_zone_id(uc_id, zone_id) in (select private.assigned_zone_ids()))
  or (private.current_role() in ('SUPERVISOR', 'SURVEYOR', 'RECTIFIER') and uc_id in (select private.assigned_uc_ids()))
);

drop policy if exists user_assignments_write_admin on public.user_assignments;
drop policy if exists user_assignments_manage on public.user_assignments;
create policy user_assignments_manage on public.user_assignments for all to authenticated
  using (
    private.current_role() = 'ADMIN'
    or (private.current_role() = 'AREA_MANAGER' and private.resolve_tehsil_id(uc_id, zone_id, tehsil_id) in (select private.assigned_tehsil_ids()))
    or (private.current_role() = 'ZO' and private.resolve_zone_id(uc_id, zone_id) in (select private.assigned_zone_ids()))
  )
  with check (
    private.current_role() = 'ADMIN'
    or (private.current_role() = 'AREA_MANAGER' and private.resolve_tehsil_id(uc_id, zone_id, tehsil_id) in (select private.assigned_tehsil_ids()))
    or (private.current_role() = 'ZO' and private.resolve_zone_id(uc_id, zone_id) in (select private.assigned_zone_ids()))
  );
-- Supervisor/Surveyor/Rectifier get no write policy here at all — by
-- design, per "supervisor can't add/remove, it's up to ZO".

-- ── Live location tracking ───────────────────────────────────────────────
-- Immutable pings, like report_images/audit_logs — no update/delete policy.

create table if not exists public.location_pings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  latitude double precision not null,
  longitude double precision not null,
  accuracy double precision,
  recorded_at timestamptz not null default now()
);
create index if not exists location_pings_user_recorded_idx on public.location_pings(user_id, recorded_at desc);

grant select, insert on public.location_pings to authenticated;
alter table public.location_pings enable row level security;

drop policy if exists location_pings_insert_self on public.location_pings;
create policy location_pings_insert_self on public.location_pings for insert to authenticated with check (user_id = auth.uid());

drop policy if exists location_pings_select on public.location_pings;
create policy location_pings_select on public.location_pings for select to authenticated using (
  user_id = auth.uid()
  or private.current_role() in ('ADMIN', 'AREA_MANAGER')
  or (
    private.current_role() = 'ZO'
    and exists (
      select 1 from public.user_assignments ua
      where ua.user_id = location_pings.user_id and ua.is_active = true
        and private.resolve_zone_id(ua.uc_id, ua.zone_id) in (select private.assigned_zone_ids())
    )
  )
);

-- ── Attendance, derived from activity — no table to keep in sync, just a
-- view over reports/resolutions. Present means MORE THAN 5 reports filed
-- + resolutions closed that day, combined — logging in alone doesn't
-- count. security_invoker is required here: without it the view would
-- run as its owner and silently bypass the RLS on reports/resolutions.
--
-- The per-source subqueries group by (user_id, date) and count(*) BEFORE
-- the union — grouping only after a plain `union` (distinct) would have
-- collapsed every same-day report from one user down to a single row,
-- making an accurate count impossible.

create or replace view public.attendance_daily
with (security_invoker = true) as
select user_id, activity_date, sum(cnt) as activity_count, (sum(cnt) > 5) as present
from (
  select reported_by as user_id, (created_at at time zone 'Asia/Karachi')::date as activity_date, count(*) as cnt
  from public.reports
  group by reported_by, (created_at at time zone 'Asia/Karachi')::date
  union all
  select resolved_by as user_id, (resolved_at at time zone 'Asia/Karachi')::date as activity_date, count(*) as cnt
  from public.resolutions
  group by resolved_by, (resolved_at at time zone 'Asia/Karachi')::date
) activity
group by user_id, activity_date;

grant select on public.attendance_daily to authenticated;

-- ── Distance covered per day, from consecutive location pings (haversine
-- great-circle distance — no PostGIS dependency needed for this) ────────

create or replace view public.daily_distance_km
with (security_invoker = true) as
with pings as (
  select
    user_id,
    (recorded_at at time zone 'Asia/Karachi')::date as activity_date,
    latitude,
    longitude,
    lag(latitude) over w as prev_lat,
    lag(longitude) over w as prev_lng
  from public.location_pings
  window w as (partition by user_id, (recorded_at at time zone 'Asia/Karachi')::date order by recorded_at)
)
select
  user_id,
  activity_date,
  round(sum(
    case when prev_lat is null then 0 else
      6371 * acos(least(1.0, greatest(-1.0,
        sin(radians(latitude)) * sin(radians(prev_lat))
        + cos(radians(latitude)) * cos(radians(prev_lat)) * cos(radians(longitude - prev_lng))
      )))
    end
  )::numeric, 2) as distance_km
from pings
group by user_id, activity_date;

grant select on public.daily_distance_km to authenticated;

-- ── Realign seed issue types with the four categories actually in scope
-- (Garbage Heap / Garbage in Open Plot / Manhole-Slab Missing / Sewer
-- Issue) — retire the leftovers instead of deleting them, since reports
-- may end up referencing them once real data exists ────────────────────

update public.issue_types set name = 'Garbage Heap', description = 'Accumulated solid waste in a public area', color = '#B45309'
  where id = '00000000-0000-0000-0000-000000000301';
update public.issue_types set name = 'Manhole / Slab Missing', description = 'Missing or damaged manhole cover or drain slab', color = '#6D28D9'
  where id = '00000000-0000-0000-0000-000000000302';
update public.issue_types set is_active = false where id = '00000000-0000-0000-0000-000000000303';
update public.issue_types set name = 'Sewer Issue', description = 'Blocked, overflowing, or damaged sewer line', color = '#0369A1'
  where id = '00000000-0000-0000-0000-000000000304';
update public.issue_types set is_active = false where id = '00000000-0000-0000-0000-000000000305';

insert into public.issue_types (id, name, description, color, is_active) values
  ('00000000-0000-0000-0000-000000000306', 'Garbage in Open Plot', 'Illegal dumping on a vacant or open plot', '#BE123C', true)
on conflict (id) do nothing;

insert into public.districts (id, name, code, is_active) values
  ('00000000-0000-0000-0000-000000000001', 'Test District', 'TESTD', true)
on conflict (id) do nothing;

-- Not linking Test Tehsil to Test District here — that row doesn't exist
-- yet at this point in the combined setup_all.sql (0005 runs before
-- seed.sql, which is what actually creates it), so the link is done in
-- seed.sql instead, right after the tehsil insert.
