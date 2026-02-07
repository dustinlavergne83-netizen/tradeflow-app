import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";

export default function TrialBalance() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);
  const [accounts, setAccounts] = useState([]);
  const [totals, setTotals] = useState({ totalDebits: 0, totalCredits: 0, difference: 0 });

  useEffect(() => {
    loadTrialBalance();
  }, [user, asOfDate]);

  async function loadTrialBalance() {
    try {
      setLoading(true);

      // Load all accounts
      const { data: accountsData, error: accountsError } = await supabase
        .from("accounts")
        .select("*")
        .eq("is_active", true)
        .order("account_number");

      if (accountsError) throw accountsError;

      // Load all posted journal entry lines up to the specified date
      const { data: linesData, error: linesError } = await supabase
        .from("journal_entry_lines")
        .select(`
          *,
          journal_entries!inner(
            entry_date,
            is_posted
          )
        `)
        .eq("journal_entries.is_posted", true)
        .lte("journal_entries.entry_date", asOfDate);

      if (linesError) throw linesError;

      // Calculate balances for each account
      const accountBalances = {};
      
      linesData.forEach(line => {
        const accountId = line.account_id;
        if (!accountBalances[accountId]) {
          accountBalances[accountId] = { debit: 0, credit: 0 };
        }
        accountBalances[accountId].debit += line.debit || 0;
        accountBalances[accountId].credit += line.credit || 0;
      });

      // Combine accounts with their balances
      const accountsWithBalances = accountsData.map(account => {
        const balance = accountBalances[account.id] || { debit: 0, credit: 0 };
        const netBalance = balance.debit - balance.credit;
        
        // Determine if account normally has debit or credit balance
        const isDebitAccount = ['asset', 'expense'].includes(account.account_type.toLowerCase());
        
        return {
          ...account,
          debitAmount: balance.debit,
          creditAmount: balance.credit,
          netBalance: netBalance,
          displayDebit: isDebitAccount && netBalance > 0 ? Math.abs(netBalance) : 
                       !isDebitAccount && netBalance < 0 ? Math.abs(netBalance) : 0,
          displayCredit: isDebitAccount && netBalance < 0 ? Math.abs(netBalance) : 
                        !isDebitAccount && netBalance > 0 ? Math.abs(netBalance) : 0
        };
      });

      // Filter to only show accounts with activity
      const activeAccounts = accountsWithBalances.filter(
        acc => acc.debitAmount > 0 || acc.creditAmount > 0
      );

      // Calculate totals
      const totalDebits = activeAccounts.reduce((sum, acc) => sum + acc.displayDebit, 0);
      const totalCredits = activeAccounts.reduce((sum, acc) => sum + acc.displayCredit, 0);
      const difference = Math.abs(totalDebits - totalCredits);

      setAccounts(activeAccounts);
      setTotals({ totalDebits, totalCredits, difference });
    } catch (err) {
      console.error("Error loading trial balance:", err);
      alert("Failed to load trial balance: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return '$0.00';
    return `$${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  const getAccountTypeColor = (type) => {
    const colors = {
      'asset': '#3b82f6',
      'liability': '#ef4444',
      'equity': '#8b5cf6',
      'income': '#10b981',
      'expense': '#f59e0b'
    };
    return colors[type.toLowerCase()] || '#6b7280';
  };

  const isBalanced = totals.difference < 0.01; // Within 1 cent tolerance

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading trial balance...</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <button onClick={() => navigate('/accounting')} style={styles.backButton}>
            ← Back to Accounting
          </button>
          <h1 style={styles.title}>📊 Trial Balance</h1>
          <p style={styles.subtitle}>Verify that debits equal credits</p>
        </div>
        <div style={styles.controls}>
          <div style={styles.dateControl}>
            <label style={styles.dateLabel}>As of Date:</label>
            <input
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
              style={styles.dateInput}
            />
          </div>
        </div>
      </div>

      {/* Balance Status Card */}
      <div style={{
        ...styles.statusCard,
        backgroundColor: isBalanced ? '#d1fae5' : '#fee2e2',
        borderColor: isBalanced ? '#10b981' : '#ef4444'
      }}>
        <div style={styles.statusIcon}>
          {isBalanced ? '✅' : '⚠️'}
        </div>
        <div style={styles.statusContent}>
          <h2 style={styles.statusTitle}>
            {isBalanced ? 'Books are Balanced!' : 'Books are Out of Balance'}
          </h2>
          <p style={styles.statusText}>
            {isBalanced 
              ? 'Your accounting records are in balance. Debits equal credits.'
              : `Difference: ${formatCurrency(totals.difference)} - Please review your journal entries.`
            }
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={styles.summaryGrid}>
        <div style={styles.summaryCard}>
          <div style={styles.summaryLabel}>Total Debits</div>
          <div style={{...styles.summaryValue, color: '#3b82f6'}}>
            {formatCurrency(totals.totalDebits)}
          </div>
        </div>
        <div style={styles.summaryCard}>
          <div style={styles.summaryLabel}>Total Credits</div>
          <div style={{...styles.summaryValue, color: '#10b981'}}>
            {formatCurrency(totals.totalCredits)}
          </div>
        </div>
        <div style={styles.summaryCard}>
          <div style={styles.summaryLabel}>Difference</div>
          <div style={{
            ...styles.summaryValue, 
            color: isBalanced ? '#10b981' : '#ef4444'
          }}>
            {formatCurrency(totals.difference)}
          </div>
        </div>
      </div>

      {/* Trial Balance Table */}
      <div style={styles.reportCard}>
        <div style={styles.reportHeader}>
          <h2 style={styles.reportTitle}>Trial Balance Report</h2>
          <p style={styles.reportDate}>As of {formatDate(asOfDate)}</p>
        </div>

        {accounts.length === 0 ? (
          <div style={styles.empty}>
            <p style={styles.emptyText}>No account activity found for this date range.</p>
            <p style={styles.emptySubtext}>
              Create journal entries to see data in the trial balance.
            </p>
          </div>
        ) : (
          <div style={styles.tableContainer}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.tableHeader}>
                  <th style={{...styles.th, textAlign: 'left'}}>Account #</th>
                  <th style={{...styles.th, textAlign: 'left'}}>Account Name</th>
                  <th style={{...styles.th, textAlign: 'left'}}>Type</th>
                  <th style={{...styles.th, textAlign: 'right'}}>Debit</th>
                  <th style={{...styles.th, textAlign: 'right'}}>Credit</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((account, idx) => (
                  <tr 
                    key={account.id} 
                    style={{
                      ...styles.tableRow,
                      backgroundColor: idx % 2 === 0 ? '#fff' : '#f9fafb'
                    }}
                  >
                    <td style={styles.td}>{account.account_number}</td>
                    <td style={styles.td}>
                      <strong>{account.account_name}</strong>
                    </td>
                    <td style={styles.td}>
                      <span style={{
                        ...styles.typeBadge,
                        backgroundColor: getAccountTypeColor(account.account_type) + '20',
                        color: getAccountTypeColor(account.account_type)
                      }}>
                        {account.account_type}
                      </span>
                    </td>
                    <td style={{...styles.td, textAlign: 'right', fontWeight: '600'}}>
                      {account.displayDebit > 0 ? formatCurrency(account.displayDebit) : '-'}
                    </td>
                    <td style={{...styles.td, textAlign: 'right', fontWeight: '600'}}>
                      {account.displayCredit > 0 ? formatCurrency(account.displayCredit) : '-'}
                    </td>
                  </tr>
                ))}
                {/* Totals Row */}
                <tr style={styles.totalsRow}>
                  <td colSpan="3" style={{...styles.td, fontWeight: 'bold', fontSize: 16}}>
                    TOTALS
                  </td>
                  <td style={{
                    ...styles.td, 
                    textAlign: 'right', 
                    fontWeight: 'bold', 
                    fontSize: 16,
                    borderTop: '3px solid #111',
                    color: '#3b82f6'
                  }}>
                    {formatCurrency(totals.totalDebits)}
                  </td>
                  <td style={{
                    ...styles.td, 
                    textAlign: 'right', 
                    fontWeight: 'bold', 
                    fontSize: 16,
                    borderTop: '3px solid #111',
                    color: '#10b981'
                  }}>
                    {formatCurrency(totals.totalCredits)}
                  </td>
                </tr>
                {/* Difference Row (if not balanced) */}
                {!isBalanced && (
                  <tr style={{backgroundColor: '#fee2e2'}}>
                    <td colSpan="3" style={{...styles.td, fontWeight: 'bold', color: '#ef4444'}}>
                      ⚠️ DIFFERENCE (Out of Balance)
                    </td>
                    <td colSpan="2" style={{
                      ...styles.td, 
                      textAlign: 'right', 
                      fontWeight: 'bold',
                      color: '#ef4444'
                    }}>
                      {formatCurrency(totals.difference)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div style={styles.actions}>
        <button 
          onClick={() => navigate('/accounting/general-ledger')}
          style={styles.actionButton}
        >
          📖 View General Ledger
        </button>
        <button 
          onClick={() => navigate('/accounting/journal-entry')}
          style={styles.actionButton}
        >
          ✏️ Create Journal Entry
        </button>
        <button 
          onClick={() => window.print()}
          style={{...styles.actionButton, backgroundColor: '#10b981'}}
        >
          🖨️ Print Report
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    maxWidth: 1400,
    margin: "0 auto",
    padding: "40px 20px",
    backgroundColor: "#0b3ea8",
    minHeight: "100vh",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 30,
    flexWrap: "wrap",
    gap: 20,
  },
  backButton: {
    padding: "8px 16px",
    backgroundColor: "#fff",
    border: "2px solid #e5e7eb",
    borderRadius: 6,
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    cursor: "pointer",
    marginBottom: 12,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#fff",
    margin: 0,
  },
  subtitle: {
    fontSize: 16,
    color: "#fff",
    marginTop: 8,
  },
  controls: {
    display: "flex",
    gap: 12,
    alignItems: "flex-end",
  },
  dateControl: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  dateLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
  dateInput: {
    padding: "10px 14px",
    fontSize: 15,
    border: "2px solid #e5e7eb",
    borderRadius: 6,
    backgroundColor: "#fff",
    color: "#111",
    fontWeight: "600",
    colorScheme: "light",
  },
  loading: {
    textAlign: "center",
    padding: 60,
    fontSize: 18,
    color: "#fff",
  },
  statusCard: {
    display: "flex",
    alignItems: "center",
    gap: 20,
    padding: 24,
    borderRadius: 12,
    border: "3px solid",
    marginBottom: 30,
  },
  statusIcon: {
    fontSize: 48,
  },
  statusContent: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#111",
    margin: "0 0 8px 0",
  },
  statusText: {
    fontSize: 15,
    color: "#666",
    margin: 0,
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
    gap: 20,
    marginBottom: 30,
  },
  summaryCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 24,
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  },
  summaryLabel: {
    fontSize: 14,
    color: "#666",
    marginBottom: 8,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: "bold",
  },
  reportCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    boxShadow: "0 2px 12px rgba(0,0,0,0.1)",
    marginBottom: 30,
    overflow: "hidden",
  },
  reportHeader: {
    padding: 28,
    borderBottom: "2px solid #e5e7eb",
  },
  reportTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#111",
    margin: "0 0 8px 0",
  },
  reportDate: {
    fontSize: 15,
    color: "#666",
    margin: 0,
  },
  empty: {
    textAlign: "center",
    padding: "60px 20px",
  },
  emptyText: {
    fontSize: 18,
    color: "#666",
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#999",
  },
  tableContainer: {
    overflow: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 14,
  },
  tableHeader: {
    backgroundColor: "#f9fafb",
    borderBottom: "2px solid #e5e7eb",
  },
  th: {
    padding: "16px",
    fontWeight: "700",
    color: "#374151",
    whiteSpace: "nowrap",
  },
  tableRow: {
    borderBottom: "1px solid #e5e7eb",
    transition: "background-color 0.15s",
  },
  td: {
    padding: "14px 16px",
    color: "#111",
  },
  typeBadge: {
    display: "inline-block",
    padding: "4px 10px",
    borderRadius: 6,
    fontSize: 12,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  totalsRow: {
    backgroundColor: "#f9fafb",
    borderTop: "3px solid #111",
  },
  actions: {
    display: "flex",
    gap: 16,
    justifyContent: "center",
    flexWrap: "wrap",
  },
  actionButton: {
    padding: "14px 28px",
    backgroundColor: "#fc6b04",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 16,
    fontWeight: "600",
    cursor: "pointer",
    boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
  },
};
