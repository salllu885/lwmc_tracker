import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.warn(
    'VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set — the app will build but auth and data calls will fail until they are configured. See .env.example.'
  );
}

// createClient() throws synchronously on an empty/invalid URL — with no env
// vars set that happened at module-load time, before React ever mounted, so
// the whole app was a blank white screen instead of the "calls fail later"
// degradation the warning above promises. A syntactically valid placeholder
// lets the client construct; real calls against it still fail (no such
// project), which is the actually-intended fallback.
export const supabase = createClient(url || 'https://placeholder.supabase.co', anonKey || 'placeholder-anon-key', {
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
