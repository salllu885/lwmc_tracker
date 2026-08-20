import { supabase } from '../supabaseClient';

export async function listUsers({ role } = {}) {
  let q = supabase.from('profiles').select('*').order('full_name');
  if (role) q = q.eq('role', role);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export async function listAssignments({ userId } = {}) {
  let q = supabase
    .from('user_assignments')
    .select('*, user:profiles(id,full_name,username,role), tehsil:tehsils(id,name), zone:zones(id,name), uc:ucs(id,name)')
    .order('created_at', { ascending: false });
  if (userId) q = q.eq('user_id', userId);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export async function createAssignment(fields) {
  const { data, error } = await supabase.from('user_assignments').insert(fields).select().single();
  if (error) throw error;
  return data;
}

export async function endAssignment(id) {
  const { error } = await supabase
    .from('user_assignments')
    .update({ is_active: false, end_date: new Date().toISOString().slice(0, 10) })
    .eq('id', id);
  if (error) throw error;
}

export async function setUserActive(userId, isActive) {
  const { error } = await supabase.from('profiles').update({ is_active: isActive }).eq('id', userId);
  if (error) throw error;
}

// Account creation is the one thing regular RLS-scoped calls can't do
// (it needs the service-role key), so it goes through the admin-create-user
// Edge Function instead — see supabase/functions/admin-create-user.
export async function createUser({ username, fullName, phone, role, designation, password, assignment }) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error('Not authenticated');

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const res = await fetch(`${supabaseUrl}/functions/v1/admin-create-user`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ username, full_name: fullName, phone, role, designation, password, assignment }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || 'Failed to create user');
  return body;
}
