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
