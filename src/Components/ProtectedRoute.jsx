import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import Sidebar from "./Sidebar.jsx";
import AIAssistant from "./AIAssistant.jsx";

export default function ProtectedRoute({ children }) {
  const { user, employee, customer, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={styles.loading}>
        <div style={styles.spinner}></div>
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/signin" replace />;
  }

  // Customer users should not access employee/admin routes
  if (customer && !employee) {
    return <Navigate to="/customer/portal" replace />;
  }

  if (employee && (!employee.last_name?.trim() || !employee.phone?.trim()) && location.pathname !== "/profile-setup") {
    return <Navigate to="/profile-setup" replace />;
  }

  // Layout wrapper: sidebar + main content (header is global)
  return (
    <div className="appShell">
      <div className="sidebar">
        <Sidebar />
      </div>
      <div className="main" style={{ padding: 24 }}>
        {children}
      </div>
      {/* Global AI floating button — available on every page */}
      <AIAssistant floating={true} />
    </div>
  );
}

const styles = {
  loading: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
    backgroundColor: "#0b3ea8",
    color: "#fff",
    fontSize: 18,
  },
  spinner: {
    border: "4px solid rgba(255, 255, 255, 0.3)",
    borderTop: "4px solid #f97316",
    borderRadius: "50%",
    width: 50,
    height: 50,
    animation: "spin 1s linear infinite",
    marginBottom: 16,
  },
};
