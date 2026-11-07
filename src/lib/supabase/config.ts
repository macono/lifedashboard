/**
 * Supabase settings come from environment variables (see .env.example).
 * The publishable (anon) key is designed to be public; Row Level Security protects
 * the data. Never put the secret / service_role key in a NEXT_PUBLIC_ variable.
 */
export interface SupabaseConfig {
  url: string;
  publishableKey: string;
}

export function getSupabaseConfig(): SupabaseConfig | null {
  // Written out in full so Next.js can inline them into the browser bundle.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !publishableKey) return null;
  return { url, publishableKey };
}
