-- 0010_org_boundaries: optional boundary polygon per Tehsil/Zone/UC, so the
-- Map view can draw an outline of each area (per the PULSE Land Information
-- System reference: https://lis.pulse.gop.pk/) the way it already draws
-- report markers.
--
-- Tehsils/Zones/UCs here are admin-entered rows, not a fixed government
-- list (see seed.sql's placeholder "Test Tehsil"/"Zone-01"/"UC-01"), so
-- there's no reliable way to auto-match them to an official shapefile by
-- name. Instead each row gets its own optional `boundary` column that the
-- Admin fills in per entity — by pasting GeoJSON, or via the "look up on
-- OpenStreetMap" helper in the admin form, which is a best-effort public
-- source and may not have every Union Council mapped. A geometry column
-- (not PostGIS) keeps this simple: it's rendered as-is by Leaflet's
-- <GeoJSON>, and no server-side spatial querying is needed.
--
-- Stored as a bare GeoJSON Polygon/MultiPolygon geometry (a Feature, if
-- pasted, is unwrapped to its geometry client-side before saving) — no
-- existing RLS change needed, since tehsils/zones/ucs are already
-- select-to-all-authenticated, write-to-ADMIN-only (0002_rls.sql).

alter table public.tehsils add column if not exists boundary jsonb;
alter table public.zones add column if not exists boundary jsonb;
alter table public.ucs add column if not exists boundary jsonb;
