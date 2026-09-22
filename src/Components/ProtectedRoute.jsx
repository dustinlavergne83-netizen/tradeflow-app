import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useFeatures } from "../lib/useFeatures";
import { hasCustomProjectTypes } from "../lib/projectTypes";
import Sidebar from "./Sidebar.jsx";
import AIAssistant from "./AIAssistant.jsx";

export default function ProtectedRoute({ children, feature, requireCustomCatalog }) {
  const { user, employee, customer, company, loading } = useAuth();
  const features = useFeatures();
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

  // Per-company feature gate — e.g. <ProtectedRoute feature="generators">.
  // Blocks direct URL access, not just the sidebar link, when a company
  // has this feature turned off in companies.settings.
  if (feature && features[feature] === false) {
    return <Navigate to="/dashboard" replace />;
  }

  // Routes only meaningful for companies with a custom service
  // catalog (e.g. /contracts for DT Specialties). Companies without
  // one (DML, and any company without settings.projectTypes) never
  // see or reach this route.
  if (requireCustomCatalog && !hasCustomProjectTypes(company)) {
    return <Navigate to="/dashboard" replace />;
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
