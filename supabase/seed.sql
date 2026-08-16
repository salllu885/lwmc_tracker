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
