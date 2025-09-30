import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/types/supabase.generated"

// Server-side admin client getter (must only be used on the server)
export function getSupabaseAdmin() {
  const supabaseUrl = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) as string | undefined
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string | undefined

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase admin env: SUPABASE_SERVICE_ROLE_KEY and SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL"
    )
  }

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}
