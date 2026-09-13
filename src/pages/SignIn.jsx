import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useBrand } from "../lib/useBrand";
import logo from "../assets/LOGOD.jpg";

export default function SignIn() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const BRAND = useBrand();
  const styles = makeStyles(BRAND);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await signIn(email, password);
      navigate("/dashboard");
    } catch (err) {
      setError(err.message || "Failed to sign in");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.logoContainer}>
          <img src={BRAND.logo_url || logo} alt="Logo" style={styles.logo} />
        </div>
        
        <h1 style={styles.title}>{BRAND.name}</h1>
        <p style={styles.subtitle}>{BRAND.tagline}</p>

        <form onSubmit={handleSubmit} style={styles.form}>
          {error && (
            <div style={styles.error}>
              {error}
            </div>
          )}

          <div style={styles.field}>
            <label style={styles.label}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={styles.input}
              placeholder="your@email.com"
              required
              autoFocus
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
              placeholder="••••••••"
              required
            />
          </div>

          <button type="submit" style={styles.button} disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div style={{
          marginTop: "24px",
          textAlign: "center",
          color: "#718096",
          fontSize: "14px",
        }}>
          New employee?{" "}
          <button
            onClick={() => navigate("/signup")}
            style={{
              color: "#667eea",
              fontWeight: "600",
              background: "none",
              border: "none",
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            Create Account
          </button>
        </div>

        {/* Divider */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "24px 0 16px" }}>
          <div style={{ flex: 1, height: 1, backgroundColor: "#e2e8f0" }} />
          <span style={{ fontSize: 12, color: "#a0aec0", fontWeight: 600 }}>OR</span>
          <div style={{ flex: 1, height: 1, backgroundColor: "#e2e8f0" }} />
        </div>

        {/* Customer portal link */}
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: 13, color: "#718096", marginBottom: 10 }}>
            Are you a customer?
          </p>
          <button
            onClick={() => navigate("/customer/login")}
            style={{
              width: "100%",
              padding: "12px",
              backgroundColor: "transparent",
              border: "2px solid #e2e8f0",
              color: "#4a5568",
              borderRadius: 10,
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            👤 Customer Portal Login
          </button>
        </div>

        {/* Back to website */}
        <div style={{ textAlign: "center", marginTop: 16 }}>
          <button
            onClick={() => navigate("/welcome")}
            style={{
              background: "none",
              border: "none",
              color: "#a0aec0",
              fontSize: 13,
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            ← Back to Website
          </button>
        </div>
      </div>
    </div>
  );

  function makeStyles(brand) {
    return {
      container: {
        minHeight: "100vh",
        backgroundColor: brand.bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      },
      card: {
        backgroundColor: "#fff",
        borderRadius: 16,
        padding: 48,
        maxWidth: 400,
        width: "100%",
        boxShadow: "0 10px 40px rgba(0, 0, 0, 0.3)",
      },
      logoContainer: {
        display: "flex",
        justifyContent: "center",
        marginBottom: 24,
      },
      logo: {
        width: 200,
        height: 70,
        objectFit: "contain",
      },
      title: {
        fontSize: 32,
        fontWeight: 900,
        fontStyle: "italic",
        color: brand.accent,
        textAlign: "center",
        margin: "0 0 8px 0",
      },
      subtitle: {
        fontSize: 16,
        fontWeight: 600,
        color: "#666",
        textAlign: "center",
        margin: "0 0 32px 0",
      },
      form: {
        width: "100%",
      },
      error: {
        backgroundColor: "#fee",
        color: "#c00",
        padding: 12,
        borderRadius: 8,
        marginBottom: 16,
        fontSize: 14,
        textAlign: "center",
      },
      field: {
        marginBottom: 20,
      },
      label: {
        display: "block",
        fontSize: 14,
        fontWeight: 600,
        color: "#374151",
        marginBottom: 6,
      },
      input: {
        width: "100%",
        padding: 12,
        fontSize: 15,
        fontFamily: "Arial, Helvetica, sans-serif",
        border: "2px solid #d1d5db",
        borderRadius: 8,
        outline: "none",
        backgroundColor: "#fff",
        color: "#111",
        boxSizing: "border-box",
        WebkitTextFillColor: "#111",
      },
      button: {
        width: "100%",
        padding: "14px 28px",
        backgroundColor: brand.accent,
        border: "none",
        color: "#fff",
        borderRadius: 10,
        cursor: "pointer",
        fontSize: 16,
        fontWeight: "bold",
        marginTop: 8,
      },
    };
  }
}
