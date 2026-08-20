-- Field Issue Reporting & Rectification Management System
-- 0001_init: core schema (enums, tables, indexes)

create extension if not exists pgcrypto;

-- ── Enums ────────────────────────────────────────────────────────────────
-- Postgres has no `create type if not exists`, so these are guarded by
-- hand — safe to run this whole script more than once.

-- Role is a permission TIER, not a job title — AREA_MANAGER covers
-- AC/GM/TM/Manager titles, ADMIN covers DC/CO MCL/GM LWMC/WASA titles. The
-- actual title a person holds goes in profiles.designation (free text)
-- instead of a per-title enum value.
do $$ begin
  create type app_role as enum ('ADMIN', 'AREA_MANAGER', 'ZO', 'SUPERVISOR', 'SURVEYOR', 'RECTIFIER');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type report_status as enum ('SUBMITTED', 'PENDING', 'IN_PROGRESS', 'CLOSED', 'REOPENED');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type report_image_type as enum ('BEFORE', 'RESOLUTION');
exception when duplicate_object then null;
end $$;

-- ── Organisational hierarchy ────────────────────────────────────────────

create table if not exists public.tehsils (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.zones (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tehsil_id uuid not null references public.tehsils(id) on delete restrict,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists zones_tehsil_id_idx on public.zones(tehsil_id);

create table if not exists public.ucs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text,
  zone_id uuid not null references public.zones(id) on delete restrict,
  tehsil_id uuid not null references public.tehsils(id) on delete restrict,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists ucs_zone_id_idx on public.ucs(zone_id);
create index if not exists ucs_tehsil_id_idx on public.ucs(tehsil_id);

-- ── Issue taxonomy ───────────────────────────────────────────────────────

create table if not exists public.issue_types (
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

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  username text not null unique,
  phone text,
  role app_role not null,
  -- Free-text title shown in the UI: DC, CO MCL, GM LWMC, WASA, AC, TM,
  -- Zone Officer, Supervisor, Surveyor, Rectifier... — see the app_role
  -- comment above.
  designation text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A user's assignment to a level of the hierarchy. Historical rows are kept
-- (end_date/is_active) so past reports keep their original assignment
-- snapshot even after someone's coverage area changes.
create table if not exists public.user_assignments (
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
create index if not exists user_assignments_user_id_idx on public.user_assignments(user_id);
create index if not exists user_assignments_uc_id_idx on public.user_assignments(uc_id) where uc_id is not null;
create index if not exists user_assignments_zone_id_idx on public.user_assignments(zone_id) where zone_id is not null;
create index if not exists user_assignments_tehsil_id_idx on public.user_assignments(tehsil_id) where tehsil_id is not null;

-- ── Reports ──────────────────────────────────────────────────────────────

create sequence if not exists public.report_number_seq;

create table if not exists public.reports (
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
create index if not exists reports_uc_id_idx on public.reports(uc_id);
create index if not exists reports_zone_id_idx on public.reports(zone_id);
create index if not exists reports_tehsil_id_idx on public.reports(tehsil_id);
create index if not exists reports_reported_by_idx on public.reports(reported_by);
create index if not exists reports_assigned_supervisor_idx on public.reports(assigned_supervisor_id);
create index if not exists reports_assigned_zo_idx on public.reports(assigned_zo_id);
create index if not exists reports_status_idx on public.reports(status);
create index if not exists reports_issue_type_idx on public.reports(issue_type_id);
create index if not exists reports_created_at_idx on public.reports(created_at desc);

create table if not exists public.report_images (
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
create index if not exists report_images_report_id_idx on public.report_images(report_id);

create table if not exists public.resolutions (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null unique references public.reports(id) on delete cascade,
  resolved_by uuid not null references public.profiles(id),
  resolution_note text,
  latitude double precision,
  longitude double precision,
  location_accuracy double precision,
  resolved_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id),
  report_id uuid references public.reports(id) on delete cascade,
  action text not null,
  old_status report_status,
  new_status report_status,
  remarks text,
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_report_id_idx on public.audit_logs(report_id);
create index if not exists audit_logs_created_at_idx on public.audit_logs(created_at desc);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  report_id uuid references public.reports(id) on delete cascade,
  type text not null,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_id_idx on public.notifications(user_id, is_read);
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
-- View scope: Admin + Area Manager see the whole district; ZO is scoped to
-- their own Zone; Supervisor/Surveyor/Rectifier are scoped to their own
-- assigned UC(s).
create or replace function private.can_view_report(p_report_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.reports r
    where r.id = p_report_id
      and (
        private.current_role() in ('ADMIN', 'AREA_MANAGER')
        or (private.current_role() = 'ZO' and r.zone_id in (select private.assigned_zone_ids()))
        or (private.current_role() in ('SUPERVISOR', 'SURVEYOR', 'RECTIFIER') and r.uc_id in (select private.assigned_uc_ids()))
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
-- Every policy below is preceded by `drop policy if exists` so this whole
-- script is safe to paste and run more than once.

drop policy if exists tehsils_select on public.tehsils;
create policy tehsils_select on public.tehsils for select to authenticated using (true);
drop policy if exists tehsils_write on public.tehsils;
create policy tehsils_write on public.tehsils for all to authenticated
  using (private.current_role() = 'ADMIN') with check (private.current_role() = 'ADMIN');

drop policy if exists zones_select on public.zones;
create policy zones_select on public.zones for select to authenticated using (true);
drop policy if exists zones_write on public.zones;
create policy zones_write on public.zones for all to authenticated
  using (private.current_role() = 'ADMIN') with check (private.current_role() = 'ADMIN');

drop policy if exists ucs_select on public.ucs;
create policy ucs_select on public.ucs for select to authenticated using (true);
drop policy if exists ucs_write on public.ucs;
create policy ucs_write on public.ucs for all to authenticated
  using (private.current_role() = 'ADMIN') with check (private.current_role() = 'ADMIN');

drop policy if exists issue_types_select on public.issue_types;
create policy issue_types_select on public.issue_types for select to authenticated using (true);
drop policy if exists issue_types_write on public.issue_types;
create policy issue_types_write on public.issue_types for all to authenticated
  using (private.current_role() = 'ADMIN') with check (private.current_role() = 'ADMIN');

-- ── Profiles ─────────────────────────────────────────────────────────────

drop policy if exists profiles_select on public.profiles;
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
drop policy if exists profiles_write_admin on public.profiles;
create policy profiles_write_admin on public.profiles for all to authenticated
  using (private.current_role() = 'ADMIN') with check (private.current_role() = 'ADMIN');
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- ── User assignments ────────────────────────────────────────────────────

drop policy if exists user_assignments_select on public.user_assignments;
create policy user_assignments_select on public.user_assignments for select to authenticated using (
  user_id = auth.uid() or private.current_role() = 'ADMIN'
);
drop policy if exists user_assignments_write_admin on public.user_assignments;
create policy user_assignments_write_admin on public.user_assignments for all to authenticated
  using (private.current_role() = 'ADMIN') with check (private.current_role() = 'ADMIN');

-- ── Reports ──────────────────────────────────────────────────────────────

drop policy if exists reports_select on public.reports;
create policy reports_select on public.reports for select to authenticated using (
  private.current_role() in ('ADMIN', 'AREA_MANAGER')
  or (private.current_role() = 'ZO' and zone_id in (select private.assigned_zone_ids()))
  or (private.current_role() in ('SUPERVISOR', 'SURVEYOR', 'RECTIFIER') and uc_id in (select private.assigned_uc_ids()))
);

-- Who may REPORT: Surveyor + every "controller" tier except Rectifier
-- (Rectifier is resolve-only — see resolutions_insert below). A controller
-- reports as themselves, scoped to what they can already see: Area Manager
-- anywhere in the district, ZO within their zone, Supervisor/Surveyor
-- within their own assigned UC(s).
drop policy if exists reports_insert on public.reports;
create policy reports_insert on public.reports for insert to authenticated with check (
  reported_by = auth.uid()
  and (
    private.current_role() in ('ADMIN', 'AREA_MANAGER')
    or (private.current_role() = 'ZO' and uc_id in (select id from public.ucs where zone_id in (select private.assigned_zone_ids())))
    or (private.current_role() in ('SUPERVISOR', 'SURVEYOR') and uc_id in (select private.assigned_uc_ids()))
  )
);

-- Report lifecycle updates stay with the "controller" tiers (Rectifier
-- resolves through the resolutions table below, not a direct report
-- update). No delete policy anywhere -> deletes are always denied for API
-- callers.
drop policy if exists reports_update on public.reports;
create policy reports_update on public.reports for update to authenticated
  using (
    private.current_role() in ('ADMIN', 'AREA_MANAGER')
    or (private.current_role() = 'ZO' and zone_id in (select private.assigned_zone_ids()))
    or (private.current_role() = 'SUPERVISOR' and uc_id in (select private.assigned_uc_ids()))
  )
  with check (
    private.current_role() in ('ADMIN', 'AREA_MANAGER')
    or (private.current_role() = 'ZO' and zone_id in (select private.assigned_zone_ids()))
    or (private.current_role() = 'SUPERVISOR' and uc_id in (select private.assigned_uc_ids()))
  );

-- ── Report images (immutable evidence: no update/delete policy) ────────

drop policy if exists report_images_select on public.report_images;
create policy report_images_select on public.report_images for select to authenticated using (
  private.can_view_report(report_id)
);
drop policy if exists report_images_insert on public.report_images;
create policy report_images_insert on public.report_images for insert to authenticated with check (
  private.can_view_report(report_id) and uploaded_by = auth.uid()
);

-- ── Resolutions (immutable once filed: no update/delete policy) ────────

drop policy if exists resolutions_select on public.resolutions;
create policy resolutions_select on public.resolutions for select to authenticated using (
  private.can_view_report(report_id)
);
-- Who may RESOLVE: Rectifier + every controller tier except Surveyor — a
-- live scope check (Rectifier picks which pending report to work from a
-- queue, rather than a single report handed to them, so this can't use the
-- old pre-stamped assigned_supervisor_id/assigned_zo_id shortcut).
drop policy if exists resolutions_insert on public.resolutions;
create policy resolutions_insert on public.resolutions for insert to authenticated with check (
  resolved_by = auth.uid()
  and exists (
    select 1 from public.reports r
    where r.id = report_id
      and (
        private.current_role() in ('ADMIN', 'AREA_MANAGER')
        or (private.current_role() = 'ZO' and r.zone_id in (select private.assigned_zone_ids()))
        or (private.current_role() in ('SUPERVISOR', 'RECTIFIER') and r.uc_id in (select private.assigned_uc_ids()))
      )
  )
);

-- ── Audit logs (read-only to clients; only triggers may insert) ────────

drop policy if exists audit_logs_select on public.audit_logs;
create policy audit_logs_select on public.audit_logs for select to authenticated using (
  private.current_role() = 'ADMIN' or (report_id is not null and private.can_view_report(report_id))
);
-- Deliberately no insert/update/delete policy for the `authenticated` role.
-- Rows are written exclusively by SECURITY DEFINER trigger functions
-- (0003_triggers.sql), which run as the table owner and bypass RLS, so the
-- trail can't be edited or forged from the client.

-- ── Notifications ────────────────────────────────────────────────────────

drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications for select to authenticated using (
  user_id = auth.uid() or private.current_role() = 'ADMIN'
);
drop policy if exists notifications_update_self on public.notifications;
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

create or replace trigger reports_set_updated_at
before update on public.reports
for each row execute function public.set_updated_at();

create or replace trigger profiles_set_updated_at
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

create or replace trigger reports_before_insert_trigger
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

create or replace trigger reports_after_insert_trigger
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

create or replace trigger reports_after_update_trigger
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

create or replace trigger resolutions_after_insert_trigger
after insert on public.resolutions
for each row execute function public.resolutions_after_insert();

-- ── Guard: only Admin may change role / is_active / username on profiles ──
-- RLS lets a user UPDATE their own profiles row (e.g. to change their
-- phone number); this trigger blocks the privileged columns from being
-- smuggled into that same request.

-- Role/username stay Admin-only; is_active (activate/deactivate — this
-- app's "add/remove" for a user who already exists) delegates to
-- private.user_in_manage_scope(), defined later in 0005_hierarchy_v2.sql —
-- a plpgsql function body is only resolved when it EXECUTES, not when it's
-- created, so this forward reference is safe even though the referenced
-- function doesn't exist yet at this point in the script.
create or replace function public.profiles_protect_privileged_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.role is distinct from old.role or new.username is distinct from old.username)
     and private.current_role() <> 'ADMIN' then
    raise exception 'Only an admin can change role or username.';
  end if;
  if new.is_active is distinct from old.is_active and not private.user_in_manage_scope(old.id) then
    raise exception 'You do not have permission to activate or deactivate this user.';
  end if;
  return new;
end;
$$;

create or replace trigger profiles_protect_privileged_fields_trigger
before update on public.profiles
for each row execute function public.profiles_protect_privileged_fields();

-- ── Guard: assignment shape must match the assignee's role ─────────────

create or replace function public.validate_user_assignment()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_role app_role;
begin
  select role into v_role from public.profiles where id = new.user_id;

  if v_role in ('SURVEYOR', 'RECTIFIER', 'SUPERVISOR') and new.uc_id is null then
    raise exception '% assignments require a uc_id.', v_role;
  end if;
  if v_role = 'ZO' and new.zone_id is null then
    raise exception 'ZO assignments require a zone_id.';
  end if;
  if v_role = 'AREA_MANAGER' and new.tehsil_id is null then
    raise exception 'Area Manager assignments require a tehsil_id.';
  end if;

  return new;
end;
$$;

create or replace trigger user_assignments_validate_trigger
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

drop policy if exists report_photos_select on storage.objects;
create policy report_photos_select on storage.objects for select to authenticated using (
  bucket_id = 'report-photos'
  and private.can_view_report((split_part(name, '/', 1))::uuid)
);

drop policy if exists report_photos_insert on storage.objects;
create policy report_photos_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'report-photos'
  and private.can_view_report((split_part(name, '/', 1))::uuid)
);
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
-- Amendment D: report submission must carry a real GPS fix — manual address
-- alone is no longer an acceptable substitute. NOT VALID so pre-existing rows
-- (created before this rule existed) aren't retroactively broken; the check
-- still applies to every INSERT/UPDATE going forward.
alter table public.reports
  add constraint reports_location_required
  check (latitude is not null and longitude is not null) not valid;
-- Amendment: a user with more than one active UC assignment (e.g. a
-- Supervisor covering two UCs) needs one marked as their default so the New
-- Issue form can auto-select it instead of picking whichever row happened to
-- come back first. At most one default per user, enforced with a partial
-- unique index (only counts active, default rows).
alter table public.user_assignments add column if not exists is_default boolean not null default false;

create unique index if not exists user_assignments_one_default_per_user
  on public.user_assignments(user_id)
  where is_default and is_active;
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
-- Dummy organisational data (requirements doc §49) so the app can be
-- exercised end-to-end before real Tehsil/Zone/UC data is entered.
-- Safe to re-run: fixed ids + ON CONFLICT DO NOTHING.

insert into public.tehsils (id, name, code, is_active) values
  ('00000000-0000-0000-0000-000000000001', 'Test Tehsil', 'TEST', true)
on conflict (id) do nothing;

-- Links Test Tehsil to Test District (inserted in 0005_hierarchy_v2.sql,
-- which runs before this file) — done here rather than there since this is
-- the first point in the combined setup_all.sql where the tehsil row is
-- guaranteed to exist.
update public.tehsils set district_id = '00000000-0000-0000-0000-000000000001'
where id = '00000000-0000-0000-0000-000000000001' and district_id is null;

insert into public.zones (id, name, tehsil_id, is_active) values
  ('00000000-0000-0000-0000-000000000101', 'Zone-01', '00000000-0000-0000-0000-000000000001', true)
on conflict (id) do nothing;

insert into public.ucs (id, name, code, zone_id, tehsil_id, is_active) values
  ('00000000-0000-0000-0000-000000000201', 'UC-01', 'UC-01', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000001', true)
on conflict (id) do nothing;

insert into public.issue_types (id, name, description, color, is_active) values
  ('00000000-0000-0000-0000-000000000301', 'Garbage Heap', 'Accumulated solid waste in a public area', '#B45309', true),
  ('00000000-0000-0000-0000-000000000302', 'Manhole / Slab Missing', 'Missing or damaged manhole cover or drain slab', '#6D28D9', true),
  ('00000000-0000-0000-0000-000000000304', 'Sewer Issue', 'Blocked, overflowing, or damaged sewer line', '#0369A1', true),
  ('00000000-0000-0000-0000-000000000306', 'Garbage in Open Plot', 'Illegal dumping on a vacant or open plot', '#BE123C', true)
on conflict (id) do nothing;

-- Dummy users (ZO-01 / Supervisor-01 / Surveyor-01 / Rectifier-01) are NOT
-- created here — they need real auth.users rows, which plain SQL can't
-- produce safely.
--
-- Bootstrapping order:
--   1. The very first Admin account has to be created by hand, once, since
--      there's no Admin yet to use the app's "create user" flow:
--        a. Supabase Dashboard -> Authentication -> Add User
--           (email: admin@lwmc.internal, set a password, confirm email)
--        b. Then run, filling in the new user's id from that screen:
--             insert into public.profiles (id, full_name, username, role, designation)
--             values ('<auth-user-id>', 'System Admin', 'admin', 'ADMIN', 'DC');
--   2. Log into the app as that Admin and use Admin > Users to create
--      ZO-01, Supervisor-01, Surveyor-01 and Rectifier-01 (this calls the
--      admin-create-user Edge Function, which also needs to be deployed
--      first — see supabase/functions/admin-create-user).
--   3. Use Admin > Assignments to assign:
--        Surveyor-01   -> UC-01
--        Rectifier-01  -> UC-01
--        Supervisor-01 -> UC-01
--        ZO-01         -> Zone-01
