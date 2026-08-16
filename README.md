# Field Issue Reporting & Rectification Management System

A role-based field issue reporting app (Admin / Surveyer / Supervisor / ZO /
Manager / GM / AC) over a Tehsil → Zone → UC hierarchy, per
`Field_Issue_Reporting_System_Requirements (1).md`. One Vite + React +
Tailwind + Capacitor codebase serves both the packaged Android APK and the
browser-based "web dashboard" — same login, same data, nav chrome just
switches between bottom tabs (phone width) and a sidebar (desktop width).

Backend is Supabase (Postgres + Auth + Storage + Row Level Security). Every
visibility rule (a Supervisor only sees their own UC's reports, etc.) is
enforced in the database via RLS policies, not just hidden in the UI — see
`supabase/migrations/0002_rls.sql`.

## What's already built

- `supabase/migrations/0001_init.sql` … `0004_storage.sql` — full schema,
  RLS policies, auto-assignment/audit-trail triggers, and the private photo
  storage bucket.
- `supabase/seed.sql` — dummy Tehsil/Zone/UC/issue-type data per the
  requirements doc §49, plus the bootstrap steps for the first Admin.
- `supabase/functions/admin-create-user` — the only path that can create new
  accounts (needs the service-role key, which never ships to the client).
- The full React app: login, role-based home/nav, new-issue submission with
  camera+GPS, pending/reports list with filters+search, report detail with
  before/after photos and the resolve flow, a Leaflet map (free, no API key),
  analytics with performance tables and CSV/Excel/PDF export, and an admin
  panel for Tehsils/Zones/UCs/Issue Types/Users/Assignments.
- `.github/workflows/build-apk.yml` — builds the debug APK entirely in
  GitHub's cloud (installs Node + Android SDK itself), reading the two
  Supabase values below from repo secrets.

None of this can actually authenticate or fetch data yet — it's wired to
`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`, which don't exist until a
real Supabase project does.

## Setup checklist (things only you can do)

1. **Create a free Supabase project** at https://supabase.com/dashboard
   (needs a Supabase account — sign up if you don't have one).
2. **Run the migrations.** In the Supabase dashboard's SQL Editor, run the
   four files in `supabase/migrations/` in order (0001 → 0004), then
   `supabase/seed.sql`.
3. **Create the first Admin** (bootstrap — see the comment at the bottom of
   `seed.sql` for the exact steps): add a user by hand in
   Authentication → Add User, then insert a matching `profiles` row with
   `role = 'ADMIN'`.
4. **Deploy the Edge Function.** With the [Supabase CLI](https://supabase.com/docs/guides/cli):
   ```
   supabase login
   supabase link --project-ref <your-project-ref>
   supabase functions deploy admin-create-user
   supabase secrets set SYNTHETIC_EMAIL_DOMAIN=lwmc.internal
   ```
   (`SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` are provided automatically to
   Edge Functions — nothing to set for those.)
5. **Create the `report-photos` storage bucket + policies** — already
   handled by `0004_storage.sql` in step 2, nothing extra to do here.
6. **Add two GitHub repo secrets** (Settings → Secrets and variables →
   Actions) so the CI build can bake them into the app:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   (found in Supabase dashboard → Project Settings → API)
7. **Push / re-run the Actions workflow** to get a build wired to the real
   backend, then log in as the Admin from step 3 and use Admin → Users +
   Admin → Assignments to create ZO-01 / Supervisor-01 / Surveyer-01 and
   assign them, per `seed.sql`.

Hand me the project URL + anon key (and ideally a Supabase access token) once
you've done steps 1–4, and I'll finish the rest — seed data, end-to-end test,
rebuild.

## Get the APK without installing anything locally

`.github/workflows/build-apk.yml` installs Node.js and the Android SDK in
the cloud, builds the app, and produces a downloadable debug APK — no local
Node.js, Android Studio, or SDK required.

1. Push to a GitHub repo (already done for this project).
2. Open the repo's **Actions** tab — the `Build Android APK` workflow runs
   automatically on push (or click **Run workflow** to trigger it manually).
3. When it finishes, open the run and download the
   `field-issue-tracker-debug-apk` artifact from **Artifacts**. Unzip it to
   get `app-debug.apk`.
4. Transfer the APK to an Android phone, enable "Install from unknown
   sources", and tap to install.

## Building locally instead (needs Android Studio)

```
npm install
npm run build
npx cap sync android
npx cap open android
```
Then in Android Studio: **Build → Build Bundle(s) / APK(s) → Build APK(s)**.

For wider distribution, sign the APK with a release key via Android Studio's
**Build → Generate Signed Bundle/APK**.

## Known scope trade-offs

- **Maps**: the embedded map uses Leaflet + OpenStreetMap (free, no API
  key). "Navigate"/"Open in Maps" links still open Google Maps directly —
  that's a plain URL, not the billed Maps JS API. Swapping the embedded map
  to Google Maps is a contained follow-up if you set up Google Cloud
  billing later.
- **Push notifications**: not implemented — `notifications` rows are
  written server-side so an in-app bell/list works, but nothing pings a
  phone yet.
- **Offline queueing**: not implemented — a submission needs connectivity
  at the moment of submit, per the requirements doc's own MVP1 scope note.
