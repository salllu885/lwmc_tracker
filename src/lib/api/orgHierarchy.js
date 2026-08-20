import { supabase } from '../supabaseClient';

export async function listDistricts({ activeOnly = false } = {}) {
  let q = supabase.from('districts').select('*').order('name');
  if (activeOnly) q = q.eq('is_active', true);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export async function listTehsils({ districtId, activeOnly = false } = {}) {
  let q = supabase.from('tehsils').select('*').order('name');
  if (districtId) q = q.eq('district_id', districtId);
  if (activeOnly) q = q.eq('is_active', true);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export async function listZones({ tehsilId, activeOnly = false } = {}) {
  let q = supabase.from('zones').select('*').order('name');
  if (tehsilId) q = q.eq('tehsil_id', tehsilId);
  if (activeOnly) q = q.eq('is_active', true);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export async function listUcs({ zoneId, tehsilId, activeOnly = false } = {}) {
  let q = supabase.from('ucs').select('*').order('name');
  if (zoneId) q = q.eq('zone_id', zoneId);
  if (tehsilId) q = q.eq('tehsil_id', tehsilId);
  if (activeOnly) q = q.eq('is_active', true);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

// UCs a given user is currently assigned to — used to scope the "Select
// UC" dropdown on the New Issue form to what that Surveyer/Supervisor is
// actually permitted to file/handle reports for.
export async function listAssignedUcs(userId) {
  const { data, error } = await supabase
    .from('user_assignments')
    .select('uc:ucs(id,name,code,zone_id,tehsil_id)')
    .eq('user_id', userId)
    .eq('is_active', true)
    .not('uc_id', 'is', null);
  if (error) throw error;
  return (data || []).map((row) => row.uc).filter(Boolean);
}

export async function listIssueTypes({ activeOnly = false } = {}) {
  let q = supabase.from('issue_types').select('*').order('name');
  if (activeOnly) q = q.eq('is_active', true);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

// Tehsils/Zones/UCs/IssueTypes all follow the same admin CRUD shape
// (requirements doc §25), so the admin screens share these generic helpers
// instead of one bespoke create/update per entity.
export async function createEntity(table, fields) {
  const { data, error } = await supabase.from(table).insert(fields).select().single();
  if (error) throw error;
  return data;
}

export async function updateEntity(table, id, fields) {
  const { data, error } = await supabase.from(table).update(fields).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function setEntityActive(table, id, isActive) {
  return updateEntity(table, id, { is_active: isActive });
}
