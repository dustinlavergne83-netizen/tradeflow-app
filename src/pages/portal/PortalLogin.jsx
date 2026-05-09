import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";

export default function PortalLogin() {
  const { slug } = useParams();
  const navigate = useNavigate();

  const [company, setCompany] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(true);

  // Load company by slug
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("companies")
        .select("id, name, logo_url, primary_color, slug")
        .eq("slug", slug.toLowerCase())
        .maybeSingle();

      if (data) {
        setCompany(data);
      } else {
        setNotFound(true);
      }
      setChecking(false);
    })();
  }, [slug]);

  // If already signed in and is admin/supervisor for this company → redirect to dashboard
  useEffect(() => {
    if (!company) return;
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;
      if (!user) return;

      const { data: emp } = await supabase
        .from("employees")
        .select("role, company_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (
        emp &&
        emp.company_id === company.id &&
        (emp.role === "admin" || emp.role === "supervisor")
      ) {
        navigate(`/${slug}/dashboard`, { replace: true });
      }
    })();
  }, [company, slug, navigate]);

  async function handleSignIn(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) { setError(authError.message); setLoading(false); return; }

      // Verify admin/supervisor role for this company
      const { data: { user } } = await supabase.auth.getUser();
      const { data: emp } = await supabase
        .from("employees")
        .select("role, company_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!emp || emp.company_id !== company.id) {
        await supabase.auth.signOut();
        setError("You don't have access to this portal.");
        setLoading(false);
        return;
      }

      if (emp.role !== "admin" && emp.role !== "supervisor") {
        await supabase.auth.signOut();
        setError("Admin or supervisor access required.");
        setLoading(false);
        return;
      }

      navigate(`/${slug}/dashboard`, { replace: true });
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  const accentColor = company?.primary_color || "#fc6b04";
  const bgColor = "#0b3ea8";

  if (checking) {
    return (
      <div style={{ minHeight: "100vh", background: bgColor, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#fff", fontSize: 18, fontWeight: 700 }}>Loading…</div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div style={{ minHeight: "100vh", background: bgColor, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", color: "#fff" }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>🔍</div>
          <h2 style={{ fontWeight: 900, fontSize: 24 }}>Portal Not Found</h2>
          <p style={{ color: "#94a3b8" }}>No company found for "<strong>{slug}</strong>"</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: `linear-gradient(135deg, ${bgColor} 0%, #1e3a8a 100%)`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 16,
    }}>
      <div style={{
        width: "100%",
        maxWidth: 420,
        background: "#fff",
        borderRadius: 20,
        padding: "40px 36px",
        boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
      }}>
        {/* Company branding */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          {company.logo_url ? (
            <img
              src={company.logo_url}
              alt={company.name}
              style={{ maxHeight: 80, maxWidth: 200, objectFit: "contain", marginBottom: 12 }}
            />
          ) : (
            <div style={{
              width: 72, height: 72, borderRadius: 16, margin: "0 auto 12px",
              background: accentColor, display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 32,
            }}>
              ⏱️
            </div>
          )}
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#111" }}>
            {company.name}
          </h1>
          <p style={{ margin: "6px 0 0", color: "#6b7280", fontSize: 14 }}>
            Admin Portal
          </p>
        </div>

        {/* Sign-in form */}
        <form onSubmit={handleSignIn}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6 }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="admin@company.com"
              style={{
                width: "100%", padding: "11px 14px", borderRadius: 10,
                border: "1.5px solid #d1d5db", fontSize: 15, boxSizing: "border-box",
                outline: "none",
              }}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6 }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="••••••••"
              style={{
                width: "100%", padding: "11px 14px", borderRadius: 10,
                border: "1.5px solid #d1d5db", fontSize: 15, boxSizing: "border-box",
                outline: "none",
              }}
            />
          </div>

          {error && (
            <div style={{
              background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 10,
              padding: "10px 14px", marginBottom: 16, color: "#dc2626", fontSize: 14, fontWeight: 600,
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%", padding: "13px", borderRadius: 12, border: "none",
              background: loading ? "#9ca3af" : accentColor,
              color: "#fff", fontSize: 16, fontWeight: 900,
              cursor: loading ? "default" : "pointer",
              transition: "background 0.2s",
            }}
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: 24, fontSize: 12, color: "#9ca3af" }}>
          Powered by <strong style={{ color: accentColor }}>TradeFlow</strong>
        </p>
      </div>
    </div>
  );
}
