import { supabase } from '../supabaseClient';

// PostgREST needs the explicit constraint name when embedding a table that
// `reports` references more than once (profiles, via reported_by /
// assigned_supervisor_id / assigned_zo_id) — these match Postgres's default
// `<table>_<column>_fkey` naming from the 0001_init.sql migration.
const REPORT_SELECT = `
  *,
  issue_type:issue_types(id,name,color),
  uc:ucs(id,name,code),
  zone:zones(id,name),
  tehsil:tehsils(id,name),
  reporter:profiles!reports_reported_by_fkey(id,full_name,username),
  supervisor:profiles!reports_assigned_supervisor_id_fkey(id,full_name,username),
  zo:profiles!reports_assigned_zo_id_fkey(id,full_name,username)
`;

export async function listReports(filters = {}) {
  let q = supabase.from('reports').select(REPORT_SELECT).order('created_at', { ascending: false });

  if (filters.status) q = q.eq('status', filters.status);
  if (filters.tehsilId) q = q.eq('tehsil_id', filters.tehsilId);
  if (filters.zoneId) q = q.eq('zone_id', filters.zoneId);
  if (filters.ucId) q = q.eq('uc_id', filters.ucId);
  if (filters.issueTypeId) q = q.eq('issue_type_id', filters.issueTypeId);
  if (filters.reportedBy) q = q.eq('reported_by', filters.reportedBy);
  if (filters.assignedSupervisorId) q = q.eq('assigned_supervisor_id', filters.assignedSupervisorId);
  if (filters.assignedZoId) q = q.eq('assigned_zo_id', filters.assignedZoId);
  if (filters.dateFrom) q = q.gte('created_at', filters.dateFrom);
  if (filters.dateTo) q = q.lte('created_at', filters.dateTo);
  if (filters.search) {
    const term = filters.search.replace(/[%,]/g, '');
    q = q.or(`report_number.ilike.%${term}%,address.ilike.%${term}%`);
  }

  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export async function getReport(id) {
  const { data, error } = await supabase.from('reports').select(REPORT_SELECT).eq('id', id).single();
  if (error) throw error;

  const [{ data: images, error: imgErr }, { data: resolution, error: resErr }] = await Promise.all([
    supabase.from('report_images').select('*').eq('report_id', id),
    supabase.from('resolutions').select('*').eq('report_id', id).maybeSingle(),
  ]);
  if (imgErr) throw imgErr;
  if (resErr) throw resErr;

  return { ...data, images: images ?? [], resolution: resolution ?? null };
}

// Bulk fetch for exports (one query for many reports' photos/resolutions,
// instead of N+1 getReport() calls) — grouped by report_id client-side.
export async function listReportImages(reportIds) {
  if (!reportIds.length) return [];
  const { data, error } = await supabase.from('report_images').select('*').in('report_id', reportIds);
  if (error) throw error;
  return data;
}

export async function listResolutions(reportIds) {
  if (!reportIds.length) return [];
  const { data, error } = await supabase
    .from('resolutions')
    .select('*, resolver:profiles!resolutions_resolved_by_fkey(id,full_name)')
    .in('report_id', reportIds);
  if (error) throw error;
  return data;
}

export async function uploadReportPhoto(reportId, kind, dataUrl) {
  const blob = await (await fetch(dataUrl)).blob();
  const path = `${reportId}/${kind}.jpg`;
  const { error } = await supabase.storage.from('report-photos').upload(path, blob, {
    contentType: 'image/jpeg',
    upsert: true,
  });
  if (error) throw error;
  return path;
}

// The report-photos bucket is private, so a viewable link always has to be
// a short-lived signed URL — there is no plain public URL.
export async function getReportPhotoSignedUrl(path, expiresIn = 3600) {
  if (!path) return null;
  const { data, error } = await supabase.storage.from('report-photos').createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}

export async function createReport({ ucId, issueTypeId, address, description, lat, lng, accuracy, reportedBy, photoDataUrl }) {
  const { data: report, error } = await supabase
    .from('reports')
    .insert({
      uc_id: ucId,
      issue_type_id: issueTypeId,
      address,
      description,
      latitude: lat,
      longitude: lng,
      location_accuracy: accuracy,
      reported_by: reportedBy,
    })
    .select(REPORT_SELECT)
    .single();
  if (error) throw error;

  if (photoDataUrl) {
    const path = await uploadReportPhoto(report.id, 'before', photoDataUrl);
    const { error: imgErr } = await supabase.from('report_images').insert({
      report_id: report.id,
      image_type: 'BEFORE',
      file_path: path,
      uploaded_by: reportedBy,
      latitude: lat,
      longitude: lng,
      location_accuracy: accuracy,
    });
    if (imgErr) throw imgErr;
  }

  return report;
}

export async function startResolving(reportId) {
  const { error } = await supabase.from('reports').update({ status: 'IN_PROGRESS' }).eq('id', reportId);
  if (error) throw error;
}

// Filing the resolution row also flips the report to CLOSED — see the
// resolutions_after_insert trigger in 0003_triggers.sql.
export async function resolveReport(reportId, { resolvedBy, note, lat, lng, accuracy, photoDataUrl }) {
  if (photoDataUrl) {
    const path = await uploadReportPhoto(reportId, 'resolution', photoDataUrl);
    const { error: imgErr } = await supabase.from('report_images').insert({
      report_id: reportId,
      image_type: 'RESOLUTION',
      file_path: path,
      uploaded_by: resolvedBy,
      latitude: lat,
      longitude: lng,
      location_accuracy: accuracy,
    });
    if (imgErr) throw imgErr;
  }

  const { error } = await supabase.from('resolutions').insert({
    report_id: reportId,
    resolved_by: resolvedBy,
    resolution_note: note,
    latitude: lat,
    longitude: lng,
    location_accuracy: accuracy,
  });
  if (error) throw error;
}
