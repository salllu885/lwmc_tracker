// Shared GeoJSON boundary helpers for the Tehsil/Zone/UC admin forms and
// the Map view — kept in one place so "what counts as a valid boundary"
// can't drift between where it's saved and where it's drawn.

export function serializeBoundary(value) {
  return value ? JSON.stringify(value, null, 2) : '';
}

// Accepts a bare Polygon/MultiPolygon geometry, or a Feature wrapping one
// (what a copy-paste from geojson.io or an OSM lookup usually looks like),
// and normalizes to just the geometry — that's all <GeoJSON> needs to draw
// it, and it keeps the stored shape consistent regardless of source.
export function parseBoundary(text) {
  const trimmed = (text || '').trim();
  if (!trimmed) return null;

  let value;
  try {
    value = JSON.parse(trimmed);
  } catch {
    throw new Error('must be valid GeoJSON (valid JSON)');
  }

  const geometry = value?.type === 'Feature' ? value.geometry : value;
  if (!geometry || !['Polygon', 'MultiPolygon'].includes(geometry.type)) {
    throw new Error('must be a GeoJSON Polygon or MultiPolygon (or a Feature wrapping one)');
  }
  return geometry;
}
