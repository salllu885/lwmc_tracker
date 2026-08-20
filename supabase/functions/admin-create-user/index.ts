// User creation, gated by manage-scope — not Admin-only anymore.
//
// Field staff log in with a username, not an email, so accounts are given a
// synthetic email (<username>@<domain>) that only this function ever needs
// to know about. The service-role key that can call the Supabase Auth admin
// API lives only here (server-side env var) — it is never shipped to the
// client bundle. Every call re-checks the CALLER's own role/scope by
// reading `profiles`/`user_assignments` with the caller's own JWT, before
// touching anything with the privileged service-role client.
//
// Manage scope (who may create which role, and where):
//   ADMIN        anywhere in the district, any role
//   AREA_MANAGER only within their own assigned Tehsil/Town — which roles
//                they may create there depends on their `authority_level`
//                (see 0008_authority_levels.sql — GM LWMC/Town Manager/AC
//                are admin-editable rows, not hardcoded per role tier)
//   ZO           only within their own assigned Zone — same idea, via
//                their own authority level (default "Zone Officer")
//   everyone else (Supervisor/Surveyor/Rectifier) — no manage rights at
//                all, per "Supervisor can't add/remove, it's up to ZO"
// Only ADMIN may create another ADMIN or AREA_MANAGER account (district-
// level appointments — DC, CO MCL, GM LWMC, WASA, AC, TM, ...). A caller
// with no authority_id assigned yet (e.g. pre-migration accounts) falls
// back to MANAGER_CREATABLE_ROLES / ZO_CREATABLE_ROLES so nothing breaks
// before an admin assigns them one. The very first Admin still has to be
// created by hand in the Supabase dashboard, since there's no Admin yet to
// call this function — see supabase/seed.sql.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const EMAIL_DOMAIN = Deno.env.get('SYNTHETIC_EMAIL_DOMAIN') ?? 'lwmc.internal';

const ROLES = ['ADMIN', 'AREA_MANAGER', 'ZO', 'SUPERVISOR', 'SURVEYOR', 'RECTIFIER'];
// Fallback only — used when the caller has no authority_id assigned yet.
// The real, admin-editable source of truth is the authority_levels table.
const MANAGER_CREATABLE_ROLES = ['ZO', 'SUPERVISOR', 'SURVEYOR', 'RECTIFIER'];
const ZO_CREATABLE_ROLES = ['SUPERVISOR', 'SURVEYOR', 'RECTIFIER'];

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

type Assignment = { tehsil_id?: string; zone_id?: string; uc_id?: string };

// Walks a UC- or Zone-level assignment up to its owning Tehsil/Zone, same
// as private.resolve_tehsil_id()/resolve_zone_id() in the migration — a
// new Surveyor's assignment only ever carries a uc_id, not a tehsil_id, so
// the scope check has to resolve it rather than compare uc_id directly.
// deno-lint-ignore no-explicit-any
async function resolveTehsilId(client: any, assignment: Assignment): Promise<string | null> {
  if (assignment.tehsil_id) return assignment.tehsil_id;
  if (assignment.zone_id) {
    const { data } = await client.from('zones').select('tehsil_id').eq('id', assignment.zone_id).single();
    return data?.tehsil_id ?? null;
  }
  if (assignment.uc_id) {
    const { data } = await client.from('ucs').select('tehsil_id').eq('id', assignment.uc_id).single();
    return data?.tehsil_id ?? null;
  }
  return null;
}

