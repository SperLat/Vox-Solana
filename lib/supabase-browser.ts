import { createClient } from "@supabase/supabase-js";
import { createSupabaseFetch, normalizeSupabaseKey } from "@/lib/supabase-fetch";

export function getBrowserSupabase() {
  const url = normalizeSupabaseKey(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const anonKey = normalizeSupabaseKey(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  if (!url || !anonKey) {
    return null;
  }

  return createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false
    },
    global: {
      fetch: createSupabaseFetch(anonKey)
    }
  });
}
