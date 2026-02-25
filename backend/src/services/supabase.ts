import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_URL et SUPABASE_SERVICE_KEY sont requis dans .env');
  process.exit(1);
}

/**
 * Client avec la clé service_role — accès complet, bypass RLS.
 * Utilisé côté serveur uniquement. Ne jamais exposer au client.
 */
export const supabase: SupabaseClient = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

/**
 * Crée un client Supabase authentifié avec le token JWT de l'utilisateur.
 * Respecte les politiques RLS.
 */
export function supabaseForUser(token: string): SupabaseClient {
  return createClient(
    SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    }
  );
}
