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
