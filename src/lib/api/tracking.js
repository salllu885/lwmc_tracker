import { supabase } from '../supabaseClient';

export async function logLocationPing({ userId, lat, lng, accuracy }) {
  const { error } = await supabase.from('location_pings').insert({
    user_id: userId,
    latitude: lat,
    longitude: lng,
    accuracy: accuracy ?? null,
  });
  if (error) throw error;
}

// One row per user: their most recent ping in the last `withinMinutes`
// (default 30 — anyone quieter than that reads as off-duty/idle on the Live
// Tracking map). There's no DISTINCT ON in the supabase-js query builder, so
// this fetches recent pings ordered newest-first and keeps the first one
// seen per user client-side.
export async function listLatestPings({ withinMinutes = 30 } = {}) {
  const since = new Date(Date.now() - withinMinutes * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('location_pings')
    .select('user_id, latitude, longitude, accuracy, recorded_at, user:profiles(id,full_name,role,designation)')
    .gte('recorded_at', since)
    .order('recorded_at', { ascending: false });
  if (error) throw error;

  const latest = new Map();
  for (const ping of data || []) {
    if (!latest.has(ping.user_id)) latest.set(ping.user_id, ping);
  }
  return Array.from(latest.values());
}

export async function listAttendance({ dateFrom, dateTo } = {}) {
  let q = supabase.from('attendance_daily').select('user_id, activity_date, present').order('activity_date', { ascending: false });
  if (dateFrom) q = q.gte('activity_date', dateFrom);
  if (dateTo) q = q.lte('activity_date', dateTo);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export async function listDailyDistance({ dateFrom, dateTo } = {}) {
  let q = supabase.from('daily_distance_km').select('user_id, activity_date, distance_km').order('activity_date', { ascending: false });
  if (dateFrom) q = q.gte('activity_date', dateFrom);
  if (dateTo) q = q.lte('activity_date', dateTo);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}
