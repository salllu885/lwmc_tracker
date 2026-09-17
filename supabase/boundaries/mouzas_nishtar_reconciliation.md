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

**2 are unconfirmed possible matches** — flagged, not merged in:
- Patwari "**Keet**" vs. PULSE's "**Kaiyat**" (tagged Nishter)
- Patwari "**Thay Champ**" vs. PULSE's "**Tha Janib**" (tagged Nishter)

These may be the same place under very different transliteration, or two
different places — PULSE has no other name close to "Keet" or "Thay Champ"
anywhere in Lahore, so if they're not these two, they're simply undigitized.
`mouzas_nishtar.geojson` currently keeps "Kaiyat" and "Tha Janib" under their
PULSE names as-is.

**1 exists in PULSE only as an unusable fragment**: Patwari "**Attu Asal**"
matches "**Aato Asal**" in the parcel-level cadastral layer (3), but that
record is a single ~20m x 20m parcel, not a mouza-sized boundary — almost
certainly one digitized khasra out of many, not the whole mouza. Not added to
the map; would misrepresent the mouza's real extent.

**10 have no PULSE record at all**, checked via every method above:
Kamahan, Dulu Kalan, Bhallar, Mehdipura, Gajjumatta, Kahna Nou, Kahna Kohna,
Toor Waraich, Gulvera, Halloki.

## Bottom line

`mouzas_nishtar.geojson`'s 31 mouzas are everything PULSE has digitized for
Tehsil Nishtar — confirmed exhaustively, not a shallow single-layer read. The
Patwari list is the more complete and more authoritative record; PULSE is
simply missing boundary data for roughly a quarter of Nishtar's mouzas, most
of them concentrated in the Kamahan and Kahna revenue circles (the tehsil's
southern edge). Filling that gap would require a source PULSE doesn't have —
a fresh field survey/digitization, or another agency's cadastral data — not a
better query against PULSE.
