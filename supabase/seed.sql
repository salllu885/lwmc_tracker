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
