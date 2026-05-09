import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";

// ── Onboarding default form ──────────────────────────────────────────────────
const defaultOnboardForm = {
  company_name: "",
  company_slug: "",
  primary_color: "#0b3ea8",
  secondary_color: "#fc6b04",
  contact_phone: "",
  subscription_tier: "basic",
  admin_first_name: "",
  admin_last_name: "",
  admin_email: "",
  admin_password: "",
};

const BRAND = {
  primary: "#0b3ea8",
  accent: "#fc6b04",
  success: "#16a34a",
  warning: "#f59e0b",
  danger: "#dc2626",
  bg: "#f3f4f6",
  card: "#ffffff",
};

export default function SuperAdmin() {
  const { employee } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState([]);
  const [stats, setStats] = useState({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [showOnboardForm, setShowOnboardForm] = useState(false);
  const [onboardForm, setOnboardForm] = useState(defaultOnboardForm);
  const [onboarding, setOnboarding] = useState(false);
  const [onboardResult, setOnboardResult] = useState(null);
  const [editingCompany, setEditingCompany] = useState(null);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    primary_color: "#0b3ea8",
    secondary_color: "#fc6b04",
    contact_email: "",
    contact_phone: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    website: "",
    subscription_tier: "basic",
    subscription_status: "active",
    max_employees: 50,
  });

  // Guard: only super admins
  useEffect(() => {
    if (employee && !employee.is_super_admin) {
      navigate("/dashboard");
    }
  }, [employee, navigate]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      // Load all companies (super admin bypasses RLS via service role, 
      // but since we're using anon key, we need a workaround)
      // We'll use a direct query approach
      const { data: companiesData, error: compError } = await supabase
        .from("companies")
        .select("*")
        .order("created_at", { ascending: true });

      if (compError) throw compError;

      // Load stats for each company
      const statsMap = {};
      for (const company of companiesData || []) {
        const [empRes, shiftRes, activeShiftRes] = await Promise.all([
          supabase
            .from("employees")
            .select("id", { count: "exact", head: true })
            .eq("company_id", company.id),
          supabase
            .from("shifts")
            .select("id", { count: "exact", head: true })
            .eq("company_id", company.id),
          supabase
            .from("shifts")
            .select("id", { count: "exact", head: true })
            .eq("company_id", company.id)
            .is("clock_out", null),
        ]);

        statsMap[company.id] = {
          employees: empRes.count || 0,
          totalShifts: shiftRes.count || 0,
          activeShifts: activeShiftRes.count || 0,
        };
      }

      setCompanies(companiesData || []);
      setStats(statsMap);
    } catch (err) {
      console.error("Error loading super admin data:", err);
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setForm({
      name: "",
      slug: "",
      primary_color: "#0b3ea8",
      secondary_color: "#fc6b04",
      contact_email: "",
      contact_phone: "",
      address: "",
      city: "",
      state: "",
      zip: "",
      website: "",
      subscription_tier: "basic",
      subscription_status: "active",
      max_employees: 50,
    });
  }

  async function handleAddCompany(e) {
    e.preventDefault();
    try {
      const slug = form.slug || form.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      
      const { data, error } = await supabase
        .from("companies")
        .insert({
          ...form,
          slug,
          max_employees: parseInt(form.max_employees) || 50,
        })
        .select()
        .single();

      if (error) throw error;

      alert(`✅ Company "${form.name}" created successfully!`);
      resetForm();
      setShowAddForm(false);
      loadData();
    } catch (err) {
      alert(`❌ Error: ${err.message}`);
    }
  }

  async function handleUpdateCompany(e) {
    e.preventDefault();
    try {
      const { error } = await supabase
        .from("companies")
        .update({
          name: form.name,
          slug: form.slug,
          primary_color: form.primary_color,
          secondary_color: form.secondary_color,
          contact_email: form.contact_email,
          contact_phone: form.contact_phone,
          address: form.address,
          city: form.city,
          state: form.state,
          zip: form.zip,
          website: form.website,
          subscription_tier: form.subscription_tier,
          subscription_status: form.subscription_status,
          max_employees: parseInt(form.max_employees) || 50,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingCompany.id);

      if (error) throw error;

      alert(`✅ Company "${form.name}" updated!`);
      setEditingCompany(null);
      resetForm();
      loadData();
    } catch (err) {
      alert(`❌ Error: ${err.message}`);
    }
  }

  // ── Auto-generate slug from company name ──────────────────────────────────
  function handleOnboardNameChange(name) {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    setOnboardForm((f) => ({ ...f, company_name: name, company_slug: slug }));
  }

  // ── Call the create-company Edge Function ─────────────────────────────────
  async function handleOnboard(e) {
    e.preventDefault();
    setOnboarding(true);
    setOnboardResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-company`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session?.access_token}`,
            "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            company_name: onboardForm.company_name,
            company_slug: onboardForm.company_slug,
            primary_color: onboardForm.primary_color,
            secondary_color: onboardForm.secondary_color,
            contact_phone: onboardForm.contact_phone,
            subscription_tier: onboardForm.subscription_tier,
            admin_first_name: onboardForm.admin_first_name,
            admin_last_name: onboardForm.admin_last_name,
            admin_email: onboardForm.admin_email,
            admin_password: onboardForm.admin_password,
          }),
        }
      );
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || "Onboarding failed");
      setOnboardResult({ success: true, data: json });
      setOnboardForm(defaultOnboardForm);
      loadData();
    } catch (err) {
      setOnboardResult({ success: false, error: err.message });
    } finally {
      setOnboarding(false);
    }
  }

  async function handleToggleStatus(company) {
    const newStatus = company.subscription_status === "active" ? "suspended" : "active";
    const confirm = window.confirm(
      `${newStatus === "suspended" ? "⚠️ Suspend" : "✅ Activate"} "${company.name}"?`
    );
    if (!confirm) return;

    try {
      const { error } = await supabase
        .from("companies")
        .update({ subscription_status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", company.id);

      if (error) throw error;
      loadData();
    } catch (err) {
      alert(`❌ Error: ${err.message}`);
    }
  }

  function startEdit(company) {
    setEditingCompany(company);
    setForm({
      name: company.name || "",
      slug: company.slug || "",
      primary_color: company.primary_color || "#0b3ea8",
      secondary_color: company.secondary_color || "#fc6b04",
      contact_email: company.contact_email || "",
      contact_phone: company.contact_phone || "",
      address: company.address || "",
      city: company.city || "",
      state: company.state || "",
      zip: company.zip || "",
      website: company.website || "",
      subscription_tier: company.subscription_tier || "basic",
      subscription_status: company.subscription_status || "active",
      max_employees: company.max_employees || 50,
    });
    setShowAddForm(false);
  }

  const statusBadge = (status) => {
    const colors = {
      active: { bg: "#dcfce7", color: "#166534" },
      trial: { bg: "#fef3c7", color: "#92400e" },
      suspended: { bg: "#fee2e2", color: "#991b1b" },
      cancelled: { bg: "#f3f4f6", color: "#6b7280" },
    };
    const c = colors[status] || colors.active;
    return (
      <span
        style={{
          background: c.bg,
          color: c.color,
          padding: "4px 10px",
          borderRadius: 6,
          fontSize: 12,
          fontWeight: 700,
          textTransform: "uppercase",
        }}
      >
        {status}
      </span>
    );
  };

  const tierBadge = (tier) => {
    const colors = {
      basic: { bg: "#e0e7ff", color: "#3730a3" },
      pro: { bg: "#fef3c7", color: "#92400e" },
      enterprise: { bg: "#f3e8ff", color: "#6b21a8" },
    };
    const c = colors[tier] || colors.basic;
    return (
      <span
        style={{
          background: c.bg,
          color: c.color,
          padding: "4px 10px",
          borderRadius: 6,
          fontSize: 12,
          fontWeight: 700,
          textTransform: "uppercase",
        }}
      >
        {tier}
      </span>
    );
  };

  if (!employee?.is_super_admin) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <h2>🔒 Access Denied</h2>
        <p>You don't have super admin access.</p>
      </div>
    );
  }

  // ── Company Form (Add or Edit) ──────────────────────────────────────────
  const renderForm = (isEdit) => (
    <form
      onSubmit={isEdit ? handleUpdateCompany : handleAddCompany}
      style={{
        background: BRAND.card,
        padding: 24,
        borderRadius: 12,
        marginBottom: 24,
        border: "1px solid #e5e7eb",
        boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
      }}
    >
      <h3 style={{ margin: "0 0 16px", color: BRAND.primary }}>
        {isEdit ? `✏️ Edit: ${editingCompany?.name}` : "➕ Add New Company"}
      </h3>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label style={labelStyle}>Company Name *</label>
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            style={inputStyle}
            placeholder="Acme Plumbing, LLC"
          />
        </div>
        <div>
          <label style={labelStyle}>Slug (URL-friendly)</label>
          <input
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
            style={inputStyle}
            placeholder="acme-plumbing (auto-generated if blank)"
          />
        </div>
        <div>
          <label style={labelStyle}>Contact Email</label>
          <input
            type="email"
            value={form.contact_email}
            onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
            style={inputStyle}
            placeholder="admin@acmeplumbing.com"
          />
        </div>
        <div>
          <label style={labelStyle}>Contact Phone</label>
          <input
            value={form.contact_phone}
            onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
            style={inputStyle}
            placeholder="(337) 555-1234"
          />
        </div>
        <div>
          <label style={labelStyle}>Address</label>
          <input
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            style={inputStyle}
            placeholder="123 Main St"
          />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 8 }}>
          <div>
            <label style={labelStyle}>City</label>
            <input
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>State</label>
            <input
              value={form.state}
              onChange={(e) => setForm({ ...form, state: e.target.value })}
              style={inputStyle}
              maxLength={2}
            />
          </div>
          <div>
            <label style={labelStyle}>Zip</label>
            <input
              value={form.zip}
              onChange={(e) => setForm({ ...form, zip: e.target.value })}
              style={inputStyle}
            />
          </div>
        </div>
        <div>
          <label style={labelStyle}>Website</label>
          <input
            value={form.website}
            onChange={(e) => setForm({ ...form, website: e.target.value })}
            style={inputStyle}
            placeholder="https://acmeplumbing.com"
          />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div>
            <label style={labelStyle}>Primary Color</label>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="color"
                value={form.primary_color}
                onChange={(e) => setForm({ ...form, primary_color: e.target.value })}
                style={{ width: 40, height: 36, border: "none", cursor: "pointer" }}
              />
              <input
                value={form.primary_color}
                onChange={(e) => setForm({ ...form, primary_color: e.target.value })}
                style={{ ...inputStyle, flex: 1 }}
              />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Accent Color</label>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="color"
                value={form.secondary_color}
                onChange={(e) => setForm({ ...form, secondary_color: e.target.value })}
                style={{ width: 40, height: 36, border: "none", cursor: "pointer" }}
              />
              <input
                value={form.secondary_color}
                onChange={(e) => setForm({ ...form, secondary_color: e.target.value })}
                style={{ ...inputStyle, flex: 1 }}
              />
            </div>
          </div>
        </div>
        <div>
          <label style={labelStyle}>Subscription Tier</label>
          <select
            value={form.subscription_tier}
            onChange={(e) => setForm({ ...form, subscription_tier: e.target.value })}
            style={inputStyle}
          >
            <option value="basic">Basic</option>
            <option value="pro">Pro</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Status</label>
          <select
            value={form.subscription_status}
            onChange={(e) => setForm({ ...form, subscription_status: e.target.value })}
            style={inputStyle}
          >
            <option value="active">Active</option>
            <option value="trial">Trial</option>
            <option value="suspended">Suspended</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Max Employees</label>
          <input
            type="number"
            value={form.max_employees}
            onChange={(e) => setForm({ ...form, max_employees: e.target.value })}
            style={inputStyle}
            min={1}
          />
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
        <button
          type="submit"
          style={{
            background: BRAND.primary,
            color: "#fff",
            border: "none",
            padding: "10px 24px",
            borderRadius: 8,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {isEdit ? "💾 Save Changes" : "➕ Create Company"}
        </button>
        <button
          type="button"
          onClick={() => {
            setShowAddForm(false);
            setEditingCompany(null);
            resetForm();
          }}
          style={{
            background: "#e5e7eb",
            color: "#374151",
            border: "none",
            padding: "10px 24px",
            borderRadius: 8,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  );

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        <div>
          <h1 style={{ margin: 0, color: BRAND.primary, fontSize: 28 }}>
            🛡️ Super Admin Panel
          </h1>
          <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: 14 }}>
            Platform management — All companies
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => {
              setShowOnboardForm(!showOnboardForm);
              setShowAddForm(false);
              setEditingCompany(null);
              setOnboardResult(null);
            }}
            style={{
              background: showOnboardForm ? "#6b7280" : "#7c3aed",
              color: "#fff",
              border: "none",
              padding: "12px 20px",
              borderRadius: 10,
              fontWeight: 800,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            {showOnboardForm ? "✕ Cancel" : "🚀 Onboard New Company"}
          </button>
          <button
            onClick={() => {
              setShowAddForm(!showAddForm);
              setShowOnboardForm(false);
              setEditingCompany(null);
              resetForm();
            }}
            style={{
              background: BRAND.accent,
              color: "#fff",
              border: "none",
              padding: "12px 20px",
              borderRadius: 10,
              fontWeight: 800,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            {showAddForm ? "✕ Cancel" : "➕ Company Only"}
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <SummaryCard
          label="Total Companies"
          value={companies.length}
          icon="🏢"
          color={BRAND.primary}
        />
        <SummaryCard
          label="Active Companies"
          value={companies.filter((c) => c.subscription_status === "active").length}
          icon="✅"
          color={BRAND.success}
        />
        <SummaryCard
          label="Total Employees"
          value={Object.values(stats).reduce((sum, s) => sum + (s.employees || 0), 0)}
          icon="👥"
          color={BRAND.accent}
        />
        <SummaryCard
          label="Active Shifts Now"
          value={Object.values(stats).reduce((sum, s) => sum + (s.activeShifts || 0), 0)}
          icon="⏱️"
          color={BRAND.warning}
        />
      </div>

      {/* ── Onboard New Company Form ─────────────────────────────────────── */}
      {showOnboardForm && (
        <form
          onSubmit={handleOnboard}
          style={{
            background: "#faf5ff",
            padding: 24,
            borderRadius: 12,
            marginBottom: 24,
            border: "2px solid #7c3aed",
            boxShadow: "0 2px 8px rgba(124,58,237,0.15)",
          }}
        >
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ margin: 0, color: "#7c3aed", fontSize: 20 }}>
              🚀 Onboard New Company
            </h3>
            <p style={{ margin: "6px 0 0", color: "#6b7280", fontSize: 13 }}>
              Creates the company, admin login, and employee record all at once.
              The admin can sign in immediately after this is submitted.
            </p>
          </div>

          {/* Success / Error Result */}
          {onboardResult && (
            <div
              style={{
                background: onboardResult.success ? "#dcfce7" : "#fee2e2",
                border: `1px solid ${onboardResult.success ? "#86efac" : "#fca5a5"}`,
                padding: 16,
                borderRadius: 10,
                marginBottom: 20,
              }}
            >
              {onboardResult.success ? (
                <div>
                  <p style={{ margin: 0, fontWeight: 700, color: "#166534", fontSize: 15 }}>
                    ✅ Company onboarded successfully!
                  </p>
                  <p style={{ margin: "6px 0 0", color: "#166534", fontSize: 13 }}>
                    <strong>{onboardResult.data.message}</strong>
                  </p>
                  <div style={{ marginTop: 8, padding: 10, background: "rgba(255,255,255,0.6)", borderRadius: 6 }}>
                    <div style={{ fontSize: 12, color: "#374151" }}>
                      <strong>Trial ends:</strong> {new Date(onboardResult.data.trial_ends_at).toLocaleDateString()}
                    </div>
                    <div style={{ fontSize: 12, color: "#374151", marginTop: 2 }}>
                      <strong>Company ID:</strong> {onboardResult.data.company_id}
                    </div>
                  </div>
                </div>
              ) : (
                <p style={{ margin: 0, fontWeight: 700, color: "#991b1b" }}>
                  ❌ {onboardResult.error}
                </p>
              )}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {/* Company Info */}
            <div
              style={{
                background: "white",
                padding: 16,
                borderRadius: 10,
                border: "1px solid #e9d5ff",
              }}
            >
              <h4 style={{ margin: "0 0 12px", color: "#7c3aed", fontSize: 14 }}>
                🏢 Company Info
              </h4>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div>
                  <label style={labelStyle}>Company Name *</label>
                  <input
                    required
                    value={onboardForm.company_name}
                    onChange={(e) => handleOnboardNameChange(e.target.value)}
                    style={inputStyle}
                    placeholder="Acme Plumbing, LLC"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Slug (auto-generated)</label>
                  <input
                    required
                    value={onboardForm.company_slug}
                    onChange={(e) => setOnboardForm({ ...onboardForm, company_slug: e.target.value })}
                    style={{ ...inputStyle, background: "#f9fafb" }}
                    placeholder="acme-plumbing"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Contact Phone</label>
                  <input
                    value={onboardForm.contact_phone}
                    onChange={(e) => setOnboardForm({ ...onboardForm, contact_phone: e.target.value })}
                    style={inputStyle}
                    placeholder="(337) 555-1234"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Subscription Tier</label>
                  <select
                    value={onboardForm.subscription_tier}
                    onChange={(e) => setOnboardForm({ ...onboardForm, subscription_tier: e.target.value })}
                    style={inputStyle}
                  >
                    <option value="basic">Basic (14-day trial)</option>
                    <option value="pro">Pro (14-day trial)</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div>
                    <label style={labelStyle}>Primary Color</label>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <input
                        type="color"
                        value={onboardForm.primary_color}
                        onChange={(e) => setOnboardForm({ ...onboardForm, primary_color: e.target.value })}
                        style={{ width: 36, height: 32, border: "none", cursor: "pointer" }}
                      />
                      <input
                        value={onboardForm.primary_color}
                        onChange={(e) => setOnboardForm({ ...onboardForm, primary_color: e.target.value })}
                        style={{ ...inputStyle, flex: 1, fontSize: 12 }}
                      />
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>Accent Color</label>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <input
                        type="color"
                        value={onboardForm.secondary_color}
                        onChange={(e) => setOnboardForm({ ...onboardForm, secondary_color: e.target.value })}
                        style={{ width: 36, height: 32, border: "none", cursor: "pointer" }}
                      />
                      <input
                        value={onboardForm.secondary_color}
                        onChange={(e) => setOnboardForm({ ...onboardForm, secondary_color: e.target.value })}
                        style={{ ...inputStyle, flex: 1, fontSize: 12 }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Admin Account */}
            <div
              style={{
                background: "white",
                padding: 16,
                borderRadius: 10,
                border: "1px solid #e9d5ff",
              }}
            >
              <h4 style={{ margin: "0 0 12px", color: "#7c3aed", fontSize: 14 }}>
                👤 Admin Account
              </h4>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div>
                    <label style={labelStyle}>First Name *</label>
                    <input
                      required
                      value={onboardForm.admin_first_name}
                      onChange={(e) => setOnboardForm({ ...onboardForm, admin_first_name: e.target.value })}
                      style={inputStyle}
                      placeholder="John"
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Last Name *</label>
                    <input
                      required
                      value={onboardForm.admin_last_name}
                      onChange={(e) => setOnboardForm({ ...onboardForm, admin_last_name: e.target.value })}
                      style={inputStyle}
                      placeholder="Smith"
                    />
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Admin Email *</label>
                  <input
                    required
                    type="email"
                    value={onboardForm.admin_email}
                    onChange={(e) => setOnboardForm({ ...onboardForm, admin_email: e.target.value })}
                    style={inputStyle}
                    placeholder="admin@acmeplumbing.com"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Temp Password *</label>
                  <input
                    required
                    type="text"
                    value={onboardForm.admin_password}
                    onChange={(e) => setOnboardForm({ ...onboardForm, admin_password: e.target.value })}
                    style={inputStyle}
                    placeholder="Give them a strong temp password"
                    minLength={8}
                  />
                  <p style={{ margin: "4px 0 0", fontSize: 11, color: "#9ca3af" }}>
                    Share this with the admin. They can change it after login.
                  </p>
                </div>
                {/* Preview branding */}
                <div
                  style={{
                    background: onboardForm.primary_color,
                    padding: "10px 14px",
                    borderRadius: 8,
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    marginTop: 4,
                  }}
                >
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: "50%",
                      background: onboardForm.secondary_color,
                    }}
                  />
                  <span style={{ color: "white", fontWeight: 700, fontSize: 13 }}>
                    {onboardForm.company_name || "Company Name"} — Preview
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
            <button
              type="submit"
              disabled={onboarding}
              style={{
                background: onboarding ? "#9ca3af" : "#7c3aed",
                color: "#fff",
                border: "none",
                padding: "12px 28px",
                borderRadius: 10,
                fontWeight: 800,
                fontSize: 15,
                cursor: onboarding ? "not-allowed" : "pointer",
              }}
            >
              {onboarding ? "⏳ Creating..." : "🚀 Create Company + Admin"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowOnboardForm(false);
                setOnboardResult(null);
              }}
              style={{
                background: "#e5e7eb",
                color: "#374151",
                border: "none",
                padding: "12px 24px",
                borderRadius: 10,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Add/Edit Form */}
      {showAddForm && renderForm(false)}
      {editingCompany && renderForm(true)}

      {/* Companies Table */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 40 }}>
          <p style={{ fontSize: 18, color: "#6b7280" }}>Loading companies...</p>
        </div>
      ) : (
        <div
          style={{
            background: BRAND.card,
            borderRadius: 12,
            border: "1px solid #e5e7eb",
            overflow: "hidden",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: BRAND.primary, color: "#fff" }}>
                <th style={thStyle}>Company</th>
                <th style={thStyle}>Branding</th>
                <th style={thStyle}>Tier</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Employees</th>
                <th style={thStyle}>Shifts</th>
                <th style={thStyle}>Active Now</th>
                <th style={thStyle}>Created</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((company, i) => {
                const s = stats[company.id] || {};
                return (
                  <tr
                    key={company.id}
                    style={{
                      background: i % 2 === 0 ? "#fff" : "#f9fafb",
                      borderBottom: "1px solid #e5e7eb",
                    }}
                  >
                    <td style={tdStyle}>
                      <div>
                        <strong style={{ fontSize: 14 }}>{company.name}</strong>
                        <div style={{ fontSize: 11, color: "#9ca3af" }}>
                          {company.slug}
                        </div>
                        {company.contact_email && (
                          <div style={{ fontSize: 11, color: "#6b7280" }}>
                            {company.contact_email}
                          </div>
                        )}
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <div
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: 6,
                            background: company.primary_color || "#0b3ea8",
                            border: "1px solid #d1d5db",
                          }}
                          title={`Primary: ${company.primary_color}`}
                        />
                        <div
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: 6,
                            background: company.secondary_color || "#fc6b04",
                            border: "1px solid #d1d5db",
                          }}
                          title={`Accent: ${company.secondary_color}`}
                        />
                      </div>
                    </td>
                    <td style={tdStyle}>{tierBadge(company.subscription_tier)}</td>
                    <td style={tdStyle}>{statusBadge(company.subscription_status)}</td>
                    <td style={{ ...tdStyle, textAlign: "center", fontWeight: 700 }}>
                      {s.employees || 0}
                      <span style={{ fontSize: 10, color: "#9ca3af", display: "block" }}>
                        / {company.max_employees || 50}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: "center", fontWeight: 700 }}>
                      {s.totalShifts || 0}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "center" }}>
                      {(s.activeShifts || 0) > 0 ? (
                        <span
                          style={{
                            background: "#dcfce7",
                            color: "#166534",
                            padding: "2px 8px",
                            borderRadius: 10,
                            fontWeight: 700,
                            fontSize: 13,
                          }}
                        >
                          🟢 {s.activeShifts}
                        </span>
                      ) : (
                        <span style={{ color: "#9ca3af", fontSize: 13 }}>—</span>
                      )}
                    </td>
                    <td style={{ ...tdStyle, fontSize: 12, color: "#6b7280" }}>
                      {company.created_at
                        ? new Date(company.created_at).toLocaleDateString()
                        : "—"}
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          onClick={() => startEdit(company)}
                          style={actionBtnStyle}
                          title="Edit"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleToggleStatus(company)}
                          style={{
                            ...actionBtnStyle,
                            background:
                              company.subscription_status === "active"
                                ? "#fee2e2"
                                : "#dcfce7",
                          }}
                          title={
                            company.subscription_status === "active"
                              ? "Suspend"
                              : "Activate"
                          }
                        >
                          {company.subscription_status === "active" ? "⏸️" : "▶️"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {companies.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ textAlign: "center", padding: 40, color: "#9ca3af" }}>
                    No companies yet. Click "Add Company" to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Summary Card Component ──────────────────────────────────────────────────
function SummaryCard({ label, value, icon, color }) {
  return (
    <div
      style={{
        background: "#fff",
        padding: 20,
        borderRadius: 12,
        border: "1px solid #e5e7eb",
        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 4 }}>{label}</div>
          <div style={{ fontSize: 28, fontWeight: 900, color }}>{value}</div>
        </div>
        <div style={{ fontSize: 32 }}>{icon}</div>
      </div>
    </div>
  );
}

// ── Shared Styles ───────────────────────────────────────────────────────────
const labelStyle = {
  display: "block",
  fontSize: 12,
  fontWeight: 700,
  color: "#374151",
  marginBottom: 4,
};

const inputStyle = {
  width: "100%",
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid #d1d5db",
  fontSize: 14,
  boxSizing: "border-box",
};

const thStyle = {
  padding: "12px 14px",
  textAlign: "left",
  fontSize: 12,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 0.5,
};

const tdStyle = {
  padding: "12px 14px",
  fontSize: 14,
};

const actionBtnStyle = {
  background: "#f3f4f6",
  border: "1px solid #d1d5db",
  borderRadius: 6,
  padding: "6px 10px",
  cursor: "pointer",
  fontSize: 14,
};
