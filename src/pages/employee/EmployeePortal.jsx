import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabase";
import logo from "../../assets/LOGOD.jpg";

const BRAND = { blue: "#0b3ea8", orange: "#fc6b04", darkBlue: "#092d7e" };

export default function EmployeePortal() {
  const navigate = useNavigate();
  const { employee, signOut } = useAuth();
  const [clockStatus, setClockStatus] = useState(null); // null | { shiftId, clockIn }
  const [weekHours, setWeekHours] = useState(0);
  const [recentShifts, setRecentShifts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (employee) {
      loadEmployeePortalData();
    }
  }, [employee]);

  async function loadEmployeePortalData() {
    setLoading(true);
    try {
      await Promise.all([
        loadClockStatus(),
        loadWeekHours(),
        loadRecentShifts(),
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function loadClockStatus() {
    const { data } = await supabase
      .from("shifts")
      .select("id, clock_in")
      .eq("user_id", employee.user_id || employee.id)
      .is("clock_out", null)
      .maybeSingle();

    setClockStatus(data ? { shiftId: data.id, clockIn: data.clock_in } : null);
  }

  async function loadWeekHours() {
    const now = new Date();
    const day = now.getDay();
    const daysBack = day === 0 ? 6 : day - 1;
    const monday = new Date(now);
    monday.setDate(now.getDate() - daysBack);
    monday.setHours(0, 0, 0, 0);

    const { data } = await supabase
      .from("shifts")
      .select("clock_in, clock_out")
      .eq("user_id", employee.user_id || employee.id)
      .gte("clock_in", monday.toISOString())
      .not("clock_out", "is", null);

    const total = (data || []).reduce((sum, s) => {
      const h = (new Date(s.clock_out) - new Date(s.clock_in)) / 3600000;
      return sum + h;
    }, 0);
    setWeekHours(Math.round(total * 10) / 10);
  }

  async function loadRecentShifts() {
    const { data } = await supabase
      .from("shifts")
      .select("id, clock_in, clock_out, project_id")
      .eq("user_id", employee.user_id || employee.id)
      .not("clock_out", "is", null)
      .order("clock_in", { ascending: false })
      .limit(7);

    setRecentShifts(data || []);
  }

  async function handleSignOut() {
    await signOut();
    navigate("/signin");
  }

  function getElapsed(clockIn) {
    const diff = Date.now() - new Date(clockIn).getTime();
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return `${h}h ${m}m`;
  }

  function formatHours(clock_in, clock_out) {
    if (!clock_out) return "–";
    const h = (new Date(clock_out) - new Date(clock_in)) / 3600000;
    return `${Math.round(h * 10) / 10}h`;
  }

  function formatTime(iso) {
    if (!iso) return "–";
    return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  }

  function formatDate(iso) {
    if (!iso) return "–";
    return new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  }

  const quickLinks = [
    { icon: "⏱️", label: "Time Clock", path: "/timeclock", desc: "Clock in & out" },
    { icon: "📅", label: "My Timesheets", path: "/timeclock/history", desc: "View your hours" },
    { icon: "💵", label: "Pay Stubs", path: "/check-stubs", desc: "Check stubs" },
    { icon: "🏖️", label: "Time Off", path: "/time-off", desc: "Request time off" },
    { icon: "📊", label: "Weekly Totals", path: "/weekly", desc: "This week summary" },
    { icon: "🗺️", label: "My Location", path: "/employee-locations", desc: "Location history" },
  ];

  return (
    <div style={styles.page}>
      {/* HEADER */}
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <div style={styles.headerBrand}>
            <img src={logo} alt="DML Electrical" style={styles.headerLogo} />
            <div>
              <div style={styles.headerCompany}>DML Electrical Service</div>
              <div style={styles.headerPortalLabel}>Employee Portal</div>
            </div>
          </div>
          <div style={styles.headerRight}>
            <span style={styles.headerGreeting}>
              👷 <strong>{employee?.full_name || employee?.first_name || "Employee"}</strong>
            </span>
            {employee?.role === "admin" && (
              <button
                style={styles.headerAdminBtn}
                onClick={() => navigate("/dashboard")}
              >
                ⚙️ Admin Dashboard
              </button>
            )}
            <button style={styles.headerSignOut} onClick={handleSignOut}>
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main style={styles.main}>
        <div style={styles.container}>
          {/* Welcome */}
          <div style={styles.welcomeBanner}>
            <div>
              <h1 style={styles.welcomeTitle}>
                Good {getGreeting()}, {employee?.first_name || "there"}! 👷
              </h1>
              <p style={styles.welcomeSubtitle}>
                {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
              </p>
            </div>
            <button
              style={styles.timeClockBtn}
              onClick={() => navigate("/timeclock")}
            >
              ⏱️ Go to Time Clock
            </button>
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: 60, color: "#6b7280" }}>Loading...</div>
          ) : (
            <>
              {/* Clock Status Banner */}
              {clockStatus ? (
                <div style={styles.clockedInBanner}>
                  <div style={styles.clockedInDot} />
                  <div>
                    <div style={styles.clockedInTitle}>🟢 You are clocked in</div>
                    <div style={styles.clockedInSub}>
                      Since {formatTime(clockStatus.clockIn)} · {getElapsed(clockStatus.clockIn)} elapsed
                    </div>
                  </div>
                  <button
                    style={styles.clockOutBtn}
                    onClick={() => navigate("/timeclock")}
                  >
                    Clock Out →
                  </button>
                </div>
              ) : (
                <div style={styles.notClockedBanner}>
                  <div style={{ fontSize: 28 }}>⏸️</div>
                  <div>
                    <div style={styles.notClockedTitle}>You are not clocked in</div>
                    <div style={styles.notClockedSub}>Tap below to start your shift</div>
                  </div>
                  <button
                    style={styles.clockInBtn}
                    onClick={() => navigate("/timeclock")}
                  >
                    Clock In →
                  </button>
                </div>
              )}

              {/* Stats row */}
              <div style={styles.statsRow}>
                <div style={styles.statCard}>
                  <div style={styles.statIcon}>📅</div>
                  <div>
                    <div style={styles.statValue}>{weekHours}h</div>
                    <div style={styles.statLabel}>Hours This Week</div>
                  </div>
                </div>
                <div style={styles.statCard}>
                  <div style={styles.statIcon}>🏢</div>
                  <div>
                    <div style={styles.statValue}>{employee?.role || "Employee"}</div>
                    <div style={styles.statLabel}>Your Role</div>
                  </div>
                </div>
                <div style={styles.statCard}>
                  <div style={styles.statIcon}>📞</div>
                  <div>
                    <div style={styles.statValue}>{employee?.phone || "N/A"}</div>
                    <div style={styles.statLabel}>Phone on File</div>
                  </div>
                </div>
              </div>

              {/* Quick Links */}
              <div style={styles.section}>
                <h2 style={styles.sectionTitle}>Quick Access</h2>
                <div style={styles.quickGrid}>
                  {quickLinks.map((link, i) => (
                    <button
                      key={i}
                      style={styles.quickCard}
                      onClick={() => navigate(link.path)}
                    >
                      <div style={styles.quickIcon}>{link.icon}</div>
                      <div style={styles.quickLabel}>{link.label}</div>
                      <div style={styles.quickDesc}>{link.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Recent Shifts */}
              <div style={styles.section}>
                <div style={styles.sectionHeader}>
                  <h2 style={styles.sectionTitle}>Recent Shifts</h2>
                  <button
                    style={styles.viewAllBtn}
                    onClick={() => navigate("/timeclock/history")}
                  >
                    View Full History →
                  </button>
                </div>

                {recentShifts.length === 0 ? (
                  <div style={styles.emptyShifts}>No recent shifts found</div>
                ) : (
                  <div style={styles.shiftList}>
                    {recentShifts.map((shift) => (
                      <div key={shift.id} style={styles.shiftRow}>
                        <div style={styles.shiftDate}>{formatDate(shift.clock_in)}</div>
                        <div style={styles.shiftTimes}>
                          {formatTime(shift.clock_in)} → {formatTime(shift.clock_out)}
                        </div>
                        <div style={styles.shiftHours}>
                          {formatHours(shift.clock_in, shift.clock_out)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Company Contact */}
              <div style={styles.helpCard}>
                <div style={{ fontSize: 32 }}>🏢</div>
                <div>
                  <div style={styles.helpTitle}>DML Electrical Service</div>
                  <div style={styles.helpText}>Questions? Contact the office or your supervisor.</div>
                </div>
                <a href="tel:3372880395" style={styles.helpPhone}>
                  📞 (337) 288-0395
                </a>
              </div>
            </>
          )}
        </div>
      </main>

      <footer style={styles.footer}>
        © {new Date().getFullYear()} DML Electrical Service — Employee Portal
      </footer>
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

const styles = {
  page: { minHeight: "100vh", backgroundColor: "#f1f5f9", display: "flex", flexDirection: "column" },
  header: { backgroundColor: BRAND.blue, padding: "12px 24px", boxShadow: "0 2px 12px rgba(0,0,0,0.2)", position: "sticky", top: 0, zIndex: 50 },
  headerInner: { maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 },
  headerBrand: { display: "flex", alignItems: "center", gap: 12 },
  headerLogo: { height: 44, objectFit: "contain" },
  headerCompany: { color: BRAND.orange, fontSize: 17, fontWeight: 900, fontStyle: "italic", lineHeight: 1.1 },
  headerPortalLabel: { color: "rgba(255,255,255,0.65)", fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" },
  headerRight: { display: "flex", alignItems: "center", gap: 12 },
  headerGreeting: { color: "#fff", fontSize: 14, fontWeight: 600 },
  headerAdminBtn: { padding: "7px 14px", backgroundColor: BRAND.orange, border: "none", color: "#fff", borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: "pointer" },
  headerSignOut: { padding: "7px 14px", backgroundColor: "transparent", border: "2px solid rgba(255,255,255,0.4)", color: "#fff", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer" },
  main: { flex: 1, padding: "32px 24px" },
  container: { maxWidth: 900, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 },
  welcomeBanner: { background: `linear-gradient(120deg, ${BRAND.darkBlue} 0%, ${BRAND.blue} 100%)`, borderRadius: 16, padding: "24px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 },
  welcomeTitle: { fontSize: 24, fontWeight: 800, color: "#fff", margin: "0 0 4px 0" },
  welcomeSubtitle: { fontSize: 14, color: "rgba(255,255,255,0.7)", margin: 0 },
  timeClockBtn: { padding: "12px 24px", backgroundColor: BRAND.orange, color: "#fff", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: "pointer" },
  clockedInBanner: { backgroundColor: "#f0fdf4", border: "2px solid #86efac", borderRadius: 14, padding: "16px 20px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" },
  clockedInDot: { width: 14, height: 14, borderRadius: "50%", backgroundColor: "#16a34a", flexShrink: 0, boxShadow: "0 0 0 4px rgba(22,163,74,0.2)" },
  clockedInTitle: { fontSize: 17, fontWeight: 800, color: "#15803d" },
  clockedInSub: { fontSize: 13, color: "#16a34a" },
  clockOutBtn: { marginLeft: "auto", padding: "10px 20px", backgroundColor: "#16a34a", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: "pointer" },
  notClockedBanner: { backgroundColor: "#fff7ed", border: "2px solid #fed7aa", borderRadius: 14, padding: "16px 20px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" },
  notClockedTitle: { fontSize: 17, fontWeight: 800, color: "#c2410c" },
  notClockedSub: { fontSize: 13, color: "#ea580c" },
  clockInBtn: { marginLeft: "auto", padding: "10px 20px", backgroundColor: BRAND.orange, color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: "pointer" },
  statsRow: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 },
  statCard: { backgroundColor: "#fff", borderRadius: 12, padding: "18px 20px", display: "flex", alignItems: "center", gap: 14, boxShadow: "0 1px 6px rgba(0,0,0,0.06)" },
  statIcon: { fontSize: 32 },
  statValue: { fontSize: 22, fontWeight: 800, color: "#111", lineHeight: 1.1, marginBottom: 2 },
  statLabel: { fontSize: 12, color: "#6b7280", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3 },
  section: { backgroundColor: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 1px 8px rgba(0,0,0,0.06)" },
  sectionHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: 800, color: "#111", margin: "0 0 16px 0" },
  viewAllBtn: { padding: "6px 14px", backgroundColor: BRAND.blue, color: "#fff", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: "pointer" },
  quickGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12 },
  quickCard: { display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: 16, backgroundColor: "#f8fafc", border: "2px solid #e5e7eb", borderRadius: 12, cursor: "pointer", textAlign: "center", transition: "all 0.15s" },
  quickIcon: { fontSize: 32 },
  quickLabel: { fontSize: 14, fontWeight: 700, color: "#111" },
  quickDesc: { fontSize: 12, color: "#9ca3af" },
  emptyShifts: { textAlign: "center", padding: "32px 20px", color: "#9ca3af", fontSize: 14 },
  shiftList: { display: "flex", flexDirection: "column", gap: 4 },
  shiftRow: { display: "flex", alignItems: "center", gap: 16, padding: "10px 0", borderBottom: "1px solid #f3f4f6" },
  shiftDate: { fontWeight: 700, fontSize: 14, color: "#111", width: 160, flexShrink: 0 },
  shiftTimes: { flex: 1, fontSize: 14, color: "#6b7280" },
  shiftHours: { fontWeight: 800, fontSize: 16, color: BRAND.orange, flexShrink: 0, minWidth: 40, textAlign: "right" },
  helpCard: { backgroundColor: "#eff6ff", border: "2px solid #bfdbfe", borderRadius: 16, padding: "16px 20px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" },
  helpTitle: { fontSize: 16, fontWeight: 800, color: "#1e40af" },
  helpText: { fontSize: 13, color: "#3b82f6" },
  helpPhone: { marginLeft: "auto", padding: "10px 18px", backgroundColor: BRAND.blue, color: "#fff", borderRadius: 8, textDecoration: "none", fontSize: 14, fontWeight: 700 },
  footer: { backgroundColor: "#1e293b", padding: "20px 24px", textAlign: "center", color: "rgba(255,255,255,0.4)", fontSize: 13 },
};
