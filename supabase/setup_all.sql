-- Combined setup script: run this once in the Supabase SQL Editor.
-- (Same as running 0001, 0002, 0003, 0004, then seed.sql in order.)

-- Field Issue Reporting & Rectification Management System
-- 0001_init: core schema (enums, tables, indexes)

create extension if not exists pgcrypto;

-- ── Enums ────────────────────────────────────────────────────────────────

create type app_role as enum (
  'ADMIN', 'SURVEYER', 'SUPERVISOR', 'ZO', 'MANAGER', 'GM', 'AC'
);

create type report_status as enum (
  'SUBMITTED', 'PENDING', 'IN_PROGRESS', 'CLOSED', 'REOPENED'
);

create type report_image_type as enum ('BEFORE', 'RESOLUTION');

-- ── Organisational hierarchy ────────────────────────────────────────────

create table public.tehsils (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.zones (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tehsil_id uuid not null references public.tehsils(id) on delete restrict,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index zones_tehsil_id_idx on public.zones(tehsil_id);

create table public.ucs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text,
  zone_id uuid not null references public.zones(id) on delete restrict,
  tehsil_id uuid not null references public.tehsils(id) on delete restrict,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index ucs_zone_id_idx on public.ucs(zone_id);
create index ucs_tehsil_id_idx on public.ucs(tehsil_id);

-- ── Issue taxonomy ───────────────────────────────────────────────────────

create table public.issue_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  color text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ── Users ────────────────────────────────────────────────────────────────
-- 1:1 with auth.users. Created via the admin-create-user Edge Function
-- (or, for the very first Admin, directly in the Supabase dashboard).

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  username text not null unique,
  phone text,
  role app_role not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A user's assignment to a level of the hierarchy. Historical rows are kept
-- (end_date/is_active) so past reports keep their original assignment
-- snapshot even after someone's coverage area changes.
create table public.user_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  tehsil_id uuid references public.tehsils(id) on delete cascade,
  zone_id uuid references public.zones(id) on delete cascade,
  uc_id uuid references public.ucs(id) on delete cascade,
  start_date date not null default current_date,
  end_date date,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index user_assignments_user_id_idx on public.user_assignments(user_id);
create index user_assignments_uc_id_idx on public.user_assignments(uc_id) where uc_id is not null;
create index user_assignments_zone_id_idx on public.user_assignments(zone_id) where zone_id is not null;
create index user_assignments_tehsil_id_idx on public.user_assignments(tehsil_id) where tehsil_id is not null;

-- ── Reports ──────────────────────────────────────────────────────────────

create sequence public.report_number_seq;

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  report_number text unique,
  -- zone_id/tehsil_id are derived server-side from uc_id by a trigger
  -- (0003_triggers.sql) — never trust a client-supplied value here.
  tehsil_id uuid references public.tehsils(id),
  zone_id uuid references public.zones(id),
  uc_id uuid not null references public.ucs(id),
  issue_type_id uuid not null references public.issue_types(id),
  reported_by uuid not null references public.profiles(id),
  address text,
  description text,
  latitude double precision,
  longitude double precision,
  location_accuracy double precision,
  status report_status not null default 'PENDING',
  -- Stamped server-side at creation time from the active user_assignments
  -- for this uc/zone. Intentionally a point-in-time snapshot.
  assigned_supervisor_id uuid references public.profiles(id),
  assigned_zo_id uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index reports_uc_id_idx on public.reports(uc_id);
create index reports_zone_id_idx on public.reports(zone_id);
create index reports_tehsil_id_idx on public.reports(tehsil_id);
create index reports_reported_by_idx on public.reports(reported_by);
create index reports_assigned_supervisor_idx on public.reports(assigned_supervisor_id);
create index reports_assigned_zo_idx on public.reports(assigned_zo_id);
create index reports_status_idx on public.reports(status);
create index reports_issue_type_idx on public.reports(issue_type_id);
create index reports_created_at_idx on public.reports(created_at desc);

create table public.report_images (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  image_type report_image_type not null,
  file_path text not null,
  uploaded_by uuid not null references public.profiles(id),
  latitude double precision,
  longitude double precision,
  location_accuracy double precision,
  captured_at timestamptz not null default now()
);
create index report_images_report_id_idx on public.report_images(report_id);

create table public.resolutions (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null unique references public.reports(id) on delete cascade,
  resolved_by uuid not null references public.profiles(id),
  resolution_note text,
  latitude double precision,
  longitude double precision,
  location_accuracy double precision,
  resolved_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id),
  report_id uuid references public.reports(id) on delete cascade,
  action text not null,
  old_status report_status,
  new_status report_status,
  remarks text,
  created_at timestamptz not null default now()
);
create index audit_logs_report_id_idx on public.audit_logs(report_id);
create index audit_logs_created_at_idx on public.audit_logs(created_at desc);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  report_id uuid references public.reports(id) on delete cascade,
  type text not null,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index notifications_user_id_idx on public.notifications(user_id, is_read);

-- 0002_rls: helper functions + Row Level Security policies
--
-- Every visibility rule from the requirements doc is enforced here, in the
-- database, so it holds even if someone bypasses the app UI and calls the
-- Supabase API directly. Helper functions live in a separate `private`
-- schema (not exposed over the API) and are SECURITY DEFINER so they can
-- read `profiles`/`user_assignments` without recursing back through RLS.

create schema if not exists private;
grant usage on schema private to authenticated;

create or replace function private.current_role()
returns app_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function private.assigned_uc_ids()
returns setof uuid
language sql stable security definer set search_path = public as $$
  select uc_id from public.user_assignments
  where user_id = auth.uid() and is_active = true and uc_id is not null
    and start_date <= current_date and (end_date is null or end_date >= current_date);
$$;

create or replace function private.assigned_zone_ids()
returns setof uuid
language sql stable security definer set search_path = public as $$
  select zone_id from public.user_assignments
  where user_id = auth.uid() and is_active = true and zone_id is not null
    and start_date <= current_date and (end_date is null or end_date >= current_date);
$$;

create or replace function private.assigned_tehsil_ids()
returns setof uuid
language sql stable security definer set search_path = public as $$
  select tehsil_id from public.user_assignments
  where user_id = auth.uid() and is_active = true and tehsil_id is not null
    and start_date <= current_date and (end_date is null or end_date >= current_date);
$$;

-- Central "can this caller see this report" check, reused by report_images,
-- resolutions, audit_logs and the storage policies so evidence/audit rows
-- always follow the same scope as the report itself.
create or replace function private.can_view_report(p_report_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.reports r
    where r.id = p_report_id
      and (
        private.current_role() = 'ADMIN'
        or (private.current_role() = 'SURVEYER' and r.reported_by = auth.uid())
        or (private.current_role() = 'SUPERVISOR' and r.uc_id in (select private.assigned_uc_ids()))
        or (private.current_role() = 'ZO' and r.zone_id in (select private.assigned_zone_ids()))
        or (private.current_role() = 'MANAGER' and (
              r.zone_id in (select private.assigned_zone_ids())
              or r.tehsil_id in (select private.assigned_tehsil_ids())
            ))
        or (private.current_role() in ('GM', 'AC') and r.tehsil_id in (select private.assigned_tehsil_ids()))
      )
  );
$$;

grant execute on function private.current_role() to authenticated;
grant execute on function private.assigned_uc_ids() to authenticated;
grant execute on function private.assigned_zone_ids() to authenticated;
grant execute on function private.assigned_tehsil_ids() to authenticated;
grant execute on function private.can_view_report(uuid) to authenticated;

-- ── Table grants (RLS still restricts per-row/command access below) ────

grant select, insert, update, delete on
  public.tehsils, public.zones, public.ucs, public.issue_types,
  public.profiles, public.user_assignments, public.reports,
  public.report_images, public.resolutions, public.audit_logs,
  public.notifications
to authenticated;

alter table public.tehsils enable row level security;
alter table public.zones enable row level security;
alter table public.ucs enable row level security;
alter table public.issue_types enable row level security;
alter table public.profiles enable row level security;
alter table public.user_assignments enable row level security;
alter table public.reports enable row level security;
alter table public.report_images enable row level security;
alter table public.resolutions enable row level security;
alter table public.audit_logs enable row level security;
alter table public.notifications enable row level security;

-- ── Reference data: readable by everyone signed in, writable by Admin ──

create policy tehsils_select on public.tehsils for select to authenticated using (true);
create policy tehsils_write on public.tehsils for all to authenticated
  using (private.current_role() = 'ADMIN') with check (private.current_role() = 'ADMIN');

create policy zones_select on public.zones for select to authenticated using (true);
create policy zones_write on public.zones for all to authenticated
  using (private.current_role() = 'ADMIN') with check (private.current_role() = 'ADMIN');

create policy ucs_select on public.ucs for select to authenticated using (true);
create policy ucs_write on public.ucs for all to authenticated
  using (private.current_role() = 'ADMIN') with check (private.current_role() = 'ADMIN');

create policy issue_types_select on public.issue_types for select to authenticated using (true);
create policy issue_types_write on public.issue_types for all to authenticated
  using (private.current_role() = 'ADMIN') with check (private.current_role() = 'ADMIN');

-- ── Profiles ─────────────────────────────────────────────────────────────

create policy profiles_select on public.profiles for select to authenticated using (
  id = auth.uid()
  or private.current_role() = 'ADMIN'
  or exists (
    select 1 from public.reports r
    where (r.reported_by = profiles.id or r.assigned_supervisor_id = profiles.id or r.assigned_zo_id = profiles.id)
      and private.can_view_report(r.id)
  )
);

-- Admin can do anything; everyone else may only touch their own row, and
-- even then role/is_active/username are locked down by a trigger in
-- 0003_triggers.sql (profiles_protect_privileged_fields).
create policy profiles_write_admin on public.profiles for all to authenticated
  using (private.current_role() = 'ADMIN') with check (private.current_role() = 'ADMIN');
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- ── User assignments ────────────────────────────────────────────────────

create policy user_assignments_select on public.user_assignments for select to authenticated using (
  user_id = auth.uid() or private.current_role() = 'ADMIN'
);
create policy user_assignments_write_admin on public.user_assignments for all to authenticated
  using (private.current_role() = 'ADMIN') with check (private.current_role() = 'ADMIN');

-- ── Reports ──────────────────────────────────────────────────────────────

create policy reports_select on public.reports for select to authenticated using (
  private.current_role() = 'ADMIN'
  or (private.current_role() = 'SURVEYER' and reported_by = auth.uid())
  or (private.current_role() = 'SUPERVISOR' and uc_id in (select private.assigned_uc_ids()))
  or (private.current_role() = 'ZO' and zone_id in (select private.assigned_zone_ids()))
  or (private.current_role() = 'MANAGER' and (
        zone_id in (select private.assigned_zone_ids())
        or tehsil_id in (select private.assigned_tehsil_ids())
      ))
  or (private.current_role() in ('GM', 'AC') and tehsil_id in (select private.assigned_tehsil_ids()))
);

-- A Surveyer can only file a report for a UC they're actually assigned to.
create policy reports_insert on public.reports for insert to authenticated with check (
  private.current_role() = 'ADMIN'
  or (private.current_role() = 'SURVEYER' and reported_by = auth.uid() and uc_id in (select private.assigned_uc_ids()))
);

-- Only the responsible Supervisor/ZO (or Admin) can move a report through
-- its lifecycle. No delete policy anywhere -> deletes are always denied for
-- API callers.
create policy reports_update on public.reports for update to authenticated
  using (
    private.current_role() = 'ADMIN'
    or (private.current_role() = 'SUPERVISOR' and uc_id in (select private.assigned_uc_ids()))
    or (private.current_role() = 'ZO' and zone_id in (select private.assigned_zone_ids()))
  )
  with check (
    private.current_role() = 'ADMIN'
    or (private.current_role() = 'SUPERVISOR' and uc_id in (select private.assigned_uc_ids()))
    or (private.current_role() = 'ZO' and zone_id in (select private.assigned_zone_ids()))
  );

-- ── Report images (immutable evidence: no update/delete policy) ────────

create policy report_images_select on public.report_images for select to authenticated using (
  private.can_view_report(report_id)
);
create policy report_images_insert on public.report_images for insert to authenticated with check (
  private.can_view_report(report_id) and uploaded_by = auth.uid()
);

-- ── Resolutions (immutable once filed: no update/delete policy) ────────

create policy resolutions_select on public.resolutions for select to authenticated using (
  private.can_view_report(report_id)
);
create policy resolutions_insert on public.resolutions for insert to authenticated with check (
  resolved_by = auth.uid()
  and (
    private.current_role() = 'ADMIN'
    or exists (
      select 1 from public.reports r
      where r.id = report_id and (r.assigned_supervisor_id = auth.uid() or r.assigned_zo_id = auth.uid())
    )
  )
);

-- ── Audit logs (read-only to clients; only triggers may insert) ────────

create policy audit_logs_select on public.audit_logs for select to authenticated using (
  private.current_role() = 'ADMIN' or (report_id is not null and private.can_view_report(report_id))
);
-- Deliberately no insert/update/delete policy for the `authenticated` role.
-- Rows are written exclusively by SECURITY DEFINER trigger functions
-- (0003_triggers.sql), which run as the table owner and bypass RLS, so the
-- trail can't be edited or forged from the client.

-- ── Notifications ────────────────────────────────────────────────────────

create policy notifications_select on public.notifications for select to authenticated using (
  user_id = auth.uid() or private.current_role() = 'ADMIN'
);
create policy notifications_update_self on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
-- No client insert policy — rows are written by triggers only.

-- 0003_triggers: auto-assignment, report numbering, audit trail,
-- notifications, and a couple of integrity guards RLS alone can't express.

-- ── updated_at maintenance ──────────────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger reports_set_updated_at
before update on public.reports
for each row execute function public.set_updated_at();

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- ── Report numbering ─────────────────────────────────────────────────────

create or replace function public.generate_report_number()
returns text language plpgsql as $$
declare
  seq_val bigint;
begin
  seq_val := nextval('public.report_number_seq');
  return 'RPT-' || to_char(now(), 'YYYY') || '-' || lpad(seq_val::text, 6, '0');
end;
$$;

-- ── Automatic routing on report creation ────────────────────────────────
-- Derives zone/tehsil from the UC server-side (never trusts a
-- client-supplied value), stamps the currently-active Supervisor/ZO for
-- that UC/Zone, and assigns the report number. This is what makes the
-- hierarchy tamper-proof: the client only ever picks a uc_id.

create or replace function public.reports_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_zone_id uuid;
  v_tehsil_id uuid;
  v_supervisor_id uuid;
  v_zo_id uuid;
begin
  select zone_id, tehsil_id into v_zone_id, v_tehsil_id from public.ucs where id = new.uc_id;
  if v_zone_id is null then
    raise exception 'Invalid uc_id: no matching zone/tehsil found';
  end if;
  new.zone_id := v_zone_id;
  new.tehsil_id := v_tehsil_id;

  select ua.user_id into v_supervisor_id
  from public.user_assignments ua
  join public.profiles p on p.id = ua.user_id
  where p.role = 'SUPERVISOR' and ua.uc_id = new.uc_id and ua.is_active = true and p.is_active = true
    and ua.start_date <= current_date and (ua.end_date is null or ua.end_date >= current_date)
  order by ua.start_date desc
  limit 1;

  select ua.user_id into v_zo_id
  from public.user_assignments ua
  join public.profiles p on p.id = ua.user_id
  where p.role = 'ZO' and ua.zone_id = v_zone_id and ua.is_active = true and p.is_active = true
    and ua.start_date <= current_date and (ua.end_date is null or ua.end_date >= current_date)
  order by ua.start_date desc
  limit 1;

  new.assigned_supervisor_id := v_supervisor_id;
  new.assigned_zo_id := v_zo_id;
  new.status := 'PENDING';
  new.report_number := public.generate_report_number();

  return new;
end;
$$;

create trigger reports_before_insert_trigger
before insert on public.reports
for each row execute function public.reports_before_insert();

-- ── Audit + notifications on creation ───────────────────────────────────

create or replace function public.reports_after_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_logs (user_id, report_id, action, old_status, new_status)
  values (new.reported_by, new.id, 'CREATED', null, new.status);

  if new.assigned_supervisor_id is not null then
    insert into public.notifications (user_id, report_id, type, message)
    values (new.assigned_supervisor_id, new.id, 'NEW_REPORT', 'New report ' || new.report_number || ' assigned to you.');
  end if;
  if new.assigned_zo_id is not null then
    insert into public.notifications (user_id, report_id, type, message)
    values (new.assigned_zo_id, new.id, 'NEW_REPORT', 'New report ' || new.report_number || ' in your zone.');
  end if;

  return new;
end;
$$;

create trigger reports_after_insert_trigger
after insert on public.reports
for each row execute function public.reports_after_insert();

-- ── Audit + notifications on status change ──────────────────────────────

create or replace function public.reports_after_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status then
    insert into public.audit_logs (user_id, report_id, action, old_status, new_status)
    values (auth.uid(), new.id, 'STATUS_CHANGE', old.status, new.status);

    if new.status = 'CLOSED' then
      insert into public.notifications (user_id, report_id, type, message)
      values (new.reported_by, new.id, 'CLOSED', 'Your report ' || new.report_number || ' has been closed.');

      if new.assigned_zo_id is not null and new.assigned_zo_id <> auth.uid() then
        insert into public.notifications (user_id, report_id, type, message)
        values (new.assigned_zo_id, new.id, 'CLOSED', 'Report ' || new.report_number || ' has been closed.');
      end if;
    end if;
  end if;
  return new;
end;
$$;

create trigger reports_after_update_trigger
after update on public.reports
for each row execute function public.reports_after_update();

-- ── Filing a resolution closes the report ───────────────────────────────

create or replace function public.resolutions_after_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.reports set status = 'CLOSED' where id = new.report_id and status <> 'CLOSED';
  return new;
end;
$$;

create trigger resolutions_after_insert_trigger
after insert on public.resolutions
for each row execute function public.resolutions_after_insert();

-- ── Guard: only Admin may change role / is_active / username on profiles ──
-- RLS lets a user UPDATE their own profiles row (e.g. to change their
-- phone number); this trigger blocks the privileged columns from being
-- smuggled into that same request.

create or replace function public.profiles_protect_privileged_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if private.current_role() <> 'ADMIN' then
    if new.role is distinct from old.role
      or new.is_active is distinct from old.is_active
      or new.username is distinct from old.username then
      raise exception 'Only an admin can change role, active status, or username.';
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_protect_privileged_fields_trigger
before update on public.profiles
for each row execute function public.profiles_protect_privileged_fields();

-- ── Guard: assignment shape must match the assignee's role ─────────────

create or replace function public.validate_user_assignment()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_role app_role;
begin
  select role into v_role from public.profiles where id = new.user_id;

  if v_role in ('SURVEYER', 'SUPERVISOR') and new.uc_id is null then
    raise exception 'Surveyer/Supervisor assignments require a uc_id.';
  end if;
  if v_role = 'ZO' and new.zone_id is null then
    raise exception 'ZO assignments require a zone_id.';
  end if;
  if v_role = 'AC' and new.tehsil_id is null then
    raise exception 'AC assignments require a tehsil_id.';
  end if;
  if v_role = 'MANAGER' and new.zone_id is null and new.tehsil_id is null then
    raise exception 'Manager assignments require a zone_id or tehsil_id.';
  end if;

  return new;
end;
$$;

create trigger user_assignments_validate_trigger
before insert or update on public.user_assignments
for each row execute function public.validate_user_assignment();

-- 0004_storage: photo evidence bucket + access policies
--
-- Path convention: <report_id>/before.jpg and <report_id>/resolution.jpg.
-- Access follows the exact same scope as the report row itself, via
-- private.can_view_report() — a Supervisor can only fetch/upload photos
-- for reports they're actually allowed to see.

insert into storage.buckets (id, name, public)
values ('report-photos', 'report-photos', false)
on conflict (id) do nothing;

create policy report_photos_select on storage.objects for select to authenticated using (
  bucket_id = 'report-photos'
  and private.can_view_report((split_part(name, '/', 1))::uuid)
);

create policy report_photos_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'report-photos'
  and private.can_view_report((split_part(name, '/', 1))::uuid)
);

