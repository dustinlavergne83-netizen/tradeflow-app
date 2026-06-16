import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { createExpenseJournalEntry } from "../utils/accountingJournals";
import { getTodayLocalDate, toLocalDateString } from "../utils/dateUtils";

export default function Expenses() {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [clearedBankExpenses, setClearedBankExpenses] = useState([]);
  const [projects, setProjects] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [expenseAccounts, setExpenseAccounts] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [bankTransactions, setBankTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null); // { type: 'success'|'error', text: string }
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 50;
  const [thisMonthTotal, setThisMonthTotal] = useState(null); // server-side this-month total
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all"); // 'all' | 'manual' | 'bank'
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [expenseForm, setExpenseForm] = useState({
    expense_date: getTodayLocalDate(),
    amount: '',
    category: 'materials',
    vendor: '',
    description: '',
    payment_method: 'credit_card',
    bank_account_id: '',
    income_account_id: '', // Track income accounts separately
    project_id: '',
    project_name: '',
    tax_deductible: true,
    receipt_notes: ''
  });

  useEffect(() => {
    if (!user?.id) return;
    loadExpenses();
    loadProjects();
    loadBankAccounts();
    loadExpenseAccounts();
    loadVendors();
    loadBankTransactions();
    loadClearedBankExpenses();
    loadThisMonthTotal();
  }, [user?.id]);

  // Listen for custom event from BankTransactions when expense is created
  useEffect(() => {
    if (!user?.id) return;
    const handleExpenseCreated = () => {
      console.log('📢 Received expenseCreated event - reloading expenses...');
      loadExpenses();
      loadBankTransactions();
      loadClearedBankExpenses();
    };

    // Listen for custom event from BankTransactions
    window.addEventListener('expenseCreated', handleExpenseCreated);

    return () => {
      window.removeEventListener('expenseCreated', handleExpenseCreated);
    };
  }, [user?.id]);

  async function loadExpenses() {
    try {
      const { data, error } = await supabase
        .from("expenses")
        .select(`
          *,
          projects:project_id (
            id,
            name
          )
        `)
        .eq("created_by", user.id)
        .order("expense_date", { ascending: false })
        .limit(500);

      if (error) throw error;
      
      // Map project data to match existing field names
      const mappedExpenses = (data || []).map(expense => ({
        ...expense,
        project_name: expense.project_name || (expense.projects?.name || null)
      }));
      
      setExpenses(mappedExpenses);
    } catch (err) {
      console.error("Error loading expenses:", err);
    } finally {
      setLoading(false);
    }
  }

  async function loadProjects() {
    try {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name")
        .eq("created_by", user.id)
        .order("name");

      if (error) throw error;
      setProjects(data || []);
    } catch (err) {
      console.error("Error loading projects:", err);
    }
  }

  async function loadBankAccounts() {
    try {
      // Load bank accounts
      const { data: bankData, error: bankError } = await supabase
        .from("bank_accounts")
        .select("*")
        .eq("company_id", user.id)
        .eq("is_active", true)
        .order("account_name");

      if (bankError) throw bankError;

      // Also load income accounts from Chart of Accounts to allow expenses to be recorded against them
      const { data: incomeAccounts, error: incomeError } = await supabase
        .from("accounts")
        .select("id, account_number, account_name, account_type")
        .eq("company_id", user.id)
        .eq("account_type", "Income")
        .eq("is_active", true)
        .order("account_name");

      if (incomeError) throw incomeError;

      // Also load Asset accounts from Chart of Accounts (e.g. Green Dot prepaid, petty cash)
      // that are NOT already represented as bank accounts (to avoid duplicates)
      const linkedChartAccountIds = (bankData || [])
        .map(ba => ba.chart_account_id)
        .filter(Boolean);

      const { data: assetAccounts, error: assetError } = await supabase
        .from("accounts")
        .select("id, account_number, account_name, account_type")
        .eq("company_id", user.id)
        .eq("account_type", "Asset")
        .eq("is_active", true)
        .order("account_name");

      if (assetError) throw assetError;

      // Filter out asset accounts that are already linked to a bank account (avoid duplicates)
      const unlinkedAssetAccounts = (assetAccounts || []).filter(
        acc => !linkedChartAccountIds.includes(acc.id)
      );

      // Merge bank accounts + income accounts + unlinked asset accounts
      const mergedAccounts = [
        ...(bankData || []),
        ...(incomeAccounts || []).map(acc => ({
          id: acc.id,
          account_name: acc.account_name,
          account_type: acc.account_type,
          bank_name: `(Income Account)`,
          is_active: true
        })),
        ...unlinkedAssetAccounts.map(acc => ({
          id: acc.id,
          account_name: acc.account_name,
          account_type: acc.account_type,
          bank_name: `(Asset Account)`,
          is_active: true
        }))
      ];

      setBankAccounts(mergedAccounts);
    } catch (err) {
      console.error("Error loading bank accounts:", err);
    }
  }

  async function loadExpenseAccounts() {
    try {
      const { data, error } = await supabase
        .from("accounts")
        .select("*")
        .eq("company_id", user.id)
        .eq("account_type", "Expense")
        .eq("is_active", true)
        .order("account_number");

      if (error) throw error;
      setExpenseAccounts(data || []);
    } catch (err) {
      console.error("Error loading expense accounts:", err);
    }
  }

  async function loadVendors() {
    try {
      const { data, error } = await supabase
        .from("vendors")
        .select("*")
        .eq("company_id", user.id)
        .eq("archived", false)
        .order("vendor_name");

      if (error) throw error;
      setVendors(data || []);
    } catch (err) {
      console.error("Error loading vendors:", err);
    }
  }

  async function loadBankTransactions() {
    try {
      const { data, error } = await supabase
        .from("bank_transactions")
        .select("id, linked_expense_id")
        .not("linked_expense_id", "is", null)
        .limit(1000);

      if (error) throw error;
      setBankTransactions(data || []);
    } catch (err) {
      console.error("Error loading bank transactions:", err);
    }
  }

  async function loadClearedBankExpenses() {
    try {
      // Fetch bank account names for display (does NOT gate the transaction query —
      // we let Supabase RLS scope bank_transactions to this company, the same way
      // the Dashboard does. Using a bank_account_id list was causing an empty-return
      // if the lookup itself returned no rows.)
      const { data: userBankAccounts } = await supabase
        .from("bank_accounts")
        .select("id, account_name")
        .eq("company_id", user.id);

      // Build a quick lookup: bank_account_id → account_name (for display only)
      const accountNameById = {};
      (userBankAccounts || []).forEach(ba => { accountNameById[ba.id] = ba.account_name; });

      console.log("🏦 Bank accounts available for name lookup:", Object.keys(accountNameById).length);

      // Fetch cleared/reconciled bank transactions that represent expenses.
      // RLS on bank_transactions already restricts rows to this company's accounts,
      // so we do NOT need an explicit bank_account_id filter here.
      // Conditions:
      //   • is_cleared OR is_reconciled = true
      //     (BankTransactions toggle → is_cleared; linking an expense → is_reconciled;
      //      BankReconciliation sets both)
      //   • amount < 0  (withdrawals / payments going out)
      //   • linked_expense_id IS NULL  (avoid double-counting manual expenses)
      const { data, error } = await supabase
        .from("bank_transactions")
        .select("*")
        .or("is_cleared.eq.true,is_reconciled.eq.true")
        .lt("amount", 0)
        .is("linked_expense_id", null)
        .order("transaction_date", { ascending: false })
        .limit(500);

      if (error) {
        console.error("❌ Error loading cleared bank expenses:", error);
        setClearedBankExpenses([]);
        return;
      }

      console.log(`✅ Cleared/reconciled bank expense transactions found: ${(data || []).length}`);

      // Map to expense-like objects that match the shape of the expenses table rows
      const mapped = (data || []).map(bt => ({
        id: `bank_${bt.id}`,
        _isBankTransaction: true,
        bank_transaction_id: bt.id,
        expense_date: bt.transaction_date,
        vendor: bt.payee || bt.description || 'Bank Withdrawal',
        category: bt.category || 'Bank Transaction',
        amount: Math.abs(bt.amount),
        description: bt.description || '',
        project_id: bt.project_id,
        project_name: null,
        bank_account_name: accountNameById[bt.bank_account_id] || null,
        payment_method: bt.transaction_type || 'bank',
        tax_deductible: true,
        is_cleared: bt.is_cleared,
        is_reconciled: bt.is_reconciled,
      }));

      setClearedBankExpenses(mapped);
    } catch (err) {
      console.error("❌ Error in loadClearedBankExpenses:", err);
      setClearedBankExpenses([]);
    }
  }

  // ── Server-side "This Month" total — mirrors the Dashboard 3-step calculation ──
  // Step 1: posted JE lines for expense accounts
  // Step 2: expenses table rows with journal_entry_id = null (not yet journalised)
  // Step 3: cleared bank withdrawals whose bank_transaction_id is NOT already in a JE
  async function loadThisMonthTotal() {
    try {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const startDate = `${year}-${month}-01`;
      const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
      const endDate   = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

      // ── Step 1: posted journal entry lines for expense accounts ──────────────
      const { data: linesData } = await supabase
        .from("journal_entry_lines")
        .select(`
          debit, credit,
          accounts!inner(account_type),
          journal_entries!inner(entry_date, is_posted, reference_type, reference_id)
        `)
        .eq("journal_entries.is_posted", true)
        .gte("journal_entries.entry_date", startDate)
        .lte("journal_entries.entry_date", endDate)
        .limit(2000);

      let total = 0;
      const bankTxIdsInJE = new Set();

      (linesData || []).forEach(line => {
        // Track bank_transaction IDs already covered by a JE (for step 3 dedup)
        if (line.journal_entries?.reference_type === 'bank_transaction' && line.journal_entries?.reference_id) {
          bankTxIdsInJE.add(line.journal_entries.reference_id);
        }
        if (line.accounts?.account_type === 'Expense') {
          total += (line.debit || 0) - (line.credit || 0);
        }
      });

      // ── Step 2: expenses table rows that have NO journal entry yet ────────────
      const { data: directExpenses } = await supabase
        .from("expenses")
        .select("amount")
        .gte("expense_date", startDate)
        .lte("expense_date", endDate)
        .is("journal_entry_id", null);

      (directExpenses || []).forEach(exp => {
        const amt = parseFloat(exp.amount) || 0;
        if (amt > 0) total += amt;
      });

      // ── Step 3: cleared bank withdrawals NOT already counted via a JE ────────
      const { data: btData } = await supabase
        .from("bank_transactions")
        .select("id, amount")
        .eq("is_cleared", true)
        .is("linked_expense_id", null)
        .lt("amount", 0)
        .gte("transaction_date", startDate)
        .lte("transaction_date", endDate);

      (btData || []).forEach(tx => {
        if (bankTxIdsInJE.has(tx.id)) return; // already counted in step 1
        total += Math.abs(parseFloat(tx.amount) || 0);
      });

      console.log(`📅 This Month server-side total (3-step): $${total.toFixed(2)}`);
      setThisMonthTotal(total);
    } catch (err) {
      console.error("Error loading this month total:", err);
      setThisMonthTotal(null);
    }
  }

  // Check if expense is linked to a bank transaction
  function isExpenseLinked(expenseId) {
    return bankTransactions.some(t => t.linked_expense_id === expenseId);
  }

  function openAddExpenseModal() {
    setEditingExpense(null);
    setExpenseForm({
      expense_date: getTodayLocalDate(),
      amount: '',
      category: 'materials',
      vendor: '',
      vendor_id: '',
      description: '',
      payment_method: 'credit_card',
      bank_account_id: '',
      project_id: '',
      project_name: '',
      tax_deductible: true,
      receipt_notes: ''
    });
    setShowExpenseModal(true);
  }

  function openEditExpenseModal(expense) {
    setEditingExpense(expense);
    setExpenseForm({
      expense_date: expense.expense_date,
      amount: expense.amount,
      category: expense.category,
      vendor: expense.vendor || '',
      vendor_id: expense.vendor_id || '',
      description: expense.description || '',
      payment_method: expense.payment_method || 'credit_card',
      bank_account_id: expense.bank_account_id || '',
      project_id: expense.project_id || '',
      project_name: expense.project_name || '',
      tax_deductible: expense.tax_deductible !== false,
      receipt_notes: expense.receipt_notes || ''
    });
    setShowExpenseModal(true);
  }

  async function handleSaveExpense() {
    if (!expenseForm.amount || expenseForm.amount <= 0) {
      setSaveMessage({ type: 'error', text: 'Please enter a valid amount' });
      return;
    }

    if (!expenseForm.category) {
      setSaveMessage({ type: 'error', text: 'Please select a category' });
      return;
    }

    // For cash payments, bank_account_id is not needed (uses Cash account 1000)
    // For other payment methods, bank_account_id is required
    if (expenseForm.payment_method !== 'cash' && !expenseForm.bank_account_id) {
      setSaveMessage({ type: 'error', text: 'Please select a bank account for this payment method' });
      return;
    }

    setSaving(true);
    setSaveMessage(null);

    try {
      // Determine if selected account is a real bank account (from bank_accounts table)
      // OR a Chart of Accounts entry (Income or Asset account - stored in income_account_id)
      const selectedAccount = bankAccounts.find(acc => acc.id === expenseForm.bank_account_id);
      const isChartAccount = selectedAccount && (
        selectedAccount.account_type === 'Income' || selectedAccount.account_type === 'Asset'
      );
      const isBankAccount = selectedAccount && !isChartAccount;

      const expenseData = {
        ...expenseForm,
        created_by: user.id,
        amount: parseFloat(expenseForm.amount),
        // Only store bank_account_id if it's a real bank account (from bank_accounts table)
        // Asset/Income accounts from Chart of Accounts go in income_account_id
        bank_account_id: isBankAccount ? expenseForm.bank_account_id : null,
        income_account_id: isChartAccount ? expenseForm.bank_account_id : null
      };

      // Convert empty strings to null for UUID fields
      if (!expenseData.project_id || expenseData.project_id === '') {
        expenseData.project_id = null;
        expenseData.project_name = '';
      } else {
        const project = projects.find(p => p.id === expenseData.project_id);
        expenseData.project_name = project?.name || '';
      }

      if (!expenseData.vendor_id || expenseData.vendor_id === '') {
        expenseData.vendor_id = null;
      } else {
        const vendor = vendors.find(v => v.id === expenseData.vendor_id);
        expenseData.vendor = vendor?.vendor_name || '';
      }

      if (editingExpense) {
        // Update existing expense
        const { error } = await supabase
          .from('expenses')
          .update(expenseData)
          .eq('id', editingExpense.id);

        if (error) throw error;
        // Update success — close modal and reload
        setShowExpenseModal(false);
        setEditingExpense(null);
        loadExpenses();
        return;
      } else {
        // Create new expense and get the ID back
        const { data: newExpense, error } = await supabase
          .from('expenses')
          .insert([expenseData])
          .select()
          .single();

        if (error) throw error;
        
        // Fire-and-forget journal entry creation — do NOT await it.
        // This prevents any slow/hanging DB query in the journal creation
        // from blocking the UI. The expense is saved; the JE runs in background.
        createExpenseJournalEntry(
          newExpense,
          user.id,
          user.id,
          newExpense.bank_account_id || newExpense.income_account_id,
          newExpense.payment_method
        ).catch(err => console.warn('Background journal entry failed:', err));
      }

      setShowExpenseModal(false);
      setEditingExpense(null);
      loadExpenses();
    } catch (err) {
      console.error('Error saving expense:', err);
      setSaveMessage({ type: 'error', text: `Failed to save expense: ${err.message}` });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(expense) {
    if (!window.confirm(`Are you sure you want to delete this ${expense.category} expense for ${formatCurrency(expense.amount)}?`)) {
      return;
    }

    try {
      // First, delete the associated journal entry
      const { error: journalError } = await supabase
        .from('journal_entries')
        .delete()
        .eq('reference_type', 'expense')
        .eq('reference_id', expense.id);

      if (journalError) {
        console.error('Error deleting journal entry:', journalError);
        // Continue anyway - the expense might not have a journal entry
      }

      // Then delete the expense
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', expense.id);

      if (error) throw error;

      loadExpenses();
    } catch (err) {
      console.error('Error deleting expense:', err);
    }
  }

  // Combine manually-entered expenses + cleared bank transactions, sorted by date descending
  const allExpenses = [
    ...expenses.map(e => ({ ...e, _isBankTransaction: false })),
    ...clearedBankExpenses
  ].sort((a, b) => {
    const dateA = new Date(a.expense_date || 0);
    const dateB = new Date(b.expense_date || 0);
    return dateB - dateA;
  });

  const filteredExpenses = allExpenses.filter(expense => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = (
      expense.vendor?.toLowerCase().includes(searchLower) ||
      expense.description?.toLowerCase().includes(searchLower) ||
      expense.category?.toLowerCase().includes(searchLower) ||
      expense.project_name?.toLowerCase().includes(searchLower)
    );

    const matchesCategory = categoryFilter === "all" || expense.category === categoryFilter;

    const matchesSource =
      sourceFilter === "all" ||
      (sourceFilter === "manual" && !expense._isBankTransaction) ||
      (sourceFilter === "bank" && expense._isBankTransaction);

    return matchesSearch && matchesCategory && matchesSource;
  });

  // Pagination — only render PAGE_SIZE rows at a time
  const totalPages = Math.max(1, Math.ceil(filteredExpenses.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pagedExpenses = filteredExpenses.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Calculate summary statistics using combined list
  const stats = {
    total: allExpenses.length,
    totalAmount: allExpenses.reduce((sum, e) => sum + (e.amount || 0), 0),
    byCategory: allExpenses.reduce((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + e.amount;
      return acc;
    }, {}),
    taxDeductible: allExpenses.filter(e => e.tax_deductible).reduce((sum, e) => sum + e.amount, 0),
    thisMonth: allExpenses.filter(e => {
      // Use string comparison (YYYY-MM) to avoid UTC timezone shift:
      // new Date("2026-04-01") parses as midnight UTC = March 31 in CST,
      // which would wrongly count April 1 expenses as March.
      if (!e.expense_date) return false;
      const yearMonth = String(e.expense_date).substring(0, 7); // "YYYY-MM"
      const now = new Date();
      const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      return yearMonth === currentYearMonth;
    }).reduce((sum, e) => sum + e.amount, 0)
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString.includes('T') ? dateString : dateString + 'T00:00:00');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
  };

  const formatCurrency = (amount) => {
    if (!amount) return '$0.00';
    return `$${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  };

  const getCategoryColor = (category) => {
    const colors = {
      materials: '#3b82f6',
      labor: '#10b981',
      fuel: '#f59e0b',
      equipment: '#8b5cf6',
      tools: '#06b6d4',
      permits: '#ef4444',
      insurance: '#ec4899',
      office: '#6366f1',
      vehicle: '#f97316',
      utilities: '#14b8a6',
      marketing: '#a855f7',
      subcontractor: '#84cc16',
      other: '#6b7280'
    };
    return colors[category] || '#6b7280';
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading expenses...</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Expenses</h1>
        <button 
          onClick={openAddExpenseModal}
          style={styles.newButton}
        >
          + Add Expense
        </button>
      </div>

      {/* Summary Stats */}
      <div style={styles.statsContainer}>
        <div style={styles.statCard}>
          <div style={styles.statValue}>{stats.total}</div>
          <div style={styles.statLabel}>Total Expenses</div>
        </div>
        <div style={styles.statCard}>
          <div style={{...styles.statValue, color: '#ef4444'}}>{formatCurrency(stats.totalAmount)}</div>
          <div style={styles.statLabel}>Total Spent</div>
        </div>
        <div style={styles.statCard}>
          <div style={{...styles.statValue, color: '#f59e0b'}}>
            {thisMonthTotal === null ? formatCurrency(stats.thisMonth) : formatCurrency(thisMonthTotal)}
          </div>
          <div style={styles.statLabel}>This Month</div>
        </div>
        <div style={styles.statCard}>
          <div style={{...styles.statValue, color: '#10b981'}}>{formatCurrency(stats.taxDeductible)}</div>
          <div style={styles.statLabel}>Tax Deductible</div>
        </div>
      </div>

      {/* Search and Filter */}
      <div style={styles.filterBar}>
        <input
          type="text"
          placeholder="Search by vendor, description, category, or project..."
          value={searchTerm}
          onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
          style={styles.searchInput}
        />
        <select
          value={categoryFilter}
          onChange={(e) => { setCategoryFilter(e.target.value); setCurrentPage(1); }}
          style={styles.filterSelect}
        >
          <option value="all">All Categories</option>
          <option value="materials">Materials</option>
          <option value="labor">Labor</option>
          <option value="fuel">Fuel</option>
          <option value="equipment">Equipment</option>
          <option value="tools">Tools</option>
          <option value="permits">Permits</option>
          <option value="insurance">Insurance</option>
          <option value="office">Office</option>
          <option value="vehicle">Vehicle</option>
          <option value="utilities">Utilities</option>
          <option value="marketing">Marketing</option>
          <option value="subcontractor">Subcontractor</option>
          <option value="other">Other</option>
        </select>
        <select
          value={sourceFilter}
          onChange={(e) => { setSourceFilter(e.target.value); setCurrentPage(1); }}
          style={styles.filterSelect}
        >
          <option value="all">All Sources</option>
          <option value="manual">Manual Entries</option>
          <option value="bank">Cleared Bank Transactions</option>
        </select>
      </div>

      {/* Legend */}
      <div style={{display: 'flex', gap: 16, marginBottom: 12, alignItems: 'center'}}>
        <span style={{fontSize: 13, color: '#aaa'}}>
          <span style={{background: '#fff', border: '1px solid #e5e7eb', borderRadius: 4, padding: '2px 8px', marginRight: 6, fontSize: 12}}>✏️ Manual</span>
          Manually entered expense
        </span>
        <span style={{fontSize: 13, color: '#aaa'}}>
          <span style={{background: '#dbeafe', border: '1px solid #93c5fd', borderRadius: 4, padding: '2px 8px', marginRight: 6, fontSize: 12}}>🏦 Bank</span>
          Cleared bank transaction
        </span>
      </div>

      {filteredExpenses.length === 0 ? (
        <div style={styles.empty}>
          <p style={styles.emptyText}>
            {searchTerm || categoryFilter !== "all" || sourceFilter !== "all"
              ? "No expenses found matching your filters." 
              : "No expenses yet. Click 'Add Expense' to track your first expense!"}
          </p>
        </div>
      ) : (
        <div style={styles.tableContainer}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.tableHeaderRow}>
                <th style={{...styles.th, textAlign: 'left', width: '10%'}}>Date</th>
                <th style={{...styles.th, textAlign: 'left', width: '8%'}}>Source</th>
                <th style={{...styles.th, textAlign: 'left', width: '15%'}}>Vendor / Payee</th>
                <th style={{...styles.th, textAlign: 'center', width: '20%'}}>Category / Account</th>
                <th style={{...styles.th, textAlign: 'center', width: '20%'}}>Project</th>
                <th style={{...styles.th, textAlign: 'right', width: '10%'}}>Amount</th>
                <th style={{...styles.th, textAlign: 'center', width: '10%'}}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pagedExpenses.map(expense => (
                <tr 
                  key={expense.id} 
                  style={{
                    ...styles.tableRow,
                    backgroundColor: expense._isBankTransaction ? '#f0f7ff' : 'transparent'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = expense._isBankTransaction ? '#dbeafe' : '#f9fafb'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = expense._isBankTransaction ? '#f0f7ff' : 'transparent'}
                >
                  <td style={{...styles.td, width: '10%'}}>
                    {formatDate(expense.expense_date)}
                  </td>
                  <td style={{...styles.td, width: '8%'}}>
                    {expense._isBankTransaction ? (
                      <span style={{
                        background: '#dbeafe',
                        border: '1px solid #93c5fd',
                        borderRadius: 4,
                        padding: '2px 8px',
                        fontSize: 11,
                        fontWeight: 700,
                        color: '#1d4ed8',
                        whiteSpace: 'nowrap'
                      }} title="Cleared from bank account">
                        🏦 Bank
                      </span>
                    ) : (
                      <span style={{
                        background: '#fff',
                        border: '1px solid #e5e7eb',
                        borderRadius: 4,
                        padding: '2px 8px',
                        fontSize: 11,
                        fontWeight: 700,
                        color: '#555',
                        whiteSpace: 'nowrap'
                      }}>
                        ✏️ Manual
                      </span>
                    )}
                  </td>
                  <td style={{...styles.td, width: '15%'}}>
                    <div style={{display: 'flex', alignItems: 'center', gap: 6}}>
                      {!expense._isBankTransaction && isExpenseLinked(expense.id) && (
                        <span style={{fontSize: 16}} title="Linked to bank transaction">🔗</span>
                      )}
                      <span>{expense.vendor || 'N/A'}</span>
                    </div>
                  </td>
                  <td style={{...styles.td, width: '20%', textAlign: 'center'}}>
                    {expense.category || 'N/A'}
                  </td>
                  <td style={{...styles.td, width: '20%', textAlign: 'center'}}>
                    {expense.project_name || '-'}
                  </td>
                  <td style={{...styles.td, textAlign: 'right', width: '10%'}}>
                    <span style={styles.amount}>{formatCurrency(expense.amount)}</span>
                  </td>
                  <td style={{...styles.td, textAlign: 'center', width: '10%'}}>
                    {expense._isBankTransaction ? (
                      <div style={{fontSize: 11, color: '#6b7280', textAlign: 'center'}}>
                        <em>Manage in<br/>Bank Transactions</em>
                      </div>
                    ) : (
                      <div style={styles.actions}>
                        <button
                          onClick={() => openEditExpenseModal(expense)}
                          style={{...styles.actionButton, ...styles.editButton}}
                          title="Edit"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDelete(expense)}
                          style={{...styles.actionButton, ...styles.deleteButton}}
                          title="Delete"
                        >
                          🗑️
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div style={{display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 16}}>
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={safePage <= 1}
            style={{
              padding: '8px 18px', borderRadius: 6, border: '2px solid #e5e7eb',
              background: safePage <= 1 ? '#f3f4f6' : '#fff', cursor: safePage <= 1 ? 'default' : 'pointer',
              color: safePage <= 1 ? '#aaa' : '#333', fontWeight: 600, fontSize: 14
            }}
          >
            ← Prev
          </button>
          <span style={{color: '#fff', fontWeight: 600, fontSize: 14}}>
            Page {safePage} of {totalPages} &nbsp;·&nbsp; {filteredExpenses.length} total
          </span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={safePage >= totalPages}
            style={{
              padding: '8px 18px', borderRadius: 6, border: '2px solid #e5e7eb',
              background: safePage >= totalPages ? '#f3f4f6' : '#fff', cursor: safePage >= totalPages ? 'default' : 'pointer',
              color: safePage >= totalPages ? '#aaa' : '#333', fontWeight: 600, fontSize: 14
            }}
          >
            Next →
          </button>
        </div>
      )}

      <div style={styles.footer}>
        <p style={styles.footerText}>
          Showing {pagedExpenses.length} of {filteredExpenses.length} filtered ({allExpenses.length} total:
          {' '}{expenses.length} manual + {clearedBankExpenses.length} cleared bank transactions)
        </p>
      </div>

      {/* Expense Modal */}
      {showExpenseModal && (
        <div style={styles.modalOverlay} onClick={() => setShowExpenseModal(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>
                {editingExpense ? 'Edit Expense' : 'Add New Expense'}
              </h2>
              <button 
                onClick={() => { setShowExpenseModal(false); setSaveMessage(null); }} 
                style={styles.closeButton}
              >
                ×
              </button>
            </div>
            
            <div style={styles.modalBody}>
              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Date *</label>
                  <input
                    type="date"
                    value={expenseForm.expense_date}
                    onChange={(e) => setExpenseForm({...expenseForm, expense_date: e.target.value})}
                    style={styles.input}
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Amount *</label>
                  <input
                    type="number"
                    value={expenseForm.amount}
                    onChange={(e) => setExpenseForm({...expenseForm, amount: e.target.value})}
                    style={styles.input}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>

              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Expense Account *</label>
                  <select
                    value={expenseForm.category}
                    onChange={(e) => setExpenseForm({...expenseForm, category: e.target.value})}
                    style={styles.input}
                  >
                    <option value="">Select Account...</option>
                    {expenseAccounts.map(account => (
                      <option key={account.id} value={account.account_name}>
                        {account.account_number} - {account.account_name}
                      </option>
                    ))}
                  </select>
                  {expenseAccounts.length === 0 && (
                    <div style={{fontSize: 12, color: '#ef4444', marginTop: 6}}>
                      No expense accounts found. Add them in Chart of Accounts.
                    </div>
                  )}
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Vendor</label>
                  <select
                    value={expenseForm.vendor_id}
                    onChange={(e) => setExpenseForm({...expenseForm, vendor_id: e.target.value, vendor: ''})}
                    style={styles.input}
                  >
                    <option value="">Select Vendor...</option>
                    {vendors.map(vendor => (
                      <option key={vendor.id} value={vendor.id}>
                        {vendor.vendor_name}
                      </option>
                    ))}
                  </select>
                  {vendors.length === 0 && (
                    <div style={{fontSize: 12, color: '#ef4444', marginTop: 6}}>
                      No vendors found. Add them in the Vendors page.
                    </div>
                  )}
                  {!expenseForm.vendor_id && (
                    <div style={{marginTop: 8}}>
                      <label style={{...styles.label, fontSize: 12, color: '#666'}}>Or enter vendor name manually:</label>
                      <input
                        type="text"
                        value={expenseForm.vendor}
                        onChange={(e) => setExpenseForm({...expenseForm, vendor: e.target.value})}
                        style={styles.input}
                        placeholder="e.g. Home Depot, Lowes"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Description</label>
                <input
                  type="text"
                  value={expenseForm.description}
                  onChange={(e) => setExpenseForm({...expenseForm, description: e.target.value})}
                  style={styles.input}
                  placeholder="What was this expense for?"
                />
              </div>

              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Payment Method</label>
                  <select
                    value={expenseForm.payment_method}
                    onChange={(e) => setExpenseForm({...expenseForm, payment_method: e.target.value})}
                    style={styles.input}
                  >
                    <option value="credit_card">Credit Card</option>
                    <option value="debit_card">Debit Card</option>
                    <option value="cash">💵 Cash</option>
                    <option value="check">Check</option>
                    <option value="ach">ACH/Bank Transfer</option>
                    <option value="other">Other</option>
                  </select>
                  {expenseForm.payment_method === 'cash' && (
                    <div style={{fontSize: 12, color: '#10b981', marginTop: 6, fontWeight: 600}}>
                      ✓ Using Cash Account (1000) - no bank account needed
                    </div>
                  )}
                </div>
                {expenseForm.payment_method !== 'cash' && (
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Bank Account (Paid From) *</label>
                    <select
                      value={expenseForm.bank_account_id}
                      onChange={(e) => setExpenseForm({...expenseForm, bank_account_id: e.target.value})}
                      style={styles.input}
                    >
                      <option value="">Select Account...</option>
                      {bankAccounts.map(account => (
                        <option key={account.id} value={account.id}>
                          {account.account_name} - {account.account_type}
                          {account.bank_name ? ` (${account.bank_name})` : ''}
                        </option>
                      ))}
                    </select>
                    {bankAccounts.length === 0 && (
                      <div style={{fontSize: 12, color: '#ef4444', marginTop: 6}}>
                        No bank accounts found. Add one in Bank Accounts page.
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Link to Project (Optional)</label>
                <select
                  value={expenseForm.project_id}
                  onChange={(e) => setExpenseForm({...expenseForm, project_id: e.target.value})}
                  style={styles.input}
                >
                  <option value="">No Project</option>
                  {projects.map(project => (
                    <option key={project.id} value={project.id}>{project.name}</option>
                  ))}
                </select>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={expenseForm.tax_deductible}
                    onChange={(e) => setExpenseForm({...expenseForm, tax_deductible: e.target.checked})}
                    style={styles.checkbox}
                  />
                  Tax Deductible
                </label>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Notes</label>
                <textarea
                  value={expenseForm.receipt_notes}
                  onChange={(e) => setExpenseForm({...expenseForm, receipt_notes: e.target.value})}
                  style={{...styles.input, minHeight: 80, resize: 'vertical'}}
                  placeholder="Any additional notes..."
                />
              </div>
            </div>

            <div style={styles.modalFooter}>
              {saveMessage && (
                <div style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: 6,
                  fontSize: 14,
                  fontWeight: 600,
                  backgroundColor: saveMessage.type === 'error' ? '#fef2f2' : '#f0fdf4',
                  color: saveMessage.type === 'error' ? '#dc2626' : '#16a34a',
                  border: `1px solid ${saveMessage.type === 'error' ? '#fca5a5' : '#86efac'}`,
                }}>
                  {saveMessage.type === 'error' ? '⚠️ ' : '✅ '}{saveMessage.text}
                </div>
              )}
              <button 
                onClick={() => { setShowExpenseModal(false); setSaveMessage(null); }} 
                style={styles.cancelButton}
                disabled={saving}
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveExpense} 
                style={{...styles.saveButton, opacity: saving ? 0.6 : 1, cursor: saving ? 'not-allowed' : 'pointer'}}
                disabled={saving}
              >
                {saving ? '⏳ Saving...' : editingExpense ? '💾 Update' : '💰 Save Expense'}
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
  statsContainer: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: 16,
    marginBottom: 30,
  },
  statCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 24,
    textAlign: "center",
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
  },
  statValue: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#fc6b04",
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 13,
    color: "#666",
    textTransform: "uppercase",
    fontWeight: "600",
    letterSpacing: "0.5px",
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
  tableContainer: {
    backgroundColor: "#fff",
    borderRadius: 12,
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
    overflow: "hidden",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    tableLayout: "fixed",
  },
  tableHeaderRow: {
    backgroundColor: "#f9fafb",
    borderBottom: "2px solid #e5e7eb",
  },
  th: {
    padding: "16px 20px",
    fontSize: 13,
    fontWeight: "700",
    color: "#666",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  tableRow: {
    borderBottom: "1px solid #f0f0f0",
    transition: "background-color 0.2s",
  },
  td: {
    padding: "16px 20px",
    fontSize: 15,
    color: "#333",
  },
  categoryBadge: {
    display: "inline-block",
    padding: "6px 12px",
    borderRadius: 6,
    fontSize: 12,
    fontWeight: "bold",
    color: "#fff",
    textTransform: "capitalize",
  },
  description: {
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
  },
  amount: {
    fontWeight: "700",
    color: "#ef4444",
    fontSize: 16,
  },
  actions: {
    display: "flex",
    gap: 8,
    justifyContent: "center",
  },
  actionButton: {
    padding: "6px 12px",
    border: "none",
    borderRadius: 6,
    fontSize: 16,
    cursor: "pointer",
    transition: "opacity 0.2s",
  },
  editButton: {
    backgroundColor: "#3b82f6",
    color: "#fff",
  },
  deleteButton: {
    backgroundColor: "#ef4444",
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
    marginBottom: 20,
  },
  footer: {
    marginTop: 20,
    textAlign: "center",
  },
  footerText: {
    color: "#fff",
    fontSize: 14,
  },
  loading: {
    textAlign: "center",
    padding: 60,
    fontSize: 18,
    color: "#fff",
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
  checkboxLabel: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
    cursor: "pointer",
  },
  checkbox: {
    width: 18,
    height: 18,
    cursor: "pointer",
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
