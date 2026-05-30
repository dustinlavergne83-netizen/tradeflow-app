import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

const BRAND = { bg: "#0b3ea8", primary: "#fc6b04ff" };

export default function SetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState("loading"); // loading | ready | saving | done | error
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    // Supabase auto-parses the #access_token hash and fires onAuthStateChange.
    // We just need to wait for the session to be established.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setStatus("ready");
      } else {
        // Hash not yet processed — listen for the auth event
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
          if (session && (event === "SIGNED_IN" || event === "PASSWORD_RECOVERY")) {
            setStatus("ready");
            subscription.unsubscribe();
          }
        });
        // Fallback: if no event fires in 5s, show error
        setTimeout(() => {
          setStatus((s) => s === "loading" ? "error" : s);
          setErrorMsg("The invite link has expired or is invalid. Please ask for a new invite.");
        }, 5000);
      }
    });
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (password.length < 8) {
      setErrorMsg("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setErrorMsg("Passwords do not match.");
      return;
    }
    setErrorMsg("");
    setStatus("saving");

    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setErrorMsg(error.message);
      setStatus("ready");
      return;
    }

    setStatus("done");
    setTimeout(() => navigate("/dashboard"), 2000);
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logo}>🔑</div>
        <h1 style={styles.title}>Set Your Password</h1>

        {status === "loading" && (
          <p style={styles.sub}>Verifying your invite link…</p>
        )}

        {status === "error" && (
          <p style={{ ...styles.sub, color: "#ef4444" }}>{errorMsg}</p>
        )}

        {status === "done" && (
          <p style={{ ...styles.sub, color: "#10b981" }}>
            ✅ Password set! Redirecting you to the dashboard…
          </p>
        )}

        {(status === "ready" || status === "saving") && (
          <form onSubmit={handleSubmit} style={styles.form}>
            <p style={styles.sub}>
              Welcome to TradeFlow! Choose a password to secure your account.
            </p>

            {errorMsg && <p style={styles.error}>{errorMsg}</p>}

            <label style={styles.label}>New Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 8 characters"
              style={styles.input}
              required
              autoFocus
              minLength={8}
            />

            <label style={styles.label}>Confirm Password</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Re-enter your password"
              style={styles.input}
              required
            />

            <button
              type="submit"
              style={{
                ...styles.button,
                opacity: status === "saving" ? 0.7 : 1,
                cursor: status === "saving" ? "not-allowed" : "pointer",
              }}
              disabled={status === "saving"}
            >
              {status === "saving" ? "Setting Password…" : "Set Password & Sign In"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    backgroundColor: BRAND.bg,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 40,
    maxWidth: 440,
    width: "100%",
    textAlign: "center",
    boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
  },
  logo: {
    fontSize: 56,
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: 800,
    color: "#111",
    marginBottom: 8,
  },
  sub: {
    fontSize: 15,
    color: "#6b7280",
    marginBottom: 24,
    lineHeight: 1.6,
  },
  error: {
    backgroundColor: "#fef2f2",
    border: "1px solid #fca5a5",
    color: "#dc2626",
    borderRadius: 8,
    padding: "10px 14px",
    fontSize: 14,
    marginBottom: 16,
    textAlign: "left",
  },
  form: {
    textAlign: "left",
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
    padding: "12px 14px",
    fontSize: 16,
    border: "2px solid #e5e7eb",
    borderRadius: 8,
    marginBottom: 20,
    boxSizing: "border-box",
    outline: "none",
  },
  button: {
    backgroundColor: BRAND.primary,
    color: "#fff",
    border: "none",
    padding: "14px 0",
    width: "100%",
    borderRadius: 8,
    fontSize: 16,
    fontWeight: 700,
    marginTop: 4,
  },
};
