/**
 * useBrand — returns the active company's brand colors and name.
 *
 * Reads from AuthContext so all components stay in sync.
 * Falls back to DML/TradeFlow defaults if no company is loaded yet.
 */
import { useAuth } from "../contexts/AuthContext";

const DML_DEFAULTS = {
  bg: "#0b3ea8",
  accent: "#fc6b04",
  name: "TradeFlow",
  tagline: "Built for the Trades",
  logo_url: null,
};

export function useBrand() {
  const { company } = useAuth();

  const accent = company?.secondary_color || DML_DEFAULTS.accent;

  return {
    bg:       company?.primary_color || DML_DEFAULTS.bg,
    accent,
    primary:  accent,   // alias — many pages still use BRAND.primary
    text:     accent,   // alias — DesktopHeader used BRAND.text
    name:     company?.name || DML_DEFAULTS.name,
    tagline:  DML_DEFAULTS.tagline,
    logo_url: company?.logo_url || DML_DEFAULTS.logo_url,
  };
}
