// Admin-only user creation.
//
// Field staff log in with a username, not an email, so accounts are given a
// synthetic email (<username>@<domain>) that only this function ever needs
// to know about. The service-role key that can call the Supabase Auth admin
// API lives only here (server-side env var) — it is never shipped to the
// client bundle. Every call re-checks that the caller is an active Admin by
// reading `profiles` with the CALLER's own JWT, before touching anything
// with the privileged service-role client.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const EMAIL_DOMAIN = Deno.env.get('SYNTHETIC_EMAIL_DOMAIN') ?? 'lwmc.internal';

const ROLES = ['ADMIN', 'SURVEYER', 'SUPERVISOR', 'ZO', 'MANAGER', 'GM', 'AC'];

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Missing Authorization header' }, 401);

  // Scoped to the caller's own JWT — used only to find out who's calling.
  const callerClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userErr } = await callerClient.auth.getUser();
  if (userErr || !userData?.user) return json({ error: 'Invalid session' }, 401);

  const { data: callerProfile, error: profileErr } = await callerClient
    .from('profiles')
    .select('role, is_active')
    .eq('id', userData.user.id)
    .single();

  if (profileErr || !callerProfile || callerProfile.role !== 'ADMIN' || !callerProfile.is_active) {
    return json({ error: 'Only an active Admin can create users' }, 403);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const { username, full_name, phone, role, password, assignment } = body as {
    username?: string;
    full_name?: string;
    phone?: string;
    role?: string;
    password?: string;
    assignment?: { tehsil_id?: string; zone_id?: string; uc_id?: string };
  };

  if (!username || !full_name || !role || !password) {
    return json({ error: 'username, full_name, role and password are required' }, 400);
  }
  if (!ROLES.includes(role)) {
    return json({ error: `role must be one of ${ROLES.join(', ')}` }, 400);
  }
  if (String(password).length < 8) {
    return json({ error: 'password must be at least 8 characters' }, 400);
  }

  const normalizedUsername = String(username).trim().toLowerCase();
  const email = `${normalizedUsername}@${EMAIL_DOMAIN}`;

  // Privileged client — service-role key, only ever used inside this function.
  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username: normalizedUsername, full_name },
  });

  if (createErr || !created?.user) {
    return json({ error: createErr?.message ?? 'Failed to create auth user' }, 400);
  }

  const { error: insertProfileErr } = await adminClient.from('profiles').insert({
    id: created.user.id,
    full_name,
    username: normalizedUsername,
    phone: phone ?? null,
    role,
  });

  if (insertProfileErr) {
    // Don't leave an orphaned auth user with no matching profile behind.
    await adminClient.auth.admin.deleteUser(created.user.id);
    return json({ error: insertProfileErr.message }, 400);
  }

  if (assignment && (assignment.tehsil_id || assignment.zone_id || assignment.uc_id)) {
    const { error: assignErr } = await adminClient.from('user_assignments').insert({
      user_id: created.user.id,
      tehsil_id: assignment.tehsil_id ?? null,
      zone_id: assignment.zone_id ?? null,
      uc_id: assignment.uc_id ?? null,
    });
    if (assignErr) {
      return json(
        { warning: `User created but assignment failed: ${assignErr.message}`, user_id: created.user.id },
        200,
      );
    }
  }

  return json({ user_id: created.user.id, username: normalizedUsername, email }, 200);
});
