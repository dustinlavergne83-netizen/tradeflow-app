import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import logo from "../assets/LOGOD.jpg";

const BRAND = {
  bg: "#0b3ea8",
  primary: "#fc6b04ff",
};

export default function ProfileSetup() {
  const navigate = useNavigate();
  const { employee, user } = useAuth();
  const [form, setForm] = useState({
    first_name: employee?.first_name || "",
    last_name: employee?.last_name || "",
    phone: employee?.phone || "",
    date_of_birth: employee?.date_of_birth || "",
    address: employee?.address || "",
    city: employee?.city || "",
    state: employee?.state || "",
    zip_code: employee?.zip_code || "",
    emergency_contact_name: employee?.emergency_contact_name || "",
    emergency_contact_phone: employee?.emergency_contact_phone || "",
    emergency_contact_relationship: employee?.emergency_contact_relationship || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    
    if (!form.first_name.trim()) {
      setError("First name is required");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const { error: updateError } = await supabase
        .from("employees")
        .update({
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          phone: form.phone.trim(),
          date_of_birth: form.date_of_birth || null,
          // Uncomment the following lines if you add these columns to your table:
          // address: form.address.trim(),
          // city: form.city.trim(),
          // state: form.state.trim(),
          // zip_code: form.zip_code.trim(),
          // emergency_contact_name: form.emergency_contact_name.trim(),
          // emergency_contact_phone: form.emergency_contact_phone.trim(),
          // emergency_contact_relationship: form.emergency_contact_relationship.trim(),
        })
        .eq("email", user.email.trim().toLowerCase());

      if (updateError) throw updateError;

      // Wait a moment then reload
      await new Promise(resolve => setTimeout(resolve, 500));
      window.location.href = "/";
    } catch (err) {
      console.error("Error updating profile:", err);
      setError(err.message || "Failed to save profile");
      setSaving(false);
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.logoContainer}>
          <img src={logo} alt="Logo" style={styles.logo} />
        </div>
        
        <h1 style={styles.title}>Complete Your Profile</h1>
        <p style={styles.subtitle}>Please provide your information to get started</p>

        <form onSubmit={handleSubmit} style={styles.form}>
          {error && (
            <div style={styles.error}>
              {error}
            </div>
          )}

          <div style={styles.field}>
            <label style={styles.label}>First Name *</label>
            <input
              type="text"
              value={form.first_name}
              onChange={(e) => setForm({ ...form, first_name: e.target.value })}
              style={styles.input}
              placeholder="John"
              required
              autoFocus
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Last Name</label>
            <input
              type="text"
              value={form.last_name}
              onChange={(e) => setForm({ ...form, last_name: e.target.value })}
              style={styles.input}
              placeholder="Doe"
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Phone Number</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              style={styles.input}
              placeholder="555-555-5555"
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Date of Birth</label>
            <input
              type="date"
              value={form.date_of_birth}
              onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })}
              style={styles.input}
            />
          </div>

          <h3 style={styles.sectionTitle}>Address</h3>

          <div style={styles.field}>
            <label style={styles.label}>Street Address</label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              style={styles.input}
              placeholder="123 Main St"
            />
          </div>

          <div style={styles.row}>
            <div style={styles.field}>
              <label style={styles.label}>City</label>
              <input
                type="text"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                style={styles.input}
                placeholder="City"
              />
            </div>
            
            <div style={styles.fieldSmall}>
              <label style={styles.label}>State</label>
              <input
                type="text"
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
                style={styles.input}
                placeholder="LA"
                maxLength="2"
              />
            </div>
          </div>
            
          <div style={styles.field}>
            <label style={styles.label}>ZIP Code</label>
            <input
              type="text"
              value={form.zip_code}
              onChange={(e) => setForm({ ...form, zip_code: e.target.value })}
              style={styles.input}
              placeholder="70001"
            />
          </div>

          <h3 style={styles.sectionTitle}>Emergency Contact</h3>

          <div style={styles.field}>
            <label style={styles.label}>Contact Name</label>
            <input
              type="text"
              value={form.emergency_contact_name}
              onChange={(e) => setForm({ ...form, emergency_contact_name: e.target.value })}
              style={styles.input}
              placeholder="Jane Doe"
            />
          </div>

          <div style={styles.row}>
            <div style={styles.field}>
              <label style={styles.label}>Contact Phone</label>
              <input
                type="tel"
                value={form.emergency_contact_phone}
                onChange={(e) => setForm({ ...form, emergency_contact_phone: e.target.value })}
                style={styles.input}
                placeholder="555-555-5555"
              />
            </div>
            
            <div style={styles.field}>
              <label style={styles.label}>Relationship</label>
              <input
                type="text"
                value={form.emergency_contact_relationship}
                onChange={(e) => setForm({ ...form, emergency_contact_relationship: e.target.value })}
                style={styles.input}
                placeholder="Spouse, Parent, etc."
              />
            </div>
          </div>

          <button type="submit" style={styles.button} disabled={saving}>
            {saving ? "Saving..." : "Complete Setup"}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles = {
  container: {
    backgroundColor: BRAND.bg,
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 40,
    maxWidth: 600,
    width: "100%",
    boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
    maxHeight: "90vh",
    overflowY: "auto",
  },
  logoContainer: {
    textAlign: "center",
    marginBottom: 24,
  },
  logo: {
    maxWidth: 200,
    height: "auto",
  },
  title: {
    fontSize: 28,
    fontWeight: 900,
    color: BRAND.primary,
    textAlign: "center",
    margin: "0 0 8px 0",
    fontStyle: "italic",
  },
  subtitle: {
    fontSize: 16,
    color: "#6b7280",
    textAlign: "center",
    margin: "0 0 32px 0",
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 700,
    color: "#111",
    marginTop: 24,
    marginBottom: 12,
    borderBottom: "2px solid #e5e7eb",
    paddingBottom: 8,
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 20,
  },
  error: {
    backgroundColor: "#fee2e2",
    color: "#dc2626",
    padding: 12,
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
  },
  field: {
    display: "flex",
    flexDirection: "column",
  },
  fieldSmall: {
    display: "flex",
    flexDirection: "column",
    minWidth: 100,
    flex: "0 0 auto",
  },
  row: {
    display: "flex",
    gap: 12,
    width: "100%",
  },
  label: {
    fontSize: 14,
    fontWeight: 600,
    color: "#111",
    marginBottom: 6,
  },
  input: {
    padding: 12,
    fontSize: 16,
    border: "2px solid #e5e7eb",
    borderRadius: 8,
    backgroundColor: "#fff",
    color: "#111",
  },
  button: {
    backgroundColor: BRAND.primary,
    color: "#fff",
    border: "none",
    padding: 14,
    borderRadius: 8,
    fontSize: 16,
    fontWeight: 700,
    cursor: "pointer",
    marginTop: 8,
  },
};
