import { NavLink } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function Sidebar({ onNavigate }) {
  const { isAdmin, employee } = useAuth();

  const isSupervisor = employee?.role === "supervisor" || employee?.role === "admin";

  const linkStyle = ({ isActive }) => ({
    display: "block",
    padding: "12px 14px",
    color: "white",
    textDecoration: "none",
    fontWeight: isActive ? 800 : 600,
    background: isActive ? "rgba(255,255,255,0.12)" : "transparent",
    borderRadius: 10,
    marginBottom: 6,
  });

  return (
    <div style={{ padding: 12, paddingTop: 8 }}>
      <div style={{ marginTop: 8, marginBottom: 8 }}>
        <NavLink to="/dashboard" style={linkStyle} onClick={() => onNavigate?.()}>
          Dashboard
        </NavLink>
      </div>
      <NavLink to="/projects" style={linkStyle} onClick={() => onNavigate?.()}>
        Projects
      </NavLink>
      <NavLink to="/estimates" style={linkStyle} onClick={() => onNavigate?.()}>
        Estimates
      </NavLink>
      <NavLink to="/invoices" style={linkStyle} onClick={() => onNavigate?.()}>
        Invoices
      </NavLink>
      <NavLink to="/expenses" style={linkStyle} onClick={() => onNavigate?.()}>
        Expenses
      </NavLink>
      <NavLink to="/accounting" style={linkStyle} onClick={() => onNavigate?.()}>
        Accounting
      </NavLink>
      <NavLink to="/customers" style={linkStyle} onClick={() => onNavigate?.()}>
        Customers
      </NavLink>
      <NavLink to="/vendors" style={linkStyle} onClick={() => onNavigate?.()}>
        Vendors
      </NavLink>
      {/* ── Payroll & Employees section ─────────────────────────────────── */}
      <div style={{ marginTop: 10, marginBottom: 4 }}>
        <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 10, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase", padding: "0 14px 4px" }}>
          Payroll
        </div>
        <NavLink to="/employees" style={linkStyle} onClick={() => onNavigate?.()}>
          👤 Employees
        </NavLink>
        <NavLink to="/timeclock" style={linkStyle} onClick={() => onNavigate?.()}>
          🕐 Time Clock
        </NavLink>
        <NavLink to="/payroll-approval" style={linkStyle} onClick={() => onNavigate?.()}>
          💰 Payroll Approval
        </NavLink>
        <NavLink to="/payroll-upload" style={linkStyle} onClick={() => onNavigate?.()}>
          📤 Upload Stubs
        </NavLink>
      </div>

      <NavLink to="/company-locations" style={linkStyle} onClick={() => onNavigate?.()}>
        🏢 Company Locations
      </NavLink>
      <NavLink to="/scheduled-notifications" style={linkStyle} onClick={() => onNavigate?.()}>
        ⏰ Scheduled Alerts
      </NavLink>

      {/* Communications — visible to admin and supervisors */}
      {isSupervisor && (
        <NavLink
          to="/communications"
          style={({ isActive }) => ({
            display: "block",
            padding: "12px 14px",
            color: "white",
            textDecoration: "none",
            fontWeight: isActive ? 800 : 600,
            background: isActive ? "rgba(34,197,94,0.25)" : "rgba(34,197,94,0.1)",
            borderRadius: 10,
            marginBottom: 6,
            border: "1px solid rgba(34,197,94,0.3)",
          })}
          onClick={() => onNavigate?.()}
        >
          💬 Communications
        </NavLink>
      )}

      {/* Website Manager — visible to admin and supervisors */}
      {isSupervisor && (
        <NavLink
          to="/website-manager"
          style={({ isActive }) => ({
            display: "block",
            padding: "12px 14px",
            color: "white",
            textDecoration: "none",
            fontWeight: isActive ? 800 : 600,
            background: isActive ? "rgba(252,107,4,0.25)" : "rgba(252,107,4,0.1)",
            borderRadius: 10,
            marginBottom: 6,
            border: "1px solid rgba(252,107,4,0.3)",
          })}
          onClick={() => onNavigate?.()}
        >
          🌐 Website Manager
        </NavLink>
      )}

      {isAdmin && (
        <NavLink to="/admin" style={linkStyle} onClick={() => onNavigate?.()}>
          Admin
        </NavLink>
      )}

      {/* Super Admin — platform owner only */}
      {employee?.is_super_admin && (
        <NavLink
          to="/super-admin"
          style={({ isActive }) => ({
            display: "block",
            padding: "12px 14px",
            color: "white",
            textDecoration: "none",
            fontWeight: isActive ? 800 : 600,
            background: isActive ? "rgba(139,92,246,0.35)" : "rgba(139,92,246,0.15)",
            borderRadius: 10,
            marginBottom: 6,
            marginTop: 8,
            border: "1px solid rgba(139,92,246,0.4)",
          })}
          onClick={() => onNavigate?.()}
        >
          🛡️ Super Admin
        </NavLink>
      )}
    </div>
  );
}
