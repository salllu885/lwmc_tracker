import { useState } from 'react';
import { serializeBoundary } from '../lib/boundary';

// Best-effort "fetch a public boundary" helper for the Tehsil/Zone/UC admin
// forms: Tehsils/Zones/UCs here are entered by the Admin, not drawn from a
// fixed government list (see 0010_org_boundaries.sql), so there's no name
// we can reliably match against an official shapefile. OpenStreetMap's
// Nominatim search is the closest public, no-API-key source of drawn
// administrative/place boundaries — coverage for Union Councils in Punjab
// is patchy, so this is offered as a shortcut, not the only way in: a
// found shape can still be hand-edited, and nothing found just means
// paste the GeoJSON manually (e.g. from https://lis.pulse.gop.pk/ or
// geojson.io).
export default function BoundaryLookupField({ defaultQuery, onFound }) {
  const [query, setQuery] = useState(defaultQuery || '');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');

  async function lookup() {
    const q = query.trim();
    if (!q) {
      setStatus('Enter a search term first.');
      return;
    }
    setLoading(true);
    setStatus('');
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&polygon_geojson=1&limit=5&q=${encodeURIComponent(q)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Lookup failed (HTTP ${res.status})`);
      const results = await res.json();
      const hit = results.find((r) => r.geojson && (r.geojson.type === 'Polygon' || r.geojson.type === 'MultiPolygon'));
      if (!hit) {
        setStatus('No boundary polygon found on OpenStreetMap for that search — try a more specific name, or paste GeoJSON manually.');
        return;
      }
      onFound(serializeBoundary(hit.geojson));
      setStatus(`Found: "${hit.display_name}" — review the boundary below before saving.`);
    } catch (e) {
      setStatus(e.message || 'Lookup failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-1.5 space-y-1.5">
      <div className="flex gap-1.5">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search OpenStreetMap, e.g. Iqbal Town, Lahore"
          className="flex-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
        />
        <button
          type="button"
          onClick={lookup}
          disabled={loading}
          className="shrink-0 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-700 disabled:opacity-50"
        >
          {loading ? 'Looking up…' : 'Look up on OSM'}
        </button>
      </div>
      {status && <p className="text-[11px] text-slate-500">{status}</p>}
    </div>
  );
}
