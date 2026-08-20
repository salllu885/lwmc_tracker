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
