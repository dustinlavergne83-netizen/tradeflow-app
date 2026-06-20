import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import BankStatementUpload from "../Components/BankStatementUpload";
import { createBankTransactionJournalEntry, getNextJournalEntryNumber } from "../utils/accountingJournals";
import { getTodayLocalDate } from "../utils/dateUtils";

export default function BankTransactions() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const accountId = searchParams.get('accountId');

  const [bankAccount, setBankAccount] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showMatchesModal, setShowMatchesModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterCleared, setFilterCleared] = useState('all');
  const [expenses, setExpenses] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [invoicePayments, setInvoicePayments] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selectedTransactions, setSelectedTransactions] = useState(new Set());
  const [isClearing, setIsClearing] = useState(false);
  const [selectedClearedTransactions, setSelectedClearedTransactions] = useState(new Set());
  const [isUnclearing, setIsUnclearing] = useState(false);
  const [bulkStatusMsg, setBulkStatusMsg] = useState('');
  const [showClearedFolder, setShowClearedFolder] = useState(false);
  const [showMatchReview, setShowMatchReview] = useState(false);
  const [matchReviewIndex, setMatchReviewIndex] = useState(0);
  const [matchCandidateIndex, setMatchCandidateIndex] = useState(0);
  
  const [transactionForm, setTransactionForm] = useState({
    transaction_date: getTodayLocalDate(),
    description: '',
    reference_number: '',
    amount: '',
    transaction_type: 'deposit',
    category: '',
    payee: '',
    notes: '',
    project_id: ''
  });

  useEffect(() => {
    if (!accountId) {
      alert('No bank account specified');
      navigate('/accounting/bank-accounts');
      return;
    }
    loadData();
    loadExpensesAndInvoices();
    loadVendors();
  }, [accountId, user]);

  useEffect(() => {
    applyFilters();
  }, [transactions, searchTerm, filterType, filterCleared]);

  async function loadData() {
    try {
      setLoading(true);
      
      // Load bank account details
      const { data: accountData, error: accountError } = await supabase
        .from("bank_accounts")
        .select("*")
        .eq("id", accountId)
        .single();

      if (accountError) throw accountError;
      setBankAccount(accountData);

      // Load transactions with project info
      const { data: transactionsData, error: transactionsError } = await supabase
        .from("bank_transactions")
        .select(`
          *,
          projects:project_id (
            id,
            name
          )
        `)
        .eq("bank_account_id", accountId)
        .order("transaction_date", { ascending: false })
        .order("created_at", { ascending: false});

      if (transactionsError) throw transactionsError;
      setTransactions(transactionsData || []);
    } catch (err) {
      console.error("Error loading data:", err);
      alert("Failed to load transactions: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadExpensesAndInvoices() {
    try {
      // Load Chart of Accounts
      const { data: accountsData, error: accountsError } = await supabase
        .from("accounts")
        .select("id, account_name, account_number, account_type")
        .order("account_number", { ascending: true });

      if (accountsError) throw accountsError;
      setAccounts(accountsData || []);

      // Load expenses - simplified query without project join
      const { data: expensesData, error: expensesError } = await supabase
        .from("expenses")
        .select("id, expense_date, vendor, amount, description, category, project_id")
        .order("expense_date", { ascending: false })
        .limit(500);

      if (expensesError) {
        console.error("Error loading expenses:", expensesError);
        setExpenses([]);
      } else {
        setExpenses(expensesData || []);
      }

      // Load projects separately - using only columns that exist (active projects only)
      const { data: projectsData, error: projectsError } = await supabase
        .from("projects")
        .select("id, name, status")
        .in("status", ["active", "in_progress"])
        .order("name");
      
      if (projectsError) {
        console.error("Error loading projects:", projectsError);
      } else {
        // Rename 'name' to 'project_name' for compatibility
        const mappedProjects = (projectsData || []).map(p => ({
          ...p,
          project_name: p.name
        }));
        setProjects(mappedProjects);
      }

      // Load invoices - including new processing fee fields
      const { data: invoicesData, error: invoicesError } = await supabase
        .from("invoices")
        .select("id, invoice_date, invoice_number, total, customer_name, processing_fee, net_deposit_amount")
        .eq("created_by", user.id)
        .order("invoice_date", { ascending: false })
        .limit(500);

      if (invoicesError) throw invoicesError;
      // Rename 'total' to 'total_amount' for compatibility with the rest of the code
      const mappedInvoices = (invoicesData || []).map(inv => ({
        ...inv,
        total_amount: inv.total,
        net_deposit_amount: inv.net_deposit_amount || inv.total, // Use net_deposit_amount if available, otherwise use total
        processing_fee: inv.processing_fee || 0,
        customer_id: inv.customer_name // Map for compatibility
      }));
      setInvoices(mappedInvoices);

      // Load individual payment records so we can match on individual payment net amounts
      // (e.g. a $1700 Venmo payment with $57.50 fee deposits as $1642.50 in the bank)
      const { data: paymentsData } = await supabase
        .from("invoice_payments")
        .select("id, invoice_id, amount, net_amount, processing_fee, payment_date")
        .order("payment_date", { ascending: false })
        .limit(2000);
      setInvoicePayments(paymentsData || []);
    } catch (err) {
      console.error("Error loading expenses/invoices:", err);
    }
  }

  async function loadVendors() {
    try {
      const { data, error } = await supabase
        .from("vendors")
        .select("vendor_name")
        .eq("company_id", user.id)
        .eq("archived", false)
        .order("vendor_name");

      if (error) throw error;
      setVendors(data || []);
    } catch (err) {
      console.error("Error loading vendors:", err);
    }
  }

  async function deleteJournalEntryForTransaction(transactionId) {
    try {
      console.log('Starting deletion of journal entry for transaction:', transactionId);
      
      // IMPORTANT: First try to find by reference_type and reference_id (most reliable)
      let { data: journalEntries, error: journalCheckError } = await supabase
        .from('journal_entries')
        .select('id, entry_number, reference_type, reference_id')
        .eq('reference_type', 'bank_transaction')
        .eq('reference_id', transactionId);

      if (journalCheckError) {
        console.error('Error checking for journal entry:', journalCheckError);
        throw journalCheckError;
      }

      console.log('Journal entries found by reference:', journalEntries);

      // If no entries found by reference, they might be orphaned - try to find by description containing transaction info
      if (!journalEntries || journalEntries.length === 0) {
        console.log('No entries found by reference, searching by description pattern...');
        // This is a fallback in case the reference_id doesn't match
        const { data: orphanedEntries, error: orphanError } = await supabase
          .from('journal_entries')
          .select('id, entry_number, description')
          .ilike('description', `%Bank%transaction%`)
          .limit(100);
        
        if (orphanError) {
          console.error('Error searching for orphaned entries:', orphanError);
        } else {
          console.log('Orphaned entries found:', orphanedEntries?.length);
        }
      }

      // Process ALL matching journal entries
      if (journalEntries && journalEntries.length > 0) {
        console.log(`Found ${journalEntries.length} journal entries to delete`);
        
        for (const journalEntry of journalEntries) {
          console.log('Processing journal entry:', journalEntry.id, 'Reference:', journalEntry.reference_id);
          
          // FIRST: Delete ALL journal entry lines for this entry (with detailed logging)
          console.log('Step 1: Deleting all journal entry lines for entry:', journalEntry.id);
          const { error: linesDeleteError, count: linesDeleted } = await supabase
            .from('journal_entry_lines')
            .delete()
            .eq('entry_id', journalEntry.id);

          if (linesDeleteError) {
            console.error('Error deleting journal entry lines:', linesDeleteError);
            throw linesDeleteError;
          }
          console.log('✅ Deleted journal entry lines. Rows affected:', linesDeleted);

          // SECOND: Delete the journal entry itself
          console.log('Step 2: Deleting journal entry with ID:', journalEntry.id);
          const { error: entryDeleteError, count: entriesDeleted } = await supabase
            .from('journal_entries')
            .delete()
            .eq('id', journalEntry.id);

          if (entryDeleteError) {
            console.error('Error deleting journal entry:', entryDeleteError);
            throw entryDeleteError;
          }

          console.log('✅ SUCCESSFULLY deleted journal entry:', journalEntry.id, 'Rows affected:', entriesDeleted);
        }
        return true;
      } else {
        console.log('⚠️ No journal entry found for transaction ID:', transactionId);
        console.log('The transaction may have been cleared without creating a journal entry, or the reference_id may not match');
        // Don't throw an error here - just return false so unclearing can still succeed
        return false;
      }
    } catch (err) {
      console.error('❌ Error in deleteJournalEntryForTransaction:', err);
      console.log('Full error details:', err);
      alert(`❌ WARNING: Could not automatically remove journal entry.\n\nError: ${err.message}\n\nPlease manually delete Entry #${err.entry_number || 'unknown'} from the General Ledger.`);
      // Don't throw - allow the transaction to still be marked as uncleared
      return false;
    }
  }

  async function handleLinkExpense(transactionId, expenseId) {
    try {
      if (!expenseId) {
        // Unlinking - just clear the link
        const updates = {
          linked_expense_id: null,
          is_reconciled: false,
          reconciled_at: null,
          reconciled_by: null
        };

        const { error } = await supabase
          .from('bank_transactions')
          .update(updates)
          .eq('id', transactionId);

        if (error) throw error;
      } else {
        // Linking - copy vendor and category from expense
        const expense = expenses.find(e => e.id === expenseId);
        
        if (!expense) {
          alert('Expense not found');
          return;
        }

        // Find the account ID for this category name
        let categoryAccountId = null;
        if (expense.category) {
          const account = accounts.find(a => a.account_name === expense.category);
          categoryAccountId = account?.id || null;
        }

        const updates = {
          linked_expense_id: expenseId,
          is_reconciled: true,
          reconciled_at: new Date().toISOString(),
          reconciled_by: user.id,
          payee: expense.vendor || null,
          category: categoryAccountId
        };

        const { error } = await supabase
          .from('bank_transactions')
          .update(updates)
          .eq('id', transactionId);

        if (error) throw error;
      }

      loadData();
      setShowMatchesModal(false);
    } catch (err) {
      console.error('Error linking expense:', err);
      alert('Failed to link expense');
    }
  }

  async function handleLinkInvoice(transactionId, invoiceId) {
    try {
      if (!invoiceId) {
        // Unlinking
        const updates = {
          linked_invoice_id: null,
          is_reconciled: false,
          reconciled_at: null,
          reconciled_by: null
        };

        const { error } = await supabase
          .from('bank_transactions')
          .update(updates)
          .eq('id', transactionId);

        if (error) throw error;
      } else {
        // Linking - get the invoice details including bank account
        const invoice = invoices.find(i => i.id === invoiceId);
        
        if (!invoice) {
          alert('Invoice not found');
          return;
        }

        // Get the full invoice record to find which bank account was used for payment
        const { data: fullInvoice, error: invoiceError } = await supabase
          .from('invoices')
          .select('bank_account_id')
          .eq('id', invoiceId)
          .single();

        if (invoiceError) {
          console.error('Error fetching invoice details:', invoiceError);
        }

        let categoryAccountId = null;
        
        // If the invoice has a bank_account_id, get its chart_account_id
        if (fullInvoice?.bank_account_id) {
          const { data: bankAcct, error: bankError } = await supabase
            .from('bank_accounts')
            .select('chart_account_id')
            .eq('id', fullInvoice.bank_account_id)
            .single();

          if (bankError) {
            console.error('Error fetching bank account:', bankError);
          } else if (bankAcct?.chart_account_id) {
            categoryAccountId = bankAcct.chart_account_id;
          }
        }

        const updates = {
          linked_invoice_id: invoiceId,
          is_reconciled: true,
          reconciled_at: new Date().toISOString(),
          reconciled_by: user.id,
          category: categoryAccountId,
          payee: invoice.customer_name || null
        };

        const { error } = await supabase
          .from('bank_transactions')
          .update(updates)
          .eq('id', transactionId);

        if (error) throw error;
      }

      loadData();
      setShowMatchesModal(false);
    } catch (err) {
      console.error('Error linking invoice:', err);
      alert('Failed to link invoice');
    }
  }


  function openMatchesModal(transaction) {
    setSelectedTransaction(transaction);
    setShowMatchesModal(true);
  }

  function getMatchingExpenses(transaction) {
    return expenses.filter(exp => Math.abs(exp.amount) === Math.abs(transaction.amount));
  }

  function getMatchingInvoices(transaction) {
    const transAmount = Math.abs(parseFloat(transaction.amount) || 0);

    return invoices.filter(inv => {
      // 1. Match against net_deposit_amount on the invoice record (last payment's net, $2 tolerance)
      const netDepositAmount = Math.abs(parseFloat(inv.net_deposit_amount) || 0);
      if (netDepositAmount > 0 && Math.abs(netDepositAmount - transAmount) <= 2.00) {
        return true;
      }

      // 2. Check individual payment records — handles invoices with multiple partial payments
      //    Each Venmo/PayPal payment deposits the NET amount (gross minus fee) into the bank,
      //    so a bank transaction of $1,642.50 should match a $1,700 payment with $57.50 fee.
      const hasMatchingPayment = invoicePayments.some(pmt => {
        if (pmt.invoice_id !== inv.id) return false;
        const pmtNet = Math.abs(parseFloat(pmt.net_amount) || 0);
        const pmtGross = Math.abs(parseFloat(pmt.amount) || 0);
        // Net amount match (within $2 to handle rounding)
        if (pmtNet > 0 && Math.abs(pmtNet - transAmount) <= 2.00) return true;
        // Gross amount match (within 1 cent — e.g. no-fee payments like checks/cash)
        if (pmtGross > 0 && Math.abs(pmtGross - transAmount) < 0.01) return true;
        return false;
      });
      if (hasMatchingPayment) return true;

      // 3. Fallback: match against total invoice amount (exact, within 1 cent)
      const invAmount = Math.abs(parseFloat(inv.total_amount) || 0);
      return Math.abs(invAmount - transAmount) < 0.01;
    });
  }

  function getMatchCount(transaction) {
    const expenseMatches = getMatchingExpenses(transaction).length;
    const invoiceMatches = getMatchingInvoices(transaction).length;
    return expenseMatches + invoiceMatches;
  }

  function applyFilters() {
    let filtered = [...transactions];

    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(t => 
        t.description?.toLowerCase().includes(search) ||
        t.payee?.toLowerCase().includes(search) ||
        t.reference_number?.toLowerCase().includes(search) ||
        t.category?.toLowerCase().includes(search)
      );
    }

    // Type filter
    if (filterType !== 'all') {
      filtered = filtered.filter(t => t.transaction_type === filterType);
    }

    // NOTE: Cleared/uncleared split is handled by the two separate sections below (no filter here)
    setFilteredTransactions(filtered);
  }

  function openAddModal() {
    setEditingTransaction(null);
    setTransactionForm({
      transaction_date: getTodayLocalDate(),
      description: '',
      reference_number: '',
      amount: '',
      transaction_type: 'deposit',
      category: '',
      payee: '',
      notes: '',
      project_id: ''
    });
    setShowModal(true);
  }

  function openEditModal(transaction) {
    setEditingTransaction(transaction);
    setTransactionForm({
      transaction_date: transaction.transaction_date || getTodayLocalDate(),
      description: transaction.description || '',
      reference_number: transaction.reference_number || '',
      amount: Math.abs(transaction.amount).toString(),
      transaction_type: transaction.transaction_type || 'deposit',
      category: transaction.category || '',
      payee: transaction.payee || '',
      notes: transaction.notes || '',
      project_id: transaction.project_id || ''
    });
    setShowModal(true);
  }

  async function handleSave() {
    if (!transactionForm.description || !transactionForm.amount) {
      alert('Please enter description and amount');
      return;
    }

    try {
      const amount = parseFloat(transactionForm.amount);
      if (isNaN(amount) || amount <= 0) {
        alert('Please enter a valid positive amount');
        return;
      }

      // For deposits, amount is positive; for withdrawals, amount is negative
      const finalAmount = transactionForm.transaction_type === 'withdrawal' || 
                         transactionForm.transaction_type === 'fee' ? 
                         -Math.abs(amount) : Math.abs(amount);

      const transactionData = {
        bank_account_id: accountId,
        transaction_date: transactionForm.transaction_date,
        description: transactionForm.description,
        reference_number: transactionForm.reference_number || null,
        amount: finalAmount,
        transaction_type: transactionForm.transaction_type,
        category: transactionForm.category || null,
        payee: transactionForm.payee || null,
        notes: transactionForm.notes || null,
        project_id: transactionForm.project_id || null,
        created_by: user.id
      };

      if (editingTransaction) {
        const { error } = await supabase
          .from('bank_transactions')
          .update(transactionData)
          .eq('id', editingTransaction.id);

        if (error) throw error;
        alert('Transaction updated successfully!');
      } else {
        const { error } = await supabase
          .from('bank_transactions')
          .insert([transactionData]);

        if (error) throw error;
        alert('Transaction added successfully!');
      }

      setShowModal(false);
      setEditingTransaction(null);
      loadData();
    } catch (err) {
      console.error('Error saving transaction:', err);
      alert(`Failed to save: ${err.message}`);
    }
  }

  async function handleToggleCleared(transaction, bulkMode = false) {
    try {
      const newClearedStatus = !transaction.is_cleared;
      
      // STEP 1: Update the is_cleared status
      const { error: updateError } = await supabase
        .from('bank_transactions')
        .update({ is_cleared: newClearedStatus })
        .eq('id', transaction.id);

      if (updateError) {
        console.error('Error updating is_cleared:', updateError);
        alert('Failed to update transaction status');
        return;
      }

      // STEP 2: If linked to invoice/expense, handle status updates
      if (newClearedStatus && transaction.linked_invoice_id) {
        // FIRST: Get the full invoice to know the amount
        const { data: fullInvoice, error: invoiceLoadError } = await supabase
          .from('invoices')
          .select('*')
          .eq('id', transaction.linked_invoice_id)
          .single();

        if (invoiceLoadError || !fullInvoice) {
          console.warn('Could not load invoice details:', invoiceLoadError);
          // Still reload even if there's an error
          await loadData();
          return;
        }

        // Just update invoice to mark as paid and set balance due to 0
        // DO NOT create a journal entry - it was already created elsewhere
        const { error: invoiceError } = await supabase
          .from('invoices')
          .update({ 
            payment_status: 'paid',
            payment_date: new Date().toISOString(),
            amount_paid: fullInvoice.total,
            balance_due: 0
          })
          .eq('id', transaction.linked_invoice_id);

        if (invoiceError) {
          console.warn('Failed to update invoice payment status:', invoiceError);
        }
        
        console.log('✅ Linked invoice marked as paid - no duplicate journal entry created');
        
        // RELOAD DATA - skip in bulk mode, caller reloads once at the end
        if (!bulkMode) await loadData();
        return;
      }

      // If marking as NOT cleared and linked to an invoice, mark the invoice as unpaid
      if (!newClearedStatus && transaction.linked_invoice_id) {
        const { error: invoiceError } = await supabase
          .from('invoices')
          .update({ 
            payment_status: 'unpaid',
            payment_date: null
          })
          .eq('id', transaction.linked_invoice_id);

        if (invoiceError) {
          console.warn('Failed to update invoice payment status:', invoiceError);
        }
      }

      // When UNCLEANING an UNLINKED transaction, DELETE the journal entry that was created
      if (!newClearedStatus && !transaction.linked_invoice_id && !transaction.linked_expense_id) {
        console.log('Removing journal entry for uncleared unlinked transaction:', transaction.id);
        
        // Delete journal entry for this transaction
        await deleteJournalEntryForTransaction(transaction.id);
        
        // Remind user to refresh Chart of Accounts
        if (!bulkMode) alert('✅ Transaction uncleared! \n\n⚠️ IMPORTANT: Please go to Chart of Accounts > "Refresh Balances" to update the book values.');
      }

        // IMPORTANT: Always create a journal entry for CLEARED transactions
        // This ensures all cleared transactions are recorded in the ledger
        // SPECIAL HANDLING: For owner draws, ALWAYS create entry and cleanup orphaned entries
        if (newClearedStatus && !transaction.linked_invoice_id && !transaction.linked_expense_id) {
          console.log('Creating journal entry for cleared transaction:', transaction.id);

        
        // IMPORTANT: Reload the transaction from database to get the latest category value
        // The in-memory transaction object may not have the category that was just selected in the UI
        let { data: freshTransaction, error: freshTransError } = await supabase
          .from('bank_transactions')
          .select('*')
          .eq('id', transaction.id)
          .single();

        if (freshTransError) {
          console.error('Error reloading transaction:', freshTransError);
          alert('Failed to reload transaction data');
          return;
        }

        // FIRST: Validate/assign category
        if (!freshTransaction || !freshTransaction.category) {
          // SPECIAL CASE: For owner draw transactions, auto-assign the Owner Draws account
          if (freshTransaction?.is_owner_draw) {
            console.log('🏦 Owner draw detected - auto-assigning Owner Draws account...');
            
            // Find the Owner Draws account (usually #3100)
            const { data: ownerDrawsAccount, error: odError } = await supabase
              .from('accounts')
              .select('id')
              .eq('account_number', '3100')
              .or('account_name.ilike.%owner%draw%')
              .single();

            if (odError || !ownerDrawsAccount) {
              console.error('❌ Owner Draws account not found in Chart of Accounts');
              alert('⚠️ Owner Draws account (#3100) not found in Chart of Accounts.\n\nPlease create an Owner Draws account first.');
              
              // Unclear since we can't find the account
              const { error: unClearError } = await supabase
                .from('bank_transactions')
                .update({ is_cleared: false })
                .eq('id', transaction.id);
              
              await loadData();
              return;
            }

            // Auto-assign the Owner Draws account as the category
            const { error: updateError } = await supabase
              .from('bank_transactions')
              .update({ category: ownerDrawsAccount.id })
              .eq('id', transaction.id);

            if (updateError) {
              console.error('Error assigning Owner Draws account:', updateError);
              if (!bulkMode) alert('⚠️ Failed to assign Owner Draws account');
              if (!bulkMode) await loadData();
              return;
            }

            // Reload the transaction with the newly assigned category
            const { data: updatedTrans, error: reloadError } = await supabase
              .from('bank_transactions')
              .select('*')
              .eq('id', transaction.id)
              .single();

            if (reloadError || !updatedTrans) {
              console.error('Error reloading transaction:', reloadError);
              alert('Failed to reload transaction');
              return;
            }

            freshTransaction = updatedTrans;
            console.log('✅ Owner Draws account auto-assigned:', ownerDrawsAccount.id);
          } else {
            // Non-owner-draw transaction without category - require user to select one
            const { error: unClearError } = await supabase
              .from('bank_transactions')
              .update({ is_cleared: false })
              .eq('id', transaction.id);
            
            if (!bulkMode) {
              alert('⚠️ Please select a Category (Chart of Accounts) before clearing this transaction.\n\nThis ensures the transaction is properly recorded in both your Bank Account and the Chart of Accounts.');
              await loadData();
              return;
            }
            throw new Error('No category assigned — skipped');
          }
        }
        
        // CRITICAL: Reload transaction AGAIN after any category assignment to get the fresh data
        const { data: finalTransaction, error: finalReloadError } = await supabase
          .from('bank_transactions')
          .select('*')
          .eq('id', transaction.id)
          .single();

        if (finalReloadError || !finalTransaction) {
          console.error('Error reloading transaction after category assignment:', finalReloadError);
          alert('Failed to reload transaction');
          return;
        }

        // Use the final transaction data with category guaranteed to exist
        transaction = finalTransaction;
        
        // NOW CREATE THE JOURNAL ENTRY
        try {
          // DELETE any existing journal entry for this transaction, then create a fresh one
          console.log('🏦 Checking and cleaning up any existing journal entries for transaction:', transaction.id);
          
          const { error: deleteError } = await supabase
            .from('journal_entries')
            .delete()
            .eq('reference_type', 'bank_transaction')
            .eq('reference_id', transaction.id);

          if (deleteError) {
            console.warn('Warning: could not delete existing entry:', deleteError);
          } else {
            console.log('✅ Cleaned up any existing entries');
          }

          // Get the bank account's Chart of Accounts ID
          const { data: bankAccountRecord, error: bankRecordError } = await supabase
            .from('bank_accounts')
            .select('chart_account_id')
            .eq('id', accountId)
            .single();

          if (bankRecordError) {
            console.error('Error fetching bank account:', bankRecordError);
            alert('⚠️ Error fetching bank account details. Please try again.');
            return;
          }

          if (!bankAccountRecord?.chart_account_id) {
            console.error('Bank account not linked to Chart of Accounts');
            alert('⚠️ Bank account is not linked to Chart of Accounts.\n\nPlease go to Bank Accounts settings and link it to an account in your Chart of Accounts before clearing unlinked transactions.');
            return;
          }

          // Proceed with journal entry creation
          {
            // Use the shared entry number generator — same approach used throughout the app
            // (random 5-digit suffix: e.g. JE-2026-47382)
            const currentYear = new Date().getFullYear();

            // Determine the offset account based on transaction type and category
            let offsetAccountId = null;
            let offsetAccountName = 'Uncategorized';

            if (transaction.category) {
              // Use the selected category account - NO QUESTIONS ASKED
              // Works for ANY account type: Expense, Income, Equity, Asset, Liability, etc.
              offsetAccountId = transaction.category;
              console.log('Using selected category account ID:', offsetAccountId);
              
              // Get the account name for logging
              const { data: catAccount, error: catError } = await supabase
                .from('accounts')
                .select('account_name, account_type')
                .eq('id', transaction.category)
                .single();
              
              if (catError) {
                console.error('Error loading selected category account:', catError);
              }
              
              if (catAccount) {
                offsetAccountName = catAccount.account_name;
                console.log('✅ Using account:', offsetAccountName, `(Type: ${catAccount.account_type})`);
              } else {
                console.error('Category account not found for ID:', transaction.category);
                alert('⚠️ Selected account not found in Chart of Accounts. Please select a valid account and try again.');
                return;
              }
            } else {
              console.log('No category selected - will look for default offset accounts');
              // Auto-select based on transaction type
              // Try to find appropriate default accounts
              const { data: allAccounts, error: acctError } = await supabase
                .from('accounts')
                .select('id, account_number, account_name, account_type')
                .order('account_type, account_number');

              console.log('All accounts:', allAccounts);

              if (acctError) {
                console.error('Error loading accounts:', acctError);
                alert('⚠️ Could not load accounts. Please try again.');
                return;
              }

              // SPECIAL CASE: Opening Balance transactions should go to Equity accounts, NOT Income
              if (transaction.description && transaction.description.toLowerCase().includes('opening balance')) {
                console.log('🏦 Detected Opening Balance transaction - using Equity account');
                const equityAcct = allAccounts?.find(a => a.account_type === 'Equity');
                if (equityAcct) {
                  offsetAccountId = equityAcct.id;
                  offsetAccountName = equityAcct.account_name;
                  console.log('✅ Using Equity account for opening balance:', offsetAccountName);
                } else {
                  console.error('No Equity account found for opening balance. Available accounts:', allAccounts);
                  alert('⚠️ No Equity account found in Chart of Accounts. Please create an Equity account (like Owner\'s Equity) first.');
                  return;
                }
              } else if (transaction.amount < 0) {
                // Withdrawal - look for ANY Expense account
                const expenseAcct = allAccounts?.find(a => a.account_type === 'Expense');
                if (expenseAcct) {
                  offsetAccountId = expenseAcct.id;
                  offsetAccountName = expenseAcct.account_name;
                  console.log('Using Expense account:', offsetAccountName);
                } else {
                  console.error('No Expense account found. Available accounts:', allAccounts);
                  alert('⚠️ No Expense account found in Chart of Accounts. Please create an Expense account first.');
                  return;
                }
              } else {
                // Deposit (but NOT opening balance) - look for ANY Income account
                const incomeAcct = allAccounts?.find(a => a.account_type === 'Income');
                if (incomeAcct) {
                  offsetAccountId = incomeAcct.id;
                  offsetAccountName = incomeAcct.account_name;
                  console.log('Using Income account:', offsetAccountName);
                } else {
                  console.error('No Income account found. Available accounts:', allAccounts);
                  alert('⚠️ No Income account found in Chart of Accounts. Please create an Income account first.');
                  return;
                }
              }
            }

            if (!offsetAccountId) {
              console.error('Could not determine offset account for journal entry');
              alert('⚠️ Please select a category (Chart of Accounts) for this transaction before clearing it.');
              return;
            }

            // Create journal entry
            // Truncate description to fit database limit (50 chars max)
            let fullDescription = `${transaction.description || 'Bank transaction'}`;
            if (offsetAccountName) {
              const maxLen = 50 - offsetAccountName.length - 3; // Reserve space for " - "
              fullDescription = fullDescription.substring(0, Math.max(10, maxLen)) + ` - ${offsetAccountName.substring(0, 15)}`;
            }
            fullDescription = fullDescription.substring(0, 50); // Final truncation to 50 chars

            // Generate a unique entry number using the shared utility
            // This uses the same random approach as the rest of the app (e.g. JE-2026-47382)
            const entryNumber = await getNextJournalEntryNumber(user.id);
            console.log('Using entry_number:', entryNumber);

            const { data: newEntry, error: entryError } = await supabase
              .from('journal_entries')
              .insert([{
                entry_number: entryNumber,
                entry_date: transaction.transaction_date,
                description: fullDescription,
                reference_type: 'bank_transaction',
                reference_id: transaction.id,
                created_by: user.id,
                company_id: user.id,
                is_posted: true,
                posted_at: new Date().toISOString(),
                posted_by: user.id
              }])
              .select()
              .single();

            if (entryError) {
              console.error('Failed to create journal entry:', entryError);
              alert(`⚠️ Transaction cleared but journal entry failed: ${entryError.message}`);
              return;
            }

            console.log('✅ Journal entry created (posted):', newEntry.id);

            if (newEntry) {
            // Create journal entry lines
              // FIRST: Get the account type for the offset account so we can apply correct debit/credit rules
              const { data: offsetAccount, error: offsetError } = await supabase
                .from('accounts')
                .select('account_type, normal_balance')
                .eq('id', offsetAccountId)
                .single();

              if (offsetError || !offsetAccount) {
                console.error('Error fetching offset account details:', offsetError);
                alert('⚠️ Could not fetch account details. Please try again.');
                // Delete the journal entry since we can't complete the posting
                await supabase.from('journal_entries').delete().eq('id', newEntry.id);
                return;
              }

              // Determine debit/credit for OFFSET ACCOUNT
              let offsetDebit = 0;
              let offsetCredit = 0;
              const absAmount = Math.abs(transaction.amount);

              // LOGIC: For any account type, debits REDUCE the balance shown, credits INCREASE it
              // For a LIABILITY account (normal balance = credit, shown as negative):
              //   - Debit = reduces the liability = makes balance LESS negative (good for payment)
              //   - Credit = increases the liability = makes balance MORE negative (bad)
              // For an ASSET/EXPENSE account (normal balance = debit, shown as positive):
              //   - Debit = increases the balance
              //   - Credit = reduces the balance
              
              // Bank account is ALWAYS an asset, so:
              // - Positive amount (deposit): Bank DEBITS (increases)
              // - Negative amount (payment): Bank CREDITS (decreases)
              
              const bankDebit = transaction.amount > 0 ? absAmount : 0;
              const bankCredit = transaction.amount < 0 ? absAmount : 0;
              
              // Offset account needs to be the OPPOSITE to balance the entry
              if (offsetAccount.normal_balance === 'credit') {
                // CREDIT balance account (Liability, Income, Equity)
                // If bank debits, offset CREDITS (both sides of + entry)
                // If bank credits, offset DEBITS (both sides of - entry)
                offsetDebit = bankCredit;  // opposite of bank
                offsetCredit = bankDebit;  // opposite of bank
              } else {
                // DEBIT balance account (Asset, Expense)
                // If bank debits, offset CREDITS
                // If bank credits, offset DEBITS
                offsetDebit = bankCredit;  // opposite of bank
                offsetCredit = bankDebit;  // opposite of bank
              }

              // Create lines with proper debit/credit assignment

              const lines = [
                {
                  entry_id: newEntry.id,
                  line_number: 1,
                  account_id: bankAccountRecord.chart_account_id, // Bank account (always ASSET with debit normal balance)
                  debit: bankDebit,
                  credit: bankCredit,
                  description: 'Bank transaction'
                },
                {
                  entry_id: newEntry.id,
                  line_number: 2,
                  account_id: offsetAccountId, // Offset account (expense, income, liability, etc.)
                  debit: offsetDebit,
                  credit: offsetCredit,
                  description: offsetAccountName
                }
              ];

              // Validate that the journal entry will be balanced
              const totalDebits = bankDebit + offsetDebit;
              const totalCredits = bankCredit + offsetCredit;

              console.log('Journal Entry Validation:');
              console.log('Bank - Debit:', bankDebit, 'Credit:', bankCredit);
              console.log('Offset - Debit:', offsetDebit, 'Credit:', offsetCredit);
              console.log('Total Debits:', totalDebits, 'Total Credits:', totalCredits);
              console.log('Balanced?', Math.abs(totalDebits - totalCredits) < 0.01);

              if (Math.abs(totalDebits - totalCredits) > 0.01) {
                console.error('❌ Journal entry is NOT balanced!');
                alert(`⚠️ Journal entry calculation error. Total debits ($${totalDebits.toFixed(2)}) do not equal total credits ($${totalCredits.toFixed(2)}).\n\nThis is a system error. Please contact support.`);
                // Delete the journal entry since we can't post it
                await supabase.from('journal_entries').delete().eq('id', newEntry.id);
                return;
              }

              const { error: linesError } = await supabase
                .from('journal_entry_lines')
                .insert(lines);

              if (linesError) {
                console.error('Failed to create journal entry lines:', linesError);
                alert(`⚠️ Journal entry created but lines failed: ${linesError.message}`);
                return;
              }

              // Entry was already inserted with is_posted: true — no separate RPC needed
              console.log('✅ Journal entry created and posted for transaction:', transaction.id);
              console.log('Transaction', transaction.amount > 0 ? 'deposit' : 'withdrawal', 'recorded to both Bank Account and Chart of Accounts');
            }
          }
        } catch (err) {
          console.error('Error creating journal entry:', err);
          alert(`⚠️ Failed to create journal entry: ${err.message}\n\nMake sure you have both Expense and Income accounts in your Chart of Accounts.`);
        }
      }

      // Balance recalculation — skip in bulk mode, caller does it once at the end
      if (!bulkMode) {
        try {
          const { data: clearedTransactions, error: clearedError } = await supabase
            .from('bank_transactions').select('amount')
            .eq('bank_account_id', accountId).eq('is_cleared', true);
          if (!clearedError) {
            const freshClearedSum = (clearedTransactions || []).reduce((sum, t) => sum + t.amount, 0);
            const freshClearedBalance = (bankAccount?.opening_balance || 0) + freshClearedSum;
            setBankAccount(prev => prev ? {...prev, current_balance: freshClearedBalance} : prev);
            await supabase.from('bank_accounts').update({ current_balance: freshClearedBalance }).eq('id', accountId);
          }
        } catch (err) {
          console.error('Error recalculating bank balance:', err);
        }
        await loadData();
      }
    } catch (err) {
      console.error('Error toggling cleared status:', err);
      if (!bulkMode) {
        alert(`Failed to update: ${err.message}`);
        await loadData();
      } else {
        throw err; // re-throw so bulk caller counts it as a failure
      }
    }
  }

  async function handleDelete(transaction) {
    if (!confirm(`Delete transaction "${transaction.description}"?`)) {
      return;
    }

    try {
      // First delete any journal entry associated with this transaction
      await deleteJournalEntryForTransaction(transaction.id);

      const { error } = await supabase
        .from('bank_transactions')
        .delete()
        .eq('id', transaction.id);

      if (error) throw error;
      alert('Transaction deleted successfully!');
      loadData();
    } catch (err) {
      console.error('Error deleting transaction:', err);
      alert(`Failed to delete: ${err.message}`);
    }
  }

  async function handleImportTransactions(transactions) {
    try {
      // Add bank_account_id and created_by to each transaction
      const transactionsToInsert = transactions.map(t => ({
        ...t,
        bank_account_id: accountId,
        created_by: user.id,
        imported_date: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from('bank_transactions')
        .insert(transactionsToInsert);

      if (error) throw error;

      alert(`Successfully imported ${transactions.length} transactions!`);
      setShowUploadModal(false);
      loadData();
    } catch (err) {
      console.error('Error importing transactions:', err);
      alert(`Failed to import transactions: ${err.message}`);
    }
  }

  function calculateRunningBalance(transactions) {
    // Sort by date ascending for running balance calculation
    const sorted = [...transactions].sort((a, b) => {
      const dateCompare = new Date(a.transaction_date) - new Date(b.transaction_date);
      if (dateCompare !== 0) return dateCompare;
      return new Date(a.created_at) - new Date(b.created_at);
    });

    let runningBalance = bankAccount?.opening_balance || 0;
    const balances = {};

    sorted.forEach(t => {
      if (t.is_cleared) {
        runningBalance += t.amount;
      }
      balances[t.id] = runningBalance;
    });

    return balances;
  }

  async function handleClearSelected() {
    if (selectedTransactions.size === 0) return;

    setIsClearing(true);
    setBulkStatusMsg(`⏳ Clearing ${selectedTransactions.size} transactions…`);
    const transactionIds = Array.from(selectedTransactions);
    let successCount = 0;
    let errorCount = 0;

    try {
      for (const transId of transactionIds) {
        const transaction = transactions.find(t => t.id === transId);
        if (transaction) {
          try {
            await handleToggleCleared(transaction, true); // bulkMode: no alerts, no per-transaction reload
            successCount++;
          } catch (err) {
            console.error(`Error clearing transaction ${transId}:`, err);
            errorCount++;
          }
        }
      }

      setSelectedTransactions(new Set());

      if (successCount > 0) {
        // Recalculate balance once for all cleared transactions
        try {
          const { data: clearedTxns } = await supabase
            .from('bank_transactions').select('amount')
            .eq('bank_account_id', accountId).eq('is_cleared', true);
          const freshSum = (clearedTxns || []).reduce((sum, t) => sum + t.amount, 0);
          const freshBalance = (bankAccount?.opening_balance || 0) + freshSum;
          setBankAccount(prev => prev ? {...prev, current_balance: freshBalance} : prev);
          await supabase.from('bank_accounts').update({ current_balance: freshBalance }).eq('id', accountId);
        } catch (e) { console.error('Balance recalc error:', e); }
        await loadData();
      }

      const msg = `✅ ${successCount} transaction${successCount !== 1 ? 's' : ''} cleared${errorCount > 0 ? ` · ${errorCount} skipped (no category)` : ''}`;
      setBulkStatusMsg(msg);
      setTimeout(() => setBulkStatusMsg(''), 6000);
    } catch (err) {
      console.error('Error clearing selected transactions:', err);
      setBulkStatusMsg('❌ Error clearing transactions');
      setTimeout(() => setBulkStatusMsg(''), 6000);
    } finally {
      setIsClearing(false);
    }
  }

  async function handleUnclearSelected() {
    if (selectedClearedTransactions.size === 0) return;

    setIsUnclearing(true);
    setBulkStatusMsg(`⏳ Unclearing ${selectedClearedTransactions.size} transactions…`);
    const transactionIds = Array.from(selectedClearedTransactions);
    let successCount = 0;
    let errorCount = 0;

    try {
      for (const transId of transactionIds) {
        const transaction = transactions.find(t => t.id === transId);
        if (transaction) {
          try {
            await handleToggleCleared(transaction, true); // bulkMode: no alerts, no per-transaction reload
            successCount++;
          } catch (err) {
            console.error(`Error unclearing transaction ${transId}:`, err);
            errorCount++;
          }
        }
      }

      setSelectedClearedTransactions(new Set());

      if (successCount > 0) {
        // Recalculate balance once after all are uncleared
        try {
          const { data: clearedTxns } = await supabase
            .from('bank_transactions').select('amount')
            .eq('bank_account_id', accountId).eq('is_cleared', true);
          const freshSum = (clearedTxns || []).reduce((sum, t) => sum + t.amount, 0);
          const freshBalance = (bankAccount?.opening_balance || 0) + freshSum;
          setBankAccount(prev => prev ? {...prev, current_balance: freshBalance} : prev);
          await supabase.from('bank_accounts').update({ current_balance: freshBalance }).eq('id', accountId);
        } catch (e) { console.error('Balance recalc error:', e); }
        await loadData();
      }

      const msg = `✅ ${successCount} transaction${successCount !== 1 ? 's' : ''} uncleared${errorCount > 0 ? ` · ${errorCount} failed` : ''}`;
      setBulkStatusMsg(msg);
      setTimeout(() => setBulkStatusMsg(''), 6000);
    } catch (err) {
      console.error('Error unclearing selected transactions:', err);
      setBulkStatusMsg('❌ Error unclearing transactions');
      setTimeout(() => setBulkStatusMsg(''), 6000);
    } finally {
      setIsUnclearing(false);
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
    // Append T00:00:00 so date-only strings are parsed as LOCAL time, not UTC midnight
    const date = new Date(dateString.includes('T') ? dateString : dateString + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getTransactionIcon = (type) => {
    const icons = {
      'deposit': '💰',
      'withdrawal': '💸',
      'transfer': '🔄',
      'fee': '💳',
      'interest': '📈'
    };
    return icons[type] || '📝';
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading transactions...</div>
      </div>
    );
  }

  if (!bankAccount) {
    return (
      <div style={styles.container}>
        <div style={styles.error}>Bank account not found</div>
      </div>
    );
  }

  const runningBalances = calculateRunningBalance(transactions);
  const unclearedFiltered = filteredTransactions.filter(t => !t.is_cleared);
  const clearedFiltered = filteredTransactions.filter(t => t.is_cleared);

  // Match Review queue: unlinked transactions that have at least one candidate match
  const reviewQueue = transactions.filter(t =>
    !t.linked_expense_id && !t.linked_invoice_id && getMatchCount(t) > 0
  );
  const currentReviewTx = reviewQueue[matchReviewIndex] || null;
  const reviewExpMatches = currentReviewTx
    ? getMatchingExpenses(currentReviewTx).map(e => ({...e, _type: 'expense'}))
    : [];
  const reviewInvMatches = currentReviewTx
    ? getMatchingInvoices(currentReviewTx).map(i => ({...i, _type: 'invoice'}))
    : [];
  const reviewCandidates = [...reviewExpMatches, ...reviewInvMatches];
  const safeCandIdx = Math.min(matchCandidateIndex, Math.max(0, reviewCandidates.length - 1));
  const currentCandidate = reviewCandidates[safeCandIdx] || null;

  // Match Review actions
  async function confirmReviewMatch() {
    if (!currentReviewTx || !currentCandidate) return;
    if (currentCandidate._type === 'expense') {
      await handleLinkExpense(currentReviewTx.id, currentCandidate.id);
    } else {
      await handleLinkInvoice(currentReviewTx.id, currentCandidate.id);
    }
    setMatchCandidateIndex(0);
    // After loadData(), the linked transaction leaves the queue; same index points to next item
  }

  function skipReviewTransaction() {
    const maxIdx = reviewQueue.length - 1;
    if (matchReviewIndex >= maxIdx) {
      setShowMatchReview(false);
    } else {
      setMatchReviewIndex(prev => prev + 1);
      setMatchCandidateIndex(0);
    }
  }

  const reviewAmountDiff = currentReviewTx && currentCandidate
    ? Math.abs(
        Math.abs(currentReviewTx.amount) -
        Math.abs(currentCandidate._type === 'expense'
          ? (currentCandidate.amount || 0)
          : (currentCandidate.net_deposit_amount || currentCandidate.total_amount || 0))
      )
    : 0;
  const isExactReviewMatch = reviewAmountDiff < 0.01;
  const isCloseReviewMatch = !isExactReviewMatch && reviewAmountDiff <= 2.00;
  const totalDeposits = transactions.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
  const totalWithdrawals = Math.abs(transactions.filter(t => t.amount < 0).reduce((sum, t) => sum + t.amount, 0));
  const clearedBalance = bankAccount.current_balance || 0;
  const unclearedAmount = transactions.filter(t => !t.is_cleared).reduce((sum, t) => sum + t.amount, 0);

  return (
    <div style={styles.container}>
      {/* Bulk operation toast */}
      {bulkStatusMsg && (
        <div style={{
          position: 'fixed', bottom: 28, right: 28, zIndex: 9999,
          backgroundColor: bulkStatusMsg.startsWith('❌') ? '#ef4444' : '#111',
          color: '#fff', padding: '14px 22px', borderRadius: 10,
          fontSize: 15, fontWeight: 600, boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          display: 'flex', alignItems: 'center', gap: 10, maxWidth: 380,
        }}>
          {bulkStatusMsg}
        </div>
      )}
      <div style={styles.header}>
        <div>
          <button onClick={() => navigate('/accounting/bank-accounts')} style={styles.backButton}>
            ← Back to Bank Accounts
          </button>
          <h1 style={styles.title}>
            {getTransactionIcon(bankAccount.account_type)} {bankAccount.account_name}
          </h1>
          <p style={styles.subtitle}>{bankAccount.bank_name || 'Bank Transactions'}</p>
        </div>
        <div style={styles.headerButtons}>
          <button
            onClick={handleClearSelected}
            disabled={isClearing || selectedTransactions.size === 0}
            style={{
              ...styles.newButton,
              backgroundColor: selectedTransactions.size > 0 ? '#10b981' : '#6b7280',
              cursor: selectedTransactions.size > 0 ? 'pointer' : 'not-allowed',
              opacity: selectedTransactions.size > 0 ? 1 : 0.6,
            }}
            title="Check rows below then click to clear them all at once"
          >
            {isClearing
              ? '⏳ Clearing...'
              : selectedTransactions.size > 0
                ? `✅ Clear Selected (${selectedTransactions.size})`
                : '✅ Clear Selected'}
          </button>
          <button
            onClick={handleUnclearSelected}
            disabled={isUnclearing || selectedClearedTransactions.size === 0}
            style={{
              ...styles.newButton,
              backgroundColor: selectedClearedTransactions.size > 0 ? '#f59e0b' : '#6b7280',
              cursor: selectedClearedTransactions.size > 0 ? 'pointer' : 'not-allowed',
              opacity: selectedClearedTransactions.size > 0 ? 1 : 0.6,
            }}
            title="Check cleared rows below then click to unclear them"
          >
            {isUnclearing
              ? '⏳ Unclearing...'
              : selectedClearedTransactions.size > 0
                ? `🔓 Unclear Selected (${selectedClearedTransactions.size})`
                : '🔓 Unclear Selected'}
          </button>
          <button 
            onClick={async () => {
              console.log('Refreshing account balances...');
              await loadExpensesAndInvoices();
              alert('✅ Account balances refreshed!');
            }} 
            style={{...styles.newButton, backgroundColor: '#8b5cf6'}}
          >
            🔄 Refresh Balances
          </button>
          <button onClick={() => setShowUploadModal(true)} style={styles.uploadButton}>
            📤 Upload CSV
          </button>
          <button onClick={openAddModal} style={styles.newButton}>
            + Add Transaction
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={styles.summaryGrid}>
        <div style={styles.summaryCard}>
          <div style={styles.summaryLabel}>Cleared Balance</div>
          <div style={styles.summaryValue}>{formatCurrency(clearedBalance)}</div>
        </div>
        <div style={styles.summaryCard}>
          <div style={styles.summaryLabel}>Uncleared Amount</div>
          <div style={{...styles.summaryValue, color: unclearedAmount >= 0 ? '#10b981' : '#ef4444'}}>
            {formatCurrency(unclearedAmount)}
          </div>
        </div>
        <div style={styles.summaryCard}>
          <div style={styles.summaryLabel}>Total Deposits</div>
          <div style={{...styles.summaryValue, color: '#10b981'}}>
            {formatCurrency(totalDeposits)}
          </div>
        </div>
        <div style={styles.summaryCard}>
          <div style={styles.summaryLabel}>Total Withdrawals</div>
          <div style={{...styles.summaryValue, color: '#ef4444'}}>
            {formatCurrency(totalWithdrawals)}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={styles.filtersSection}>
        <div style={styles.searchBox}>
          <span style={styles.searchIcon}>🔍</span>
          <input
            type="text"
            placeholder="Search transactions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={styles.searchInput}
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          style={styles.filterSelect}
        >
          <option value="all">All Types</option>
          <option value="deposit">Deposits</option>
          <option value="withdrawal">Withdrawals</option>
          <option value="transfer">Transfers</option>
          <option value="fee">Fees</option>
          <option value="interest">Interest</option>
        </select>
        {selectedTransactions.size > 0 && (
          <button
            onClick={handleClearSelected}
            disabled={isClearing}
            style={{...styles.filterSelect, ...styles.bulkClearButton}}
          >
            {isClearing ? '⏳ Clearing...' : `✅ Clear Selected (${selectedTransactions.size})`}
          </button>
        )}
        {selectedClearedTransactions.size > 0 && (
          <button
            onClick={handleUnclearSelected}
            disabled={isUnclearing}
            style={{...styles.filterSelect, ...styles.bulkUnclearButton}}
          >
            {isUnclearing ? '⏳ Unclearing...' : `🔓 Unclear Selected (${selectedClearedTransactions.size})`}
          </button>
        )}
        {reviewQueue.length > 0 && (
          <button
            onClick={() => { setMatchReviewIndex(0); setMatchCandidateIndex(0); setShowMatchReview(true); }}
            style={{
              padding: '12px 20px', border: 'none', borderRadius: 8, cursor: 'pointer',
              fontWeight: 700, fontSize: 15, whiteSpace: 'nowrap',
              backgroundColor: '#7c3aed', color: '#fff',
              boxShadow: '0 2px 6px rgba(124,58,237,0.4)',
            }}
          >
            🔍 Review Matches ({reviewQueue.length})
          </button>
        )}
      </div>

      {/* ── Uncleared Transactions (Main View) ── */}
      {unclearedFiltered.length === 0 ? (
        <div style={styles.empty}>
          <p style={styles.emptyText}>
            {searchTerm || filterType !== 'all'
              ? 'No uncleared transactions match your filters'
              : 'No uncleared transactions — all caught up! 🎉'}
          </p>
        </div>
      ) : (
        <div style={styles.tableContainer}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.tableHeader}>
                <th style={styles.th}>✓</th>
                <th style={styles.th}>Date</th>
                <th style={styles.th}>Description</th>
                <th style={styles.th}>Payee</th>
                <th style={styles.th}>Reference</th>
                <th style={styles.th}>Category</th>
                <th style={styles.th}>Project</th>
                <th style={{...styles.th, textAlign: 'center'}} title="Matches">🔗</th>
                <th style={{...styles.th, textAlign: 'right'}}>Amount</th>
                <th style={{...styles.th, textAlign: 'right'}}>Balance</th>
                <th style={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {unclearedFiltered.map(transaction => (
              <tr 
                key={transaction.id} 
                style={{...styles.tableRow, backgroundColor: '#fef3c7'}}
              >
                <td style={styles.td}>
                  <input
                    type="checkbox"
                    checked={transaction.is_cleared ? selectedClearedTransactions.has(transaction.id) : selectedTransactions.has(transaction.id)}
                    onChange={(e) => {
                      if (transaction.is_cleared) {
                        // For cleared transactions, use selectedClearedTransactions
                        const newSelected = new Set(selectedClearedTransactions);
                        if (e.target.checked) {
                          newSelected.add(transaction.id);
                        } else {
                          newSelected.delete(transaction.id);
                        }
                        setSelectedClearedTransactions(newSelected);
                      } else {
                        // For uncleared transactions, use selectedTransactions
                        const newSelected = new Set(selectedTransactions);
                        if (e.target.checked) {
                          newSelected.add(transaction.id);
                        } else {
                          newSelected.delete(transaction.id);
                        }
                        setSelectedTransactions(newSelected);
                      }
                    }}
                    style={{cursor: 'pointer', width: 18, height: 18}}
                  />
                </td>
                  <td style={styles.td}>{formatDate(transaction.transaction_date)}</td>
                  <td style={styles.td}>{transaction.description}</td>
                  <td style={styles.td}>
                    <input
                      type="text"
                      defaultValue={transaction.payee || ''}
                      onBlur={async (e) => {
                        const newPayee = e.target.value;
                        if (newPayee === (transaction.payee || '')) return; // No change
                        try {
                          const { error } = await supabase
                            .from('bank_transactions')
                            .update({ payee: newPayee || null })
                            .eq('id', transaction.id);
                          if (error) throw error;
                          
                          // Update local state silently without reload
                          setTransactions(prev => prev.map(t => 
                            t.id === transaction.id ? {...t, payee: newPayee || null} : t
                          ));
                        } catch (err) {
                          console.error('Error updating payee:', err);
                          alert('Failed to update payee');
                        }
                      }}
                      list="vendors-datalist-inline"
                      style={styles.inlineInput}
                      placeholder="-"
                    />
                  </td>
                  <datalist id="vendors-datalist-inline">
                    {vendors.map((vendor, index) => (
                      <option key={index} value={vendor.vendor_name} />
                    ))}
                  </datalist>
                  <td style={styles.td}>{transaction.reference_number || '-'}</td>
                  <td style={styles.td}>
                    <select
                      value={transaction.category || ''}
                      onChange={async (e) => {
                        const newCategory = e.target.value || null;
                        try {
                          const { error } = await supabase
                            .from('bank_transactions')
                            .update({ category: newCategory })
                            .eq('id', transaction.id);
                          if (error) throw error;
                          
                          // Update local state silently without reload
                          setTransactions(prev => prev.map(t => 
                            t.id === transaction.id ? {...t, category: newCategory} : t
                          ));
                        } catch (err) {
                          console.error('Error updating category:', err);
                          alert('Failed to update category');
                        }
                      }}
                      style={styles.categorySelect}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <option value="">-- Select Account --</option>
                      {accounts.map(account => (
                        <option key={account.id} value={account.id}>
                          {account.account_number} - {account.account_name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={styles.td}>
                    <select
                      value={transaction.project_id || ''}
                      onChange={async (e) => {
                        const newProjectId = e.target.value || null;
                        try {
                          const { error } = await supabase
                            .from('bank_transactions')
                            .update({ project_id: newProjectId })
                            .eq('id', transaction.id);
                          if (error) throw error;
                          
                          // Update local state silently without reload
                          setTransactions(prev => prev.map(t => 
                            t.id === transaction.id ? {...t, project_id: newProjectId} : t
                          ));
                        } catch (err) {
                          console.error('Error updating project:', err);
                          alert('Failed to update project');
                        }
                      }}
                      style={styles.categorySelect}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <option value="">-- Select Project --</option>
                      {projects.map(project => (
                        <option key={project.id} value={project.id}>
                          {project.project_name}
                        </option>
                      ))}
                    </select>
                  </td>

                  {/* Matches Column */}
                  <td style={{...styles.td, textAlign: 'center'}}>
                    <button
                      onClick={() => openMatchesModal(transaction)}
                      style={styles.matchIconButton}
                      title={
                        transaction.linked_expense_id || transaction.linked_invoice_id 
                          ? 'Linked to expense/invoice - Click to view' 
                          : getMatchCount(transaction) > 0 
                            ? `${getMatchCount(transaction)} potential match${getMatchCount(transaction) > 1 ? 'es' : ''} found`
                            : 'No matches found'
                      }
                    >
                      {transaction.linked_expense_id || transaction.linked_invoice_id ? '🔗' : getMatchCount(transaction) > 0 ? '✅' : '❌'}
                    </button>
                  </td>

                  <td style={{
                    ...styles.td, 
                    textAlign: 'right',
                    fontWeight: '600',
                    color: transaction.amount < 0 ? '#ef4444' : '#10b981'
                  }}>
                    {formatCurrency(transaction.amount)}
                  </td>
                  <td style={{...styles.td, fontWeight: 'bold'}}>
                    {transaction.is_cleared ? formatCurrency(runningBalances[transaction.id]) : '-'}
                  </td>
                  <td style={styles.td}>
                    <div style={styles.actionButtons}>
                      <button
                        onClick={() => handleToggleCleared(transaction)}
                        style={styles.clearedButton}
                        title={transaction.is_cleared ? 'Click to unclear' : 'Click to clear'}
                      >
                        {transaction.is_cleared ? '✅' : '🔲'}
                      </button>
                      <button
                        onClick={() => openEditModal(transaction)}
                        style={styles.actionBtn}
                        title="Edit"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDelete(transaction)}
                        style={{...styles.actionBtn, ...styles.deleteBtn}}
                        title="Delete"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Cleared Transactions Folder ── */}
      <div
        onClick={() => setShowClearedFolder(f => !f)}
        style={styles.clearedFolderHeader}
      >
        <span style={{display: 'flex', alignItems: 'center', gap: 10}}>
          <span style={{fontSize: 22}}>{showClearedFolder ? '📂' : '📁'}</span>
          <span style={{fontSize: 17, fontWeight: 700}}>Cleared Transactions</span>
          <span style={{
            fontSize: 13, fontWeight: 600,
            backgroundColor: 'rgba(255,255,255,0.25)',
            borderRadius: 20, padding: '2px 10px'
          }}>
            {clearedFiltered.length}
          </span>
        </span>
        <span style={{fontSize: 13, opacity: 0.85}}>{showClearedFolder ? '▲ Collapse' : '▼ Expand'}</span>
      </div>

      {showClearedFolder && (
        clearedFiltered.length === 0 ? (
          <div style={{...styles.empty, borderRadius: '0 0 12px 12px', marginBottom: 24}}>
            <p style={styles.emptyText}>No cleared transactions match your filters</p>
          </div>
        ) : (
          <div style={{...styles.tableContainer, borderRadius: '0 0 12px 12px', marginBottom: 24}}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.tableHeader}>
                  <th style={styles.th}>✓</th>
                  <th style={styles.th}>Date</th>
                  <th style={styles.th}>Description</th>
                  <th style={styles.th}>Payee</th>
                  <th style={styles.th}>Reference</th>
                  <th style={styles.th}>Category</th>
                  <th style={styles.th}>Project</th>
                  <th style={{...styles.th, textAlign: 'center'}} title="Matches">🔗</th>
                  <th style={{...styles.th, textAlign: 'right'}}>Amount</th>
                  <th style={{...styles.th, textAlign: 'right'}}>Balance</th>
                  <th style={styles.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {clearedFiltered.map(transaction => (
                <tr
                  key={transaction.id}
                  style={{...styles.tableRow, backgroundColor: '#f0fdf4'}}
                >
                  <td style={styles.td}>
                    <input
                      type="checkbox"
                      checked={selectedClearedTransactions.has(transaction.id)}
                      onChange={(e) => {
                        const newSelected = new Set(selectedClearedTransactions);
                        if (e.target.checked) {
                          newSelected.add(transaction.id);
                        } else {
                          newSelected.delete(transaction.id);
                        }
                        setSelectedClearedTransactions(newSelected);
                      }}
                      style={{cursor: 'pointer', width: 18, height: 18}}
                    />
                  </td>
                  <td style={styles.td}>{formatDate(transaction.transaction_date)}</td>
                  <td style={styles.td}>{transaction.description}</td>
                  <td style={styles.td}>
                    <input
                      type="text"
                      defaultValue={transaction.payee || ''}
                      onBlur={async (e) => {
                        const newPayee = e.target.value;
                        if (newPayee === (transaction.payee || '')) return;
                        try {
                          const { error } = await supabase
                            .from('bank_transactions')
                            .update({ payee: newPayee || null })
                            .eq('id', transaction.id);
                          if (error) throw error;
                          setTransactions(prev => prev.map(t =>
                            t.id === transaction.id ? {...t, payee: newPayee || null} : t
                          ));
                        } catch (err) {
                          console.error('Error updating payee:', err);
                          alert('Failed to update payee');
                        }
                      }}
                      list="vendors-datalist-inline"
                      style={styles.inlineInput}
                      placeholder="-"
                    />
                  </td>
                  <td style={styles.td}>{transaction.reference_number || '-'}</td>
                  <td style={styles.td}>
                    <select
                      value={transaction.category || ''}
                      onChange={async (e) => {
                        const newCategory = e.target.value || null;
                        try {
                          const { error } = await supabase
                            .from('bank_transactions')
                            .update({ category: newCategory })
                            .eq('id', transaction.id);
                          if (error) throw error;
                          setTransactions(prev => prev.map(t =>
                            t.id === transaction.id ? {...t, category: newCategory} : t
                          ));
                        } catch (err) {
                          console.error('Error updating category:', err);
                          alert('Failed to update category');
                        }
                      }}
                      style={styles.categorySelect}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <option value="">-- Select Account --</option>
                      {accounts.map(account => (
                        <option key={account.id} value={account.id}>
                          {account.account_number} - {account.account_name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={styles.td}>
                    <select
                      value={transaction.project_id || ''}
                      onChange={async (e) => {
                        const newProjectId = e.target.value || null;
                        try {
                          const { error } = await supabase
                            .from('bank_transactions')
                            .update({ project_id: newProjectId })
                            .eq('id', transaction.id);
                          if (error) throw error;
                          setTransactions(prev => prev.map(t =>
                            t.id === transaction.id ? {...t, project_id: newProjectId} : t
                          ));
                        } catch (err) {
                          console.error('Error updating project:', err);
                          alert('Failed to update project');
                        }
                      }}
                      style={styles.categorySelect}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <option value="">-- Select Project --</option>
                      {projects.map(project => (
                        <option key={project.id} value={project.id}>
                          {project.project_name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={{...styles.td, textAlign: 'center'}}>
                    <button
                      onClick={() => openMatchesModal(transaction)}
                      style={styles.matchIconButton}
                      title={
                        transaction.linked_expense_id || transaction.linked_invoice_id
                          ? 'Linked to expense/invoice - Click to view'
                          : getMatchCount(transaction) > 0
                            ? `${getMatchCount(transaction)} potential match${getMatchCount(transaction) > 1 ? 'es' : ''} found`
                            : 'No matches found'
                      }
                    >
                      {transaction.linked_expense_id || transaction.linked_invoice_id ? '🔗' : getMatchCount(transaction) > 0 ? '✅' : '❌'}
                    </button>
                  </td>
                  <td style={{
                    ...styles.td,
                    textAlign: 'right',
                    fontWeight: '600',
                    color: transaction.amount < 0 ? '#ef4444' : '#10b981'
                  }}>
                    {formatCurrency(transaction.amount)}
                  </td>
                  <td style={{...styles.td, fontWeight: 'bold'}}>
                    {formatCurrency(runningBalances[transaction.id])}
                  </td>
                  <td style={styles.td}>
                    <div style={styles.actionButtons}>
                      <button
                        onClick={() => handleToggleCleared(transaction)}
                        style={styles.clearedButton}
                        title="Click to unclear"
                      >
                        ✅
                      </button>
                      <button
                        onClick={() => openEditModal(transaction)}
                        style={styles.actionBtn}
                        title="Edit"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDelete(transaction)}
                        style={{...styles.actionBtn, ...styles.deleteBtn}}
                        title="Delete"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* ── Match Review Modal ── */}
      {showMatchReview && (
        <div style={styles.matchReviewOverlay} onClick={() => setShowMatchReview(false)}>
          <div style={styles.matchReviewModal} onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div style={styles.matchReviewHeader}>
              <div style={{display: 'flex', alignItems: 'center', gap: 16}}>
                <span style={{fontSize: 20, fontWeight: 700, color: '#fff'}}>🔍 Match Review</span>
                {currentReviewTx && (
                  <span style={{
                    fontSize: 13, color: '#c7d2fe',
                    backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, padding: '3px 12px'
                  }}>
                    Transaction {matchReviewIndex + 1} of {reviewQueue.length}
                  </span>
                )}
              </div>
              <button onClick={() => setShowMatchReview(false)} style={{...styles.closeButton, color: '#fff', fontSize: 28}}>×</button>
            </div>

            {/* Progress bar */}
            {currentReviewTx && (
              <div style={{height: 4, backgroundColor: 'rgba(255,255,255,0.2)'}}>
                <div style={{
                  height: '100%', backgroundColor: '#10b981',
                  width: `${((matchReviewIndex + 1) / reviewQueue.length) * 100}%`,
                  transition: 'width 0.3s ease'
                }} />
              </div>
            )}

            {/* ── All Done ── */}
            {!currentReviewTx && (
              <div style={{textAlign: 'center', padding: '60px 40px'}}>
                <div style={{fontSize: 64, marginBottom: 16}}>🎉</div>
                <h2 style={{fontSize: 24, color: '#fff', marginBottom: 8}}>All caught up!</h2>
                <p style={{fontSize: 16, color: '#c7d2fe', marginBottom: 32}}>All potential matches have been reviewed.</p>
                <button onClick={() => setShowMatchReview(false)} style={styles.matchReviewConfirmBtn}>Close</button>
              </div>
            )}

            {/* ── Side-by-side comparison ── */}
            {currentReviewTx && currentCandidate && (
              <div style={styles.matchReviewBody}>

                {/* Left: Bank Transaction card */}
                <div style={styles.matchReviewCard}>
                  <div style={{...styles.matchReviewCardHeader, backgroundColor: '#1e429f'}}>
                    🏦 Bank Transaction
                  </div>
                  <div style={styles.matchReviewCardBody}>
                    <div style={styles.matchReviewField}>
                      <span style={styles.matchReviewLabel}>Date</span>
                      <span style={styles.matchReviewValue}>{formatDate(currentReviewTx.transaction_date)}</span>
                    </div>
                    <div style={styles.matchReviewField}>
                      <span style={styles.matchReviewLabel}>Amount</span>
                      <span style={{
                        ...styles.matchReviewValue, fontSize: 22, fontWeight: 700,
                        color: currentReviewTx.amount < 0 ? '#ef4444' : '#10b981'
                      }}>
                        {formatCurrency(currentReviewTx.amount)}
                      </span>
                    </div>
                    <div style={styles.matchReviewField}>
                      <span style={styles.matchReviewLabel}>Description</span>
                      <span style={styles.matchReviewValue}>{currentReviewTx.description || '—'}</span>
                    </div>
                    <div style={styles.matchReviewField}>
                      <span style={styles.matchReviewLabel}>Payee</span>
                      <span style={styles.matchReviewValue}>{currentReviewTx.payee || '—'}</span>
                    </div>
                    <div style={styles.matchReviewField}>
                      <span style={styles.matchReviewLabel}>Type</span>
                      <span style={styles.matchReviewValue}>
                        {getTransactionIcon(currentReviewTx.transaction_type)} {currentReviewTx.transaction_type}
                      </span>
                    </div>
                    {currentReviewTx.reference_number && (
                      <div style={styles.matchReviewField}>
                        <span style={styles.matchReviewLabel}>Reference</span>
                        <span style={styles.matchReviewValue}>{currentReviewTx.reference_number}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Center: match quality + candidate switcher */}
                <div style={styles.matchReviewCenter}>
                  <div style={{fontSize: 28, marginBottom: 12}}>↔</div>
                  <div style={{
                    padding: '8px 14px', borderRadius: 8, fontWeight: 700, fontSize: 13,
                    backgroundColor: isExactReviewMatch ? '#dcfce7' : isCloseReviewMatch ? '#fef3c7' : '#fee2e2',
                    color: isExactReviewMatch ? '#059669' : isCloseReviewMatch ? '#d97706' : '#dc2626',
                    textAlign: 'center'
                  }}>
                    {isExactReviewMatch
                      ? '✓ Exact Match'
                      : isCloseReviewMatch
                        ? `≈ $${reviewAmountDiff.toFixed(2)} off`
                        : `✗ $${reviewAmountDiff.toFixed(2)} diff`}
                  </div>

                  {/* Candidate switcher (if multiple) */}
                  {reviewCandidates.length > 1 && (
                    <div style={{marginTop: 20, textAlign: 'center'}}>
                      <div style={{fontSize: 12, color: '#888', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase'}}>Candidate</div>
                      <div style={{display: 'flex', alignItems: 'center', gap: 10}}>
                        <button
                          onClick={() => setMatchCandidateIndex(Math.max(0, safeCandIdx - 1))}
                          disabled={safeCandIdx === 0}
                          style={{...styles.matchReviewNavBtn, opacity: safeCandIdx === 0 ? 0.3 : 1, padding: '6px 12px'}}
                        >◀</button>
                        <span style={{fontSize: 13, fontWeight: 700}}>
                          {safeCandIdx + 1} / {reviewCandidates.length}
                        </span>
                        <button
                          onClick={() => setMatchCandidateIndex(Math.min(reviewCandidates.length - 1, safeCandIdx + 1))}
                          disabled={safeCandIdx === reviewCandidates.length - 1}
                          style={{...styles.matchReviewNavBtn, opacity: safeCandIdx === reviewCandidates.length - 1 ? 0.3 : 1, padding: '6px 12px'}}
                        >▶</button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right: Book match card */}
                <div style={styles.matchReviewCard}>
                  <div style={{
                    ...styles.matchReviewCardHeader,
                    backgroundColor: currentCandidate._type === 'expense' ? '#dc2626' : '#059669'
                  }}>
                    {currentCandidate._type === 'expense' ? '💸 Expense Record' : '📄 Invoice Record'}
                  </div>
                  <div style={styles.matchReviewCardBody}>
                    {currentCandidate._type === 'expense' ? (
                      <>
                        <div style={styles.matchReviewField}>
                          <span style={styles.matchReviewLabel}>Vendor</span>
                          <span style={styles.matchReviewValue}>{currentCandidate.vendor || '—'}</span>
                        </div>
                        <div style={styles.matchReviewField}>
                          <span style={styles.matchReviewLabel}>Amount</span>
                          <span style={{...styles.matchReviewValue, fontSize: 22, fontWeight: 700, color: '#ef4444'}}>
                            {formatCurrency(currentCandidate.amount)}
                          </span>
                        </div>
                        <div style={styles.matchReviewField}>
                          <span style={styles.matchReviewLabel}>Date</span>
                          <span style={styles.matchReviewValue}>{formatDate(currentCandidate.expense_date)}</span>
                        </div>
                        <div style={styles.matchReviewField}>
                          <span style={styles.matchReviewLabel}>Category</span>
                          <span style={styles.matchReviewValue}>{currentCandidate.category || '—'}</span>
                        </div>
                        {currentCandidate.description && (
                          <div style={styles.matchReviewField}>
                            <span style={styles.matchReviewLabel}>Notes</span>
                            <span style={styles.matchReviewValue}>{currentCandidate.description}</span>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div style={styles.matchReviewField}>
                          <span style={styles.matchReviewLabel}>Invoice #</span>
                          <span style={styles.matchReviewValue}>#{currentCandidate.invoice_number}</span>
                        </div>
                        <div style={styles.matchReviewField}>
                          <span style={styles.matchReviewLabel}>Amount</span>
                          <span style={{...styles.matchReviewValue, fontSize: 22, fontWeight: 700, color: '#10b981'}}>
                            {formatCurrency(currentCandidate.total_amount)}
                          </span>
                        </div>
                        {currentCandidate.net_deposit_amount && currentCandidate.net_deposit_amount !== currentCandidate.total_amount && (
                          <div style={styles.matchReviewField}>
                            <span style={styles.matchReviewLabel}>Net Deposit</span>
                            <span style={styles.matchReviewValue}>{formatCurrency(currentCandidate.net_deposit_amount)}</span>
                          </div>
                        )}
                        <div style={styles.matchReviewField}>
                          <span style={styles.matchReviewLabel}>Customer</span>
                          <span style={styles.matchReviewValue}>{currentCandidate.customer_name || currentCandidate.customer_id || '—'}</span>
                        </div>
                        <div style={styles.matchReviewField}>
                          <span style={styles.matchReviewLabel}>Invoice Date</span>
                          <span style={styles.matchReviewValue}>{formatDate(currentCandidate.invoice_date)}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── Footer navigation ── */}
            {currentReviewTx && (
              <div style={styles.matchReviewFooter}>
                <button
                  onClick={() => { setMatchReviewIndex(Math.max(0, matchReviewIndex - 1)); setMatchCandidateIndex(0); }}
                  disabled={matchReviewIndex === 0}
                  style={{...styles.matchReviewNavBtn, opacity: matchReviewIndex === 0 ? 0.3 : 1, padding: '11px 22px'}}
                >
                  ← Prev
                </button>
                <button onClick={skipReviewTransaction} style={styles.matchReviewSkipBtn}>
                  ❌ Skip — No Match
                </button>
                {currentCandidate && (
                  <button onClick={confirmReviewMatch} style={styles.matchReviewConfirmBtn}>
                    ✅ Confirm Match
                  </button>
                )}
                <button
                  onClick={() => {
                    if (matchReviewIndex < reviewQueue.length - 1) {
                      setMatchReviewIndex(prev => prev + 1);
                      setMatchCandidateIndex(0);
                    }
                  }}
                  disabled={matchReviewIndex >= reviewQueue.length - 1}
                  style={{...styles.matchReviewNavBtn, opacity: matchReviewIndex >= reviewQueue.length - 1 ? 0.3 : 1, padding: '11px 22px'}}
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Matches Modal */}
      {showMatchesModal && selectedTransaction && (
        <div style={styles.modalOverlay} onClick={() => setShowMatchesModal(false)}>
          <div style={styles.matchesModalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>Link Transaction</h2>
              <button onClick={() => setShowMatchesModal(false)} style={styles.closeButton}>
                ×
              </button>
            </div>

            <div style={styles.modalBody}>
              {/* Transaction Details */}
              <div style={styles.transactionDetailsCard}>
                <h3 style={styles.sectionTitle}>Transaction Details</h3>
                <div style={styles.detailsGrid}>
                  <div style={styles.detailItem}>
                    <span style={styles.detailLabel}>Date:</span>
                    <span style={styles.detailValue}>{formatDate(selectedTransaction.transaction_date)}</span>
                  </div>
                  <div style={styles.detailItem}>
                    <span style={styles.detailLabel}>Amount:</span>
                    <span style={{...styles.detailValue, fontWeight: 'bold', color: selectedTransaction.amount >= 0 ? '#10b981' : '#ef4444'}}>
                      {formatCurrency(selectedTransaction.amount)}
                    </span>
                  </div>
                  <div style={styles.detailItem}>
                    <span style={styles.detailLabel}>Description:</span>
                    <span style={styles.detailValue}>{selectedTransaction.description}</span>
                  </div>
                  <div style={styles.detailItem}>
                    <span style={styles.detailLabel}>Payee:</span>
                    <span style={styles.detailValue}>{selectedTransaction.payee || 'N/A'}</span>
                  </div>
                  <div style={styles.detailItem}>
                    <span style={styles.detailLabel}>Reference:</span>
                    <span style={styles.detailValue}>{selectedTransaction.reference_number || 'N/A'}</span>
                  </div>
                  <div style={styles.detailItem}>
                    <span style={styles.detailLabel}>Type:</span>
                    <span style={styles.detailValue}>
                      {getTransactionIcon(selectedTransaction.transaction_type)} {selectedTransaction.transaction_type}
                    </span>
                  </div>
                </div>
              </div>

              {/* Currently Linked */}
              {(selectedTransaction.linked_expense_id || selectedTransaction.linked_invoice_id) && (
                <div style={{...styles.linkedSection, backgroundColor: '#dcfce7', borderColor: '#10b981'}}>
                  <h3 style={{...styles.sectionTitle, color: '#059669'}}>✓ Currently Linked</h3>
                  {selectedTransaction.linked_expense_id && (
                    <div style={styles.linkedItem}>
                      <div>
                        <strong>Expense:</strong> {expenses.find(e => e.id === selectedTransaction.linked_expense_id)?.vendor || 'Unknown'}
                        <br />
                        <span style={{fontSize: 13, color: '#666'}}>
                        {formatDate(expenses.find(e => e.id === selectedTransaction.linked_expense_id)?.expense_date)} - 
                          {formatCurrency(expenses.find(e => e.id === selectedTransaction.linked_expense_id)?.amount)}
                        </span>
                      </div>
                      <button
                        onClick={() => handleLinkExpense(selectedTransaction.id, null)}
                        style={styles.unlinkButton}
                      >
                        🔗 Unlink
                      </button>
                    </div>
                  )}
                  {selectedTransaction.linked_invoice_id && (
                    <div style={styles.linkedItem}>
                      <div>
                        <strong>Invoice:</strong> #{invoices.find(i => i.id === selectedTransaction.linked_invoice_id)?.invoice_number || 'Unknown'}
                        <br />
                        <span style={{fontSize: 13, color: '#666'}}>
                          {formatDate(invoices.find(i => i.id === selectedTransaction.linked_invoice_id)?.invoice_date)} - 
                          {formatCurrency(invoices.find(i => i.id === selectedTransaction.linked_invoice_id)?.total_amount)}
                        </span>
                      </div>
                      <button
                        onClick={() => handleLinkInvoice(selectedTransaction.id, null)}
                        style={styles.unlinkButton}
                      >
                        🔗 Unlink
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Matching Expenses */}
              {getMatchingExpenses(selectedTransaction).length > 0 && (
                <div style={styles.matchesSection}>
                  <h3 style={styles.sectionTitle}>
                    💸 Matching Expenses ({getMatchingExpenses(selectedTransaction).length})
                  </h3>
                  <div style={styles.matchesList}>
                    {getMatchingExpenses(selectedTransaction).map(expense => (
                      <div 
                        key={expense.id} 
                        style={{
                          ...styles.matchCard,
                          backgroundColor: selectedTransaction.linked_expense_id === expense.id ? '#dcfce7' : '#fff'
                        }}
                      >
                        <div style={styles.matchCardContent}>
                          <div style={styles.matchCardHeader}>
                            <div>
                              <strong style={{fontSize: 16, display: 'block', marginBottom: 4}}>{expense.vendor || 'Unknown Vendor'}</strong>
                              {expense.category && <div style={{fontSize: 16, color: '#059669', fontWeight: '700'}}>📁 Category: {expense.category}</div>}
                            </div>
                            <span style={{fontSize: 18, fontWeight: 'bold', color: '#ef4444'}}>
                              {formatCurrency(expense.amount)}
                            </span>
                          </div>
                          <div style={styles.matchCardDetails}>
                            <div>🏢 Vendor: {expense.vendor || 'Unknown Vendor'}</div>
                            {expense.project_id ? (
                              <div>🏗️ Project: {projects.find(p => p.id === expense.project_id)?.project_name || 'Unknown Project'}</div>
                            ) : (
                              <div style={{color: '#999'}}>🏗️ Project: None</div>
                            )}
                            <div>📅 Date: {formatDate(expense.expense_date)}</div>
                            {expense.description && <div>📝 Notes: {expense.description}</div>}
                          </div>
                        </div>
                        <button
                          onClick={() => handleLinkExpense(selectedTransaction.id, expense.id)}
                          style={{
                            ...styles.linkButton,
                            backgroundColor: selectedTransaction.linked_expense_id === expense.id ? '#9ca3af' : '#fc6b04'
                          }}
                          disabled={selectedTransaction.linked_expense_id === expense.id}
                        >
                          {selectedTransaction.linked_expense_id === expense.id ? '✓ Linked' : '🔗 Link'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Matching Invoices */}
              {getMatchingInvoices(selectedTransaction).length > 0 && (
                <div style={styles.matchesSection}>
                  <h3 style={styles.sectionTitle}>
                    💰 Matching Invoices ({getMatchingInvoices(selectedTransaction).length})
                  </h3>
                  <div style={styles.matchesList}>
                    {getMatchingInvoices(selectedTransaction).map(invoice => (
                      <div 
                        key={invoice.id} 
                        style={{
                          ...styles.matchCard,
                          backgroundColor: selectedTransaction.linked_invoice_id === invoice.id ? '#dcfce7' : '#fff'
                        }}
                      >
                        <div style={styles.matchCardContent}>
                          <div style={styles.matchCardHeader}>
                            <strong style={{fontSize: 16}}>Invoice #{invoice.invoice_number}</strong>
                            <span style={{fontSize: 18, fontWeight: 'bold', color: '#10b981'}}>
                              {formatCurrency(invoice.total_amount)}
                            </span>
                          </div>
                          <div style={styles.matchCardDetails}>
                            <div>📅 {formatDate(invoice.invoice_date)}</div>
                            {invoice.customer_id && <div>👤 Customer: {invoice.customer_id}</div>}
                          </div>
                        </div>
                        <button
                          onClick={() => handleLinkInvoice(selectedTransaction.id, invoice.id)}
                          style={{
                            ...styles.linkButton,
                            backgroundColor: selectedTransaction.linked_invoice_id === invoice.id ? '#9ca3af' : '#10b981'
                          }}
                          disabled={selectedTransaction.linked_invoice_id === invoice.id}
                        >
                          {selectedTransaction.linked_invoice_id === invoice.id ? '✓ Linked' : '🔗 Link'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* No Matches - show manual link list */}
              {getMatchCount(selectedTransaction) === 0 && !selectedTransaction.linked_expense_id && !selectedTransaction.linked_invoice_id && (
                <div>
                  <div style={{textAlign: 'center', padding: '20px 0 16px'}}>
                    <div style={{fontSize: 36, marginBottom: 8}}>🔍</div>
                    <p style={{fontSize: 14, color: '#666', margin: '0 0 4px'}}>
                      No automatic match found for <strong>{formatCurrency(selectedTransaction.amount)}</strong>
                    </p>
                    <p style={{fontSize: 13, color: '#999', margin: 0}}>
                      Manually link this transaction to an invoice below:
                    </p>
                  </div>
                  <div style={{...styles.matchesSection, marginBottom: 0}}>
                    <h3 style={styles.sectionTitle}>💰 All Invoices — Manual Link</h3>
                    <div style={{maxHeight: 400, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10}}>
                      {invoices.length === 0 ? (
                        <p style={{color: '#999', fontSize: 14, padding: 12}}>No invoices found.</p>
                      ) : (
                        invoices.map(invoice => (
                          <div
                            key={invoice.id}
                            style={{
                              ...styles.matchCard,
                              backgroundColor: selectedTransaction.linked_invoice_id === invoice.id ? '#dcfce7' : '#fff',
                              alignItems: 'center'
                            }}
                          >
                            <div style={styles.matchCardContent}>
                              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                                <strong style={{fontSize: 15}}>Invoice #{invoice.invoice_number}</strong>
                                <span style={{fontWeight: 700, color: '#10b981', fontSize: 15}}>
                                  {formatCurrency(invoice.total_amount)}
                                  {invoice.net_deposit_amount && invoice.net_deposit_amount !== invoice.total_amount && (
                                    <span style={{fontSize: 12, color: '#666', marginLeft: 6}}>
                                      (net {formatCurrency(invoice.net_deposit_amount)})
                                    </span>
                                  )}
                                </span>
                              </div>
                              <div style={{fontSize: 13, color: '#666', marginTop: 4}}>
                                📅 {formatDate(invoice.invoice_date)}
                                {invoice.customer_id && <span style={{marginLeft: 12}}>👤 {invoice.customer_id}</span>}
                              </div>
                            </div>
                            <button
                              onClick={() => handleLinkInvoice(selectedTransaction.id, invoice.id)}
                              style={{
                                ...styles.linkButton,
                                backgroundColor: selectedTransaction.linked_invoice_id === invoice.id ? '#9ca3af' : '#10b981'
                              }}
                              disabled={selectedTransaction.linked_invoice_id === invoice.id}
                            >
                              {selectedTransaction.linked_invoice_id === invoice.id ? '✓ Linked' : '🔗 Link'}
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CSV Upload Modal */}
      {showUploadModal && (
        <div style={styles.modalOverlay} onClick={() => setShowUploadModal(false)}>
          <div style={styles.uploadModalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>Import Bank Statement</h2>
              <button onClick={() => setShowUploadModal(false)} style={styles.closeButton}>
                ×
              </button>
            </div>
            <BankStatementUpload
              bankAccountId={accountId}
              onImportComplete={handleImportTransactions}
            />
          </div>
        </div>
      )}

      {/* Transaction Modal */}
      {showModal && (
        <div style={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>
                {editingTransaction ? 'Edit Transaction' : 'Add New Transaction'}
              </h2>
              <button onClick={() => setShowModal(false)} style={styles.closeButton}>
                ×
              </button>
            </div>

            <div style={styles.modalBody}>
              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Date *</label>
                  <input
                    type="date"
                    value={transactionForm.transaction_date}
                    onChange={(e) => setTransactionForm({...transactionForm, transaction_date: e.target.value})}
                    style={styles.input}
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Transaction Type *</label>
                  <select
                    value={transactionForm.transaction_type}
                    onChange={(e) => setTransactionForm({...transactionForm, transaction_type: e.target.value})}
                    style={styles.input}
                  >
                    <option value="deposit">Deposit</option>
                    <option value="withdrawal">Withdrawal</option>
                    <option value="transfer">Transfer</option>
                    <option value="fee">Fee</option>
                    <option value="interest">Interest</option>
                  </select>
                </div>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Description *</label>
                <input
                  type="text"
                  value={transactionForm.description}
                  onChange={(e) => setTransactionForm({...transactionForm, description: e.target.value})}
                  style={styles.input}
                  placeholder="e.g., Payment from customer, Office supplies"
                />
              </div>

              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Amount *</label>
                  <input
                    type="number"
                    value={transactionForm.amount}
                    onChange={(e) => setTransactionForm({...transactionForm, amount: e.target.value})}
                    style={styles.input}
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Reference Number</label>
                  <input
                    type="text"
                    value={transactionForm.reference_number}
                    onChange={(e) => setTransactionForm({...transactionForm, reference_number: e.target.value})}
                    style={styles.input}
                    placeholder="Check #, Transaction ID, etc."
                  />
                </div>
              </div>

              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Payee</label>
                  <input
                    type="text"
                    value={transactionForm.payee}
                    onChange={(e) => setTransactionForm({...transactionForm, payee: e.target.value})}
                    style={styles.input}
                    placeholder="Person or company"
                    list="vendors-datalist"
                  />
                  <datalist id="vendors-datalist">
                    {vendors.map((vendor, index) => (
                      <option key={index} value={vendor.vendor_name} />
                    ))}
                  </datalist>
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Category</label>
                  <select
                    value={transactionForm.category}
                    onChange={(e) => setTransactionForm({...transactionForm, category: e.target.value})}
                    style={styles.input}
                  >
                    <option value="">-- Select Account --</option>
                    {accounts.map(account => (
                      <option key={account.id} value={account.id}>
                        {account.account_number} - {account.account_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Project</label>
                <select
                  value={transactionForm.project_id}
                  onChange={(e) => setTransactionForm({...transactionForm, project_id: e.target.value})}
                  style={styles.input}
                >
                  <option value="">-- Select Project --</option>
                  {projects.map(project => (
                    <option key={project.id} value={project.id}>
                      {project.project_name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Notes</label>
                <textarea
                  value={transactionForm.notes}
                  onChange={(e) => setTransactionForm({...transactionForm, notes: e.target.value})}
                  style={{...styles.input, minHeight: 80, resize: 'vertical'}}
                  placeholder="Optional notes..."
                />
              </div>
            </div>

            <div style={styles.modalFooter}>
              <button onClick={() => setShowModal(false)} style={styles.cancelButton}>
                Cancel
              </button>
              <button onClick={handleSave} style={styles.saveButton}>
                {editingTransaction ? '💾 Update Transaction' : '➕ Add Transaction'}
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
    width: "75vw",
    margin: "0",
    padding: "40px 5px",
    backgroundColor: "#0b3ea8",
    minHeight: "100vh",
    boxSizing: "border-box",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
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
  headerButtons: {
    display: "flex",
    gap: 12,
  },
  uploadButton: {
    padding: "12px 24px",
    backgroundColor: "#10b981",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 16,
    fontWeight: "600",
    cursor: "pointer",
    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
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
  error: {
    textAlign: "center",
    padding: 60,
    fontSize: 18,
    color: "#ef4444",
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
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#111",
  },
  filtersSection: {
    display: "flex",
    gap: 12,
    marginBottom: 24,
    flexWrap: "wrap",
  },
  searchBox: {
    flex: 1,
    minWidth: 300,
    position: "relative",
    display: "flex",
    alignItems: "center",
  },
  searchIcon: {
    position: "absolute",
    left: 12,
    fontSize: 18,
  },
  searchInput: {
    width: "100%",
    padding: "12px 12px 12px 40px",
    fontSize: 15,
    border: "2px solid #e5e7eb",
    borderRadius: 8,
    outline: "none",
    backgroundColor: "#fff",
  },
  filterSelect: {
    padding: "12px 16px",
    fontSize: 15,
    border: "2px solid #e5e7eb",
    borderRadius: 8,
    outline: "none",
    backgroundColor: "#fff",
    color: "#111",
    cursor: "pointer",
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
  tableContainer: {
    backgroundColor: "#fff",
    borderRadius: 12,
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
    overflow: "auto",
    overflowX: "auto",
    width: "100%",
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
    padding: "16px 12px",
    textAlign: "left",
    fontWeight: "700",
    color: "#374151",
    whiteSpace: "nowrap",
  },
  tableRow: {
    borderBottom: "1px solid #e5e7eb",
    transition: "background-color 0.15s",
  },
  td: {
    padding: "6px 8px",
    color: "#111",
    fontSize: 13,
  },
  typeCell: {
    textTransform: "capitalize",
    fontSize: 13,
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
  clearedButton: {
    background: "none",
    border: "none",
    fontSize: 18,
    cursor: "pointer",
    padding: 4,
  },
  actionButtons: {
    display: "flex",
    gap: 8,
  },
  actionBtn: {
    background: "none",
    border: "1px solid #e5e7eb",
    borderRadius: 4,
    padding: "4px 8px",
    fontSize: 14,
    cursor: "pointer",
  },
  deleteBtn: {
    borderColor: "#ef4444",
  },
  categorySelect: {
    padding: "6px 8px",
    fontSize: 13,
    border: "1px solid #d1d5db",
    borderRadius: 4,
    outline: "none",
    backgroundColor: "#fff",
    color: "#111",
    cursor: "pointer",
    minWidth: 140,
    maxWidth: 200,
  },
  inlineInput: {
    padding: "4px 6px",
    fontSize: 13,
    border: "1px solid #d1d5db",
    borderRadius: 4,
    outline: "none",
    backgroundColor: "#fff",
    color: "#111",
    width: '100%',
    boxSizing: 'border-box',
  },
  matchButton: {
    padding: "8px 12px",
    border: "2px solid #e5e7eb",
    borderRadius: 6,
    fontSize: 13,
    fontWeight: "600",
    cursor: "pointer",
    whiteSpace: "nowrap",
    transition: "all 0.2s",
  },
  matchIconButton: {
    padding: "4px",
    border: "none",
    background: "none",
    fontSize: 18,
    cursor: "pointer",
    transition: "transform 0.2s",
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
  uploadModalContent: {
    backgroundColor: "#fff",
    borderRadius: 12,
    maxWidth: 1200,
    width: "95%",
    maxHeight: "90vh",
    overflow: "auto",
    boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
  },
  matchesModalContent: {
    backgroundColor: "#fff",
    borderRadius: 12,
    maxWidth: 900,
    width: "90%",
    maxHeight: "90vh",
    overflow: "auto",
    boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
  },
  transactionDetailsCard: {
    backgroundColor: "#f9fafb",
    borderRadius: 8,
    padding: 20,
    marginBottom: 24,
    border: "2px solid #e5e7eb",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#111",
    marginBottom: 16,
    marginTop: 0,
  },
  detailsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: 16,
  },
  detailItem: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  detailValue: {
    fontSize: 15,
    color: "#111",
  },
  linkedSection: {
    backgroundColor: "#f0f9ff",
    border: "2px solid #0ea5e9",
    borderRadius: 8,
    padding: 20,
    marginBottom: 24,
  },
  linkedItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#fff",
    borderRadius: 6,
    marginTop: 12,
  },
  unlinkButton: {
    padding: "8px 16px",
    backgroundColor: "#ef4444",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    fontSize: 14,
    fontWeight: "600",
    cursor: "pointer",
  },
  matchesSection: {
    marginBottom: 24,
  },
  matchesList: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  matchCard: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    border: "2px solid #e5e7eb",
    borderRadius: 8,
    transition: "all 0.2s",
  },
  matchCardContent: {
    flex: 1,
  },
  matchCardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  matchCardDetails: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    fontSize: 15,
    color: "#333",
    marginTop: 12,
    paddingTop: 12,
    borderTop: "1px solid #e5e7eb",
    fontWeight: "500",
  },
  linkButton: {
    padding: "10px 20px",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    fontSize: 14,
    fontWeight: "600",
    cursor: "pointer",
    marginLeft: 16,
    whiteSpace: "nowrap",
  },
  noMatches: {
    textAlign: "center",
    padding: "60px 20px",
    color: "#666",
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
  bulkClearButton: {
    backgroundColor: "#10b981",
    color: "#fff",
    fontWeight: "600",
    whiteSpace: "nowrap",
  },
  bulkUnclearButton: {
    backgroundColor: "#f59e0b",
    color: "#fff",
    fontWeight: "600",
    whiteSpace: "nowrap",
  },
  clearedFolderHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px 22px",
    marginTop: 24,
    backgroundColor: "#1e429f",
    borderRadius: 12,
    cursor: "pointer",
    color: "#fff",
    userSelect: "none",
    boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
    transition: "background-color 0.2s",
  },
  // ── Match Review Modal ──
  matchReviewOverlay: {
    position: "fixed",
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.82)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2000,
  },
  matchReviewModal: {
    backgroundColor: "#1e1b4b",
    borderRadius: 16,
    width: "96%",
    maxWidth: 1040,
    maxHeight: "94vh",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
  },
  matchReviewHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "20px 28px",
    backgroundColor: "#312e81",
    flexShrink: 0,
  },
  matchReviewBody: {
    display: "flex",
    gap: 0,
    flex: 1,
    overflow: "hidden",
    padding: "24px 20px",
    gap: 16,
  },
  matchReviewCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 12,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
  },
  matchReviewCardHeader: {
    padding: "14px 20px",
    color: "#fff",
    fontWeight: 700,
    fontSize: 15,
    letterSpacing: "0.3px",
  },
  matchReviewCardBody: {
    padding: "20px",
    flex: 1,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },
  matchReviewCenter: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 8px",
    flexShrink: 0,
    minWidth: 110,
  },
  matchReviewField: {
    display: "flex",
    flexDirection: "column",
    gap: 3,
    borderBottom: "1px solid #f3f4f6",
    paddingBottom: 10,
  },
  matchReviewLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: "#9ca3af",
    textTransform: "uppercase",
    letterSpacing: "0.6px",
  },
  matchReviewValue: {
    fontSize: 15,
    color: "#111",
    fontWeight: 500,
    wordBreak: "break-word",
  },
  matchReviewFooter: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    padding: "16px 28px",
    backgroundColor: "#312e81",
    flexShrink: 0,
  },
  matchReviewNavBtn: {
    padding: "10px 18px",
    border: "2px solid rgba(255,255,255,0.3)",
    borderRadius: 8,
    backgroundColor: "transparent",
    color: "#fff",
    fontWeight: 600,
    fontSize: 14,
    cursor: "pointer",
  },
  matchReviewSkipBtn: {
    padding: "12px 24px",
    border: "none",
    borderRadius: 8,
    backgroundColor: "#dc2626",
    color: "#fff",
    fontWeight: 700,
    fontSize: 15,
    cursor: "pointer",
    boxShadow: "0 2px 6px rgba(220,38,38,0.4)",
  },
  matchReviewConfirmBtn: {
    padding: "12px 28px",
    border: "none",
    borderRadius: 8,
    backgroundColor: "#059669",
    color: "#fff",
    fontWeight: 700,
    fontSize: 15,
    cursor: "pointer",
    boxShadow: "0 2px 6px rgba(5,150,105,0.4)",
  },
};
