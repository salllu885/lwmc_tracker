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
