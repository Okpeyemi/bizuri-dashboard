import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/types/supabase.generated"

// Client for browser-side usage (uses anon key)
// Only use this in Client Components or on the browser.
export const supabaseClient = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  }
)
