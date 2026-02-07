import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import DesktopHeader from "../Components/DesktopHeader";

export default function AdminDashboard() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAdmin) {
      navigate("/");
    }
  }, [isAdmin, navigate]);

  if (!isAdmin) {
    return null;
  }

  return (
    <>
      <DesktopHeader title="Admin Dashboard" />
      <div style={styles.container}>
        <h2 style={styles.title}>Admin Tools</h2>
        <p style={styles.subtitle}>Manage your system's data and configurations</p>

        <div style={styles.grid}>
          <div style={styles.card} onClick={() => navigate("/assemblies")}>
            <div style={styles.icon}>🔧</div>
            <h3 style={styles.cardTitle}>Assembly Manager</h3>
            <p style={styles.cardDescription}>
              Create and manage electrical assemblies with custom components
            </p>
            <button style={styles.cardButton}>Open</button>
          </div>

          <div style={styles.card} onClick={() => navigate("/base-materials")}>
            <div style={styles.icon}>📦</div>
            <h3 style={styles.cardTitle}>Base Materials Manager</h3>
            <p style={styles.cardDescription}>
              Manage the master catalog of materials
            </p>
            <button style={styles.cardButton}>Open</button>
          </div>

          <div style={styles.card} onClick={() => navigate("/check-stubs")}>
            <div style={styles.icon}>📄</div>
            <h3 style={styles.cardTitle}>Employee Check Stubs</h3>
            <p style={styles.cardDescription}>
              Upload and manage employee pay stubs for viewing in the mobile app
            </p>
            <button style={styles.cardButton}>Open</button>
          </div>
        </div>
      </div>
    </>
  );
}

const styles = {
  container: {
    padding: 40,
    maxWidth: 1200,
    margin: "0 auto"
  },
  title: {
    margin: 0,
    fontSize: 32,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8
  },
  subtitle: {
    margin: 0,
    fontSize: 16,
    color: "#666",
    marginBottom: 40
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: 24
  },
  card: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 32,
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
    cursor: "pointer",
    transition: "transform 0.2s, box-shadow 0.2s",
    border: "2px solid transparent"
  },
  icon: {
    fontSize: 48,
    marginBottom: 16
  },
  cardTitle: {
    margin: 0,
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 12
  },
  cardDescription: {
    margin: 0,
    fontSize: 14,
    color: "#666",
    lineHeight: 1.6,
    marginBottom: 24
  },
  cardButton: {
    width: "100%",
    padding: "12px 24px",
    backgroundColor: "#0070f3",
    color: "white",
    border: "none",
    borderRadius: 8,
    fontSize: 15,
    fontWeight: "bold",
    cursor: "pointer"
  }
};
