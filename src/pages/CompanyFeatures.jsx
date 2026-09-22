import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { notify } from "../lib/notify";

// ── Feature flags — read by src/lib/useFeatures.js (web) and
// comms-mobile/lib/useBrand.ts useFeatures() (mobile). Stored per-company
// in companies.settings (JSONB). Absent key = ON, so unchecking here writes
// an explicit `false` and leaves everything else untouched.
const FEATURE_FLAGS = [
  { key: "takeoff", label: "Plans & Takeoffs", hint: "Web — Project Detail page" },
  { key: "accounting", label: "Accounting", hint: "Web — not yet gated to a specific page" },
  { key: "aiAssistant", label: "AI Assistant", hint: "Comms app — AI tab" },
  { key: "dialpad", label: "Dial Pad", hint: "Comms app — Dial Pad tab" },
  { key: "email", label: "Email", hint: "Comms app — Email tab" },
  { key: "generators", label: "Generators", hint: "Web — sidebar, /generators, generator invoices & service contracts" },
];

const BRAND = {
  primary: "#0b3ea8",
  bg: "#f3f4f6",
  card: "#ffffff",
};

export default function CompanyFeatures() {
  const { employee } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState([]);
  // Per-company draft state, keyed by company id, so editing one card
  // never touches another company's settings until its own Save is clicked.
  const [drafts, setDrafts] = useState({});
  const [savingId, setSavingId] = useState(null);

  // Guard: only super admins for THIS site's database can access this page.
  useEffect(() => {
    if (employee && !employee.is_super_admin) {
      navigate("/dashboard");
    }
  }, [employee, navigate]);

  useEffect(() => {
    loadCompanies();
  }, []);

  async function loadCompanies() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("companies")
        .select("id, name, slug, primary_color, settings")
        .order("name");

      if (error) throw error;

      setCompanies(data || []);
      const initialDrafts = {};
      for (const c of data || []) {
        initialDrafts[c.id] = { ...(c.settings || {}) };
      }
      setDrafts(initialDrafts);
    } catch (err) {
      notify(`❌ Error loading companies: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  function toggleFlag(companyId, key, checked) {
    setDrafts((prev) => ({
      ...prev,
      [companyId]: { ...prev[companyId], [key]: checked },
    }));
  }

  async function saveCompany(company) {
    setSavingId(company.id);
    try {
      const { error } = await supabase
        .from("companies")
        .update({ settings: drafts[company.id], updated_at: new Date().toISOString() })
        .eq("id", company.id);

      if (error) throw error;

      notify(`✅ ${company.name} features saved!`);
      loadCompanies();
    } catch (err) {
      notify(`❌ Error: ${err.message}`);
    } finally {
      setSavingId(null);
    }
  }

  if (employee && !employee.is_super_admin) {
    return null;
  }

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 900, color: BRAND.primary, marginBottom: 4 }}>
        🎛️ Company Features
      </h1>
      <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 24 }}>
        Turn features on/off per company. Each company below is saved independently —
        changing one never affects another. Mobile app users must sign out and back in
        to see changes.
      </p>

      {loading ? (
        <p style={{ color: "#6b7280" }}>Loading…</p>
      ) : companies.length === 0 ? (
        <p style={{ color: "#6b7280" }}>No companies found in this database.</p>
      ) : (
        companies.map((company) => (
          <div
            key={company.id}
            style={{
              background: BRAND.card,
              borderRadius: 12,
              border: `2px solid ${company.primary_color || "#e5e7eb"}`,
              padding: 20,
              marginBottom: 20,
            }}
          >
            <h2
              style={{
                fontSize: 18,
                fontWeight: 800,
                color: company.primary_color || "#111",
                marginTop: 0,
                marginBottom: 12,
              }}
            >
              {company.name}
            </h2>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
              {FEATURE_FLAGS.map((f) => (
                <label
                  key={f.key}
                  style={{ display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer" }}
                  title={f.hint}
                >
                  <input
                    type="checkbox"
                    checked={drafts[company.id]?.[f.key] !== false}
                    onChange={(e) => toggleFlag(company.id, f.key, e.target.checked)}
                    style={{ marginTop: 3 }}
                  />
                  <span>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{f.label}</span>
                    <br />
                    <span style={{ fontSize: 11, color: "#9ca3af" }}>{f.hint}</span>
                  </span>
                </label>
              ))}
            </div>

            <button
              onClick={() => saveCompany(company)}
              disabled={savingId === company.id}
              style={{
                background: company.primary_color || BRAND.primary,
                color: "#fff",
                border: "none",
                padding: "10px 20px",
                borderRadius: 8,
                fontWeight: 700,
                cursor: "pointer",
                opacity: savingId === company.id ? 0.6 : 1,
              }}
            >
              {savingId === company.id ? "Saving…" : `💾 Save ${company.name}`}
            </button>
          </div>
        ))
      )}
    </div>
  );
}
