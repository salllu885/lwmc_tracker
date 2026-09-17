# Tehsil Nishtar mouzas: PULSE vs. the official Patwari list

The Patwari (revenue) record for Tehsil Nishtar, District Lahore lists **42 mouzas**
across three revenue circles (Kamahan, Kahna, Pandoki). PULSE's own GIS/data only
covers **31** of them as mapped boundaries in `mouzas_nishtar.geojson`. This file
documents how that gap was checked, so it isn't mistaken for an unchecked guess.

## Sources checked on PULSE (lis.pulse.gop.pk)

1. **`Admin__Boundaries` MapServer, layer 3 "Mouzas (Tentative)"** — the layer used
   to build `mouzas_nishtar.geojson`. Filtered by `TEHSIL='Nishter' AND
   DISTRICT='Lahore'`: **31 features**.
2. **`VendorMaps/Punjab_Cdastral_Maps` MapServer, layer 17 "Lahore"** — the
   parcel-level cadastral layer, which has its own independent `Tehsil`/`Mouza`
   fields. Distinct mouzas with `Tehsil LIKE '%Nisht%'`: **29** (mostly the same
   names, minor spelling differences, e.g. "Aato Asal" instead of "Attu Asal").
3. **PULSE's own cascading dropdown backend** (`/Admins/filterMauzas/{tehsilId}`,
   the same endpoint the site's own Division→District→Tehsil→Mauza picker calls) —
   queried directly, bypassing the UI. For Nishtar's tehsil id (**1005**) it
   returns **0 mauzas**. Checked against the pre-2019 tehsils that existed before
   Lahore's 2019 split (ids 4-8: Lahore Cantt/Model Town/Shalamar/City/Raiwind),
   the same endpoint returns a healthy 11-47 mauzas each — so the endpoint itself
   works, it's specifically the mauza-to-tehsil link for the *new* tehsils created
   in the 2019 split (Nishtar, Ravi, Wahga, Allama Iqbal, Saddar — ids 1004-1008)
   that was never populated. This is a real, confirmed gap in PULSE's backend
   data, not a query mistake.
4. **Live map, actual site UI** — loaded lis.pulse.gop.pk in a browser and drove
   the same Division/District/Tehsil pickers programmatically (this is what
   surfaced the `/Admins/filterMauzas` endpoint above); the rendered map draws
   from the same two GIS layers already queried directly in (1) and (2), so
   panning/zooming the live map cannot show mouzas beyond what's in those layers.
5. **Province-wide name search** — for every Patwari mouza name absent from (1)
   and (2), searched the "Mouzas (Tentative)" layer with no district/tehsil
   filter at all, trying substrings of the name. None turned up anywhere in
   Punjab under any spelling tried.

## Result

**30 of the 42** Patwari mouzas match a PULSE-mapped mouza directly (small
spelling differences only, e.g. "Jhulky" / "Jhalke", "Sedhar" / "Sidhar",
"Khund" / "Khand" — Punjabi place names are romanized inconsistently between
sources).

**2 were unconfirmed possible matches, now resolved** using a hand-drawn
Patwari sketch map the user supplied ("Map of Tehsil Nishtar District
Lahore", colour-coded by revenue circle):
- Patwari "**Keet**" = PULSE's "**Kaiyat**" (tagged Nishter)
- Patwari "**Thay Champ**" = PULSE's "**Tha Janib**" (tagged Nishter)

Resolved by georeferencing the sketch: read pixel positions for the 26 mouza
labels the sketch shares with `mouzas_nishtar.geojson`, fit a least-squares
affine transform (sketch pixel → WGS84 lon/lat) from those 26 points (RMS
residual ~835m over a ~24km-wide tehsil), then applied it to "Keet" and "Thay
Champ"'s sketch positions. The estimated point for "Keet" landed ~1010m from
"Kaiyat"'s real centroid, and "Thay Champ" landed ~350m from "Tha Janib"'s —
both within the transform's own error margin, i.e. consistent with being the
same place. `mouzas_nishtar.geojson` keeps PULSE's spelling as the primary
name and now records the Patwari name in each feature's `patwari_name`
property.

**1 exists in PULSE only as an unusable fragment, now corroborated**:
Patwari "**Attu Asal**" matches "**Aato Asal**" in the parcel-level cadastral
layer, but that record is a single ~20m x 20m parcel, not a mouza-sized
boundary. The same sketch-georeferencing check placed "Attu Asal" only ~480m
from that tiny parcel's location — so it's very likely a genuine but
barely-started digitization of the right mouza, not an unrelated sliver.
Still not added to the map as a boundary — a 20m parcel would misrepresent
the mouza's real extent — but this is corroborating evidence, not a
contradiction.

**10 have no PULSE record at all**, checked via every method above:
Kamahan, Dulu Kalan, Bhallar, Mehdipura, Gajjumatta, Kahna Nou, Kahna Kohna,
Toor Waraich, Gulvera, Halloki. The same sketch and transform gives an
**approximate centroid** for each — saved as `mouzas_nishtar_estimated.geojson`
(Point geometries, `status: "estimated"`). These are not boundaries and not
survey positions: they say "roughly here" (±1km-ish, judging by the
transform's residuals on the mouzas it could check itself), useful for
placing a marker or picking a rough neighbourhood, not for anything that
needs a real edge.

## Bottom line

`mouzas_nishtar.geojson`'s 31 mouzas are everything PULSE has digitized for
Tehsil Nishtar — confirmed exhaustively, not a shallow single-layer read. With
the Patwari sketch, 32 of the 42 are now identified with real PULSE boundaries
(31 mapped mouzas, two of them now known to carry an extra Patwari name) and
the remaining 10 have an approximate location instead of a boundary. Filling
that gap with a real boundary would still require a source PULSE doesn't
have — a fresh field survey/digitization, or another agency's cadastral data
— not a better query against PULSE. But the sketch got every one of the 42
onto the map in some form, which a PULSE-only query never could.