// deno-lint-ignore no-explicit-any
async function resolveZoneId(client: any, assignment: Assignment): Promise<string | null> {
  if (assignment.zone_id) return assignment.zone_id;
  if (assignment.uc_id) {
    const { data } = await client.from('ucs').select('zone_id').eq('id', assignment.uc_id).single();
    return data?.zone_id ?? null;
  }
  return null;
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
    .select('id, role, is_active, authority_id')
    .eq('id', userData.user.id)
    .single();

  if (profileErr || !callerProfile || !callerProfile.is_active) {
    return json({ error: 'Only an active Admin, Area Manager, or ZO can create users' }, 403);
  }
  if (!['ADMIN', 'AREA_MANAGER', 'ZO'].includes(callerProfile.role)) {
    return json({ error: 'Only an active Admin, Area Manager, or ZO can create users' }, 403);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const { username, full_name, phone, role, designation, password, assignment, authority_id } = body as {
    username?: string;
    full_name?: string;
    phone?: string;
    role?: string;
    designation?: string;
    password?: string;
    assignment?: { tehsil_id?: string; zone_id?: string; uc_id?: string };
    authority_id?: string;
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

  // Scope check #1: which roles this caller is allowed to hand out at all —
  // driven by their authority_level row (admin-editable) when they have
  // one, falling back to the hardcoded default set otherwise.
  if (callerProfile.role === 'AREA_MANAGER' || callerProfile.role === 'ZO') {
    let creatableRoles = callerProfile.role === 'AREA_MANAGER' ? MANAGER_CREATABLE_ROLES : ZO_CREATABLE_ROLES;
    if (callerProfile.authority_id) {
      const { data: authRow } = await callerClient
        .from('authority_levels')
        .select('creatable_roles, is_active')
        .eq('id', callerProfile.authority_id)
        .single();
      if (authRow?.is_active && Array.isArray(authRow.creatable_roles)) {
        creatableRoles = authRow.creatable_roles;
      }
    }
    if (!creatableRoles.includes(role)) {
      return json({ error: `Your authority level can only create: ${creatableRoles.join(', ')}` }, 403);
    }
  }

  // If the caller is assigning the new hire an authority level, it must be
  // a currently-active level meant for that role tier — otherwise a typo'd
  // or stale id would silently grant/deny the wrong creatable-role set.
  if (authority_id) {
    const { data: newAuthRow, error: authErr } = await callerClient
      .from('authority_levels')
      .select('role_tier, is_active')
      .eq('id', authority_id)
      .single();
    if (authErr || !newAuthRow) return json({ error: 'Unknown authority level' }, 400);
    if (!newAuthRow.is_active) return json({ error: 'That authority level is inactive' }, 400);
    if (newAuthRow.role_tier !== role) {
      return json({ error: `That authority level is for ${newAuthRow.role_tier}, not ${role}` }, 400);
    }
  }

  // Scope check #2: IF the caller passed an assignment inline with
  // creation, it must fall inside the caller's own Tehsil/Town (Area
  // Manager) or Zone (ZO) — Admin is unrestricted. A ZO/Area Manager can
  // also create a user with no assignment yet and assign them afterward
  // via the Assignments tab, which is scope-checked by the
  // user_assignments_manage RLS policy instead. That second path is the
  // ONLY reason this check isn't unconditional: this function's own
  // assignment-insert below uses the service-role key and bypasses RLS
  // entirely, so any assignment passed HERE must be validated here.
  const hasAssignment = assignment && (assignment.tehsil_id || assignment.zone_id || assignment.uc_id);
  if (callerProfile.role !== 'ADMIN' && hasAssignment) {
    const resolved =
      callerProfile.role === 'AREA_MANAGER'
        ? await resolveTehsilId(callerClient, assignment)
        : await resolveZoneId(callerClient, assignment);

    if (!resolved) {
      return json({ error: 'Could not resolve the assignment to a Tehsil/Zone' }, 400);
    }

    const { data: callerAssignments, error: caErr } = await callerClient
      .from('user_assignments')
      .select('tehsil_id, zone_id, uc_id')
      .eq('user_id', callerProfile.id)
      .eq('is_active', true);
    if (caErr) return json({ error: caErr.message }, 400);

    const inScope =
      callerProfile.role === 'AREA_MANAGER'
        ? (callerAssignments ?? []).some((a) => a.tehsil_id === resolved)
        : (callerAssignments ?? []).some((a) => a.zone_id === resolved);

    if (!inScope) {
      return json({ error: 'That assignment is outside your own Tehsil/Town or Zone' }, 403);
    }
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
    designation: designation ?? null,
    authority_id: authority_id ?? null,
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
