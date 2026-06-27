import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { notify, confirmDialog } from '../lib/notify';

export default function ChartOfAccounts() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [showInactive, setShowInactive] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [showInitialize, setShowInitialize] = useState(false);
  const [parentAccount, setParentAccount] = useState(null);
  const [expandedAccounts, setExpandedAccounts] = useState({});
  const [accountForm, setAccountForm] = useState({
    account_number: '',
    account_name: '',
    account_type: 'Asset',
    account_subtype: '',
    description: '',
    normal_balance: 'debit',
    starting_balance: ''
  });

  const toggleExpanded = (accountId) => {
    setExpandedAccounts(prev => ({
      ...prev,
      [accountId]: !prev[accountId]
    }));
  };

  useEffect(() => {
    loadAccounts();
  }, [user]);

  async function loadAccounts() {
    try {
      setLoading(true);
      
      // Load all accounts
      const { data, error } = await supabase
        .from("accounts")
        .select("*")
        .eq("company_id", user.id)
        .order("account_number", { ascending: true});

      if (error) throw error;
      
      if (!data || data.length === 0) {
        setShowInitialize(true);
        setAccounts([]);
        return;
      }

      // For each account, calculate its balance from POSTED journal entries only
      // This way the balance is ALWAYS current and accurate
      const accountsWithCalculatedBalances = await Promise.all(
        data.map(async (account) => {
          // Get only POSTED journal entry lines for this account
          // We need to fetch with a RPC or filter on the response
          const { data: allLines, error: linesError } = await supabase
            .from("journal_entry_lines")
            .select("debit, credit, entry_id(is_posted)")
            .eq("account_id", account.id);

          if (linesError) {
            console.error(`Error loading journal lines for account ${account.id}:`, linesError);
            return account; // Return account with stored balance if there's an error
          }

          // Filter to only POSTED entries
          const journalLines = allLines ? allLines.filter(line => line.entry_id?.is_posted === true) : [];

          // Calculate balance from POSTED journal entries only
          // For DEBIT accounts (Assets, Expenses): SUM(debits - credits)
          // For CREDIT accounts (Liabilities, Equity, Income): SUM(credits - debits)
          let calculatedBalance = 0;
          
          if (journalLines && journalLines.length > 0) {
            const totalDebits = journalLines.reduce((sum, line) => sum + parseFloat(line.debit || 0), 0);
            const totalCredits = journalLines.reduce((sum, line) => sum + parseFloat(line.credit || 0), 0);
            
            if (account.normal_balance === 'credit') {
              // For credit accounts: credits are positive, debits are negative
              calculatedBalance = totalCredits - totalDebits;
              // For liability accounts, negate to show as negative
              if (account.account_type === 'Liability') {
                calculatedBalance = -calculatedBalance;
              }
            } else {
              // For debit accounts: debits are positive, credits are negative
              calculatedBalance = totalDebits - totalCredits;
            }
          } else {
            // If no posted journal entries, use the stored balance as-is
            calculatedBalance = account.balance || 0;
          }

          // Return account with calculated balance
          return {
            ...account,
            balance: calculatedBalance
          };
        })
      );

      // Load bank account actual balances for reconciliation comparison
      // This allows users to compare book balance (from journal entries) vs actual bank balance
      const { data: bankAccounts, error: bankError } = await supabase
        .from("bank_accounts")
        .select("chart_account_id, current_balance, account_name")
        .eq("company_id", user.id)
        .eq("is_active", true);

      if (!bankError && bankAccounts && bankAccounts.length > 0) {
        // Store bank balances for display purposes only (for reconciliation)
        const bankBalanceMap = {};
        bankAccounts.forEach(ba => {
          if (ba.chart_account_id) {
            bankBalanceMap[ba.chart_account_id] = {
              actual_balance: ba.current_balance,
              bank_account_name: ba.account_name
            };
          }
        });

        accountsWithCalculatedBalances.forEach(account => {
          if (bankBalanceMap[account.id]) {
            // Store bank's actual balance separately for reconciliation display
            account.actual_bank_balance = bankBalanceMap[account.id].actual_balance;
            account.bank_account_name = bankBalanceMap[account.id].bank_account_name;
          }
        });
      }

      setAccounts(accountsWithCalculatedBalances);
    } catch (err) {
      console.error("Error loading accounts:", err);
      notify("Failed to load chart of accounts");
    } finally {
      setLoading(false);
    }
  }

  async function initializeDefaultAccounts() {
    if (!await confirmDialog("This will create a standard Chart of Accounts with default accounts. Continue?")) {
      return;
    }

    try {
      // Call the Supabase function to create default accounts
      const { error } = await supabase.rpc('create_default_accounts', {
        p_company_id: user.id,
        p_user_id: user.id
      });

      if (error) throw error;

      notify("Default Chart of Accounts created successfully!");
      setShowInitialize(false);
      loadAccounts();
    } catch (err) {
      console.error("Error creating default accounts:", err);
      notify(`Failed to create default accounts: ${err.message}`);
    }
  }

  function openAddAccountModal() {
    setEditingAccount(null);
    setParentAccount(null);
    setAccountForm({
      account_number: '',
      account_name: '',
      account_type: 'Asset',
      account_subtype: '',
      description: '',
      normal_balance: 'debit',
      starting_balance: ''
    });
    setShowModal(true);
  }

  function openAddSubaccountModal(parent) {
    setEditingAccount(null);
    setParentAccount(parent);
    setAccountForm({
      account_number: '',
      account_name: '',
      account_type: parent.account_type,
      account_subtype: parent.account_subtype || '',
      description: '',
      normal_balance: parent.normal_balance,
      starting_balance: ''
    });
    setShowModal(true);
  }

  function openEditAccountModal(account) {
    setEditingAccount(account);
    setAccountForm({
      account_number: account.account_number,
      account_name: account.account_name,
      account_type: account.account_type,
      account_subtype: account.account_subtype || '',
      description: account.description || '',
      normal_balance: account.normal_balance,
      starting_balance: account.balance?.toString() || '0'
    });
    setShowModal(true);
  }

  async function handleSaveAccount() {
    if (!accountForm.account_number || !accountForm.account_name) {
      notify('Please enter both account number and account name');
      return;
    }

    try {
      // Prepare account data - include starting balance as the initial balance
      const startingBalance = accountForm.starting_balance ? parseFloat(accountForm.starting_balance) : 0;
      
      const accountData = {
        account_number: accountForm.account_number,
        account_name: accountForm.account_name,
        account_type: accountForm.account_type,
        account_subtype: accountForm.account_subtype,
        description: accountForm.description,
        normal_balance: accountForm.normal_balance,
        balance: startingBalance, // Set the balance to the starting balance
        parent_account_id: parentAccount ? parentAccount.id : null,
        company_id: user.id,
        created_by: user.id
      };

      if (editingAccount) {
        // Update existing account
        const { error } = await supabase
          .from('accounts')
          .update(accountData)
          .eq('id', editingAccount.id);

        if (error) throw error;

        // If balance changed, update the opening balance journal entry
        if (editingAccount.balance !== startingBalance && startingBalance !== 0) {
          try {
            // Find existing opening balance journal entry
            const { data: existingEntry } = await supabase
              .from('journal_entries')
              .select('id')
              .eq('reference_type', 'opening_balance')
              .eq('reference_id', editingAccount.id)
              .maybeSingle();

            if (existingEntry) {
              // Delete old journal entry lines
              await supabase
                .from('journal_entry_lines')
                .delete()
                .eq('entry_id', existingEntry.id);

              // Update journal entry with new line
              const newLine = {
                entry_id: existingEntry.id,
                line_number: 1,
                account_id: editingAccount.id,
                debit: startingBalance > 0 ? Math.abs(startingBalance) : 0,
                credit: startingBalance < 0 ? Math.abs(startingBalance) : 0,
                description: 'Opening balance'
              };

              await supabase
                .from('journal_entry_lines')
                .insert([newLine]);
            } else {
              // Create new opening balance entry if it doesn't exist
              const { data: lastEntry } = await supabase
                .from('journal_entries')
                .select('entry_number')
                .eq('company_id', user.id)
                .order('entry_number', { ascending: false })
                .limit(1)
                .maybeSingle();

              const nextEntryNumber = (lastEntry?.entry_number || 0) + 1;

              const newEntry = {
                entry_number: nextEntryNumber,
                entry_date: new Date().toISOString().split('T')[0],
                description: `Opening balance for ${editingAccount.account_number} - ${editingAccount.account_name}`,
                reference_type: 'opening_balance',
                reference_id: editingAccount.id,
                created_by: user.id,
                company_id: user.id
              };

              const { data: createdEntry, error: entryError } = await supabase
                .from('journal_entries')
                .insert([newEntry])
                .select()
                .single();

              if (!entryError && createdEntry) {
                const line = {
                  entry_id: createdEntry.id,
                  line_number: 1,
                  account_id: editingAccount.id,
                  debit: startingBalance > 0 ? Math.abs(startingBalance) : 0,
                  credit: startingBalance < 0 ? Math.abs(startingBalance) : 0,
                  description: 'Opening balance'
                };

                await supabase
                  .from('journal_entry_lines')
                  .insert([line]);
              }
            }
          } catch (journalErr) {
            console.warn('Warning: Opening balance journal entry update failed:', journalErr);
            // Don't fail the account update, just warn the user
          }
        }

        notify('Account updated successfully!');
      } else {
        // Create new account
        const { data: newAccount, error } = await supabase
          .from('accounts')
          .insert([accountData])
          .select()
          .single();

        if (error) throw error;

        // If starting balance is provided, create an opening balance journal entry
        if (startingBalance !== 0 && newAccount) {
          try {
            // Get next entry number for this company
            const { data: lastEntry } = await supabase
              .from('journal_entries')
              .select('entry_number')
              .eq('company_id', user.id)
              .order('entry_number', { ascending: false })
              .limit(1)
              .maybeSingle();

            const nextEntryNumber = (lastEntry?.entry_number || 0) + 1;

            // IMPORTANT: Find an Equity account to balance the entry
            const { data: equityAccounts } = await supabase
              .from('accounts')
              .select('id')
              .eq('company_id', user.id)
              .eq('account_type', 'Equity')
              .limit(1)
              .maybeSingle();

            if (!equityAccounts) {
              console.warn('No Equity account found to balance opening balance entry');
              throw new Error('No Equity account found');
            }

            // Create journal entry for opening balance
            const journalEntry = {
              entry_number: nextEntryNumber,
              entry_date: new Date().toISOString().split('T')[0],
              description: `Opening balance for ${newAccount.account_number} - ${newAccount.account_name}`,
              reference_type: 'opening_balance',
              reference_id: newAccount.id,
              created_by: user.id,
              company_id: user.id
            };

            const { data: newEntry, error: entryError } = await supabase
              .from('journal_entries')
              .insert([journalEntry])
              .select()
              .single();

            if (!entryError && newEntry) {
              // Create TWO journal entry lines to balance the entry
              // Line 1: The account itself
              // Line 2: Offsetting entry to Equity account
              
              let accountDebit = 0, accountCredit = 0;
              let equityDebit = 0, equityCredit = 0;

              if (accountData.normal_balance === 'debit') {
                // Debit account (Asset, Expense)
                accountDebit = Math.abs(startingBalance);
                equityCredit = Math.abs(startingBalance);
              } else {
                // Credit account (Liability, Income, Equity)
                accountCredit = Math.abs(startingBalance);
                equityDebit = Math.abs(startingBalance);
              }

              const lines = [
                {
                  entry_id: newEntry.id,
                  line_number: 1,
                  account_id: newAccount.id,
                  debit: accountDebit,
                  credit: accountCredit,
                  description: 'Opening balance'
                },
                {
                  entry_id: newEntry.id,
                  line_number: 2,
                  account_id: equityAccounts.id,
                  debit: equityDebit,
                  credit: equityCredit,
                  description: 'Opening balance offset'
                }
              ];

              const { error: linesError } = await supabase
                .from('journal_entry_lines')
                .insert(lines);

              if (!linesError) {
                // Post the journal entry
                await supabase.rpc('post_journal_entry', {
                  p_entry_id: newEntry.id,
                  p_user_id: user.id
                });
              }
            }
          } catch (journalErr) {
            console.warn('Warning: Opening balance journal entry creation failed:', journalErr);
            // Don't fail the account creation, just warn the user
          }
        }

        notify(parentAccount ? 'Subaccount added successfully!' : 'Account added successfully!');
      }

      setShowModal(false);
      setEditingAccount(null);
      setParentAccount(null);
      loadAccounts();
    } catch (err) {
      console.error('Error saving account:', err);
      notify(`Failed to save account: ${err.message}`);
    }
  }

  async function handleArchiveAccount(account) {
    if (account.is_system) {
      notify('System accounts cannot be deleted. You can mark them as inactive instead.');
      return;
    }

    if (!await confirmDialog(`Archive account "${account.account_name}"?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('accounts')
        .update({ is_active: false })
        .eq('id', account.id);

      if (error) throw error;

      notify('Account archived successfully!');
      loadAccounts();
    } catch (err) {
      console.error('Error archiving account:', err);
      notify(`Failed to archive account: ${err.message}`);
    }
  }

  async function handleToggleActive(account) {
    try {
      const { error } = await supabase
        .from('accounts')
        .update({ is_active: !account.is_active })
        .eq('id', account.id);

      if (error) throw error;
      loadAccounts();
    } catch (err) {
      console.error('Error toggling account status:', err);
      notify(`Failed to update account: ${err.message}`);
    }
  }

  const filteredAccounts = accounts.filter(account => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = (
      account.account_number?.toLowerCase().includes(searchLower) ||
      account.account_name?.toLowerCase().includes(searchLower) ||
      account.description?.toLowerCase().includes(searchLower)
    );

    const matchesType = typeFilter === "all" || account.account_type === typeFilter;
    
    // Filter by active status: 
    // An account is ACTIVE only if is_active is explicitly true
    // Everything else (false, null, undefined) is considered INACTIVE
    // Show inactive accounts only if the showInactive toggle is ON
    const isActive = account.is_active === true;
    const matchesActive = isActive || showInactive;

    return matchesSearch && matchesType && matchesActive;
  });

  // Group accounts by type
  const groupedAccounts = {
    Asset: filteredAccounts.filter(a => a.account_type === 'Asset'),
    Liability: filteredAccounts.filter(a => a.account_type === 'Liability'),
    Equity: filteredAccounts.filter(a => a.account_type === 'Equity'),
    Income: filteredAccounts.filter(a => a.account_type === 'Income'),
    Expense: filteredAccounts.filter(a => a.account_type === 'Expense')
  };

  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return '$0.00';
    return `$${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  };

  const getTypeColor = (type) => {
    const colors = {
      Asset: '#10b981',
      Liability: '#ef4444',
      Equity: '#3b82f6',
      Income: '#10b981',
      Expense: '#f59e0b'
    };
    return colors[type] || '#6b7280';
  };

  // Update normal_balance when account_type changes
  function handleTypeChange(type) {
    let normalBalance = 'debit';
    if (type === 'Liability' || type === 'Equity' || type === 'Income') {
      normalBalance = 'credit';
    }
    setAccountForm({
      ...accountForm,
      account_type: type,
      normal_balance: normalBalance
    });
  }

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading chart of accounts...</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>📋 Chart of Accounts</h1>
          <p style={styles.subtitle}>Manage your company's financial accounts</p>
        </div>
        <div style={styles.headerButtons}>
          <button
            onClick={() => navigate('/accounting')}
            style={styles.backButton}
          >
            ← Back to Dashboard
          </button>
          <button
            onClick={loadAccounts}
            style={{...styles.newButton, backgroundColor: '#3b82f6'}}
            title="Refresh account balances from journal entries"
          >
            🔄 Refresh Balances
          </button>
          <button
            onClick={openAddAccountModal}
            style={styles.newButton}
          >
            + Add Account
          </button>
        </div>
      </div>

      {/* Initialize Prompt */}
      {showInitialize && (
        <div style={styles.initializeCard}>
          <h3 style={styles.initializeTitle}>📊 No Chart of Accounts Found</h3>
          <p style={styles.initializeText}>
            Would you like to initialize your Chart of Accounts with standard accounts for a construction business?
          </p>
          <div style={styles.initializeButtons}>
            <button onClick={initializeDefaultAccounts} style={styles.initializeButton}>
              Yes, Create Default Accounts
            </button>
            <button onClick={() => setShowInitialize(false)} style={styles.cancelInitButton}>
              No, I'll Create My Own
            </button>
          </div>
        </div>
      )}

      {/* Search and Filter */}
      <div style={styles.filterBar}>
        <input
          type="text"
          placeholder="Search by account number, name, or description..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={styles.searchInput}
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          style={styles.filterSelect}
        >
          <option value="all">All Types</option>
          <option value="Asset">Assets</option>
          <option value="Liability">Liabilities</option>
          <option value="Equity">Equity</option>
          <option value="Income">Income</option>
          <option value="Expense">Expenses</option>
        </select>
        <button
          onClick={() => setShowInactive(!showInactive)}
          style={{
            ...styles.filterSelect,
            backgroundColor: showInactive ? '#10b981' : '#fff',
            color: showInactive ? '#fff' : '#111',
            padding: '12px 16px',
            border: showInactive ? 'none' : '2px solid #e5e7eb',
            fontWeight: 600,
            whiteSpace: 'nowrap'
          }}
          title={showInactive ? 'Hiding inactive accounts' : 'Showing only active accounts'}
        >
          {showInactive ? '✓ Show Inactive' : 'Hide Inactive'}
        </button>
      </div>

      {/* Accounts List */}
      {filteredAccounts.length === 0 ? (
        <div style={styles.empty}>
          <p style={styles.emptyText}>
            {searchTerm || typeFilter !== "all"
              ? "No accounts found matching your filters."
              : "No accounts yet. Click 'Add Account' to create your first account!"}
          </p>
        </div>
      ) : (
        <div style={styles.accountsContainer}>
          {Object.entries(groupedAccounts).map(([type, typeAccounts]) =>
            typeAccounts.length > 0 ? (
              <div key={type} style={styles.accountGroup}>
                <h2 style={{...styles.groupTitle, color: getTypeColor(type)}}>
                  {type === 'Asset' && '💰 '}
                  {type === 'Liability' && '💳 '}
                  {type === 'Equity' && '🏦 '}
                  {type === 'Income' && '📈 '}
                  {type === 'Expense' && '📉 '}
                  {type}s
                </h2>
                <div style={styles.accountsList}>
                  {typeAccounts
                    .filter(a => !a.parent_account_id)
                    .map(account => {
                      const subaccounts = typeAccounts.filter(sub => sub.parent_account_id === account.id);
                      const isExpanded = expandedAccounts[account.id];
                      const totalBalance = account.balance + subaccounts.reduce((sum, sub) => sum + sub.balance, 0);
                      
                      return (
                        <div key={account.id}>
                          <div
                            style={{
                              ...styles.compactCard,
                              opacity: account.is_active ? 1 : 0.6,
                              borderLeft: `3px solid ${getTypeColor(account.account_type)}`,
                              transition: 'all 0.2s',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#f0f9ff';
                              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = '#fff';
                              e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
                            }}
                          >
                            <div style={styles.compactRow}>
                              <div style={styles.compactLeft}>
                                <div
                                  onClick={() => navigate(`/accounting/ledger/${account.id}`)}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 12,
                                    cursor: 'pointer',
                                    flex: 1,
                                  }}
                                >
                                  <span style={styles.compactNumber}>{account.account_number}</span>
                                  <span style={styles.compactName}>{account.account_name}</span>
                                </div>
                                {account.is_system && <span style={styles.systemBadge}>System</span>}
                                {!account.is_active && <span style={styles.inactiveBadge}>Inactive</span>}
                                {/* Show reconciliation status for bank accounts */}
                                {account.actual_bank_balance !== undefined && (
                                  <span style={{
                                    ...styles.systemBadge,
                                    backgroundColor: Math.abs(totalBalance - account.actual_bank_balance) < 0.01 ? '#10b981' : '#f59e0b'
                                  }}>
                                    {Math.abs(totalBalance - account.actual_bank_balance) < 0.01 ? '✅ Reconciled' : '⚠️ Pending'}
                                  </span>
                                )}
                                {subaccounts.length > 0 && (
                                  <button
                                    onClick={() => toggleExpanded(account.id)}
                                    style={styles.expandButton}
                                  >
                                    {isExpanded ? '▼' : '▶'} {subaccounts.length}
                                  </button>
                                )}
                              </div>
                              <div style={styles.compactRight}>
                                <div style={styles.balanceColumn}>
                                  <div style={styles.balanceRow}>
                                    <span style={styles.balanceLabel}>Book:</span>
                                    <span style={styles.compactBalance}>{formatCurrency(totalBalance)}</span>
                                  </div>
                                  {account.actual_bank_balance !== undefined && (
                                    <>
                                      <div style={styles.balanceRow}>
                                        <span style={styles.balanceLabel}>Actual:</span>
                                        <span style={styles.compactBalance}>{formatCurrency(account.actual_bank_balance)}</span>
                                      </div>
                                      {Math.abs(totalBalance - account.actual_bank_balance) >= 0.01 && (
                                        <div style={{...styles.balanceRow, color: '#f59e0b', fontSize: 12}}>
                                          <span style={styles.balanceLabel}>Diff:</span>
                                          <span style={styles.compactBalance}>{formatCurrency(account.actual_bank_balance - totalBalance)}</span>
                                        </div>
                                      )}
                                    </>
                                  )}
                                </div>
                                <div style={styles.compactActions}>
                                  <button onClick={() => openAddSubaccountModal(account)} style={styles.compactButton} title="Add Subaccount">➕</button>
                                  <button onClick={() => openEditAccountModal(account)} style={styles.compactButton} title="Edit">✏️</button>
                                  <button onClick={() => handleToggleActive(account)} style={styles.compactButton} title={account.is_active ? 'Deactivate' : 'Activate'}>{account.is_active ? '❌' : '✅'}</button>
                                  {!account.is_system && (
                                    <button onClick={() => handleArchiveAccount(account)} style={{...styles.compactButton, color: '#ef4444'}} title="Archive">🗑️</button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          {isExpanded && subaccounts.map(sub => (
                            <div
                              key={sub.id}
                              style={{
                                ...styles.compactCard,
                                marginLeft: 40,
                                backgroundColor: '#f3f4f6',
                                opacity: sub.is_active ? 1 : 0.6,
                                borderLeft: `3px solid ${getTypeColor(sub.account_type)}`
                              }}
                            >
                              <div style={styles.compactRow}>
                                <div style={styles.compactLeft}>
                                  <span style={{...styles.compactNumber, color: '#666'}}>└─ {sub.account_number}</span>
                                  <span style={styles.compactName}>{sub.account_name}</span>
                                  {!sub.is_active && <span style={styles.inactiveBadge}>Inactive</span>}
                                </div>
                                <div style={styles.compactRight}>
                                  <span style={styles.compactBalance}>{formatCurrency(sub.balance)}</span>
                                  <div style={styles.compactActions}>
                                    <button onClick={() => openEditAccountModal(sub)} style={styles.compactButton} title="Edit">✏️</button>
                                    <button onClick={() => handleToggleActive(sub)} style={styles.compactButton} title={sub.is_active ? 'Deactivate' : 'Activate'}>{sub.is_active ? '❌' : '✅'}</button>
                                    <button onClick={() => handleArchiveAccount(sub)} style={{...styles.compactButton, color: '#ef4444'}} title="Archive">🗑️</button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                </div>
              </div>
            ) : null
          )}
        </div>
      )}

      {/* Account Modal */}
      {showModal && (
        <div style={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>
                {editingAccount ? 'Edit Account' : parentAccount ? `Add Subaccount to ${parentAccount.account_number}` : 'Add New Account'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                style={styles.closeButton}
              >
                ×
              </button>
            </div>

            {parentAccount && (
              <div style={{padding: '16px 24px', backgroundColor: '#f0fdf4', borderBottom: '2px solid #e5e7eb'}}>
                <div style={{fontSize: 14, fontWeight: 600, color: '#059669', marginBottom: 4}}>
                  Creating Subaccount For:
                </div>
                <div style={{fontSize: 16, fontWeight: 700, color: '#111'}}>
                  {parentAccount.account_number} - {parentAccount.account_name}
                </div>
              </div>
            )}

            <div style={styles.modalBody}>
              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Account Number *</label>
                  <input
                    type="text"
                    value={accountForm.account_number}
                    onChange={(e) => setAccountForm({...accountForm, account_number: e.target.value})}
                    style={styles.input}
                    placeholder="e.g., 1000, 2000, 4000"
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Account Type *</label>
                  <select
                    value={accountForm.account_type}
                    onChange={(e) => handleTypeChange(e.target.value)}
                    style={styles.input}
                  >
                    <option value="Asset">Asset</option>
                    <option value="Liability">Liability</option>
                    <option value="Equity">Equity</option>
                    <option value="Income">Income</option>
                    <option value="Expense">Expense</option>
                  </select>
                </div>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Account Name *</label>
                <input
                  type="text"
                  value={accountForm.account_name}
                  onChange={(e) => setAccountForm({...accountForm, account_name: e.target.value})}
                  style={styles.input}
                  placeholder="e.g., Cash, Accounts Receivable, Equipment"
                />
              </div>

              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Account Subtype</label>
                  <input
                    type="text"
                    value={accountForm.account_subtype}
                    onChange={(e) => setAccountForm({...accountForm, account_subtype: e.target.value})}
                    style={styles.input}
                    placeholder="e.g., Current Asset, Fixed Asset"
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Normal Balance</label>
                  <select
                    value={accountForm.normal_balance}
                    onChange={(e) => setAccountForm({...accountForm, normal_balance: e.target.value})}
                    style={styles.input}
                  >
                    <option value="debit">Debit</option>
                    <option value="credit">Credit</option>
                  </select>
                </div>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Starting Balance (Optional)</label>
                <input
                  type="number"
                  value={accountForm.starting_balance}
                  onChange={(e) => setAccountForm({...accountForm, starting_balance: e.target.value})}
                  style={styles.input}
                  placeholder="0.00"
                  step="0.01"
                />
                <div style={{fontSize: 12, color: '#666', marginTop: 6}}>
                  Enter the opening balance for this account (enter as a positive number)
                </div>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Description</label>
                <textarea
                  value={accountForm.description}
                  onChange={(e) => setAccountForm({...accountForm, description: e.target.value})}
                  style={{...styles.input, minHeight: 80, resize: 'vertical'}}
                  placeholder="Optional description of this account..."
                />
              </div>
            </div>

            <div style={styles.modalFooter}>
              <button
                onClick={() => setShowModal(false)}
                style={styles.cancelButton}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAccount}
                style={styles.saveButton}
              >
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
  initializeCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 32,
    marginBottom: 30,
    boxShadow: "0 2px 12px rgba(0,0,0,0.1)",
    textAlign: "center",
  },
  initializeTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#111",
    marginBottom: 16,
  },
  initializeText: {
    fontSize: 16,
    color: "#666",
    marginBottom: 24,
  },
  initializeButtons: {
    display: "flex",
    gap: 12,
    justifyContent: "center",
  },
  initializeButton: {
    padding: "14px 28px",
    backgroundColor: "#10b981",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 16,
    fontWeight: "600",
    cursor: "pointer",
  },
  cancelInitButton: {
    padding: "14px 28px",
    backgroundColor: "#fff",
    border: "2px solid #e5e7eb",
    borderRadius: 8,
    fontSize: 16,
    fontWeight: "600",
    color: "#666",
    cursor: "pointer",
  },
  filterBar: {
    display: "flex",
    gap: 12,
    marginBottom: 30,
  },
  searchInput: {
    flex: 1,
    padding: "14px 20px",
    fontSize: 16,
    border: "2px solid #e5e7eb",
    borderRadius: 8,
    outline: "none",
    backgroundColor: "#fff",
    color: "#111",
  },
  filterSelect: {
    padding: "14px 20px",
    fontSize: 16,
    border: "2px solid #e5e7eb",
    borderRadius: 8,
    outline: "none",
    backgroundColor: "#fff",
    color: "#111",
    cursor: "pointer",
    minWidth: 180,
  },
  accountsContainer: {
    display: "flex",
    flexDirection: "column",
    gap: 32,
  },
  accountGroup: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 24,
    boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
  },
  groupTitle: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
    paddingBottom: 12,
    borderBottom: "2px solid #e5e7eb",
  },
  accountsList: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  accountCard: {
    backgroundColor: "#f9fafb",
    borderRadius: 8,
    padding: 16,
    transition: "all 0.2s",
  },
  accountHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  accountInfo: {
    flex: 1,
  },
  accountNumber: {
    fontSize: 14,
    fontWeight: "700",
    color: "#666",
    marginBottom: 4,
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  systemBadge: {
    display: "inline-block",
    padding: "2px 8px",
    backgroundColor: "#3b82f6",
    color: "#fff",
    borderRadius: 4,
    fontSize: 11,
    fontWeight: "bold",
  },
  inactiveBadge: {
    display: "inline-block",
    padding: "2px 8px",
    backgroundColor: "#ef4444",
    color: "#fff",
    borderRadius: 4,
    fontSize: 11,
    fontWeight: "bold",
  },
  accountName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111",
    marginBottom: 4,
  },
  accountSubtype: {
    fontSize: 13,
    color: "#666",
    marginBottom: 4,
  },
  accountDescription: {
    fontSize: 13,
    color: "#999",
    fontStyle: "italic",
  },
  accountRight: {
    textAlign: "right",
  },
  accountBalance: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111",
    marginBottom: 4,
  },
  normalBalance: {
    fontSize: 12,
    color: "#666",
    textTransform: "uppercase",
    fontWeight: "600",
  },
  accountActions: {
    display: "flex",
    gap: 8,
    justifyContent: "flex-start",
  },
  actionButton: {
    padding: "8px 12px",
    backgroundColor: "#fff",
    border: "2px solid #e5e7eb",
    borderRadius: 6,
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
    cursor: "pointer",
    transition: "all 0.2s",
  },
  deleteButton: {
    borderColor: "#ef4444",
    color: "#ef4444",
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
    maxWidth: 700,
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
  // Compact card styles
  compactCard: {
    backgroundColor: "#fff",
    borderRadius: 6,
    padding: "8px 12px",
    marginBottom: 4,
    transition: "all 0.2s",
  },
  compactRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  compactLeft: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  compactNumber: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111",
    minWidth: 50,
  },
  compactName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111",
  },
  compactRight: {
    display: "flex",
    alignItems: "center",
    gap: 16,
  },
  compactBalance: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111",
    minWidth: 100,
    textAlign: "right",
  },
  compactActions: {
    display: "flex",
    gap: 4,
  },
  compactButton: {
    padding: "4px 8px",
    backgroundColor: "transparent",
    border: "none",
    borderRadius: 4,
    fontSize: 14,
    cursor: "pointer",
    transition: "all 0.2s",
    color: "#666",
  },
  expandButton: {
    padding: "2px 8px",
    backgroundColor: "#e5e7eb",
    border: "none",
    borderRadius: 4,
    fontSize: 11,
    fontWeight: "600",
    cursor: "pointer",
    color: "#374151",
  },
  balanceColumn: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    alignItems: "flex-end",
  },
  balanceRow: {
    display: "flex",
    gap: 12,
    alignItems: "center",
    fontSize: 14,
  },
  balanceLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
    minWidth: 45,
    textAlign: "right",
  },
};
