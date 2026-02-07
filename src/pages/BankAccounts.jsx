import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

export default function BankAccounts() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [chartAccounts, setChartAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [accountForm, setAccountForm] = useState({
    account_name: '',
    account_number: '',
    bank_name: '',
    account_type: 'Checking',
    routing_number: '',
    opening_balance: '0.00',
    opening_date: new Date().toISOString().split('T')[0],
    chart_account_id: '',
    notes: ''
  });

  useEffect(() => {
    loadData();
  }, [user]);

  async function loadData() {
    try {
      setLoading(true);
      
      // Load bank accounts
      const { data: accountsData, error: accountsError } = await supabase
        .from("bank_accounts")
        .select("*, accounts(account_name, account_number)")
        .eq("company_id", user.id)
        .order("account_name", { ascending: true });

      if (accountsError) throw accountsError;
      setAccounts(accountsData || []);

      // Load chart of accounts for dropdown
      const { data: chartData, error: chartError } = await supabase
        .from("accounts")
        .select("*")
        .eq("company_id", user.id)
        .eq("is_active", true)
        .in("account_type", ["Asset"])
        .order("account_number", { ascending: true });

      if (chartError) throw chartError;
      setChartAccounts(chartData || []);
    } catch (err) {
      console.error("Error loading data:", err);
      alert("Failed to load bank accounts");
    } finally {
      setLoading(false);
    }
  }

  function openAddModal() {
    setEditingAccount(null);
    setAccountForm({
      account_name: '',
      account_number: '',
      bank_name: '',
      account_type: 'Checking',
      routing_number: '',
      opening_balance: '0.00',
      opening_date: new Date().toISOString().split('T')[0],
      chart_account_id: '',
      notes: ''
    });
    setShowModal(true);
  }

  function openEditModal(account) {
    setEditingAccount(account);
    setAccountForm({
      account_name: account.account_name,
      account_number: account.account_number || '',
      bank_name: account.bank_name || '',
      account_type: account.account_type || 'Checking',
      routing_number: account.routing_number || '',
      opening_balance: account.opening_balance?.toString() || '0.00',
      opening_date: account.opening_date || new Date().toISOString().split('T')[0],
      chart_account_id: account.chart_account_id || '',
      notes: account.notes || ''
    });
    setShowModal(true);
  }

  async function handleSave() {
    if (!accountForm.account_name) {
      alert('Please enter an account name');
      return;
    }

    try {
      const accountData = {
        company_id: user.id,
        account_name: accountForm.account_name,
        account_number: accountForm.account_number || null,
        bank_name: accountForm.bank_name || null,
        account_type: accountForm.account_type,
        routing_number: accountForm.routing_number || null,
        opening_balance: parseFloat(accountForm.opening_balance) || 0,
        opening_date: accountForm.opening_date || null,
        chart_account_id: accountForm.chart_account_id || null,
        notes: accountForm.notes || null,
        created_by: user.id
      };

      if (editingAccount) {
        const { data, error } = await supabase
          .from('bank_accounts')
          .update(accountData)
          .eq('id', editingAccount.id)
          .select();

        if (error) throw error;
        if (!data || data.length === 0) {
          throw new Error('Failed to update account - no data returned');
        }
        alert('Bank account updated successfully!');
      } else {
        const { error } = await supabase
          .from('bank_accounts')
          .insert([accountData]);

        if (error) throw error;
        alert('Bank account added successfully!');
      }

      setShowModal(false);
      setEditingAccount(null);
      loadData();
    } catch (err) {
      console.error('Error saving bank account:', err);
      alert(`Failed to save: ${err.message}`);
    }
  }

  async function handleToggleActive(account) {
    try {
      const { error } = await supabase
        .from('bank_accounts')
        .update({ is_active: !account.is_active })
        .eq('id', account.id);

      if (error) throw error;
      loadData();
    } catch (err) {
      console.error('Error toggling account:', err);
      alert(`Failed to update: ${err.message}`);
    }
  }

  async function handleDelete(account) {
    if (!confirm(`Delete bank account "${account.account_name}"? This will also delete all associated transactions.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('bank_accounts')
        .delete()
        .eq('id', account.id);

      if (error) throw error;
      alert('Bank account deleted successfully!');
      loadData();
    } catch (err) {
      console.error('Error deleting account:', err);
      alert(`Failed to delete: ${err.message}`);
    }
  }

  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return '$0.00';
    return `$${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getAccountTypeIcon = (type) => {
    const icons = {
      'Checking': '💵',
      'Savings': '💰',
      'Credit Card': '💳',
      'Money Market': '📊',
      'Line of Credit': '🏦'
    };
    return icons[type] || '🏦';
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading bank accounts...</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>🏦 Bank Accounts</h1>
          <p style={styles.subtitle}>Manage your company's bank accounts</p>
        </div>
        <div style={styles.headerButtons}>
          <button onClick={() => navigate('/accounting')} style={styles.backButton}>
            ← Dashboard
          </button>
          <button onClick={openAddModal} style={styles.newButton}>
            + Add Bank Account
          </button>
        </div>
      </div>

      {/* Accounts Grid */}
      {accounts.length === 0 ? (
        <div style={styles.empty}>
          <p style={styles.emptyText}>
            No bank accounts yet. Click 'Add Bank Account' to get started!
          </p>
        </div>
      ) : (
        <div style={styles.grid}>
          {accounts.map(account => (
            <div
              key={account.id}
              style={{
                ...styles.card,
                opacity: account.is_active ? 1 : 0.6,
                borderLeft: account.is_active ? '4px solid #10b981' : '4px solid #9ca3af'
              }}
            >
              <div style={styles.cardHeader}>
                <div style={styles.accountIcon}>
                  {getAccountTypeIcon(account.account_type)}
                </div>
                <div style={styles.accountInfo}>
                  <h3 style={styles.accountName}>{account.account_name}</h3>
                  <p style={styles.bankName}>{account.bank_name || 'No bank specified'}</p>
                  <p style={styles.accountType}>{account.account_type}</p>
                </div>
                {!account.is_active && (
                  <span style={styles.inactiveBadge}>Inactive</span>
                )}
              </div>

              <div style={styles.cardBody}>
                <div style={styles.balanceSection}>
                  <div style={styles.balanceLabel}>Current Balance</div>
                  <div style={styles.balanceAmount}>
                    {formatCurrency(account.current_balance)}
                  </div>
                </div>

                {account.account_number && (
                  <div style={styles.detailRow}>
                    <span style={styles.detailLabel}>Account #:</span>
                    <span style={styles.detailValue}>
                      •••• {account.account_number.slice(-4)}
                    </span>
                  </div>
                )}

                {account.accounts && (
                  <div style={styles.detailRow}>
                    <span style={styles.detailLabel}>Linked to:</span>
                    <span style={styles.detailValue}>
                      {account.accounts.account_number} - {account.accounts.account_name}
                    </span>
                  </div>
                )}

                {account.last_reconciled_date && (
                  <div style={styles.detailRow}>
                    <span style={styles.detailLabel}>Last Reconciled:</span>
                    <span style={styles.detailValue}>
                      {formatDate(account.last_reconciled_date)}
                    </span>
                  </div>
                )}
              </div>

              <div style={styles.cardActions}>
                <button
                  onClick={() => navigate(`/accounting/bank-transactions?accountId=${account.id}`)}
                  style={styles.actionButton}
                >
                  📊 Transactions
                </button>
                <button
                  onClick={() => openEditModal(account)}
                  style={styles.actionButton}
                >
                  ✏️ Edit
                </button>
                <button
                  onClick={() => handleToggleActive(account)}
                  style={styles.actionButton}
                >
                  {account.is_active ? '❌ Deactivate' : '✅ Activate'}
                </button>
                <button
                  onClick={() => handleDelete(account)}
                  style={{...styles.actionButton, ...styles.deleteButton}}
                >
                  🗑️ Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div style={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>
                {editingAccount ? 'Edit Bank Account' : 'Add New Bank Account'}
              </h2>
              <button onClick={() => setShowModal(false)} style={styles.closeButton}>
                ×
              </button>
            </div>

            <div style={styles.modalBody}>
              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Account Name *</label>
                  <input
                    type="text"
                    value={accountForm.account_name}
                    onChange={(e) => setAccountForm({...accountForm, account_name: e.target.value})}
                    style={styles.input}
                    placeholder="e.g., Main Checking, Business Savings"
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Account Type</label>
                  <select
                    value={accountForm.account_type}
                    onChange={(e) => setAccountForm({...accountForm, account_type: e.target.value})}
                    style={styles.input}
                  >
                    <option value="Checking">Checking</option>
                    <option value="Savings">Savings</option>
                    <option value="Credit Card">Credit Card</option>
                    <option value="Money Market">Money Market</option>
                    <option value="Line of Credit">Line of Credit</option>
                  </select>
                </div>
              </div>

              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Bank Name</label>
                  <input
                    type="text"
                    value={accountForm.bank_name}
                    onChange={(e) => setAccountForm({...accountForm, bank_name: e.target.value})}
                    style={styles.input}
                    placeholder="e.g., Chase, Bank of America"
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Account Number</label>
                  <input
                    type="text"
                    value={accountForm.account_number}
                    onChange={(e) => setAccountForm({...accountForm, account_number: e.target.value})}
                    style={styles.input}
                    placeholder="Last 4 digits recommended"
                  />
                </div>
              </div>

              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Routing Number</label>
                  <input
                    type="text"
                    value={accountForm.routing_number}
                    onChange={(e) => setAccountForm({...accountForm, routing_number: e.target.value})}
                    style={styles.input}
                    placeholder="9-digit routing number"
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Link to Chart of Accounts</label>
                  <select
                    value={accountForm.chart_account_id}
                    onChange={(e) => setAccountForm({...accountForm, chart_account_id: e.target.value})}
                    style={styles.input}
                  >
                    <option value="">Select Account...</option>
                    {chartAccounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.account_number} - {acc.account_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Opening Balance</label>
                  <input
                    type="number"
                    value={accountForm.opening_balance}
                    onChange={(e) => setAccountForm({...accountForm, opening_balance: e.target.value})}
                    style={styles.input}
                    step="0.01"
                    placeholder="0.00"
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Opening Date</label>
                  <input
                    type="date"
                    value={accountForm.opening_date}
                    onChange={(e) => setAccountForm({...accountForm, opening_date: e.target.value})}
                    style={styles.input}
                  />
                </div>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Notes</label>
                <textarea
                  value={accountForm.notes}
                  onChange={(e) => setAccountForm({...accountForm, notes: e.target.value})}
                  style={{...styles.input, minHeight: 80, resize: 'vertical'}}
                  placeholder="Optional notes about this account..."
                />
              </div>
            </div>

            <div style={styles.modalFooter}>
              <button onClick={() => setShowModal(false)} style={styles.cancelButton}>
                Cancel
              </button>
              <button onClick={handleSave} style={styles.saveButton}>
                {editingAccount ? '💾 Update Account' : '➕ Add Account'}
              </button>
            </div>
          </div>
        </div>
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
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 30,
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
  headerButtons: {
    display: "flex",
    gap: 12,
  },
  backButton: {
    padding: "12px 20px",
    backgroundColor: "#fff",
    border: "2px solid #e5e7eb",
    borderRadius: 8,
    fontSize: 15,
    fontWeight: "600",
    color: "#666",
    cursor: "pointer",
  },
  newButton: {
    padding: "12px 24px",
    backgroundColor: "#fc6b04",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 16,
    fontWeight: "600",
    cursor: "pointer",
    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
  },
  loading: {
    textAlign: "center",
    padding: 60,
    fontSize: 18,
    color: "#fff",
  },
  empty: {
    textAlign: "center",
    padding: "80px 20px",
    backgroundColor: "#fff",
    borderRadius: 12,
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
  },
  emptyText: {
    fontSize: 18,
    color: "#666",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(400px, 1fr))",
    gap: 24,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 24,
    boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
    transition: "all 0.2s",
  },
  cardHeader: {
    display: "flex",
    alignItems: "flex-start",
    marginBottom: 20,
    gap: 16,
  },
  accountIcon: {
    fontSize: 48,
    lineHeight: 1,
  },
  accountInfo: {
    flex: 1,
  },
  accountName: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111",
    margin: "0 0 4px 0",
  },
  bankName: {
    fontSize: 14,
    color: "#666",
    margin: "0 0 4px 0",
  },
  accountType: {
    fontSize: 13,
    color: "#999",
    margin: 0,
  },
  inactiveBadge: {
    display: "inline-block",
    padding: "4px 12px",
    backgroundColor: "#ef4444",
    color: "#fff",
    borderRadius: 6,
    fontSize: 12,
    fontWeight: "bold",
  },
  cardBody: {
    borderTop: "2px solid #f0f0f0",
    borderBottom: "2px solid #f0f0f0",
    padding: "16px 0",
    marginBottom: 16,
  },
  balanceSection: {
    marginBottom: 16,
  },
  balanceLabel: {
    fontSize: 13,
    color: "#666",
    marginBottom: 4,
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: "700",
    color: "#10b981",
  },
  detailRow: {
    display: "flex",
    justifyContent: "space-between",
    padding: "8px 0",
    fontSize: 14,
  },
  detailLabel: {
    color: "#666",
    fontWeight: "600",
  },
  detailValue: {
    color: "#111",
  },
  cardActions: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  actionButton: {
    padding: "8px 12px",
    backgroundColor: "#fff",
    border: "2px solid #e5e7eb",
    borderRadius: 6,
    fontSize: 13,
    fontWeight: "600",
    color: "#111",
    cursor: "pointer",
    transition: "all 0.2s",
  },
  deleteButton: {
    borderColor: "#ef4444",
    color: "#ef4444",
  },
  // Modal styles
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.7)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 12,
    maxWidth: 800,
    width: "90%",
    maxHeight: "90vh",
    overflow: "auto",
    boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "24px",
    borderBottom: "2px solid #e5e7eb",
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#111",
    margin: 0,
  },
  closeButton: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#666",
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: 0,
    width: 32,
    height: 32,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  modalBody: {
    padding: "24px",
  },
  formRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16,
  },
  formGroup: {
    marginBottom: 20,
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
  modalFooter: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 12,
    padding: "24px",
    borderTop: "2px solid #e5e7eb",
  },
  cancelButton: {
    padding: "12px 24px",
    backgroundColor: "#fff",
    color: "#666",
    border: "2px solid #ddd",
    borderRadius: 8,
    fontSize: 16,
    fontWeight: "600",
    cursor: "pointer",
  },
  saveButton: {
    padding: "12px 24px",
    backgroundColor: "#fc6b04",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 16,
    fontWeight: "600",
    cursor: "pointer",
    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
  },
};
