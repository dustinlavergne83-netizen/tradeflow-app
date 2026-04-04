import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabase";
import logo from "../../assets/LOGOD.jpg";

const BRAND = { blue: "#0b3ea8", orange: "#fc6b04" };

export default function CustomerEstimates() {
  const navigate = useNavigate();
  const { customer, signOut } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState("proposals"); // "proposals" | "estimates"

  useEffect(() => {
    if (customer) loadData();
  }, [customer]);

  async function loadData() {
    setLoading(true);
    const { data: estData } = await supabase
      .from("estimates")
      .select("*")
      .ilike("customer_name", `%${customer.name}%`)
      .order("created_at", { ascending: false });

    setItems(estData || []);
    setSource("estimates");
    setLoading(false);
  }

  async function handleSignOut() {
    await signOut();
    navigate("/customer/login");
  }

  function getStatusStyle(status) {
    const s = status?.toLowerCase();
    if (s === "approved" || s === "accepted") return { bg: "#dcfce7", color: "#15803d" };
    if (s === "sent") return { bg: "#dbeafe", color: "#1d4ed8" };
    if (s === "draft") return { bg: "#f3f4f6", color: "#6b7280" };
    if (s === "rejected" || s === "declined") return { bg: "#fee2e2", color: "#b91c1c" };
    if (s === "pending") return { bg: "#fef9c3", color: "#92400e" };
    return { bg: "#f3f4f6", color: "#6b7280" };
  }

  function getViewUrl(item) {
    return `/estimate/quick/view?id=${item.id}`;
  }

  const pending = items.filter((i) => {
    const s = i.status?.toLowerCase();
    return s !== "approved" && s !== "accepted" && s !== "rejected" && s !== "declined";
  });

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
            <button style={styles.navBtn} onClick={() => navigate("/customer/invoices")}>Invoices</button>
            <button style={{ ...styles.navBtn, ...styles.navBtnActive }}>Estimates</button>
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
            <h1 style={styles.pageTitle}>Estimates & Proposals</h1>
          </div>

          {/* Pending action banner */}
          {pending.length > 0 && (
            <div style={styles.pendingBanner}>
              <span style={styles.pendingIcon}>📋</span>
              <div>
                <div style={styles.pendingTitle}>
                  {pending.length} estimate{pending.length !== 1 ? "s" : ""} awaiting your review
                </div>
                <div style={styles.pendingText}>
                  Review and view the details of your pending estimates below.
                </div>
              </div>
            </div>
          )}

          {loading ? (
            <div style={styles.loading}>Loading estimates...</div>
          ) : items.length === 0 ? (
            <div style={styles.empty}>
              <div style={{ fontSize: 56 }}>📝</div>
              <div style={{ fontSize: 18, fontWeight: 700, margin: "16px 0 8px" }}>No estimates yet</div>
              <div style={{ color: "#9ca3af", fontSize: 14 }}>
                Estimates and proposals will appear here when sent to you.
              </div>
              <div style={{ marginTop: 24 }}>
                <a href="tel:5550000000" style={styles.requestBtn}>
                  📞 Request an Estimate
                </a>
              </div>
            </div>
          ) : (
            <div style={styles.list}>
              {items.map((item) => {
                const st = getStatusStyle(item.status);
                const title = item.project_name ||
                  item.description ||
                  `${source === "proposals" ? "Proposal" : "Estimate"} #${item.proposal_number || item.estimate_number || item.id}`;
                const docNum = item.proposal_number || item.estimate_number;
                const date = item.created_at
                  ? new Date(item.created_at).toLocaleDateString()
                  : "N/A";
                const viewUrl = getViewUrl(item);

                return (
                  <div key={item.id} style={styles.card}>
                    <div style={styles.cardHeader}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={styles.cardTitle}>{title}</div>
                        <div style={styles.cardMeta}>
                          {docNum ? `#${docNum}` : source === "proposals" ? "Proposal" : "Estimate"}
                          {" · "}
                          {date}
                        </div>
                      </div>
                      <span style={{ ...styles.statusBadge, backgroundColor: st.bg, color: st.color }}>
                        {item.status
                          ? item.status.charAt(0).toUpperCase() + item.status.slice(1)
                          : "Pending"}
                      </span>
                    </div>

                    {/* Amount */}
                    <div style={styles.amountRow}>
                      <div style={styles.amountBlock}>
                        <div style={styles.amountLabel}>Estimate Total</div>
                        <div style={styles.amountValue}>
                          ${(item.total || 0).toLocaleString()}
                        </div>
                      </div>

                      {item.description && (
                        <div style={styles.descBlock}>
                          <div style={styles.amountLabel}>Description</div>
                          <div style={styles.descValue}>{item.description}</div>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div style={styles.actions}>
                      <a
                        href={viewUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={styles.viewBtn}
                      >
                        👁 View Full Document
                      </a>
                      {(item.status?.toLowerCase() === "sent" ||
                        !item.status ||
                        item.status?.toLowerCase() === "pending") && (
                        <div style={styles.acceptNote}>
                          ℹ️ Contact us to accept or ask questions about this estimate.
                        </div>
                      )}
                      {(item.status?.toLowerCase() === "approved" ||
                        item.status?.toLowerCase() === "accepted") && (
                        <span style={styles.approvedBadge}>✅ Accepted</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Contact section */}
          <div style={styles.contactCard}>
            <div style={styles.contactIcon}>💬</div>
            <div>
              <div style={styles.contactTitle}>Questions about an estimate?</div>
              <div style={styles.contactText}>
                Give us a call or send an email — we're happy to explain any details or make adjustments.
              </div>
            </div>
            <div style={styles.contactActions}>
              <a href="tel:5550000000" style={styles.contactPhone}>
                📞 (555) 000-0000
              </a>
              <a href="mailto:info@dmlelectrical.com" style={styles.contactEmail}>
                📧 Email Us
              </a>
            </div>
          </div>
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
  pendingBanner: { backgroundColor: "#fffbeb", border: "2px solid #fde68a", borderRadius: 12, padding: "16px 20px", display: "flex", alignItems: "center", gap: 16 },
  pendingIcon: { fontSize: 32, flexShrink: 0 },
  pendingTitle: { fontSize: 16, fontWeight: 800, color: "#92400e", marginBottom: 4 },
  pendingText: { fontSize: 13, color: "#b45309" },
  loading: { textAlign: "center", padding: 60, color: "#6b7280", fontSize: 16 },
  empty: { backgroundColor: "#fff", borderRadius: 16, padding: 60, textAlign: "center", boxShadow: "0 1px 6px rgba(0,0,0,0.06)" },
  requestBtn: { padding: "12px 24px", backgroundColor: BRAND.orange, color: "#fff", borderRadius: 8, textDecoration: "none", fontWeight: 700, fontSize: 15, display: "inline-block" },
  list: { display: "flex", flexDirection: "column", gap: 16 },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 1px 8px rgba(0,0,0,0.06)", border: "1px solid #e5e7eb" },
  cardHeader: { display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 16 },
  cardTitle: { fontSize: 18, fontWeight: 800, color: "#111", marginBottom: 4 },
  cardMeta: { fontSize: 13, color: "#9ca3af", fontWeight: 600 },
  statusBadge: { padding: "4px 12px", borderRadius: 20, fontSize: 13, fontWeight: 700, flexShrink: 0 },
  amountRow: { display: "flex", gap: 24, padding: "16px 0", borderTop: "1px solid #f3f4f6", borderBottom: "1px solid #f3f4f6", marginBottom: 16, flexWrap: "wrap" },
  amountBlock: {},
  amountLabel: { fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  amountValue: { fontSize: 24, fontWeight: 800, color: "#111" },
  descBlock: { flex: 1 },
  descValue: { fontSize: 14, color: "#374151", lineHeight: 1.5 },
  actions: { display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" },
  viewBtn: { padding: "10px 20px", backgroundColor: BRAND.blue, color: "#fff", borderRadius: 8, textDecoration: "none", fontSize: 14, fontWeight: 700, display: "inline-block" },
  acceptNote: { fontSize: 13, color: "#6b7280", fontStyle: "italic" },
  approvedBadge: { padding: "10px 16px", backgroundColor: "#dcfce7", color: "#15803d", borderRadius: 8, fontSize: 14, fontWeight: 700 },
  contactCard: { backgroundColor: "#eff6ff", border: "2px solid #bfdbfe", borderRadius: 16, padding: "20px 24px", display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" },
  contactIcon: { fontSize: 40, flexShrink: 0 },
  contactTitle: { fontSize: 16, fontWeight: 800, color: "#1e40af", marginBottom: 4 },
  contactText: { fontSize: 14, color: "#3b82f6" },
  contactActions: { display: "flex", gap: 12, marginLeft: "auto", flexWrap: "wrap" },
  contactPhone: { padding: "10px 18px", backgroundColor: BRAND.blue, color: "#fff", borderRadius: 8, textDecoration: "none", fontSize: 14, fontWeight: 700 },
  contactEmail: { padding: "10px 18px", backgroundColor: "transparent", border: `2px solid ${BRAND.blue}`, color: BRAND.blue, borderRadius: 8, textDecoration: "none", fontSize: 14, fontWeight: 700 },
  footer: { backgroundColor: "#1e293b", padding: "20px 24px", textAlign: "center", color: "rgba(255,255,255,0.5)", fontSize: 13 },
  footerLink: { color: "rgba(255,255,255,0.5)", textDecoration: "none", fontSize: 13 },
};
