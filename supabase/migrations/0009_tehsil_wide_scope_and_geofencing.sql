-- Amendments (2026-08-21 round):
--
-- 1. "Leave the hierarchical boundedness of UC — anyone can choose any UC
--    within their Tehsil." Supervisor/Surveyor/Rectifier were pinned to
--    their single assigned uc_id; they're now scoped to their whole Tehsil
--    instead (resolved from whichever level they're actually assigned at —
--    uc_id, zone_id, or tehsil_id — via own_tehsil_ids()). ZO stays
--    zone-scoped; that boundary wasn't part of this request.
--
-- 2. Anti-fraud geofencing, enforced server-side (a client-only check is
--    trivially bypassed, which defeats the point): a report's own GPS fix
--    must be accurate to within 100m to be accepted, and a resolution must
--    be filed from within 200m of that report's original coordinates —
--    "as they give fake resolutions... this should not be allowed."

create or replace function private.own_tehsil_ids()
returns setof uuid
language sql stable security definer set search_path = public as $$
  select tehsil_id from public.user_assignments
  where user_id = auth.uid() and is_active = true and tehsil_id is not null
    and start_date <= current_date and (end_date is null or end_date >= current_date)
  union
  select z.tehsil_id from public.user_assignments ua
  join public.zones z on z.id = ua.zone_id
  where ua.user_id = auth.uid() and ua.is_active = true and ua.zone_id is not null
    and ua.start_date <= current_date and (ua.end_date is null or ua.end_date >= current_date)
  union
  select u.tehsil_id from public.user_assignments ua
  join public.ucs u on u.id = ua.uc_id
  where ua.user_id = auth.uid() and ua.is_active = true and ua.uc_id is not null
    and ua.start_date <= current_date and (ua.end_date is null or ua.end_date >= current_date);
$$;

grant execute on function private.own_tehsil_ids() to authenticated;

create or replace function private.can_view_report(p_report_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.reports r
    where r.id = p_report_id
      and (
        private.current_role() in ('ADMIN', 'AREA_MANAGER')
        or (private.current_role() = 'ZO' and r.zone_id in (select private.assigned_zone_ids()))
        or (private.current_role() in ('SUPERVISOR', 'SURVEYOR', 'RECTIFIER') and r.tehsil_id in (select private.own_tehsil_ids()))
      )
  );
$$;

drop policy if exists reports_select on public.reports;
create policy reports_select on public.reports for select to authenticated using (
  private.current_role() in ('ADMIN', 'AREA_MANAGER')
  or (private.current_role() = 'ZO' and zone_id in (select private.assigned_zone_ids()))
  or (private.current_role() in ('SUPERVISOR', 'SURVEYOR', 'RECTIFIER') and tehsil_id in (select private.own_tehsil_ids()))
);

drop policy if exists reports_insert on public.reports;
create policy reports_insert on public.reports for insert to authenticated with check (
  reported_by = auth.uid()
  and (
    private.current_role() in ('ADMIN', 'AREA_MANAGER')
    or (private.current_role() = 'ZO' and uc_id in (select id from public.ucs where zone_id in (select private.assigned_zone_ids())))
    or (private.current_role() in ('SUPERVISOR', 'SURVEYOR') and uc_id in (select id from public.ucs where tehsil_id in (select private.own_tehsil_ids())))
  )
);

drop policy if exists reports_update on public.reports;
create policy reports_update on public.reports for update to authenticated
  using (
    private.current_role() in ('ADMIN', 'AREA_MANAGER')
    or (private.current_role() = 'ZO' and zone_id in (select private.assigned_zone_ids()))
    or (private.current_role() = 'SUPERVISOR' and tehsil_id in (select private.own_tehsil_ids()))
  )
  with check (
    private.current_role() in ('ADMIN', 'AREA_MANAGER')
    or (private.current_role() = 'ZO' and zone_id in (select private.assigned_zone_ids()))
    or (private.current_role() = 'SUPERVISOR' and tehsil_id in (select private.own_tehsil_ids()))
  );

drop policy if exists resolutions_insert on public.resolutions;
create policy resolutions_insert on public.resolutions for insert to authenticated with check (
  resolved_by = auth.uid()
  and exists (
    select 1 from public.reports r
    where r.id = report_id
      and (
        private.current_role() in ('ADMIN', 'AREA_MANAGER')
        or (private.current_role() = 'ZO' and r.zone_id in (select private.assigned_zone_ids()))
        or (private.current_role() in ('SUPERVISOR', 'RECTIFIER') and r.tehsil_id in (select private.own_tehsil_ids()))
      )
  )
);

-- ── Geofencing ───────────────────────────────────────────────────────────

-- A report's own GPS fix has to be a real, reasonably precise outdoor lock
-- — NOT VALID so it only binds future inserts/updates, not the handful of
-- reports already in the system from before this rule existed.
alter table public.reports
  add constraint reports_location_accuracy_bound
  check (location_accuracy is not null and location_accuracy <= 100) not valid;

-- Resolution must be filed from within 200m of the report's own recorded
-- location — the actual "no fake resolutions" guarantee, since this can't
-- be bypassed from the client the way a UI-only check could be. A report
-- with no stored location (pre-existing legacy rows) can't be distance
-- checked, so it's let through rather than becoming permanently unresolvable.
create or replace function public.resolutions_validate_proximity()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_report_lat double precision;
  v_report_lng double precision;
  v_distance_m double precision;
begin
  if new.latitude is null or new.longitude is null then
    raise exception 'A GPS location is required to resolve a report.';
  end if;

  select latitude, longitude into v_report_lat, v_report_lng
  from public.reports where id = new.report_id;

  if v_report_lat is null or v_report_lng is null then
    return new;
  end if;

  v_distance_m := 6371000 * acos(least(1.0, greatest(-1.0,
    sin(radians(new.latitude)) * sin(radians(v_report_lat))
    + cos(radians(new.latitude)) * cos(radians(v_report_lat)) * cos(radians(new.longitude - v_report_lng))
  )));

  if v_distance_m > 200 then
    raise exception 'You must be within 200m of the reported location to resolve it (currently ~%m away).', round(v_distance_m);
  end if;

  return new;
end;
$$;

drop trigger if exists resolutions_validate_proximity_trigger on public.resolutions;
create trigger resolutions_validate_proximity_trigger
before insert on public.resolutions
for each row execute function public.resolutions_validate_proximity();
