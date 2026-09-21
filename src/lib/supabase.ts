import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Fail fast with a readable error instead of a cryptic "Failed to fetch" when
// the Vercel project for this deployment (e.g. dt-specialties, tradeflow) has
// a missing or stale Supabase env var. Without this guard, a bad/typo'd
// VITE_SUPABASE_URL silently produces net::ERR_NAME_NOT_RESOLVED at sign-in
// time with no indication of the real cause.
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Check this " +
      "deployment's environment variables in Vercel (Project Settings → " +
      "Environment Variables) and redeploy."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
