import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";

const BASE_PRICE = 49;
const PER_EMPLOYEE = 5;

export default function PortalBilling() {
  const { slug } = useParams();
  const navigate = useNavigate();

  const [company, setCompany] = useState(null);
  const [empCount, setEmpCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [daysLeft, setDaysLeft] = useState(null);

  useEffect(() => {
    (async () => {
      // Load company
      const { data: co } = await supabase
        .from("companies")
        .select("id, name, slug, primary_color, subscription_status, trial_ends_at, clover_card_token, card_brand, card_last4")
        .eq("slug", slug.toLowerCase())
        .maybeSingle();

      if (!co) { navigate(`/${slug}`, { replace: true }); return; }
      setCompany(co);

      // Verify logged-in admin
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;
      if (!user) { navigate(`/${slug}`, { replace: true }); return; }

      const { data: emp } = await supabase
        .from("employees")
        .select("role, company_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!emp || emp.company_id !== co.id || (emp.role !== "admin" && emp.role !== "supervisor")) {
        navigate(`/${slug}`, { replace: true }); return;
      }

      // Count active employees
      const { count } = await supabase
        .from("employees")
        .select("id", { count: "exact", head: true })
        .eq("company_id", co.id)
        .eq("is_active", true);
      setEmpCount(count || 0);

      // Days left
      if (co.trial_ends_at) {
        const dl = Math.ceil((new Date(co.trial_ends_at) - Date.now()) / 86400000);
        setDaysLeft(dl);
      }

      setLoading(false);
    })();
  }, [slug, navigate]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#0b3ea8", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#fff", fontSize: 18, fontWeight: 700 }}>Loading…</div>
      </div>
    );
  }

  const accent = company?.primary_color || "#fc6b04";
  const monthly = BASE_PRICE + empCount * PER_EMPLOYEE;
  const isActive = company?.subscription_status === "active";
  const isExpired = company?.subscription_status === "trial" && daysLeft !== null && daysLeft < 0;
  const isUrgent = company?.subscription_status === "trial" && daysLeft !== null && daysLeft >= 0 && daysLeft <= 3;
  const hasCard = !!company?.clover_card_token;

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>

      {/* Top Bar */}
      <div style={{ background: "#0b3ea8", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 60, boxShadow: "0 2px 8px rgba(0,0,0,0.2)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 22 }}>⏱️</span>
          <div>
            <p style={{ margin: 0, fontWeight: 900, color: "#fff", fontSize: 15 }}>{company.name}</p>
            <p style={{ margin: 0, color: "#93c5fd", fontSize: 11 }}>Billing & Subscription</p>
          </div>
        </div>
        <Link to={`/${slug}/dashboard`} style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", borderRadius: 8, padding: "7px 16px", fontWeight: 700, fontSize: 13, textDecoration: "none" }}>
          ← Back to Dashboard
        </Link>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 680, margin: "40px auto", padding: "0 16px 60px" }}>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: "#0b3ea8", margin: "0 0 6px" }}>💳 Billing & Subscription</h1>
        <p style={{ color: "#6b7280", fontSize: 15, margin: "0 0 32px" }}>Manage your TradeFlow subscription</p>

        {/* Status Card */}
        <div style={{
          background: isExpired ? "#fee2e2" : isActive ? "#dcfce7" : "#fef3c7",
          border: `2px solid ${isExpired ? "#fca5a5" : isActive ? "#86efac" : "#fcd34d"}`,
          borderRadius: 16, padding: "20px 24px", marginBottom: 24,
          display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12,
        }}>
          <div>
            <p style={{ margin: 0, fontWeight: 900, fontSize: 18, color: isExpired ? "#dc2626" : isActive ? "#16a34a" : "#d97706" }}>
              {isActive ? "✅ Active Subscription" : isExpired ? "⚠️ Trial Expired" : `⏳ Free Trial — ${daysLeft} day${daysLeft === 1 ? "" : "s"} left`}
            </p>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#374151" }}>
              {isActive
                ? `Next billing: ${company.next_billing_at ? new Date(company.next_billing_at).toLocaleDateString() : "—"}`
                : isExpired
                  ? "Your trial ended. Add a payment method to restore access."
                  : `Trial ends: ${new Date(company.trial_ends_at).toLocaleDateString()}`}
            </p>
          </div>
          <span style={{
            background: isExpired ? "#dc2626" : isActive ? "#16a34a" : "#f59e0b",
            color: "#fff", borderRadius: 8, padding: "6px 16px", fontWeight: 800, fontSize: 13,
          }}>
            {isActive ? "ACTIVE" : isExpired ? "EXPIRED" : "TRIAL"}
          </span>
        </div>

        {/* Pricing Breakdown */}
        <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", padding: "24px", marginBottom: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <h2 style={{ margin: "0 0 18px", fontSize: 18, fontWeight: 900, color: "#111" }}>📊 Your Plan</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "#f8fafc", borderRadius: 8 }}>
              <span style={{ fontWeight: 600, color: "#374151" }}>Base price</span>
              <span style={{ fontWeight: 800, color: "#111" }}>${BASE_PRICE}/mo</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "#f8fafc", borderRadius: 8 }}>
              <span style={{ fontWeight: 600, color: "#374151" }}>Employees ({empCount} × ${PER_EMPLOYEE})</span>
              <span style={{ fontWeight: 800, color: "#111" }}>${empCount * PER_EMPLOYEE}/mo</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 14px", background: "#0b3ea8", borderRadius: 10 }}>
              <span style={{ fontWeight: 900, color: "#fff", fontSize: 16 }}>Monthly Total</span>
              <span style={{ fontWeight: 900, color: "#fff", fontSize: 22 }}>${monthly}/mo</span>
            </div>
          </div>
          <p style={{ margin: "12px 0 0", fontSize: 12, color: "#9ca3af" }}>
            * Price adjusts automatically as you add or remove employees.
          </p>
        </div>

        {/* Payment Method */}
        <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", padding: "24px", marginBottom: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <h2 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 900, color: "#111" }}>💳 Payment Method</h2>
          <p style={{ margin: "0 0 18px", color: "#6b7280", fontSize: 13 }}>Your card is charged on the 1st of each month</p>

          {hasCard ? (
            <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", background: "#f0fdf4", borderRadius: 12, border: "1.5px solid #86efac" }}>
              <span style={{ fontSize: 28 }}>💳</span>
              <div>
                <p style={{ margin: 0, fontWeight: 800, color: "#16a34a", fontSize: 15 }}>{company.card_brand || "Card"} ending in ••••{company.card_last4 || "?"}</p>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: "#4ade80" }}>Active payment method</p>
              </div>
            </div>
          ) : (
            <CloverCardEntry accent={accent} slug={slug} companyId={company.id} />
          )}
        </div>

        {/* Need help */}
        <div style={{ background: "#f0f9ff", borderRadius: 12, border: "1px solid #bae6fd", padding: "16px 20px", textAlign: "center" }}>
          <p style={{ margin: 0, color: "#0369a1", fontSize: 14, fontWeight: 600 }}>
            Need help? Email us at <a href="mailto:support@tradeflowllc.com" style={{ color: "#0b3ea8", fontWeight: 800 }}>support@tradeflowllc.com</a>
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Clover Card Entry (placeholder until keys are configured) ──────────────
function CloverCardEntry({ accent, slug, companyId }) {
  const hasCloverKeys = !!(
    import.meta.env.VITE_CLOVER_PUBLIC_KEY &&
    import.meta.env.VITE_CLOVER_MERCHANT_ID
  );

  if (!hasCloverKeys) {
    return (
      <div style={{ border: "2px dashed #d1d5db", borderRadius: 12, padding: "32px 24px", textAlign: "center" }}>
        <p style={{ fontSize: 36, margin: "0 0 12px" }}>🔧</p>
        <p style={{ fontWeight: 900, color: "#374151", fontSize: 16, margin: "0 0 6px" }}>Card payments coming soon</p>
        <p style={{ color: "#6b7280", fontSize: 14, margin: "0 0 16px", lineHeight: 1.6 }}>
          We're setting up secure payment processing. Once active, you'll be able to enter your card here and billing will start automatically.
        </p>
        <p style={{ color: "#6b7280", fontSize: 13, margin: 0 }}>
          In the meantime, contact us at{" "}
          <a href="mailto:support@tradeflowllc.com" style={{ color: accent, fontWeight: 700 }}>
            support@tradeflowllc.com
          </a>{" "}
          to extend your trial.
        </p>
      </div>
    );
  }

  // ── CLOVER LIVE MODE ──────────────────────────────────────────────────────
  // When VITE_CLOVER_PUBLIC_KEY and VITE_CLOVER_MERCHANT_ID are set,
  // this section renders Clover's hosted card entry iframe.
  return (
    <CloverLiveEntry accent={accent} companyId={companyId} />
  );
}

