import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabase";
import logo from "../../assets/LOGOD.jpg";

const BRAND = { blue: "#0b3ea8", orange: "#fc6b04" };

export default function CustomerInvoices() {
  const navigate = useNavigate();
  const { customer, signOut } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all"); // all | unpaid | paid

  useEffect(() => {
    if (customer) loadInvoices();
  }, [customer]);

  async function loadInvoices() {
    setLoading(true);
    const { data, error } = await supabase
      .from("invoices")
      .select("*")
      .ilike("customer_name", `%${customer.name}%`)
      .order("invoice_date", { ascending: false });

    if (!error) setInvoices(data || []);
    setLoading(false);
  }

  async function handleSignOut() {
    await signOut();
    navigate("/customer/login");
  }

  const filtered = invoices.filter((inv) => {
    if (filter === "unpaid") return inv.status !== "paid";
    if (filter === "paid") return inv.status === "paid";
    return true;
  });

  const totalOwed = invoices
    .filter((i) => i.status !== "paid")
    .reduce((sum, i) => sum + (i.balance_due ?? i.total ?? 0), 0);

  function getStatusStyle(status) {
    const s = status?.toLowerCase();
    if (s === "paid") return { bg: "#dcfce7", color: "#15803d" };
    if (s === "overdue") return { bg: "#fee2e2", color: "#b91c1c" };
    if (s === "sent") return { bg: "#dbeafe", color: "#1d4ed8" };
    return { bg: "#f3f4f6", color: "#6b7280" };
  }

  // Build pay URL using the existing /invoice/view route (it uses query params)
  function getPayUrl(invoice) {
    return `/invoice/view?id=${invoice.id}`;
  }

  return (
    <div style={styles.page}>
      {/* HEADER */}
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <div style={styles.headerBrand}>
            <img src={logo} alt="DML Electrical" style={styles.headerLogo} />
            <div>
              <div style={styles.headerCompany}>DML Electrical Service</div>
              <div style={styles.headerPortalLabel}>Customer Portal</div>
            </div>
          </div>
          <nav style={styles.headerNav}>
            <button style={styles.navBtn} onClick={() => navigate("/customer/portal")}>Dashboard</button>
            <button style={{ ...styles.navBtn, ...styles.navBtnActive }}>Invoices</button>
            <button style={styles.navBtn} onClick={() => navigate("/customer/estimates")}>Estimates</button>
            <button style={styles.navBtnSignOut} onClick={handleSignOut}>Sign Out</button>
          </nav>
        </div>
      </header>

      <main style={styles.main}>
        <div style={styles.container}>
          {/* Back + Title */}
          <div style={styles.pageHeader}>
            <button style={styles.backBtn} onClick={() => navigate("/customer/portal")}>
              ← Dashboard
            </button>
            <h1 style={styles.pageTitle}>My Invoices</h1>
          </div>

          {/* Balance Due Banner */}
          {totalOwed > 0 && (
            <div style={styles.owedBanner}>
              <div>
                <div style={styles.owedLabel}>Total Balance Due</div>
                <div style={styles.owedAmount}>${totalOwed.toLocaleString()}</div>
              </div>
              <div style={styles.owedNote}>
                You have unpaid invoices. Click "Pay Now" on any invoice below.
              </div>
            </div>
          )}

          {/* Filters */}
          <div style={styles.filters}>
            {["all", "unpaid", "paid"].map((f) => (
              <button
                key={f}
                style={{ ...styles.filterBtn, ...(filter === f ? styles.filterBtnActive : {}) }}
                onClick={() => setFilter(f)}
              >
                {f === "all" ? "All Invoices" : f === "unpaid" ? "Unpaid" : "Paid"}
              </button>
            ))}
            <span style={styles.filterCount}>{filtered.length} invoice{filtered.length !== 1 ? "s" : ""}</span>
          </div>

          {loading ? (
            <div style={styles.loading}>Loading invoices...</div>
          ) : filtered.length === 0 ? (
            <div style={styles.empty}>
              <div style={{ fontSize: 56 }}>🧾</div>
              <div style={{ fontSize: 18, fontWeight: 700, margin: "16px 0 8px" }}>No invoices found</div>
              <div style={{ color: "#9ca3af", fontSize: 14 }}>
                {filter !== "all" ? "Try changing the filter above." : "Your invoices will appear here when sent."}
              </div>
            </div>
          ) : (
            <div style={styles.invoiceList}>
              {filtered.map((inv) => {
                const st = getStatusStyle(inv.status);
                const isPaid = inv.status?.toLowerCase() === "paid";
                const balance = inv.balance_due ?? inv.total ?? 0;

                return (
                  <div key={inv.id} style={styles.invoiceCard}>
                    {/* Card Header */}
                    <div style={styles.invoiceCardHeader}>
                      <div>
                        <div style={styles.invoiceTitle}>
                          {inv.project_name || "Invoice"}
                        </div>
                        <div style={styles.invoiceNumber}>
                          {inv.invoice_number ? `#${inv.invoice_number}` : `ID: ${inv.id}`}
                        </div>
                      </div>
                      <span style={{
                        ...styles.statusBadge,
                        backgroundColor: st.bg,
                        color: st.color,
                      }}>
                        {inv.status ? inv.status.charAt(0).toUpperCase() + inv.status.slice(1) : "Unknown"}
                      </span>
                    </div>

                    {/* Invoice Details */}
                    <div style={styles.invoiceDetails}>
                      <div style={styles.invoiceDetail}>
                        <span style={styles.detailLabel}>Invoice Date</span>
                        <span style={styles.detailValue}>
                          {inv.invoice_date
                            ? new Date(inv.invoice_date).toLocaleDateString()
                            : "N/A"}
                        </span>
                      </div>
                      <div style={styles.invoiceDetail}>
                        <span style={styles.detailLabel}>Invoice Total</span>
                        <span style={styles.detailValue}>${(inv.total || 0).toLocaleString()}</span>
                      </div>
                      {inv.amount_paid > 0 && (
                        <div style={styles.invoiceDetail}>
                          <span style={styles.detailLabel}>Amount Paid</span>
                          <span style={{ ...styles.detailValue, color: "#10b981" }}>
                            ${inv.amount_paid.toLocaleString()}
                          </span>
                        </div>
                      )}
                      <div style={styles.invoiceDetail}>
                        <span style={styles.detailLabel}>Balance Due</span>
                        <span style={{
                          ...styles.detailValue,
                          color: isPaid ? "#10b981" : "#ef4444",
                          fontWeight: 800,
                          fontSize: 18,
                        }}>
                          ${(isPaid ? 0 : balance).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={styles.invoiceActions}>
                      <a
                        href={getPayUrl(inv)}
                        target="_blank"
                        rel="noreferrer"
                        style={styles.viewBtn}
                      >
                        👁 View Invoice
                      </a>
                      {!isPaid && balance > 0 && (
                        <a
                          href={getPayUrl(inv)}
                          target="_blank"
                          rel="noreferrer"
                          style={styles.payNowBtn}
                        >
                          💳 Pay Now — ${balance.toLocaleString()}
                        </a>
                      )}
                      {isPaid && (
                        <span style={styles.paidBadge}>✅ Paid in Full</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <footer style={styles.footer}>
        <span>© {new Date().getFullYear()} DML Electrical Service</span>
        <span style={{ margin: "0 12px", opacity: 0.4 }}>|</span>
        <a href="tel:5550000000" style={styles.footerLink}>📞 (555) 000-0000</a>
      </footer>
    </div>
  );
}

const styles = {
  page: { minHeight: "100vh", backgroundColor: "#f1f5f9", display: "flex", flexDirection: "column" },
  header: { backgroundColor: BRAND.blue, padding: "12px 24px", boxShadow: "0 2px 12px rgba(0,0,0,0.2)", position: "sticky", top: 0, zIndex: 50 },
  headerInner: { maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 },
  headerBrand: { display: "flex", alignItems: "center", gap: 12 },
  headerLogo: { height: 44, objectFit: "contain" },
  headerCompany: { color: BRAND.orange, fontSize: 17, fontWeight: 900, fontStyle: "italic", lineHeight: 1.1 },
  headerPortalLabel: { color: "rgba(255,255,255,0.65)", fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" },
  headerNav: { display: "flex", alignItems: "center", gap: 8 },
  navBtn: { padding: "7px 14px", backgroundColor: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.75)", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer" },
  navBtnActive: { backgroundColor: "rgba(255,255,255,0.25)", color: "#fff", borderColor: "rgba(255,255,255,0.5)" },
  navBtnSignOut: { padding: "7px 14px", backgroundColor: "transparent", border: "2px solid rgba(255,255,255,0.4)", color: "#fff", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer" },
  main: { flex: 1, padding: "32px 24px" },
  container: { maxWidth: 900, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 },
  pageHeader: { display: "flex", alignItems: "center", gap: 16 },
  backBtn: { padding: "8px 16px", backgroundColor: "#fff", border: "2px solid #e5e7eb", color: "#374151", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" },
  pageTitle: { fontSize: 28, fontWeight: 800, color: "#111", margin: 0 },
  owedBanner: { backgroundColor: "#fef2f2", border: "2px solid #fecaca", borderRadius: 12, padding: "20px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" },
  owedLabel: { fontSize: 12, fontWeight: 700, color: "#991b1b", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  owedAmount: { fontSize: 32, fontWeight: 900, color: "#b91c1c" },
  owedNote: { fontSize: 14, color: "#b91c1c", maxWidth: 360, lineHeight: 1.5 },
  filters: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
  filterBtn: { padding: "8px 18px", backgroundColor: "#fff", border: "2px solid #e5e7eb", color: "#374151", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" },
  filterBtnActive: { backgroundColor: BRAND.blue, borderColor: BRAND.blue, color: "#fff" },
  filterCount: { marginLeft: "auto", fontSize: 13, color: "#9ca3af", fontWeight: 600 },
  loading: { textAlign: "center", padding: 60, color: "#6b7280", fontSize: 16 },
  empty: { backgroundColor: "#fff", borderRadius: 16, padding: 60, textAlign: "center", boxShadow: "0 1px 6px rgba(0,0,0,0.06)" },
  invoiceList: { display: "flex", flexDirection: "column", gap: 16 },
  invoiceCard: { backgroundColor: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 1px 8px rgba(0,0,0,0.06)", border: "1px solid #e5e7eb" },
  invoiceCardHeader: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16, gap: 12 },
  invoiceTitle: { fontSize: 18, fontWeight: 800, color: "#111", marginBottom: 4 },
  invoiceNumber: { fontSize: 13, color: "#9ca3af", fontWeight: 600 },
  statusBadge: { padding: "4px 12px", borderRadius: 20, fontSize: 13, fontWeight: 700, flexShrink: 0 },
  invoiceDetails: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16, padding: "16px 0", borderTop: "1px solid #f3f4f6", borderBottom: "1px solid #f3f4f6", marginBottom: 16 },
  invoiceDetail: { display: "flex", flexDirection: "column", gap: 4 },
  detailLabel: { fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.5 },
  detailValue: { fontSize: 16, fontWeight: 700, color: "#111" },
  invoiceActions: { display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" },
  viewBtn: { padding: "10px 20px", backgroundColor: "#f3f4f6", color: "#374151", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", textDecoration: "none", display: "inline-block" },
  payNowBtn: { padding: "10px 24px", backgroundColor: BRAND.orange, color: "#fff", border: "none", borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: "pointer", textDecoration: "none", display: "inline-block", boxShadow: "0 2px 8px rgba(252,107,4,0.3)" },
  paidBadge: { padding: "10px 16px", backgroundColor: "#dcfce7", color: "#15803d", borderRadius: 8, fontSize: 14, fontWeight: 700 },
  footer: { backgroundColor: "#1e293b", padding: "20px 24px", textAlign: "center", color: "rgba(255,255,255,0.5)", fontSize: 13 },
  footerLink: { color: "rgba(255,255,255,0.5)", textDecoration: "none", fontSize: 13 },
};
