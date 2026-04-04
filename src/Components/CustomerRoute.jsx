

import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

/**
 * Protects customer-only portal routes.
 * - Not logged in → redirect to /customer/login
 * - Logged in as employee/admin → redirect to /dashboard
 * - Logged in as customer → render children
 */
export default function CustomerRoute({ children }) {
  const { user, customer, employee, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        minHeight: "100vh",
        backgroundColor: "#0b3ea8",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
        <div style={{ color: "#fff", fontSize: 18, fontWeight: 600 }}>Loading...</div>
      </div>
    );
  }

  // Not logged in at all
  if (!user) {
    return <Navigate to="/customer/login" replace />;
  }

  // Logged in as an employee/admin — send them to the app
  if (employee) {
    return <Navigate to="/dashboard" replace />;
  }

  // Logged in but not found in customers table
  if (!customer) {
    return (
      <div style={{
        minHeight: "100vh",
        backgroundColor: "#f9fafb",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}>
        <div style={{
          backgroundColor: "#fff",
          borderRadius: 16,
          padding: 48,
          maxWidth: 480,
          width: "100%",
          textAlign: "center",
          boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
        }}>
          <div style={{ fontSize: 56, marginBottom: 20 }}>🔒</div>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: "#111", marginBottom: 12 }}>
            Portal Access Required
          </h2>
          <p style={{ color: "#6b7280", fontSize: 15, lineHeight: 1.7, marginBottom: 28 }}>
            Your account doesn't have customer portal access yet. Please contact DML Electrical Service to be set up in our system.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <a href="tel:5550000000" style={{
              display: "block",
              padding: "12px",
              backgroundColor: "#0b3ea8",
              color: "#fff",
              borderRadius: 8,
              textDecoration: "none",
              fontWeight: 700,
              fontSize: 15,
            }}>
              📞 Call (555) 000-0000
            </a>
            <button
              onClick={() => window.location.href = "/customer/login"}
              style={{
                padding: "12px",
                backgroundColor: "transparent",
                border: "2px solid #e5e7eb",
                color: "#374151",
                borderRadius: 8,
                fontWeight: 600,
                fontSize: 15,
                cursor: "pointer",
              }}
            >
              ← Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return children;
}