// ── Clover Live Entry (only rendered when keys are present) ────────────────
function CloverLiveEntry({ accent, companyId }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [cloverReady, setCloverReady] = useState(false);
  const cloverRef = { current: null };

  // Load Clover SDK
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://checkout.clover.com/sdk.js";
    script.onload = () => {
      try {
        const clover = new window.Clover(import.meta.env.VITE_CLOVER_PUBLIC_KEY);
        const elements = clover.elements();
        cloverRef.current = clover;

        const cardNumber = elements.create("CARD_NUMBER");
        const cardDate = elements.create("CARD_DATE");
        const cardCvv = elements.create("CARD_CVV");
        const cardPostalCode = elements.create("CARD_POSTAL_CODE");

        cardNumber.mount("#clover-card-number");
        cardDate.mount("#clover-card-date");
        cardCvv.mount("#clover-card-cvv");
        cardPostalCode.mount("#clover-card-postal-code");

        setCloverReady(true);
      } catch (e) {
        setError("Failed to load payment form. Please refresh and try again.");
      }
    };
    document.head.appendChild(script);
    return () => { if (script.parentNode) script.parentNode.removeChild(script); };
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!cloverRef.current) return;
    setLoading(true);
    setError("");
    try {
      const result = await cloverRef.current.createToken();
      if (result.errors) {
        setError(Object.values(result.errors).join(". "));
        setLoading(false);
        return;
      }
      const token = result.token;
      const brand = result.card?.brand;
      const last4 = result.card?.last4;
      // Save token to Supabase
      await supabase.from("companies").update({
        clover_card_token: token,
        card_brand: brand,
        card_last4: last4,
        subscription_status: "active",
        last_billed_at: new Date().toISOString(),
        next_billing_at: new Date(Date.now() + 30 * 86400000).toISOString(),
      }).eq("id", companyId);
      setSuccess(true);
    } catch (err) {
      setError(err.message || "Failed to save card. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div style={{ textAlign: "center", padding: "24px", background: "#dcfce7", borderRadius: 12, border: "1.5px solid #86efac" }}>
        <p style={{ fontSize: 40 }}>🎉</p>
        <p style={{ fontWeight: 900, color: "#15803d", fontSize: 18 }}>Payment method saved!</p>
        <p style={{ color: "#16a34a", fontSize: 14 }}>Your subscription is now active. You'll be billed monthly.</p>
      </div>
    );
  }

  const fieldStyle = {
    border: "1.5px solid #d1d5db", borderRadius: 10, padding: "12px 14px",
    background: "#fff", width: "100%", boxSizing: "border-box", minHeight: 48,
  };

  return (
    <form onSubmit={handleSubmit}>
      {!cloverReady && <p style={{ color: "#9ca3af", fontSize: 13 }}>Loading payment form…</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 14, opacity: cloverReady ? 1 : 0.4, pointerEvents: cloverReady ? "auto" : "none" }}>
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6 }}>Card Number</label>
          <div id="clover-card-number" style={fieldStyle} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6 }}>Expiry</label>
            <div id="clover-card-date" style={fieldStyle} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6 }}>CVV</label>
            <div id="clover-card-cvv" style={fieldStyle} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6 }}>Zip</label>
            <div id="clover-card-postal-code" style={fieldStyle} />
          </div>
        </div>
        {error && (
          <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 8, padding: "10px 14px", color: "#dc2626", fontSize: 13, fontWeight: 600 }}>
            ⚠️ {error}
          </div>
        )}
        <button type="submit" disabled={loading || !cloverReady} style={{
          background: loading ? "#9ca3af" : accent, color: "#fff", border: "none",
          borderRadius: 12, padding: "14px", fontWeight: 900, fontSize: 16,
          cursor: loading ? "default" : "pointer",
          boxShadow: loading ? "none" : `0 4px 16px ${accent}55`,
        }}>
          {loading ? "⏳ Saving…" : "💳 Save & Activate"}
        </button>
      </div>
    </form>
  );
}
