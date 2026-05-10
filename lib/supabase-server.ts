import { createClient } from "@supabase/supabase-js";
import { createSupabaseFetch, normalizeSupabaseKey } from "@/lib/supabase-fetch";

export function getServerSupabase() {
  const url = normalizeSupabaseKey(process.env.SUPABASE_SERVER_URL || process.env.NEXT_PUBLIC_SUPABASE_URL);
  const serviceKey = normalizeSupabaseKey(process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (!url || !serviceKey) {
    return null;
  }

  return createClient(url, serviceKey, {
    auth: {
      persistSession: false
    },
    global: {
      fetch: createSupabaseFetch(serviceKey)
    }
  });
}
