import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.warn(
    'VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set — the app will build but auth and data calls will fail until they are configured. See .env.example.'
  );
}

export const supabase = createClient(url ?? '', anonKey ?? '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export const EMAIL_DOMAIN = import.meta.env.VITE_SYNTHETIC_EMAIL_DOMAIN || 'lwmc.internal';

// Field users log in with a username, not an email — Supabase Auth is
// email/password, so usernames map deterministically to a synthetic email.
// See supabase/functions/admin-create-user for the account-creation side.
export function usernameToEmail(username) {
  return `${String(username).trim().toLowerCase()}@${EMAIL_DOMAIN}`;
}
