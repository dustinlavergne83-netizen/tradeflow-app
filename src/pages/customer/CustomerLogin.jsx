import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabase";
import logo from "../../assets/LOGOD.jpg";

const BRAND = {
  blue: "#0b3ea8",
  orange: "#fc6b04",
  darkBlue: "#092d7e",
};

export default function CustomerLogin() {
  const navigate = useNavigate();
  const { signIn, user, customer, employee, loading } = useAuth();

  const [tab, setTab] = useState("login"); // "login" | "signup" | "reset"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Redirect if already logged in
  useEffect(() => {
    if (!loading && user) {
      if (customer) navigate("/customer/portal");
      else if (employee) navigate("/dashboard");
    }
  }, [user, customer, employee, loading, navigate]);

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await signIn(email, password);
      // AuthContext will update customer/employee state, useEffect will redirect
    } catch (err) {
      setError(err.message || "Invalid email or password. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSignUp(e) {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setSubmitting(true);
    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });
      if (signUpError) throw signUpError;
      setSuccess("Account created! Check your email to confirm your account, then sign in.");
      setTab("login");
    } catch (err) {
      setError(err.message || "Failed to create account.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReset(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/customer/login`,
      });
      if (resetError) throw resetError;
      setSuccess("Password reset email sent! Check your inbox.");
      setTab("login");
    } catch (err) {
      setError(err.message || "Failed to send reset email.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: BRAND.blue, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#fff", fontSize: 18, fontWeight: 600 }}>Loading...</div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      {/* Left panel - branding */}
      <div style={styles.leftPanel}>
        <div style={styles.leftContent}>
          <img src={logo} alt="DML Electrical" style={styles.leftLogo} />
          <h1 style={styles.leftTitle}>DML Electrical<br />Service</h1>
          <p style={styles.leftSubtitle}>Customer Portal</p>
          <div style={styles.leftDivider} />
          <div style={styles.leftFeatures}>
            <div style={styles.leftFeature}>
              <span style={styles.leftFeatureIcon}>📋</span>
              <span>View estimates &amp; proposals</span>
            </div>
            <div style={styles.leftFeature}>
              <span style={styles.leftFeatureIcon}>💳</span>
              <span>Pay invoices online</span>
            </div>
            <div style={styles.leftFeature}>
              <span style={styles.leftFeatureIcon}>📊</span>
              <span>Track project progress</span>
            </div>
            <div style={styles.leftFeature}>
              <span style={styles.leftFeatureIcon}>📄</span>
              <span>Download receipts</span>
            </div>
          </div>
          <button
            style={styles.leftBackBtn}
            onClick={() => navigate("/welcome")}
          >
            ← Back to Website
          </button>
        </div>
      </div>

      {/* Right panel - form */}
      <div style={styles.rightPanel}>
        <div style={styles.formCard}>
          {/* Tabs */}
          <div style={styles.tabs}>
            <button
              style={{ ...styles.tab, ...(tab === "login" ? styles.tabActive : {}) }}
              onClick={() => { setTab("login"); setError(""); setSuccess(""); }}
            >
              Sign In
            </button>
            <button
              style={{ ...styles.tab, ...(tab === "signup" ? styles.tabActive : {}) }}
              onClick={() => { setTab("signup"); setError(""); setSuccess(""); }}
            >
              Create Account
            </button>
          </div>

          {/* Success message */}
          {success && (
            <div style={styles.successMsg}>
              ✅ {success}
            </div>
          )}

          {/* Error message */}
          {error && (
            <div style={styles.errorMsg}>
              ⚠️ {error}
            </div>
          )}

          {/* LOGIN FORM */}
          {tab === "login" && (
            <form onSubmit={handleLogin} style={styles.form}>
              <h2 style={styles.formTitle}>Welcome Back</h2>
              <p style={styles.formSubtitle}>Sign in to your customer portal</p>

              <div style={styles.field}>
                <label style={styles.label}>Email Address</label>
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

              <button type="submit" style={styles.submitBtn} disabled={submitting}>
                {submitting ? "Signing in..." : "Sign In →"}
              </button>

              <button
                type="button"
                style={styles.forgotBtn}
                onClick={() => { setTab("reset"); setError(""); setSuccess(""); }}
              >
                Forgot your password?
              </button>
            </form>
          )}

          {/* SIGN UP FORM */}
          {tab === "signup" && (
            <form onSubmit={handleSignUp} style={styles.form}>
              <h2 style={styles.formTitle}>Create Account</h2>
              <p style={styles.formSubtitle}>
                Already a customer with DML? Create an account using the same email we have on file.
              </p>

              <div style={styles.field}>
                <label style={styles.label}>Email Address</label>
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
                  placeholder="At least 6 characters"
                  required
                />
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  style={styles.input}
                  placeholder="Re-enter password"
                  required
                />
              </div>

              <button type="submit" style={styles.submitBtn} disabled={submitting}>
                {submitting ? "Creating account..." : "Create Account →"}
              </button>

              <p style={{ textAlign: "center", fontSize: 13, color: "#6b7280", marginTop: 16 }}>
                Your email must match what DML Electrical has on file for portal access.
              </p>
            </form>
          )}

          {/* PASSWORD RESET */}
          {tab === "reset" && (
            <form onSubmit={handleReset} style={styles.form}>
              <h2 style={styles.formTitle}>Reset Password</h2>
              <p style={styles.formSubtitle}>Enter your email and we'll send you a reset link.</p>

              <div style={styles.field}>
                <label style={styles.label}>Email Address</label>
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

              <button type="submit" style={styles.submitBtn} disabled={submitting}>
                {submitting ? "Sending..." : "Send Reset Link"}
              </button>

              <button
                type="button"
                style={styles.forgotBtn}
                onClick={() => { setTab("login"); setError(""); setSuccess(""); }}
              >
                ← Back to sign in
              </button>
            </form>
          )}

          {/* Divider */}
          <div style={styles.dividerLine}>
            <div style={styles.dividerBar} />
            <span style={styles.dividerText}>or</span>
            <div style={styles.dividerBar} />
          </div>

          {/* Employee link */}
          <div style={styles.employeeLink}>
            <span style={{ color: "#6b7280", fontSize: 14 }}>Are you an employee?</span>
            <button
              style={styles.employeeLinkBtn}
              onClick={() => navigate("/signin")}
            >
              Employee Login →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
  },
  /* Left panel */
  leftPanel: {
    width: "420px",
    flexShrink: 0,
    background: `linear-gradient(160deg, #092d7e 0%, #0b3ea8 60%, #1a4fc7 100%)`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 48,
  },
  leftContent: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
  },
  leftLogo: {
    height: 70,
    objectFit: "contain",
    marginBottom: 24,
  },
  leftTitle: {
    fontSize: 36,
    fontWeight: 900,
    fontStyle: "italic",
    color: "#fc6b04",
    margin: "0 0 8px 0",
    lineHeight: 1.1,
  },
  leftSubtitle: {
    fontSize: 16,
    color: "rgba(255,255,255,0.7)",
    fontWeight: 600,
    margin: "0 0 24px 0",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  leftDivider: {
    width: 60,
    height: 3,
    backgroundColor: "#fc6b04",
    borderRadius: 2,
    marginBottom: 28,
  },
  leftFeatures: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
    textAlign: "left",
    marginBottom: 32,
  },
  leftFeature: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    color: "rgba(255,255,255,0.85)",
    fontSize: 15,
    fontWeight: 600,
  },
  leftFeatureIcon: {
    fontSize: 20,
    flexShrink: 0,
  },
  leftBackBtn: {
    padding: "10px 20px",
    backgroundColor: "rgba(255,255,255,0.1)",
    border: "2px solid rgba(255,255,255,0.3)",
    color: "#fff",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
  /* Right panel */
  rightPanel: {
    flex: 1,
    backgroundColor: "#f8fafc",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  formCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 40,
    maxWidth: 460,
    width: "100%",
    boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
  },
  tabs: {
    display: "flex",
    gap: 4,
    backgroundColor: "#f3f4f6",
    borderRadius: 10,
    padding: 4,
    marginBottom: 24,
  },
  tab: {
    flex: 1,
    padding: "10px",
    border: "none",
    borderRadius: 7,
    backgroundColor: "transparent",
    color: "#6b7280",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.2s",
  },
  tabActive: {
    backgroundColor: "#fff",
    color: "#0b3ea8",
    boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  formTitle: {
    fontSize: 26,
    fontWeight: 800,
    color: "#111",
    margin: "0 0 6px 0",
  },
  formSubtitle: {
    fontSize: 14,
    color: "#6b7280",
    margin: "0 0 20px 0",
    lineHeight: 1.5,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    display: "block",
    fontSize: 13,
    fontWeight: 700,
    color: "#374151",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  input: {
    width: "100%",
    padding: "12px 16px",
    fontSize: 15,
    fontFamily: "Arial, Helvetica, sans-serif",
    border: "2px solid #e5e7eb",
    borderRadius: 8,
    outline: "none",
    backgroundColor: "#fff",
    color: "#111",
    boxSizing: "border-box",
    transition: "border-color 0.2s",
    WebkitTextFillColor: "#111",
  },
  submitBtn: {
    padding: "14px",
    backgroundColor: "#0b3ea8",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    fontSize: 16,
    fontWeight: 700,
    cursor: "pointer",
    marginTop: 8,
    marginBottom: 4,
  },
  forgotBtn: {
    backgroundColor: "transparent",
    border: "none",
    color: "#0b3ea8",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    textAlign: "center",
    padding: "8px 0",
    textDecoration: "underline",
  },
  errorMsg: {
    backgroundColor: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#b91c1c",
    padding: "12px 16px",
    borderRadius: 8,
    fontSize: 14,
    marginBottom: 16,
  },
  successMsg: {
    backgroundColor: "#f0fdf4",
    border: "1px solid #bbf7d0",
    color: "#15803d",
    padding: "12px 16px",
    borderRadius: 8,
    fontSize: 14,
    marginBottom: 16,
  },
  dividerLine: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    margin: "20px 0 16px 0",
  },
  dividerBar: {
    flex: 1,
    height: 1,
    backgroundColor: "#e5e7eb",
  },
  dividerText: {
    fontSize: 13,
    color: "#9ca3af",
    fontWeight: 600,
  },
  employeeLink: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  employeeLinkBtn: {
    backgroundColor: "transparent",
    border: "none",
    color: "#0b3ea8",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    textDecoration: "underline",
  },
};
