import { useLocation, useNavigate } from "react-router-dom";
import logo from "../assets/LOGOD.jpg";
import { useAuth } from "../contexts/AuthContext";

const BRAND = {
  bg: "#0b3ea8",
  text: "#f97316",
};

function titleFromPath(pathname) {
  // map common routes to friendly titles
  if (!pathname || pathname === "/") return "Dashboard";
  if (pathname.startsWith("/project/new")) return "New Project";
  if (pathname.startsWith("/project/")) return "Project";
  if (pathname.startsWith("/estimate/new")) return "New Estimate";
  if (pathname.startsWith("/estimate/quick")) return "Quick Estimate";
  if (pathname.startsWith("/estimates")) return "Estimates";
  if (pathname.startsWith("/estimate")) return "Estimate";
  if (pathname.startsWith("/customers")) return "Customers";
  if (pathname.startsWith("/timeclock")) return "Time Clock";
  if (pathname.startsWith("/weekly")) return "Weekly Totals";
  if (pathname.startsWith("/employees")) return "Employees";
  if (pathname.startsWith("/check-stubs")) return "Check Stubs";
  if (pathname.startsWith("/payroll-approval")) return "💰 Payroll Approval Queue";
  if (pathname.startsWith("/payroll-upload")) return "📤 Pay Stub Upload";
  if (pathname.startsWith("/email-inbox")) return "📧 Email Inbox";
  if (pathname.startsWith("/pending-jobs")) return "Pending Jobs";
  if (pathname.startsWith("/profile-setup")) return "Profile Setup";
  if (pathname.startsWith("/accounting/chart-of-accounts")) return "Chart of Accounts";
  if (pathname.startsWith("/accounting/general-ledger")) return "General Ledger";
  if (pathname.startsWith("/accounting/journal-entry")) return "Journal Entry";
  if (pathname.startsWith("/accounting/reports/trial-balance")) return "Trial Balance";
  if (pathname.startsWith("/accounting/reports/profit-loss")) return "Profit & Loss";
  if (pathname.startsWith("/accounting/reports/balance-sheet")) return "Balance Sheet";
  if (pathname.startsWith("/accounting/reports/cash-flow")) return "Cash Flow Statement";
  if (pathname.startsWith("/accounting/bank-reconciliation")) return "Bank Reconciliation";
  if (pathname.startsWith("/accounting/bank-transactions")) return "Bank Transactions";
  if (pathname.startsWith("/accounting/bank-accounts")) return "Bank Accounts";
  if (pathname.startsWith("/accounting/bills")) return "Bills";
  if (pathname.startsWith("/accounting")) return "Accounting Dashboard";
  if (pathname.startsWith("/expenses")) return "Expenses";
  if (pathname.startsWith("/assemblies")) return "Assembly Manager";
  if (pathname.startsWith("/invoices")) return "Invoices";
  if (pathname.startsWith("/projects")) return "Projects";
  return pathname.replace(/^\//, "").replace(/-/g, " ").replace(/\//g, " - ").replace(/\b\w/g, c => c.toUpperCase());
}

export default function DesktopHeader({ title: propTitle }) {
  const navigate = useNavigate();
  const { employee, isAdmin, signOut } = useAuth();
  const { pathname } = useLocation();

  const title = propTitle || titleFromPath(pathname);

  // Hide header on customer-facing pages
  if (pathname === "/invoice/view" || pathname === "/invoice/commercial-public" || pathname === "/proposal/commercial-public") {
    return null;
  }

  async function handleSignOut() {
    await signOut();
    navigate("/signin");
  }

  return (
    <div className="siteHeader" style={styles.header}>
      <div className="headerInner">
        <div style={styles.leftBrand}>
          <div style={styles.brandTitle}>TradeFlow</div>
          <div style={styles.tagline}>Built for the Trades</div>
        </div>

        <div style={styles.center}>
          <div style={styles.pageTitle}>{title}</div>
        </div>

        <div style={styles.rightSection}>
          <div style={styles.userInfo}>
            {employee && (
              <>
                <span style={styles.userName}>{employee.full_name || employee.first_name || 'User'}</span>
                {isAdmin && <span style={styles.adminBadge}>ADMIN</span>}
              </>
            )}
            <button
              onClick={() => window.open("https://app.tradeflowllc.com/hub", "_self")}
              style={styles.switchButton}
              title="Go back to Hub to switch between DML and TradeFlow"
            >
              🔀 Switch Company
            </button>
            <button
              onClick={() => window.open("/", "_blank")}
              style={styles.websiteButton}
            >
              🌐 Website
            </button>
            <button onClick={handleSignOut} style={styles.signOutButton}>
              Sign Out
            </button>
          </div>
          <img src={logo} alt="Logo" style={styles.logo} />
        </div>
      </div>
    </div>
  );
}

const styles = {
  header: {
    backgroundColor: BRAND.bg,
    padding: "8px 18px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    height: 70,
  },

  brand: {
    width: 240,
    display: "flex",
    alignItems: "center",
  },
  logoSmall: {
    height: 62,
    width: "auto",
    objectFit: "contain",
  },
  logo: {
    height: 50,
    width: "auto",
    objectFit: "contain",
    marginLeft: 12,
  },
  leftBrand: {
    width: 240,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "flex-start",
  },
  brandTitle: {
    color: BRAND.text,
    fontSize: 24,
    fontWeight: 900,
    fontStyle: "italic",
    marginBottom: 2,
  },
  tagline: {
    color: "#fff",
    fontSize: 13,
    fontWeight: 700,
    marginTop: 0,
  },
  dashboardBtn: {
    padding: '6px 10px',
    background: '#ff6210',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontWeight: 800,
    cursor: 'pointer',
    boxShadow: '0 1px 0 rgba(0,0,0,0.2)'
  },
  center: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  pageTitle: {
    color: BRAND.text,
    fontSize: 28,
    fontWeight: 900,
    letterSpacing: 0.5,
  },
  rightSection: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 20,
  },
  userInfo: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  userName: {
    color: "#fff",
    fontSize: 15,
    fontWeight: 600,
  },
  adminBadge: {
    backgroundColor: BRAND.text,
    color: "#fff",
    padding: "4px 8px",
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 0.5,
  },
  switchButton: {
    padding: "7px 14px",
    backgroundColor: "#fc6b04",
    border: "none",
    color: "#fff",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 700,
  },
  websiteButton: {
    padding: "7px 14px",
    backgroundColor: "rgba(255,255,255,0.12)",
    border: "1px solid rgba(255,255,255,0.35)",
    color: "#fff",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
  },
  signOutButton: {
    padding: "8px 16px",
    backgroundColor: "transparent",
    border: "2px solid #fff",
    color: "#fff",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 600,
  },
};
