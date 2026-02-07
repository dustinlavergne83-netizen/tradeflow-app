import { useNavigate } from "react-router-dom";

export default function AccountingDashboard() {
  const navigate = useNavigate();

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>📊 Accounting Dashboard</h1>
      </div>

      {/* Accounting Modules */}
      <div style={styles.modulesSection}>
        <h2 style={styles.sectionTitle}>Accounting Modules</h2>
        <div style={styles.modulesGrid}>
          <div 
            style={styles.moduleCard}
            onClick={() => navigate('/accounting/chart-of-accounts')}
          >
            <div style={styles.moduleIcon}>📋</div>
            <div style={styles.moduleContent}>
              <h3 style={styles.moduleName}>Chart of Accounts</h3>
              <p style={styles.moduleDesc}>Manage your accounts structure</p>
            </div>
          </div>

          <div 
            style={styles.moduleCard}
            onClick={() => navigate('/accounting/general-ledger')}
          >
            <div style={styles.moduleIcon}>📖</div>
            <div style={styles.moduleContent}>
              <h3 style={styles.moduleName}>General Ledger</h3>
              <p style={styles.moduleDesc}>View all journal entries</p>
            </div>
          </div>

          <div 
            style={styles.moduleCard}
            onClick={() => navigate('/accounting/journal-entry')}
          >
            <div style={styles.moduleIcon}>✏️</div>
            <div style={styles.moduleContent}>
              <h3 style={styles.moduleName}>Journal Entry</h3>
              <p style={styles.moduleDesc}>Create manual entries</p>
            </div>
          </div>

          <div 
            style={styles.moduleCard}
            onClick={() => navigate('/accounting/bank-accounts')}
          >
            <div style={styles.moduleIcon}>🏦</div>
            <div style={styles.moduleContent}>
              <h3 style={styles.moduleName}>Bank Accounts</h3>
              <p style={styles.moduleDesc}>Manage bank accounts</p>
            </div>
          </div>

          <div 
            style={styles.moduleCard}
            onClick={() => navigate('/accounting/bank-reconciliation')}
          >
            <div style={styles.moduleIcon}>🔄</div>
            <div style={styles.moduleContent}>
              <h3 style={styles.moduleName}>Bank Reconciliation</h3>
              <p style={styles.moduleDesc}>Reconcile your accounts</p>
            </div>
          </div>

          <div 
            style={styles.moduleCard}
            onClick={() => navigate('/accounting/bills')}
          >
            <div style={styles.moduleIcon}>📄</div>
            <div style={styles.moduleContent}>
              <h3 style={styles.moduleName}>Bills (A/P)</h3>
              <p style={styles.moduleDesc}>Track vendor bills</p>
            </div>
          </div>
        </div>
      </div>

      {/* Financial Reports */}
      <div style={styles.modulesSection}>
        <h2 style={styles.sectionTitle}>Financial Reports</h2>
        <div style={styles.modulesGrid}>
          <div 
            style={styles.moduleCard}
            onClick={() => navigate('/accounting/reports/trial-balance')}
          >
            <div style={styles.moduleIcon}>📊</div>
            <div style={styles.moduleContent}>
              <h3 style={styles.moduleName}>Trial Balance</h3>
              <p style={styles.moduleDesc}>Verify debits equal credits</p>
            </div>
          </div>
          <div 
            style={styles.moduleCard}
            onClick={() => navigate('/accounting/reports/profit-loss')}
          >
            <div style={styles.moduleIcon}>💰</div>
            <div style={styles.moduleContent}>
              <h3 style={styles.moduleName}>Profit & Loss</h3>
              <p style={styles.moduleDesc}>Income statement report</p>
            </div>
          </div>
          <div 
            style={styles.moduleCard}
            onClick={() => navigate('/accounting/reports/balance-sheet')}
          >
            <div style={styles.moduleIcon}>⚖️</div>
            <div style={styles.moduleContent}>
              <h3 style={styles.moduleName}>Balance Sheet</h3>
              <p style={styles.moduleDesc}>Financial position statement</p>
            </div>
          </div>
          <div 
            style={styles.moduleCard}
            onClick={() => navigate('/accounting/reports/cash-flow')}
          >
            <div style={styles.moduleIcon}>💵</div>
            <div style={styles.moduleContent}>
              <h3 style={styles.moduleName}>Cash Flow Statement</h3>
              <p style={styles.moduleDesc}>Track cash movements</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    maxWidth: 1600,
    margin: "0 auto",
    padding: "40px 20px",
    backgroundColor: "#0b3ea8",
    minHeight: "100vh",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 40,
  },
  title: {
    fontSize: 36,
    fontWeight: "bold",
    color: "#fff",
    margin: 0,
  },
  modulesSection: {
    marginBottom: 40,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 24,
  },
  modulesGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: 20,
  },
  moduleCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 24,
    display: "flex",
    alignItems: "center",
    gap: 16,
    cursor: "pointer",
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
    transition: "all 0.2s",
    border: "2px solid transparent",
  },
  moduleIcon: {
    fontSize: 40,
  },
  moduleContent: {
    flex: 1,
  },
  moduleName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111",
    margin: "0 0 4px 0",
  },
  moduleDesc: {
    fontSize: 13,
    color: "#666",
    margin: 0,
  },
};
