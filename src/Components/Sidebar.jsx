import { NavLink } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function Sidebar({ onNavigate }) {
  const { isAdmin } = useAuth();
  
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
        <NavLink to="/" style={linkStyle} onClick={() => onNavigate?.()}>
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
      <NavLink to="/employees" style={linkStyle} onClick={() => onNavigate?.()}>
        Employees
      </NavLink>
      <NavLink to="/timeclock" style={linkStyle} onClick={() => onNavigate?.()}>
        Time Clock
      </NavLink>
      {isAdmin && (
        <NavLink to="/admin" style={linkStyle} onClick={() => onNavigate?.()}>
          Admin
        </NavLink>
      )}
    </div>
  );
}
