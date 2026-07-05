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
      <NavLink to="/generators" style={linkStyle} onClick={() => onNavigate?.()}>
        ⚡ Generators
      </NavLink>
      <NavLink to="/vendors" style={linkStyle} onClick={() => onNavigate?.()}>
        Vendors
      </NavLink>
      <NavLink to="/payroll" style={linkStyle} onClick={() => onNavigate?.()}>
        💼 Payroll
      </NavLink>

      <NavLink to="/company-locations" style={linkStyle} onClick={() => onNavigate?.()}>
        🏢 Company Locations
      </NavLink>
      <NavLink to="/scheduled-notifications" style={linkStyle} onClick={() => onNavigate?.()}>
        ⏰ Scheduled Alerts
      </NavLink>

      {/* Communications — visible to admin and supervisors */}
      {isSupervisor && (
        <NavLink to="/communications" style={linkStyle} onClick={() => onNavigate?.()}>
          💬 Communications
        </NavLink>
      )}

      {/* Website Manager — visible to admin and supervisors */}
      {isSupervisor && (
        <NavLink to="/website-manager" style={linkStyle} onClick={() => onNavigate?.()}>
          🌐 Website Manager
        </NavLink>
      )}

      {isAdmin && (
        <NavLink to="/admin" style={linkStyle} onClick={() => onNavigate?.()}>
          Admin
        </NavLink>
      )}
    </div>
  );
}
