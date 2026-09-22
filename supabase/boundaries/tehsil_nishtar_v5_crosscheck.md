# Tehsil Nishtar boundary: cross-check against an independent screen-trace

A second, independent reconstruction of the Tehsil Nishtar boundary ("v5") was
produced separately by screen-recording the PULSE portal and matching cursor
position to its Lat/Lng readout (see the developer's own `README.txt`, included
below). This file records the comparison against `tehsil_nishtar.geojson`,
which was pulled directly from PULSE's backing ArcGIS REST service (the
`Tehsils` layer of `Admin__Boundaries` MapServer) on 2026-09-17 — the
government GIS system's own stored polygon, not a visual approximation of it.

## Result: `tehsil_nishtar.geojson` is confirmed, not superseded

| | `tehsil_nishtar.geojson` (ours) | v5 (screen-trace) |
|---|---|---|
| Source | Direct ArcGIS REST query, PULSE's own database | Cursor tracing against PULSE's rendered map, from video |
| Vertices | 2,858 | 509 |
| Area | 238.0 km² | 231.8 km² |
| Perimeter | 108.5 km | 100.8 km |
| Geometry | Valid (no self-intersections) | Had a self-intersection (auto-repaired for comparison) |
| Stated accuracy | Native precision of the source database | ±15–30 m (zoomed sections), ±50–100 m (2 overview-only sections) |

**Overlap: 96.3% IoU.** The two independently-produced boundaries agree almost
exactly along ~95% of the perimeter — real cross-validation that
`tehsil_nishtar.geojson` is correct, not just internally consistent.

![Boundary comparison](./tehsil_nishtar_v5_crosscheck.png)

The one place they diverge (screenshot below) is the southwest stretch from
Asal Suleman to Sadhoki — which v5's own README marks as its weakest section
("overview only, ±50–100 m", not a zoomed trace like the rest). Everywhere v5
traced at its higher-confidence zoom level, it lines up with `tehsil_nishtar.geojson`
almost exactly. The area gap (238.0 vs 231.8 km², ~2.6%) is fully explained by
that one under-sampled section plus v5's much coarser vertex count (509 vs
2,858) cutting corners on tight wiggles — an expected side effect of manual
tracing at lower resolution, not a sign either boundary is wrong elsewhere.

Sanity checks from v5's own README (Kahna/Gajju Matta should be inside;
Model Town/DHA Phase 6 should be outside) hold for both boundaries.

## Conclusion

`tehsil_nishtar.geojson` remains the file to build on. It was already sourced
from the authoritative system, not reconstructed from it — v5's own README
says as much ("verify against an authoritative government GIS layer"), and
that's exactly what this cross-check did. No changes made to the boundary file
itself as a result of this comparison.

## Source package

The v5 files (`tehsil_nishter_refined_boundary_v5.geojson/.kml`,
`nishtar_boundary_points.csv`, developer package) are not committed here —
they were a one-off comparison input, not a repo artifact, and superseding
data means they're not needed going forward.
