-- Amendment D: report submission must carry a real GPS fix — manual address
-- alone is no longer an acceptable substitute. NOT VALID so pre-existing rows
-- (created before this rule existed) aren't retroactively broken; the check
-- still applies to every INSERT/UPDATE going forward.
alter table public.reports
  add constraint reports_location_required
  check (latitude is not null and longitude is not null) not valid;
