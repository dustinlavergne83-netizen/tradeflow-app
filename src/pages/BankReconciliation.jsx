import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

export default function BankReconciliation() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [bankAccounts, setBankAccounts] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reconciling, setReconciling] = useState(false);
  
  // Reconciliation state
  const [statementDate, setStatementDate] = useState(new Date().toISOString().split('T')[0]);
  const [statementEndingBalance, setStatementEndingBalance] = useState('');
  const [selectedTransactions, setSelectedTransactions] = useState(new Set());
  const [startingBalance, setStartingBalance] = useState(0);

  useEffect(() => {
    loadBankAccounts();
  }, [user]);

  useEffect(() => {
    if (selectedAccountId) {
      loadAccountData();
    }
  }, [selectedAccountId]);

  async function loadBankAccounts() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("bank_accounts")
        .select("*")
        .eq("company_id", user.id)
        .eq("is_active", true)
        .order("account_name", { ascending: true });

      if (error) throw error;
      setBankAccounts(data || []);
    } catch (err) {
      console.error("Error loading bank accounts:", err);
      alert("Failed to load bank accounts");
    } finally {
      setLoading(false);
    }
  }

  async function loadAccountData() {
    try {
      setLoading(true);
      
      // Load selected account details
      const { data: accountData, error: accountError } = await supabase
        .from("bank_accounts")
        .select("*")
        .eq("id", selectedAccountId)
        .single();

      if (accountError) throw accountError;
      setSelectedAccount(accountData);
      
      // Calculate starting balance (last reconciled balance or opening balance)
      const startBal = accountData.last_reconciled_balance !== null 
        ? accountData.last_reconciled_balance 
        : accountData.opening_balance || 0;
      setStartingBalance(startBal);

      // Load unreconciled transactions
      const { data: transData, error: transError } = await supabase
        .from("bank_transactions")
        .select("*")
        .eq("bank_account_id", selectedAccountId)
        .eq("is_reconciled", false)
        .order("transaction_date", { ascending: true });

      if (transError) throw transError;
      setTransactions(transData || []);
      
      // Pre-select cleared transactions
      const clearedIds = new Set(
        transData.filter(t => t.is_cleared).map(t => t.id)
      );
      setSelectedTransactions(clearedIds);
    } catch (err) {
      console.error("Error loading account data:", err);
      alert("Failed to load account data");
    } finally {
      setLoading(false);
    }
  }

  function toggleTransaction(transactionId) {
    const newSelected = new Set(selectedTransactions);
    if (newSelected.has(transactionId)) {
      newSelected.delete(transactionId);
    } else {
      newSelected.add(transactionId);
    }
    setSelectedTransactions(newSelected);
  }

  function calculateReconciledBalance() {
    let balance = startingBalance;
    transactions.forEach(t => {
      if (selectedTransactions.has(t.id)) {
        balance += t.amount;
      }
    });
    return balance;
  }

  function calculateDifference() {
    const endingBal = parseFloat(statementEndingBalance) || 0;
    const reconciledBal = calculateReconciledBalance();
    return endingBal - reconciledBal;
  }

  function isBalanced() {
    return Math.abs(calculateDifference()) < 0.01; // Within 1 cent
  }

  async function handleReconcile() {
    if (!statementEndingBalance) {
      alert('Please enter the statement ending balance');
      return;
    }

    if (!isBalanced()) {
      if (!confirm(`The difference is ${formatCurrency(calculateDifference())}. Are you sure you want to save this unbalanced reconciliation?`)) {
        return;
      }
    }

    try {
      setReconciling(true);

      // Mark selected transactions as reconciled
      const transactionIds = Array.from(selectedTransactions);
      if (transactionIds.length > 0) {
        const { error: updateError } = await supabase
          .from('bank_transactions')
          .update({ 
            is_reconciled: true,
            is_cleared: true // Also mark as cleared
          })
          .in('id', transactionIds);

        if (updateError) throw updateError;
      }

      // Update bank account with reconciliation info
      const { error: accountError } = await supabase
        .from('bank_accounts')
        .update({
          last_reconciled_date: statementDate,
          last_reconciled_balance: parseFloat(statementEndingBalance)
        })
        .eq('id', selectedAccountId);

      if (accountError) throw accountError;

      alert(`✅ Reconciliation complete! ${transactionIds.length} transaction(s) reconciled.`);
      
      // Reset and reload
      setSelectedAccountId('');
      setSelectedAccount(null);
      setTransactions([]);
      setSelectedTransactions(new Set());
      setStatementEndingBalance('');
      loadBankAccounts();
    } catch (err) {
      console.error('Error reconciling:', err);
      alert(`Failed to reconcile: ${err.message}`);
    } finally {
      setReconciling(false);
    }
  }

  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return '$0.00';
    const value = Number(amount);
    const abs = Math.abs(value);
    const formatted = `$${abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    return value < 0 ? `-${formatted}` : formatted;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const selectedDeposits = transactions
    .filter(t => selectedTransactions.has(t.id) && t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0);

  const selectedWithdrawals = Math.abs(
    transactions
      .filter(t => selectedTransactions.has(t.id) && t.amount < 0)
      .reduce((sum, t) => sum + t.amount, 0)
  );

  const difference = calculateDifference();
  const reconciledBalance = calculateReconciledBalance();

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading bank reconciliation...</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <button onClick={() => navigate('/accounting/bank-accounts')} style={styles.backButton}>
            ← Back to Bank Accounts
          </button>
          <h1 style={styles.title}>🔄 Bank Reconciliation</h1>
          <p style={styles.subtitle}>Match your bank statement with your records</p>
        </div>
      </div>

      {/* Account Selection */}
      {!selectedAccountId ? (
        <div style={styles.selectionSection}>
          <h2 style={styles.sectionTitle}>Select Bank Account to Reconcile</h2>
          {bankAccounts.length === 0 ? (
            <div style={styles.empty}>
              <p style={styles.emptyText}>No active bank accounts found. Please add a bank account first.</p>
              <button onClick={() => navigate('/accounting/bank-accounts')} style={styles.primaryButton}>
                Go to Bank Accounts
              </button>
            </div>
          ) : (
            <div style={styles.accountGrid}>
              {bankAccounts.map(account => (
                <div
                  key={account.id}
                  style={styles.accountCard}
                  onClick={() => setSelectedAccountId(account.id)}
                >
                  <h3 style={styles.accountCardName}>{account.account_name}</h3>
                  <p style={styles.accountCardBank}>{account.bank_name}</p>
                  <div style={styles.accountCardBalance}>
                    Current Balance: {formatCurrency(account.current_balance)}
                  </div>
                  {account.last_reconciled_date && (
                    <p style={styles.accountCardInfo}>
                      Last Reconciled: {formatDate(account.last_reconciled_date)}
                    </p>
                  )}
                  <button style={styles.selectButton}>Select →</button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Reconciliation Header */}
          <div style={styles.reconHeader}>
            <div style={styles.reconAccountInfo}>
              <h2 style={styles.reconAccountName}>{selectedAccount?.account_name}</h2>
              <p style={styles.reconAccountBank}>{selectedAccount?.bank_name}</p>
            </div>
            <button onClick={() => {
              setSelectedAccountId('');
              setSelectedAccount(null);
              setTransactions([]);
              setSelectedTransactions(new Set());
              setStatementEndingBalance('');
            }} style={styles.changeButton}>
              Change Account
            </button>
          </div>

          {/* Statement Info */}
          <div style={styles.statementSection}>
            <h3 style={styles.sectionTitle}>Bank Statement Information</h3>
            <div style={styles.formRow}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Statement Date *</label>
                <input
                  type="date"
                  value={statementDate}
                  onChange={(e) => setStatementDate(e.target.value)}
                  style={styles.input}
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Statement Ending Balance *</label>
                <input
                  type="number"
                  value={statementEndingBalance}
                  onChange={(e) => setStatementEndingBalance(e.target.value)}
                  style={styles.input}
                  step="0.01"
                  placeholder="Enter balance from bank statement"
                />
              </div>
            </div>
          </div>

          {/* Reconciliation Summary */}
          <div style={styles.summarySection}>
            <div style={styles.summaryGrid}>
              <div style={styles.summaryCard}>
                <div style={styles.summaryLabel}>Beginning Balance</div>
                <div style={styles.summaryValue}>{formatCurrency(startingBalance)}</div>
              </div>
              <div style={styles.summaryCard}>
                <div style={styles.summaryLabel}>Selected Deposits</div>
                <div style={{...styles.summaryValue, color: '#10b981'}}>
                  +{formatCurrency(selectedDeposits)}
                </div>
              </div>
              <div style={styles.summaryCard}>
                <div style={styles.summaryLabel}>Selected Withdrawals</div>
                <div style={{...styles.summaryValue, color: '#ef4444'}}>
                  -{formatCurrency(selectedWithdrawals)}
                </div>
              </div>
              <div style={styles.summaryCard}>
                <div style={styles.summaryLabel}>Calculated Balance</div>
                <div style={styles.summaryValue}>{formatCurrency(reconciledBalance)}</div>
              </div>
              <div style={styles.summaryCard}>
                <div style={styles.summaryLabel}>Statement Balance</div>
                <div style={styles.summaryValue}>
                  {statementEndingBalance ? formatCurrency(parseFloat(statementEndingBalance)) : '$0.00'}
                </div>
              </div>
              <div style={{
                ...styles.summaryCard,
                backgroundColor: isBalanced() ? '#d1fae5' : '#fee2e2',
                borderLeft: isBalanced() ? '4px solid #10b981' : '4px solid #ef4444'
              }}>
                <div style={styles.summaryLabel}>
                  {isBalanced() ? '✅ Difference' : '⚠️ Difference'}
                </div>
                <div style={{
                  ...styles.summaryValue,
                  color: isBalanced() ? '#10b981' : '#ef4444',
                  fontSize: 32
                }}>
                  {formatCurrency(difference)}
                </div>
                {isBalanced() && <div style={styles.balancedText}>BALANCED!</div>}
              </div>
            </div>
          </div>

          {/* Transactions List */}
          <div style={styles.transactionsSection}>
            <h3 style={styles.sectionTitle}>
              Unreconciled Transactions ({transactions.length})
              <span style={styles.selectedCount}>
                {selectedTransactions.size} selected
              </span>
            </h3>
            
            {transactions.length === 0 ? (
              <div style={styles.empty}>
                <p style={styles.emptyText}>
                  No unreconciled transactions. All transactions have been reconciled!
                </p>
              </div>
            ) : (
              <div style={styles.tableContainer}>
                <table style={styles.table}>
                  <thead>
                    <tr style={styles.tableHeader}>
                      <th style={styles.th}>
                        <input
                          type="checkbox"
                          checked={selectedTransactions.size === transactions.length}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedTransactions(new Set(transactions.map(t => t.id)));
                            } else {
                              setSelectedTransactions(new Set());
                            }
                          }}
                          style={styles.checkbox}
                        />
                      </th>
                      <th style={styles.th}>Date</th>
                      <th style={styles.th}>Description</th>
                      <th style={styles.th}>Reference</th>
                      <th style={styles.th}>Payee</th>
                      <th style={styles.th}>Withdrawal</th>
                      <th style={styles.th}>Deposit</th>
                      <th style={styles.th}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map(transaction => (
                      <tr 
                        key={transaction.id}
                        style={{
                          ...styles.tableRow,
                          backgroundColor: selectedTransactions.has(transaction.id) ? '#f0fdf4' : '#fff'
                        }}
                        onClick={() => toggleTransaction(transaction.id)}
                      >
                        <td style={styles.td}>
                          <input
                            type="checkbox"
                            checked={selectedTransactions.has(transaction.id)}
                            onChange={() => toggleTransaction(transaction.id)}
                            style={styles.checkbox}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </td>
                        <td style={styles.td}>{formatDate(transaction.transaction_date)}</td>
                        <td style={styles.td}>{transaction.description}</td>
                        <td style={styles.td}>{transaction.reference_number || '-'}</td>
                        <td style={styles.td}>{transaction.payee || '-'}</td>
                        <td style={{...styles.td, ...styles.withdrawalCell}}>
                          {transaction.amount < 0 ? formatCurrency(transaction.amount) : '-'}
                        </td>
                        <td style={{...styles.td, ...styles.depositCell}}>
                          {transaction.amount > 0 ? formatCurrency(transaction.amount) : '-'}
                        </td>
                        <td style={styles.td}>
                          {transaction.is_cleared ? (
                            <span style={styles.clearedBadge}>Cleared</span>
                          ) : (
                            <span style={styles.unclearedBadge}>Uncleared</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div style={styles.actionSection}>
            <button
              onClick={() => {
                setSelectedAccountId('');
                setSelectedAccount(null);
                setTransactions([]);
                setSelectedTransactions(new Set());
                setStatementEndingBalance('');
              }}
              style={styles.cancelButton}
            >
              Cancel
            </button>
            <button
              onClick={handleReconcile}
              disabled={reconciling || !statementEndingBalance || selectedTransactions.size === 0}
              style={{
                ...styles.reconcileButton,
                opacity: (reconciling || !statementEndingBalance || selectedTransactions.size === 0) ? 0.5 : 1,
                cursor: (reconciling || !statementEndingBalance || selectedTransactions.size === 0) ? 'not-allowed' : 'pointer'
              }}
            >
              {reconciling ? 'Reconciling...' : isBalanced() ? '✅ Complete Reconciliation' : '⚠️ Reconcile (Unbalanced)'}
            </button>
          </div>
        </>
      )}
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
    marginBottom: 30,
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
  loading: {
    textAlign: "center",
    padding: 60,
    fontSize: 18,
    color: "#fff",
  },
  selectionSection: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 32,
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#111",
    marginBottom: 20,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectedCount: {
    fontSize: 14,
    fontWeight: "normal",
    color: "#666",
  },
  empty: {
    textAlign: "center",
    padding: "60px 20px",
  },
  emptyText: {
    fontSize: 16,
    color: "#666",
    marginBottom: 20,
  },
  primaryButton: {
    padding: "12px 24px",
    backgroundColor: "#fc6b04",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 16,
    fontWeight: "600",
    cursor: "pointer",
  },
  accountGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
    gap: 20,
  },
  accountCard: {
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    padding: 24,
    border: "2px solid #e5e7eb",
    cursor: "pointer",
    transition: "all 0.2s",
  },
  accountCardName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#111",
    marginBottom: 8,
  },
  accountCardBank: {
    fontSize: 14,
    color: "#666",
    marginBottom: 12,
  },
  accountCardBalance: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#10b981",
    marginBottom: 8,
  },
  accountCardInfo: {
    fontSize: 12,
    color: "#999",
    marginBottom: 12,
  },
  selectButton: {
    padding: "8px 16px",
    backgroundColor: "#fc6b04",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    fontSize: 14,
    fontWeight: "600",
    cursor: "pointer",
  },
  reconHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 24,
    marginBottom: 20,
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  },
  reconAccountInfo: {},
  reconAccountName: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#111",
    margin: 0,
  },
  reconAccountBank: {
    fontSize: 14,
    color: "#666",
    marginTop: 4,
  },
  changeButton: {
    padding: "10px 20px",
    backgroundColor: "#fff",
    border: "2px solid #e5e7eb",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    cursor: "pointer",
  },
  statementSection: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 24,
    marginBottom: 20,
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  },
  formRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 20,
  },
  formGroup: {
    marginBottom: 0,
  },
  label: {
    display: "block",
    marginBottom: 8,
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  input: {
    width: "100%",
    padding: "12px",
    fontSize: 15,
    border: "2px solid #e5e7eb",
    borderRadius: 6,
    outline: "none",
    boxSizing: "border-box",
  },
  summarySection: {
    marginBottom: 20,
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: 16,
  },
  summaryCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  },
  summaryLabel: {
    fontSize: 13,
    color: "#666",
    marginBottom: 8,
    fontWeight: "600",
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#111",
  },
  balancedText: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: "bold",
    color: "#10b981",
  },
  transactionsSection: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 24,
    marginBottom: 20,
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  },
  tableContainer: {
    overflow: "auto",
    maxHeight: 500,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 14,
  },
  tableHeader: {
    backgroundColor: "#f9fafb",
    borderBottom: "2px solid #e5e7eb",
    position: "sticky",
    top: 0,
  },
  th: {
    padding: "12px",
    textAlign: "left",
    fontWeight: "700",
    color: "#374151",
    whiteSpace: "nowrap",
  },
  tableRow: {
    borderBottom: "1px solid #e5e7eb",
    cursor: "pointer",
    transition: "background-color 0.15s",
  },
  td: {
    padding: "12px",
    color: "#111",
  },
  checkbox: {
    width: 18,
    height: 18,
    cursor: "pointer",
  },
  withdrawalCell: {
    color: "#ef4444",
    fontWeight: "600",
    textAlign: "right",
  },
  depositCell: {
    color: "#10b981",
    fontWeight: "600",
    textAlign: "right",
  },
  clearedBadge: {
    display: "inline-block",
    padding: "4px 12px",
    backgroundColor: "#d1fae5",
    color: "#065f46",
    borderRadius: 12,
    fontSize: 12,
    fontWeight: "600",
  },
  unclearedBadge: {
    display: "inline-block",
    padding: "4px 12px",
    backgroundColor: "#fef3c7",
    color: "#92400e",
    borderRadius: 12,
    fontSize: 12,
    fontWeight: "600",
  },
  actionSection: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 24,
  },
  cancelButton: {
    padding: "12px 32px",
    backgroundColor: "#fff",
    border: "2px solid #e5e7eb",
    borderRadius: 8,
    fontSize: 16,
    fontWeight: "600",
    color: "#666",
    cursor: "pointer",
  },
  reconcileButton: {
    padding: "12px 32px",
    backgroundColor: "#10b981",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 16,
    fontWeight: "600",
    cursor: "pointer",
    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
  },
};
