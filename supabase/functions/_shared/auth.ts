// _shared/auth.ts
// ─────────────────────────────────────────────────────────────────────────────
// Shared super-admin check for TradeFlow edge functions (xbwgtxbgypzkvqusotra
// project). Mirrors the frontend definition in src/App.tsx / src/components/
// Layout.tsx (VITE_SUPER_ADMIN_EMAIL), so "who is the super admin" is defined
// once per side instead of drifting.
//
// Reads SUPER_ADMIN_EMAIL from Supabase Edge Function secrets. Falls back to
// dustin@tradeflowllc.com to match the frontend's hardcoded fallback.
// ─────────────────────────────────────────────────────────────────────────────

const SUPER_ADMIN_EMAIL = (Deno.env.get("SUPER_ADMIN_EMAIL") ?? "dustin@tradeflowllc.com").trim().toLowerCase();

export function isSuperAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === SUPER_ADMIN_EMAIL;
}
