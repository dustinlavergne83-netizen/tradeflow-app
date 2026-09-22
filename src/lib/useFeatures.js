/**
 * useFeatures — per-company feature flags, read from companies.settings
 * (JSONB). Same convention as comms-mobile/lib/useBrand.ts and the
 * "isFullAccess" pattern already used in timeclock-mobile.
 *
 * Every flag defaults to ON (true) when absent, so a company that
 * hasn't been configured yet (or an older row with no settings) never
 * silently loses a feature.
 *
 * Usage:
 *   const features = useFeatures();
 *   {features.takeoff && <TakeoffButton />}
 *
 * To turn a feature off for one company, run in Supabase SQL editor:
 *   UPDATE companies
 *   SET settings = settings || '{"takeoff": false}'
 *   WHERE slug = 'dt-specialties';
 *
 * See src/ENABLE_FEATURE_FLAGS.sql for the initial seed values.
 */
import { useAuth } from "../contexts/AuthContext";

export function useFeatures() {
  const { company } = useAuth();
  const s = company?.settings || {};

  return {
    // Coarse legacy tier flag (also read by timeclock-mobile) — kept
    // for backward compatibility with existing "full vs basic" checks.
    isFullAccess: s.tier === "full",

    // Per-feature flags
    takeoff: s.takeoff !== false,
    accounting: s.accounting !== false,
    aiAssistant: s.aiAssistant !== false,
    dialpad: s.dialpad !== false,
    email: s.email !== false,
    generators: s.generators !== false,
  };
}
