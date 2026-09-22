/**
 * projectTypes — single source of truth for the "job type" list used
 * across ProjectDetail.jsx, ProjectSetup.jsx and ProjectsList.jsx.
 *
 * Previously this array was copy-pasted independently in all three
 * files and had drifted out of sync (ProjectsList's "Lighting Project"
 * entry was silently missing ot_bank_auto: true, so OT Bank wasn't
 * being flagged there even though the type name implied it would be).
 *
 * DEFAULT_PROJECT_TYPES is DML's electrical list. Per-company overrides
 * (e.g. DT Specialties' lawn/landscaping/etc. catalog) are read from
 * companies.settings.projectTypes via getProjectTypes(company) below —
 * absent means "use the default list", so no company loses its types
 * just by not having settings configured yet.
 */

export const DEFAULT_PROJECT_TYPES = [
  {
    value: "commercial-public",
    icon: "🏢",
    label: "Commercial Public",
    desc: "Government, schools, public works, municipalities",
    color: "#1d4ed8",
  },
  {
    value: "commercial-private",
    icon: "🏗️",
    label: "Commercial Private",
    desc: "Private businesses, retail, industrial, offices",
    color: "#7c3aed",
  },
  {
    value: "residential-contractor",
    icon: "👷",
    label: "Residential Contractor",
    desc: "Working through a general contractor on residential work",
    color: "#d97706",
  },
  {
    value: "residential-owner",
    icon: "🏡",
    label: "Residential Owner",
    desc: "Working directly with the homeowner",
    color: "#059669",
  },
  {
    value: "lighting-project",
    icon: "💡",
    label: "Lighting Project",
    desc: "Out-of-town lighting jobs — OT Bank auto-enabled (pay 40 hrs now, bonus on collection)",
    color: "#f59e0b",
    ot_bank_auto: true,
  },
];

/**
 * Returns the job-type list for a given company row (as loaded from
 * AuthContext / supabase `companies` table), falling back to
 * DEFAULT_PROJECT_TYPES when the company has no custom list configured.
 *
 * Usage:
 *   const { company } = useAuth();
 *   const PROJECT_TYPES = getProjectTypes(company);
 */
export function getProjectTypes(company) {
  const custom = company?.settings?.projectTypes;
  return Array.isArray(custom) && custom.length > 0 ? custom : DEFAULT_PROJECT_TYPES;
}

/**
 * True only for companies with a custom catalog configured (e.g. DT
 * Specialties). Used to gate the "single type per project, chosen up
 * front" flow — which DML depends on (type drives OT Bank auto-enable,
 * hides fields on the create form, picks a proposal template) — away
 * from companies where a project can carry multiple services picked
 * later at estimate time.
 *
 * DML and any company without settings.projectTypes always get false
 * here, so this never changes DML's behavior.
 */
export function hasCustomProjectTypes(company) {
  const custom = company?.settings?.projectTypes;
  return Array.isArray(custom) && custom.length > 0;
}
