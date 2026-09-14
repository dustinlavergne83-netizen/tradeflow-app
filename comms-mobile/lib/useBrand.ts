/**
 * useBrand — returns the active company's brand colors, name, and feature
 * flags for the Comms app. Reads from CompanyContext so every screen stays
 * in sync. Falls back to DML/TradeFlow defaults if no company is loaded yet
 * (e.g. while signed out, on the sign-in screen).
 *
 * Usage:
 *   const brand = useBrand();
 *   <Text style={{ color: brand.primary }}>{brand.name} Comms</Text>
 */
import { useCompany } from "./CompanyContext";

const DML_DEFAULTS = {
  primary: "#0b3ea8",
  accent: "#fc6b04",
  name: "DML",
  appName: "DML Comms",
  logo_url: null as string | null,
};

export function useBrand() {
  const { company } = useCompany();

  const primary = company?.primary_color || DML_DEFAULTS.primary;
  const accent = company?.secondary_color || DML_DEFAULTS.accent;
  const name = company?.name || DML_DEFAULTS.name;

  return {
    primary,
    accent,
    name,
    appName: `${name} Comms`,
    logo_url: company?.logo_url || DML_DEFAULTS.logo_url,
  };
}

/**
 * useFeatures — per-company feature flags, stored in companies.settings
 * (JSONB). Everything defaults ON so existing companies (DML) are
 * unaffected until a flag is explicitly turned off for a company.
 *
 * Example (Supabase SQL):
 *   UPDATE companies
 *   SET settings = settings || '{"aiAssistant": false}'
 *   WHERE slug = 'dt-specialties';
 */
export function useFeatures() {
  const { company, loading } = useCompany();
  const s = company?.settings || {};

  return {
    // Surfaced so screens that gate rendering on these flags (e.g. the tab
    // bar) can wait for the real company row instead of acting on defaults.
    // Expo Router's <Tabs.Screen href={null}> hides a tab on first render and
    // does NOT re-register it once the flag later flips true — so rendering
    // tabs before company data resolves can permanently hide a tab for that
    // session (this is what caused the Email tab to vanish for DT accounts).
    loading,
    aiAssistant: s.aiAssistant !== false,
    dialpad: s.dialpad !== false,
    email: s.email !== false,
  };
}
