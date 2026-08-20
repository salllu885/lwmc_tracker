import { supabase } from '../supabaseClient';

export async function fetchReportsForAnalytics(filters = {}) {
  let q = supabase
    .from('reports')
    .select(
      'id,status,issue_type_id,uc_id,zone_id,tehsil_id,reported_by,assigned_supervisor_id,assigned_zo_id,created_at,resolution:resolutions(resolved_by,resolved_at)'
    );

  if (filters.tehsilId) q = q.eq('tehsil_id', filters.tehsilId);
  if (filters.zoneId) q = q.eq('zone_id', filters.zoneId);
  if (filters.ucId) q = q.eq('uc_id', filters.ucId);
  if (filters.issueTypeId) q = q.eq('issue_type_id', filters.issueTypeId);
  if (filters.status) q = q.eq('status', filters.status);
  if (filters.dateFrom) q = q.gte('created_at', filters.dateFrom);
  if (filters.dateTo) q = q.lte('created_at', filters.dateTo);

  const { data, error } = await q;
  if (error) throw error;
  return data;
}

// Two states only — "reported" is everything not yet CLOSED, regardless of
// which legacy status value a pre-simplification row happens to carry.
export function summarize(reports) {
  const total = reports.length;
  const closed = reports.filter((r) => r.status === 'CLOSED').length;
  const pending = total - closed;
  const pct = (n) => (total ? Math.round((n / total) * 1000) / 10 : 0);
  return {
    total,
    closed,
    pending,
    closureRate: pct(closed),
    pendingRate: pct(pending),
  };
}

// Shared by every "compare total/pending/closed" table in the requirements
// doc (§22/§24: by UC, by Zone, by Tehsil, Surveyer/Supervisor/ZO
// performance) — they all reduce to grouping reports by one foreign key.
export function groupCount(reports, key, lookup) {
  const counts = new Map();
  for (const r of reports) {
    const k = r[key];
    if (!k) continue;
    const entry = counts.get(k) || { key: k, total: 0, closed: 0 };
    entry.total += 1;
    if (r.status === 'CLOSED') entry.closed += 1;
    counts.set(k, entry);
  }
  return Array.from(counts.values())
    .map((e) => ({
      ...e,
      label: lookup ? lookup(e.key) : e.key,
      pending: e.total - e.closed,
      closureRate: e.total ? Math.round((e.closed / e.total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.total - a.total);
}
