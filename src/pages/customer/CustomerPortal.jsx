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

export default function CustomerPortal() {
  const navigate = useNavigate();
  const { customer, signOut } = useAuth();

  const [invoices, setInvoices] = useState([]);
  const [estimates, setEstimates] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (customer) {
      loadCustomerData();
    }
  }, [customer]);

  async function loadCustomerData() {
    setLoading(true);
    try {
      await Promise.all([
        loadInvoices(),
        loadEstimates(),
        loadProjects(),
      ]);
    } catch (err) {
      console.error("Error loading customer data:", err);
    } finally {
      setLoading(false);
    }
  }

  async function loadInvoices() {
    const { data, error } = await supabase
      .from("invoices")
      .select("id, invoice_number, project_name, total, status, invoice_date, balance_due, amount_paid")
      .ilike("customer_name", `%${customer.name}%`)
      .order("invoice_date", { ascending: false })
      .limit(10);

    if (!error) setInvoices(data || []);
  }

  async function loadEstimates() {
    const { data: estimateData } = await supabase
      .from("estimates")
      .select("id, estimate_number, project_name, total, status, created_at, customer_name")
      .ilike("customer_name", `%${customer.name}%`)
      .order("created_at", { ascending: false })
      .limit(10);

    setEstimates(estimateData || []);
  }

  async function loadProjects() {
    const { data } = await supabase
      .from("projects")
      .select("id, name, status, percent_complete, address, active_worth")
      .ilike("customer", `%${customer.name}%`)
      .order("created_at", { ascending: false })
      .limit(5);

    setProjects(data || []);
  }

  async function handleSignOut() {
    await signOut();
    navigate("/customer/login");
  }

  // Totals
  const totalOwed = invoices
    .filter((i) => i.status !== "paid")
    .reduce((sum, i) => sum + (i.balance_due ?? i.total ?? 0), 0);
  const totalPaid = invoices
    .filter((i) => i.status === "paid")
    .reduce((sum, i) => sum + (i.total ?? 0), 0);
  const openInvoices = invoices.filter((i) => i.status !== "paid").length;

  function statusBadge(status) {
    const map = {
      paid: { bg: "#dcfce7", color: "#15803d", label: "Paid" },
      sent: { bg: "#dbeafe", color: "#1d4ed8", label: "Sent" },
      draft: { bg: "#f3f4f6", color: "#6b7280", label: "Draft" },
      overdue: { bg: "#fee2e2", color: "#b91c1c", label: "Overdue" },
      approved: { bg: "#dcfce7", color: "#15803d", label: "Approved" },
      pending: { bg: "#fef9c3", color: "#92400e", label: "Pending" },
    };
    const s = map[status?.toLowerCase()] || { bg: "#f3f4f6", color: "#6b7280", label: status || "Unknown" };
    return (
      <span style={{
        backgroundColor: s.bg,
        color: s.color,
        padding: "3px 10px",
        borderRadius: 20,
        fontSize: 12,
        fontWeight: 700,
      }}>
        {s.label}
      </span>
    );
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
          <div style={styles.headerRight}>
            <div style={styles.headerGreeting}>
              👤 <strong>{customer?.name || "Customer"}</strong>
            </div>
            <button style={styles.headerBtn} onClick={() => navigate("/welcome")}>
              Website
            </button>
            <button style={styles.headerSignOut} onClick={handleSignOut}>
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* CONTENT */}
      <main style={styles.main}>
        <div style={styles.container}>
          {/* Welcome Banner */}
          <div style={styles.welcomeBanner}>
            <div>
              <h1 style={styles.welcomeTitle}>
                Welcome back, {customer?.name?.split(" ")[0] || "there"}! 👋
              </h1>
              <p style={styles.welcomeSubtitle}>
                Manage your invoices, view project status, and access your documents all in one place.
              </p>
            </div>
            <div style={styles.welcomeActions}>
              <button
                style={styles.welcomeActionBtn}
                onClick={() => navigate("/welcome#contact")}
              >
                📞 Contact Us
              </button>
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: 60, color: "#6b7280", fontSize: 16 }}>
              Loading your portal...
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              <div style={styles.statsGrid}>
                <StatCard
                  icon="💳"
                  label="Balance Due"
                  value={`$${totalOwed.toLocaleString()}`}
                  color={totalOwed > 0 ? "#ef4444" : "#10b981"}
                  onClick={() => navigate("/customer/invoices")}
                />
                <StatCard
                  icon="✅"
                  label="Total Paid"
                  value={`$${totalPaid.toLocaleString()}`}
                  color="#10b981"
                  onClick={() => navigate("/customer/invoices")}
                />
                <StatCard
                  icon="📋"
                  label="Open Invoices"
                  value={openInvoices}
                  color={openInvoices > 0 ? "#f59e0b" : "#10b981"}
                  onClick={() => navigate("/customer/invoices")}
                />
                <StatCard
                  icon="🔨"
                  label="Active Projects"
                  value={projects.filter((p) => ["active", "in progress", "in-progress"].includes(p.status?.toLowerCase())).length}
                  color="#0b3ea8"
                />
              </div>

              {/* Two column layout */}
              <div style={styles.twoCol}>
                {/* Invoices */}
                <div style={styles.card}>
                  <div style={styles.cardHeader}>
                    <h2 style={styles.cardTitle}>💳 Recent Invoices</h2>
                    <button style={styles.viewAllBtn} onClick={() => navigate("/customer/invoices")}>
                      View All →
                    </button>
                  </div>

                  {invoices.length === 0 ? (
                    <EmptyState icon="🧾" text="No invoices yet" />
                  ) : (
                    <div style={styles.list}>
                      {invoices.slice(0, 5).map((inv) => (
                        <div key={inv.id} style={styles.listRow}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={styles.listTitle}>
                              {inv.project_name || `Invoice #${inv.invoice_number || inv.id}`}
                            </div>
                            <div style={styles.listSub}>
                              {inv.invoice_date
                                ? new Date(inv.invoice_date).toLocaleDateString()
                                : "N/A"}
                            </div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                            {statusBadge(inv.status)}
                            <span style={{
                              fontWeight: 700,
                              fontSize: 15,
                              color: inv.status === "paid" ? "#10b981" : "#111",
                              minWidth: 80,
                              textAlign: "right",
                            }}>
                              ${(inv.total || 0).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {totalOwed > 0 && (
                    <button
                      style={styles.payBtn}
                      onClick={() => navigate("/customer/invoices")}
                    >
                      💳 Pay Balance: ${totalOwed.toLocaleString()}
                    </button>
                  )}
                </div>

                {/* Estimates / Proposals */}
                <div style={styles.card}>
                  <div style={styles.cardHeader}>
                    <h2 style={styles.cardTitle}>📋 Estimates & Proposals</h2>
                    <button style={styles.viewAllBtn} onClick={() => navigate("/customer/estimates")}>
                      View All →
                    </button>
                  </div>

                  {estimates.length === 0 ? (
                    <EmptyState icon="📝" text="No estimates yet" />
                  ) : (
                    <div style={styles.list}>
                      {estimates.slice(0, 5).map((est) => (
                        <div key={est.id} style={styles.listRow}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={styles.listTitle}>
                              {est.project_name || `Proposal #${est.proposal_number || est.estimate_number || est.id}`}
                            </div>
                            <div style={styles.listSub}>
                              {est.created_at
                                ? new Date(est.created_at).toLocaleDateString()
                                : "N/A"}
                            </div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                            {statusBadge(est.status)}
                            <span style={{ fontWeight: 700, fontSize: 15, minWidth: 80, textAlign: "right" }}>
                              ${(est.total || 0).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Projects */}
              {projects.length > 0 && (
                <div style={styles.card}>
                  <div style={styles.cardHeader}>
                    <h2 style={styles.cardTitle}>🔨 Your Projects</h2>
                  </div>
                  <div style={styles.projectsGrid}>
                    {projects.map((proj) => (
                      <div key={proj.id} style={styles.projectCard}>
                        <div style={styles.projectHeader}>
                          <div style={styles.projectName}>{proj.name}</div>
                          {statusBadge(proj.status)}
                        </div>
                        {proj.address && (
                          <div style={styles.projectAddress}>📍 {proj.address}</div>
                        )}
                        {proj.percent_complete > 0 && (
                          <div style={styles.progressSection}>
                            <div style={styles.progressLabel}>
                              Progress: {proj.percent_complete}%
                            </div>
                            <div style={styles.progressBar}>
                              <div
                                style={{
                                  ...styles.progressFill,
                                  width: `${proj.percent_complete}%`,
                                }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Help Section */}
              <div style={styles.helpCard}>
                <div style={styles.helpIcon}>💬</div>
                <div>
                  <div style={styles.helpTitle}>Need help or have a question?</div>
                  <div style={styles.helpText}>
                    Contact DML Electrical Service and we'll get back to you quickly.
                  </div>
                </div>
                <div style={styles.helpActions}>
                  <a href="tel:5550000000" style={styles.helpPhone}>
                    📞 (555) 000-0000
                  </a>
                  <a href="mailto:info@dmlelectrical.com" style={styles.helpEmail}>
                    📧 Email Us
                  </a>
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      {/* FOOTER */}
      <footer style={styles.footer}>
        <span>© {new Date().getFullYear()} DML Electrical Service</span>
        <span style={{ margin: "0 12px", opacity: 0.4 }}>|</span>
        <button style={styles.footerLink} onClick={() => navigate("/welcome")}>Website</button>
        <span style={{ margin: "0 12px", opacity: 0.4 }}>|</span>
        <a href="mailto:info@dmlelectrical.com" style={styles.footerLink}>Contact</a>
      </footer>
    </div>
  );
}

function StatCard({ icon, label, value, color, onClick }) {
  return (
    <div
      style={{
        ...styles.statCard,
        cursor: onClick ? "pointer" : "default",
        borderTop: `4px solid ${color}`,
      }}
      onClick={onClick}
    >
      <div style={styles.statIcon}>{icon}</div>
      <div>
        <div style={{ ...styles.statValue, color }}>{value}</div>
        <div style={styles.statLabel}>{label}</div>
      </div>
    </div>
  );
}

function EmptyState({ icon, text }) {
  return (
    <div style={{ textAlign: "center", padding: "40px 20px", color: "#9ca3af" }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>{icon}</div>
      <div style={{ fontSize: 15 }}>{text}</div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    backgroundColor: "#f1f5f9",
    display: "flex",
    flexDirection: "column",
  },
  header: {
    backgroundColor: BRAND.blue,
    padding: "12px 24px",
    boxShadow: "0 2px 12px rgba(0,0,0,0.2)",
    position: "sticky",
    top: 0,
    zIndex: 50,
  },
  headerInner: {
    maxWidth: 1100,
    margin: "0 auto",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  headerBrand: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  headerLogo: {
    height: 44,
    objectFit: "contain",
  },
  headerCompany: {
    color: BRAND.orange,
    fontSize: 17,
    fontWeight: 900,
    fontStyle: "italic",
    lineHeight: 1.1,
  },
  headerPortalLabel: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: 14,
  },
  headerGreeting: {
    color: "#fff",
    fontSize: 14,
    fontWeight: 600,
  },
  headerBtn: {
    padding: "7px 14px",
    backgroundColor: "rgba(255,255,255,0.12)",
    border: "1px solid rgba(255,255,255,0.3)",
    color: "#fff",
    borderRadius: 7,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
  headerSignOut: {
    padding: "7px 14px",
    backgroundColor: "transparent",
    border: "2px solid rgba(255,255,255,0.4)",
    color: "#fff",
    borderRadius: 7,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
  main: {
    flex: 1,
    padding: "32px 24px",
  },
  container: {
    maxWidth: 1100,
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    gap: 24,
  },
  welcomeBanner: {
    background: `linear-gradient(120deg, ${BRAND.darkBlue} 0%, ${BRAND.blue} 100%)`,
    borderRadius: 16,
    padding: "28px 32px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 16,
  },
  welcomeTitle: {
    fontSize: 26,
    fontWeight: 800,
    color: "#fff",
    margin: "0 0 6px 0",
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.75)",
    margin: 0,
    maxWidth: 500,
  },
  welcomeActions: {
    display: "flex",
    gap: 12,
    flexShrink: 0,
  },
  welcomeActionBtn: {
    padding: "10px 20px",
    backgroundColor: BRAND.orange,
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: 16,
  },
  statCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: "20px 24px",
    display: "flex",
    alignItems: "center",
    gap: 16,
    boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
    cursor: "default",
    transition: "transform 0.15s, box-shadow 0.15s",
  },
  statIcon: {
    fontSize: 36,
    flexShrink: 0,
  },
  statValue: {
    fontSize: 28,
    fontWeight: 800,
    lineHeight: 1,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: "#6b7280",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  twoCol: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
    gap: 24,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    boxShadow: "0 1px 8px rgba(0,0,0,0.06)",
  },
  cardHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 800,
    color: "#111",
    margin: 0,
  },
  viewAllBtn: {
    padding: "6px 14px",
    backgroundColor: BRAND.blue,
    color: "#fff",
    border: "none",
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  listRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 0",
    borderBottom: "1px solid #f3f4f6",
  },
  listTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: "#111",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    marginBottom: 2,
  },
  listSub: {
    fontSize: 12,
    color: "#9ca3af",
  },
  payBtn: {
    display: "block",
    width: "100%",
    marginTop: 16,
    padding: "12px",
    backgroundColor: BRAND.orange,
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
  },
  projectsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: 16,
  },
  projectCard: {
    backgroundColor: "#f9fafb",
    borderRadius: 10,
    padding: 18,
    border: "1px solid #e5e7eb",
  },
  projectHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 8,
    flexWrap: "wrap",
  },
  projectName: {
    fontSize: 15,
    fontWeight: 700,
    color: "#111",
  },
  projectAddress: {
    fontSize: 13,
    color: "#6b7280",
    marginBottom: 12,
  },
  progressSection: {
    marginTop: 8,
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: 700,
    color: "#374151",
    marginBottom: 6,
  },
  progressBar: {
    height: 8,
    backgroundColor: "#e5e7eb",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: BRAND.orange,
    borderRadius: 4,
    transition: "width 0.5s ease",
  },
  helpCard: {
    backgroundColor: "#eff6ff",
    border: "2px solid #bfdbfe",
    borderRadius: 16,
    padding: "20px 24px",
    display: "flex",
    alignItems: "center",
    gap: 20,
    flexWrap: "wrap",
  },
  helpIcon: {
    fontSize: 40,
    flexShrink: 0,
  },
  helpTitle: {
    fontSize: 16,
    fontWeight: 800,
    color: "#1e40af",
    marginBottom: 4,
  },
  helpText: {
    fontSize: 14,
    color: "#3b82f6",
  },
  helpActions: {
    display: "flex",
    gap: 12,
    marginLeft: "auto",
    flexWrap: "wrap",
  },
  helpPhone: {
    padding: "10px 18px",
    backgroundColor: BRAND.blue,
    color: "#fff",
    borderRadius: 8,
    textDecoration: "none",
    fontSize: 14,
    fontWeight: 700,
  },
  helpEmail: {
    padding: "10px 18px",
    backgroundColor: "transparent",
    border: `2px solid ${BRAND.blue}`,
    color: BRAND.blue,
    borderRadius: 8,
    textDecoration: "none",
    fontSize: 14,
    fontWeight: 700,
  },
  footer: {
    backgroundColor: "#1e293b",
    padding: "20px 24px",
    textAlign: "center",
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
  },
  footerLink: {
    color: "rgba(255,255,255,0.5)",
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: 13,
    textDecoration: "none",
  },
};
