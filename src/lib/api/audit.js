import { supabase } from '../supabaseClient';

export async function listAuditLogs(reportId) {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*, user:profiles(id,full_name,username)')
    .eq('report_id', reportId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}
