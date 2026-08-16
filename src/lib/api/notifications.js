import { supabase } from '../supabaseClient';

export async function listNotifications(userId, { unreadOnly = false } = {}) {
  let q = supabase.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false });
  if (unreadOnly) q = q.eq('is_read', false);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export async function markNotificationRead(id) {
  const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id);
  if (error) throw error;
}

export async function countUnread(userId) {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);
  if (error) throw error;
  return count ?? 0;
}