-- Dummy organisational data (requirements doc §49) so the app can be
-- exercised end-to-end before real Tehsil/Zone/UC data is entered.
-- Safe to re-run: fixed ids + ON CONFLICT DO NOTHING.

insert into public.tehsils (id, name, code, is_active) values
  ('00000000-0000-0000-0000-000000000001', 'Test Tehsil', 'TEST', true)
on conflict (id) do nothing;

insert into public.zones (id, name, tehsil_id, is_active) values
  ('00000000-0000-0000-0000-000000000101', 'Zone-01', '00000000-0000-0000-0000-000000000001', true)
on conflict (id) do nothing;

insert into public.ucs (id, name, code, zone_id, tehsil_id, is_active) values
  ('00000000-0000-0000-0000-000000000201', 'UC-01', 'UC-01', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000001', true)
on conflict (id) do nothing;

insert into public.issue_types (id, name, description, color, is_active) values
  ('00000000-0000-0000-0000-000000000301', 'Garbage', 'Uncollected garbage / overflowing bins', '#B45309', true),
  ('00000000-0000-0000-0000-000000000302', 'Manhole Cover', 'Missing or damaged manhole cover', '#7C3AED', true),
  ('00000000-0000-0000-0000-000000000303', 'Slab', 'Broken or missing slab', '#0EA5E9', true),
  ('00000000-0000-0000-0000-000000000304', 'Sewer Issue', 'Sewer line blockage or overflow', '#DC2626', true),
  ('00000000-0000-0000-0000-000000000305', 'Road Issue', 'Potholes / road surface damage', '#475569', true)
on conflict (id) do nothing;

-- Dummy users (ZO-01 / Supervisor-01 / Surveyer-01) are NOT created here —
-- they need real auth.users rows, which plain SQL can't produce safely.
--
-- Bootstrapping order:
--   1. The very first Admin account has to be created by hand, once, since
--      there's no Admin yet to use the app's "create user" flow:
--        a. Supabase Dashboard -> Authentication -> Add User
--           (email: admin@lwmc.internal, set a password, confirm email)
--        b. Then run, filling in the new user's id from that screen:
--             insert into public.profiles (id, full_name, username, role)
--             values ('<auth-user-id>', 'System Admin', 'admin', 'ADMIN');
--   2. Log into the app as that Admin and use Admin > Users to create
--      ZO-01, Supervisor-01 and Surveyer-01 (this calls the
--      admin-create-user Edge Function, which also needs to be deployed
--      first — see supabase/functions/admin-create-user).
--   3. Use Admin > Assignments to assign:
--        Surveyer-01  -> UC-01
--        Supervisor-01 -> UC-01
--        ZO-01         -> Zone-01
