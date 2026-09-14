import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

const DML_DEFAULTS = { bg: "#0b3ea8", primary: "#fc6b04ff", name: "TradeFlow" };

export default function SetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState("loading"); // loading | ready | saving | done | error
  const [errorMsg, setErrorMsg] = useState("");
  const [brand, setBrand] = useState(DML_DEFAULTS);

  // Resolves branding by the INVITING company (never by the invitee's email
  // domain — new employees typically have personal emails like gmail.com,
  // so the address itself carries no reliable company signal). Priority:
  //   1. ?company=<slug> query param — set by invite-employee's redirectTo,
  //      works instantly, even before the auth hash finishes processing
  //   2. user_metadata.company_id from the session — also set by
  //      invite-employee, available once Supabase parses the invite link
  //   3. employees row looked up by the session's user_id
  //   4. DML/TradeFlow defaults
  async function resolveBrand(session) {
    try {
      const params = new URLSearchParams(window.location.search);
      const slug = params.get("company");

      if (slug) {
        const { data } = await supabase
          .from("companies")
          .select("name, primary_color, secondary_color, logo_url")
          .eq("slug", slug)
          .maybeSingle();
        if (data) {
          setBrand({
            bg: data.primary_color || DML_DEFAULTS.bg,
            primary: data.secondary_color || DML_DEFAULTS.primary,
            name: data.name || DML_DEFAULTS.name,
            logo_url: data.logo_url || null,
          });
          return;
        }
      }

      const companyId = session?.user?.user_metadata?.company_id;
      const userId = session?.user?.id;

      let query = supabase.from("companies").select("name, primary_color, secondary_color, logo_url");
      if (companyId) {
        query = query.eq("id", companyId);
      } else if (userId) {
        const { data: emp } = await supabase
          .from("employees")
          .select("company_id")
          .eq("user_id", userId)
          .maybeSingle();
        if (!emp?.company_id) return; // no signal at all — keep defaults
        query = query.eq("id", emp.company_id);
      } else {
        return;
      }

      const { data: company } = await query.maybeSingle();
      if (company) {
        setBrand({
          bg: company.primary_color || DML_DEFAULTS.bg,
          primary: company.secondary_color || DML_DEFAULTS.primary,
          name: company.name || DML_DEFAULTS.name,
          logo_url: company.logo_url || null,
        });
      }
    } catch (e) {
      // Branding is cosmetic — never block password-setting on a lookup failure.
      console.log("SetPassword: brand lookup failed", e);
    }
  }

  useEffect(() => {
    // Resolve branding from the query param immediately, without waiting on
    // a session — this covers the "no company_id in metadata yet" window
    // right after redirect and avoids a flash of DML colors.
    resolveBrand(null);

    // Supabase auto-parses the #access_token hash and fires onAuthStateChange.
    // We just need to wait for the session to be established.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setStatus("ready");
        resolveBrand(session);
      } else {
        // Hash not yet processed — listen for the auth event
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
          if (session && (event === "SIGNED_IN" || event === "PASSWORD_RECOVERY")) {
            setStatus("ready");
            resolveBrand(session);
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
    <div style={{ ...styles.page, backgroundColor: brand.bg }}>
      <div style={styles.card}>
        {brand.logo_url ? (
          <img src={brand.logo_url} alt={brand.name} style={styles.logoImg} />
        ) : (
          <div style={styles.logo}>🔑</div>
        )}
        <h1 style={styles.title}>Set Your Password</h1>

        {status === "loading" && (
          <p style={styles.sub}>Verifying your invite link…</p>
        )}

        {status === "error" && (
          <p style={{ ...styles.sub, color: "#ef4444" }}>{errorMsg}</p>
        )}

        {status === "done" && (
          <p style={{ ...styles.sub, color: "#10b981" }}>
            ✅ Password set! Redirecting you to sign in…
          </p>
        )}

        {(status === "ready" || status === "saving") && (
          <form onSubmit={handleSubmit} style={styles.form}>
            <p style={styles.sub}>
              Welcome to {brand.name}! Choose a password to secure your account.
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
                backgroundColor: brand.primary,
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
  logoImg: {
    maxHeight: 56,
    maxWidth: 220,
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
    backgroundColor: DML_DEFAULTS.primary, // overridden inline with brand.primary
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
