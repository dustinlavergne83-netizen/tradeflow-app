import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import BankStatementUpload from "../Components/BankStatementUpload";
import BankStatementArchive from "../Components/BankStatementArchive";
import { useAuth } from "../contexts/AuthContext";
import { confirmDialog, notify } from '../lib/notify';
import { supabase } from "../lib/supabase";
import { getNextJournalEntryNumber } from "../utils/accountingJournals";
import { useBrand } from "../lib/useBrand";

import { getTodayLocalDate } from "../utils/dateUtils";

export default function BankTransactions() {
  const navigate = useNavigate();
  const BRAND = useBrand();

  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const accountId = searchParams.get('accountId');

  const [bankAccount, setBankAccount] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showStatementArchive, setShowStatementArchive] = useState(false);
  const [showMatchesModal, setShowMatchesModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterCleared, setFilterCleared] = useState('all');
  const [expenses, setExpenses] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [invoicePayments, setInvoicePayments] = useState([]);
  const [bills, setBills] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [topCategoryIds, setTopCategoryIds] = useState([]); // most-frequently-used category account IDs, for the "Most Used" optgroup
  const [transferAccounts, setTransferAccounts] = useState([]); // other active bank accounts, for transfer destination/source picker
  const [transferCandidates, setTransferCandidates] = useState([]); // uncleared transactions on OTHER accounts, for auto-detecting transfers
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
  const [linkedInvoices, setLinkedInvoices] = useState([]); // full list of invoices/payments linked to selectedTransaction (multi-link)
  const [multiSelectLineKeys, setMultiSelectLineKeys] = useState(new Set()); // checkbox selections while linking (keys from buildInvoiceLines)

  // "Record to Books?" prompt shown when clearing an unmatched withdrawal —
  // lets the user choose whether clearing should also create a real,
  // editable expenses row (with vendor/project/receipt tracking) in addition
  // to the journal entry that's already always created. See
  // onClickClearButton (the gate) and handleRecordToBooksChoice (the handler).
  const [showRecordToBooksModal, setShowRecordToBooksModal] = useState(false);
  const [recordToBooksTransaction, setRecordToBooksTransaction] = useState(null);
  const [recordToBooksCategory, setRecordToBooksCategory] = useState('');
  
  const [transactionForm, setTransactionForm] = useState({
    transaction_date: getTodayLocalDate(),
    description: '',
    reference_number: '',
    amount: '',
    transaction_type: 'deposit',
    category: '',
    transfer_account_id: '',
    transfer_direction: 'out', // 'out' = money left this account (withdrawal), 'in' = money arrived (deposit)
    payee: '',
    notes: '',
    project_id: ''
  });

  useEffect(() => {
    if (!accountId) {
      notify('No bank account specified');
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

      // Load sibling bank accounts (for the Transfer to/from picker) — RLS
      // already scopes this to the same company, same pattern as Expenses.jsx
      const { data: siblingAccounts, error: siblingError } = await supabase
        .from("bank_accounts")
        .select("id, account_name, account_number, bank_name, chart_account_id")
        .eq("is_active", true)
        .neq("id", accountId)
        .order("account_name");
      if (siblingError) {
        console.error("Error loading transfer accounts:", siblingError);
      } else {
        setTransferAccounts(siblingAccounts || []);

        // Load UNCLEARED, unpaired transactions from those sibling accounts —
        // these are the candidates for auto-detecting the "other side" of a
        // transfer (e.g. a withdrawal here that matches a deposit over there).
        const siblingIds = (siblingAccounts || []).map(a => a.id);
        if (siblingIds.length > 0) {
          const { data: candidateTx, error: candidateError } = await supabase
            .from("bank_transactions")
            .select("*")
            .in("bank_account_id", siblingIds)
            .eq("is_cleared", false)
            .is("transfer_pair_id", null)
            .order("transaction_date", { ascending: false })
            .limit(500);
          if (candidateError) {
            console.error("Error loading transfer candidates:", candidateError);
          } else {
            setTransferCandidates(candidateTx || []);
          }
        } else {
          setTransferCandidates([]);
        }
      }

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
      notify("Failed to load transactions: " + err.message);
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

      // Compute "Most Used" categories from actual categorization history,
      // so the dropdown surfaces what you actually pick most instead of
      // making you scroll all 60+ accounts every time. Bank/cash accounts
      // (linked to a bank_accounts row) are excluded — they only rank high
      // from transfers that were miscategorized before the dedicated
      // Transfer flow existed, and surfacing them would encourage that
      // old habit instead of using "Transfer" + the account picker.
      const { data: categoryHistory, error: categoryHistoryError } = await supabase
        .from("bank_transactions")
        .select("category")
        .not("category", "is", null);

      if (!categoryHistoryError && categoryHistory) {
        const { data: linkedBankAccounts } = await supabase
          .from("bank_accounts")
          .select("chart_account_id")
          .not("chart_account_id", "is", null);
        const bankChartAccountIds = new Set((linkedBankAccounts || []).map(b => b.chart_account_id));

        const counts = {};
        categoryHistory.forEach(row => {
          if (!row.category || bankChartAccountIds.has(row.category)) return;
          counts[row.category] = (counts[row.category] || 0) + 1;
        });

        const topIds = Object.entries(counts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8)
          .map(([id]) => id);
        setTopCategoryIds(topIds);
      }

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

      // Load paid bills so their payments can be matched/linked instead of
      // creating a duplicate journal entry when the bank transaction clears.
      const { data: billsData, error: billsError } = await supabase
        .from("bills")
        .select("id, vendor_name, total_amount, paid_date, payment_bank_account_id, payment_method, payment_reference")
        .eq("status", "paid")
        .order("paid_date", { ascending: false })
        .limit(500);

      if (billsError) {
        console.error("Error loading bills:", billsError);
        setBills([]);
      } else {
        setBills(billsData || []);
      }
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
      // 'transfer' is included because transfer journal entries are tagged with
      // reference_type = 'transfer' instead of 'bank_transaction' (see the transfer
      // branch in handleToggleCleared) so they can be told apart in the ledger.
      let { data: journalEntries, error: journalCheckError } = await supabase
        .from('journal_entries')
        .select('id, entry_number, reference_type, reference_id')
        .in('reference_type', ['bank_transaction', 'transfer'])
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
      notify(`❌ WARNING: Could not automatically remove journal entry.\n\nError: ${err.message}\n\nPlease manually delete Entry #${err.entry_number || 'unknown'} from the General Ledger.`);
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
          notify('Expense not found');
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
      notify('Failed to link expense');
    }
  }

  // Creates a REAL, editable expenses row (with vendor/project/receipt
  // tracking) for an unmatched withdrawal, and links it to the bank
  // transaction via linked_expense_id. Without this, an unmatched cleared
  // withdrawal only ever shows up on the Expenses page as a lightweight
  // synthetic "🏦 Managed in Bank Transactions" row (see
  // Expenses.jsx's loadClearedBankExpenses) — fine for simple cases, but
  // not editable and with no vendor/project linkage.
  //
  // IMPORTANT: this does NOT also create a journal entry. handleToggleCleared
  // already always creates exactly one JE per cleared transaction (keyed to
  // reference_type='bank_transaction' / reference_id=transaction.id);
  // calling createExpenseJournalEntry here as well would post a second,
  // duplicate entry for the same money leaving the bank. Setting
  // linked_expense_id only changes how the Expenses page displays this
  // transaction — it does not change handleToggleCleared's "already linked"
  // skip-JE branch, because that branch only fires when linked_expense_id
  // was ALREADY set before the user clicked clear (see the modal flow in
  // handleToggleCleared), not when we set it during this same clear.
  async function createExpenseFromTransaction(transaction, categoryAccountId) {
    const category = accounts.find(a => a.id === categoryAccountId);
    if (!category) {
      notify('⚠️ Could not find the selected category account.');
      return null;
    }

    const expenseData = {
      company_id: user.id,
      created_by: user.id,
      expense_date: transaction.transaction_date,
      amount: Math.abs(parseFloat(transaction.amount) || 0),
      category: category.account_name,
      vendor: transaction.payee || null,
      description: transaction.description || null,
      payment_method: 'bank',
      bank_account_id: accountId,
      project_id: transaction.project_id || null,
      tax_deductible: true,
    };

    const { data: newExpense, error } = await supabase
      .from('expenses')
      .insert([expenseData])
      .select()
      .single();

    if (error) {
      console.error('Error creating expense from transaction:', error);
      notify('⚠️ Failed to create expense record: ' + error.message);
      return null;
    }

    const { error: linkError } = await supabase
      .from('bank_transactions')
      .update({ linked_expense_id: newExpense.id, auto_created_expense: true })
      .eq('id', transaction.id);

    if (linkError) {
      console.error('Error linking new expense to transaction:', linkError);
      notify('⚠️ Expense created but could not be linked to this transaction: ' + linkError.message);
    }

    return newExpense;
  }

  // Gate for the clear (✅/🔲) button. Only intercepts with the "Record to
  // Books?" prompt when ALL of these hold:
  //   - clearing (not un-clearing) — un-clear reversal is handled entirely
  //     inside handleToggleCleared
  //   - a withdrawal (amount < 0) — deposits have their own invoice-matching
  //     flow and are out of scope here
  //   - not already linked to an expense/invoice/bill — those already have
  //     a clear story for how the books get updated
  //   - not a transfer and not an owner draw — both already have dedicated,
  //     correct handling in handleToggleCleared and must never become a P&L
  //     expense
  //   - no automatic match was found (getMatchCount === 0) — if the matcher
  //     found a candidate, the normal Matches modal flow is more appropriate
  // Anything that doesn't meet all of these clears exactly as it did before
  // this feature existed.
  function onClickClearButton(transaction) {
    const isUnclearing = transaction.is_cleared;
    const isWithdrawal = parseFloat(transaction.amount) < 0;
    const isUnlinked = !transaction.linked_expense_id && !transaction.linked_invoice_id && !transaction.linked_bill_id;
    const isPlainExpenseCandidate = transaction.transaction_type !== 'transfer' && !transaction.is_owner_draw;
    const hasNoMatch = getMatchCount(transaction) === 0;

    if (!isUnclearing && isWithdrawal && isUnlinked && isPlainExpenseCandidate && hasNoMatch) {
      setRecordToBooksTransaction(transaction);
      setRecordToBooksCategory(transaction.category || '');
      setShowRecordToBooksModal(true);
      return;
    }

    handleToggleCleared(transaction);
  }

  // Handles the three choices in the "Record to Books?" modal.
  async function handleRecordToBooksChoice(choice) {
    const transaction = recordToBooksTransaction;
    if (!transaction) return;

    setShowRecordToBooksModal(false);
    setRecordToBooksTransaction(null);

    if (choice === 'skip') {
      // "Just clear it" — bank-only, no books impact at all. Mark cleared
      // directly, bypassing handleToggleCleared's JE-creation entirely by
      // flagging the transaction as already "linked" to nothing in a way
      // that's inert — simplest correct approach is a direct, minimal update
      // plus a balance refresh, mirroring what handleToggleCleared's early
      // linked-bill branch does (status flip only, no JE).
      try {
        const { error } = await supabase
          .from('bank_transactions')
          .update({ is_cleared: true })
          .eq('id', transaction.id);
        if (error) throw error;
        await loadData();
      } catch (err) {
        console.error('Error clearing transaction (skip books):', err);
        notify('Failed to clear transaction');
      }
      return;
    }

    if (!recordToBooksCategory) {
      notify('⚠️ Please select a Category before clearing this transaction.');
      setRecordToBooksTransaction(transaction);
      setShowRecordToBooksModal(true);
      return;
    }

    // Persist the chosen category onto the transaction first — handleToggleCleared
    // reloads the transaction from the DB and requires a category to be set.
    const { error: categoryError } = await supabase
      .from('bank_transactions')
      .update({ category: recordToBooksCategory })
      .eq('id', transaction.id);
    if (categoryError) {
      console.error('Error saving category:', categoryError);
      notify('Failed to save category');
      return;
    }

    if (choice === 'expense') {
      const newExpense = await createExpenseFromTransaction(transaction, recordToBooksCategory);
      if (!newExpense) return; // error already shown by createExpenseFromTransaction
    }

    // Both 'expense' and 'journal-only' fall through to the normal clearing
    // flow, which always creates the journal entry. When 'expense' ran
    // above, linked_expense_id is now set on the DB row, but
    // handleToggleCleared's JE-skip branches only check the IN-MEMORY
    // transaction object passed in here — which still has linked_expense_id
    // unset — so the JE is still created exactly once, as intended.
    await handleToggleCleared(transaction);
  }

  // Link (or unlink) this bank transaction to a paid Bill. Linking does NOT
  // create a journal entry — createBillPaymentJournalEntry already posted
  // Dr Accounts Payable / Cr Bank when the bill was marked paid. This just
  // tells the matcher "this withdrawal IS that bill payment" so clearing it
  // doesn't try to post a second entry.
  async function handleLinkBill(transactionId, billId) {
    try {
      if (!billId) {
        // Unlinking - just clear the link
        const updates = {
          linked_bill_id: null,
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
        const bill = bills.find(b => b.id === billId);

        if (!bill) {
          notify('Bill not found');
          return;
        }

        const updates = {
          linked_bill_id: billId,
          is_reconciled: true,
          reconciled_at: new Date().toISOString(),
          reconciled_by: user.id,
          payee: bill.vendor_name || null,
          reference_number: bill.payment_reference || null
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
      console.error('Error linking bill:', err);
      notify('Failed to link bill');
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
          notify('Invoice not found');
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
      notify('Failed to link invoice');
    }
  }


  async function loadLinkedInvoices(transactionId) {
    try {
      const { data, error } = await supabase
        .from('bank_transaction_invoices')
        .select('id, invoice_id, invoice_payment_id, amount_applied')
        .eq('bank_transaction_id', transactionId);

      if (error) throw error;

      const withInvoiceInfo = (data || []).map(row => ({
        ...row,
        invoice: invoices.find(i => i.id === row.invoice_id) || null,
        payment: row.invoice_payment_id ? invoicePayments.find(p => p.id === row.invoice_payment_id) || null : null
      }));
      setLinkedInvoices(withInvoiceInfo);
      setMultiSelectLineKeys(new Set(withInvoiceInfo.map(r =>
        r.invoice_payment_id ? `payment:${r.invoice_payment_id}` : `invoice:${r.invoice_id}`
      )));
    } catch (err) {
      console.error('Error loading linked invoices:', err);
      setLinkedInvoices([]);
      setMultiSelectLineKeys(new Set());
    }
  }

  // ── Selectable "lines" for multi-invoice deposit matching ───────────────
  // Processing fees live on individual invoice_payments records, not on the
  // invoice itself (one invoice can have several payments, each with its own
  // fee). So each payment record is its own selectable line, showing the
  // net amount that actually hit the bank. Invoices with no payment history
  // fall back to a single line using the invoice's own total.
  function getAllInvoiceLines() {
    const invoiceIdsWithPayments = new Set(invoicePayments.map(p => p.invoice_id));

    const paymentLines = invoicePayments.map(pmt => {
      const invoice = invoices.find(i => i.id === pmt.invoice_id);
      const gross = parseFloat(pmt.amount) || 0;
      const fee = parseFloat(pmt.processing_fee) || 0;
      const net = (pmt.net_amount != null && parseFloat(pmt.net_amount) > 0)
        ? parseFloat(pmt.net_amount)
        : (fee > 0 ? gross - fee : gross);

      return {
        key: `payment:${pmt.id}`,
        type: 'payment',
        invoice,
        payment: pmt,
        netAmount: net,
        grossAmount: gross,
        fee,
        lineDate: pmt.payment_date
      };
    });

    const invoiceOnlyLines = invoices
      .filter(inv => !invoiceIdsWithPayments.has(inv.id))
      .map(inv => {
        const gross = parseFloat(inv.total_amount) || 0;
        const net = parseFloat(inv.net_deposit_amount) || 0;
        return {
          key: `invoice:${inv.id}`,
          type: 'invoice',
          invoice: inv,
          payment: null,
          netAmount: net > 0 ? net : gross,
          grossAmount: gross,
          fee: parseFloat(inv.processing_fee) || 0,
          lineDate: inv.invoice_date
        };
      });

    return [...paymentLines, ...invoiceOnlyLines];
  }

  function scoreInvoiceLine(transaction, line) {
    return line.type === 'payment'
      ? scoreInvoicePaymentMatch(transaction, line.payment)
      : scoreInvoiceMatch(transaction, line.invoice);
  }

  function getMatchingInvoiceLines(transaction) {
    return getAllInvoiceLines()
      .map(line => ({ ...line, _score: scoreInvoiceLine(transaction, line) }))
      .filter(line => line._score >= MIN_MATCH_SCORE)
      .sort((a, b) => b._score - a._score);
  }

  function toggleMultiSelectLine(key) {
    setMultiSelectLineKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function getSelectedLines() {
    const lines = getAllInvoiceLines();
    return Array.from(multiSelectLineKeys)
      .map(key => lines.find(l => l.key === key))
      .filter(Boolean);
  }

  function getMultiSelectTotal() {
    return getSelectedLines().reduce((sum, line) => sum + line.netAmount, 0);
  }

  function getMultiSelectGrossTotal() {
    return getSelectedLines().reduce((sum, line) => sum + line.grossAmount, 0);
  }

  // Link the transaction to every payment/invoice line currently checked.
  // Requires the selected lines' NET amounts (after processing fees) to sum
  // exactly to the transaction amount (within a 2-cent rounding tolerance) —
  // that net figure is what actually hits the bank.
  async function handleLinkMultipleInvoices(transaction) {
    try {
      const selectedLines = getSelectedLines();

      if (selectedLines.length === 0) {
        notify('Select at least one invoice');
        return;
      }

      const txAmount = Math.abs(parseFloat(transaction.amount) || 0);
      const total = getMultiSelectTotal();

      if (Math.abs(total - txAmount) > 0.02) {
        notify(`Selected items total ${formatCurrency(total)} net, which doesn't match the deposit amount ${formatCurrency(txAmount)}. Adjust your selection.`);
        return;
      }

      // Replace any existing multi-links for this transaction with the new selection
      const { error: deleteError } = await supabase
        .from('bank_transaction_invoices')
        .delete()
        .eq('bank_transaction_id', transaction.id);

      if (deleteError) throw deleteError;

      const rows = selectedLines.map(line => ({
        bank_transaction_id: transaction.id,
        invoice_id: line.invoice.id,
        invoice_payment_id: line.payment?.id || null,
        amount_applied: line.netAmount,
        company_id: user.id,
        created_by: user.id
      }));

      const { error: insertError } = await supabase
        .from('bank_transaction_invoices')
        .insert(rows);

      if (insertError) throw insertError;

      // Keep linked_invoice_id populated (first invoice) for backward compatibility
      // with existing single-invoice reporting/reconciliation code.
      const primaryInvoice = selectedLines[0].invoice;

      const { error: updateError } = await supabase
        .from('bank_transactions')
        .update({
          linked_invoice_id: primaryInvoice?.id || null,
          is_reconciled: true,
          reconciled_at: new Date().toISOString(),
          reconciled_by: user.id,
          payee: primaryInvoice?.customer_name || null
        })
        .eq('id', transaction.id);

      if (updateError) throw updateError;

      notify(`Linked ${selectedLines.length} item${selectedLines.length > 1 ? 's' : ''} to this transaction`);
      await loadData();
      await loadLinkedInvoices(transaction.id);
    } catch (err) {
      console.error('Error linking multiple invoices:', err);
      notify('Failed to link invoices');
    }
  }

  async function handleUnlinkAllInvoices(transaction) {
    try {
      const { error: deleteError } = await supabase
        .from('bank_transaction_invoices')
        .delete()
        .eq('bank_transaction_id', transaction.id);

      if (deleteError) throw deleteError;

      const { error: updateError } = await supabase
        .from('bank_transactions')
        .update({
          linked_invoice_id: null,
          is_reconciled: false,
          reconciled_at: null,
          reconciled_by: null
        })
        .eq('id', transaction.id);

      if (updateError) throw updateError;

      setLinkedInvoices([]);
      setMultiSelectLineKeys(new Set());
      await loadData();
    } catch (err) {
      console.error('Error unlinking invoices:', err);
      notify('Failed to unlink invoices');
    }
  }

  function openMatchesModal(transaction) {
    setSelectedTransaction(transaction);
    setShowMatchesModal(true);
    loadLinkedInvoices(transaction.id);
  }

  // ── Scoring-based match functions ──────────────────────────────────────────
  // Minimum score to appear as a match: 70
  //   Amount exact (≤$0.01): +50   Amount rounding diff (≤$0.02): +30
  //   Date ≤3 days: +30   ≤7d: +20   ≤14d: +10   >14d: REJECT
  //   Payee/vendor/customer name similarity: +25
  // To pass (score ≥ 70):
  //   Exact amount + ≤7 days  = 70 ✓ (minimum passing case)
  //   Exact amount + ≤3 days  = 80 ✓ (strong match)
  //   Exact amount + ≤3 days + name = 105 ✓ (very strong)
  //   Exact amount + 8-14 days = 60 ✗ (rejected — too old without name confirmation)
  //   Exact amount + >14 days = 0  ✗ (always rejected)

  function dateProximityScore(dateA, dateB, maxDays = 14) {
    if (!dateA || !dateB) return null; // no date = reject
    const a = new Date(dateA.includes('T') ? dateA : dateA + 'T00:00:00');
    const b = new Date(dateB.includes('T') ? dateB : dateB + 'T00:00:00');
    const days = Math.abs((a - b) / 86400000);
    if (days > maxDays) return null; // null = reject entirely
    if (days <= 3)  return 30;
    if (days <= 7)  return 20;
    return 10; // 8-14 days
  }

  function nameSimilarityScore(str1, str2) {
    if (!str1 || !str2) return 0;
    const a = str1.toLowerCase().trim();
    const b = str2.toLowerCase().trim();
    if (!a || !b) return 0;
    const shorter = a.length < b.length ? a : b;
    const longer  = a.length < b.length ? b : a;
    if (shorter.length >= 4 && longer.includes(shorter)) return 25;
    const aWord = a.split(/\s+/)[0];
    const bWord = b.split(/\s+/)[0];
    if (aWord.length >= 3 && aWord === bWord) return 12;
    return 0;
  }

  function scoreExpenseMatch(transaction, expense) {
    const txAmount  = Math.abs(parseFloat(transaction.amount)  || 0);
    const expAmount = Math.abs(parseFloat(expense.amount)      || 0);
    const diff      = Math.abs(txAmount - expAmount);

    // Amount must be within 2 cents — no match otherwise
    let score = 0;
    if      (diff < 0.01)  score += 50;  // exact
    else if (diff <= 0.02) score += 30;  // rounding
    else return 0;

    // Date must be within 14 days — hard reject beyond that
    const datePts = dateProximityScore(transaction.transaction_date, expense.expense_date, 14);
    if (datePts === null) return 0;
    score += datePts;

    // Payee ↔ vendor name similarity (bonus)
    score += nameSimilarityScore(transaction.payee       || '', expense.vendor || '');
    score += nameSimilarityScore(transaction.description || '', expense.vendor || '');

    return score;
  }

  function scoreInvoiceMatch(transaction, invoice) {
    const txAmount = Math.abs(parseFloat(transaction.amount) || 0);

    // ONLY match on the invoice's own total or net_deposit_amount —
    // do NOT use payment installment records, which cause false positives.
    const netDep   = Math.abs(parseFloat(invoice.net_deposit_amount) || 0);
    const invTotal = Math.abs(parseFloat(invoice.total_amount)       || 0);

    let amountScore = 0;
    if      (netDep   > 0 && Math.abs(netDep   - txAmount) < 0.01)  amountScore = 50;
    else if (netDep   > 0 && Math.abs(netDep   - txAmount) <= 0.02) amountScore = 30;
    else if (invTotal > 0 && Math.abs(invTotal  - txAmount) < 0.01)  amountScore = 50;
    else if (invTotal > 0 && Math.abs(invTotal  - txAmount) <= 0.02) amountScore = 30;
    else return 0; // amounts don't match — reject

    let score = amountScore;

    // Date must be within 14 days of invoice date — hard reject beyond that
    const datePts = dateProximityScore(transaction.transaction_date, invoice.invoice_date, 14);
    if (datePts === null) return 0;
    score += datePts;

    // Customer ↔ payee/description similarity (bonus)
    score += nameSimilarityScore(transaction.payee       || '', invoice.customer_name || '');
    score += nameSimilarityScore(transaction.description || '', invoice.customer_name || '');

    return score;
  }

  const MIN_MATCH_SCORE = 70;

  // Score a bank deposit against an individual invoice_payment record.
  // Uses net_amount (after fee) first — this is what actually hits the bank.
  // NOTE: No hard date rejection here — invoice payments are often recorded weeks
  // before or after the deposit clears. The specific after-fee amount (e.g. $294.75)
  // is distinctive enough that amount-only matching is reliable.
  function scoreInvoicePaymentMatch(transaction, payment) {
    if (transaction.amount < 0) return 0; // only for deposits
    const txAmount = Math.abs(parseFloat(transaction.amount) || 0);

    // Priority: net_amount → amount-fee → amount
    const pmtNet = (payment.net_amount != null && parseFloat(payment.net_amount) > 0)
      ? parseFloat(payment.net_amount)
      : (parseFloat(payment.processing_fee || 0) > 0
          ? (parseFloat(payment.amount) || 0) - parseFloat(payment.processing_fee)
          : parseFloat(payment.amount) || 0);

    const diff = Math.abs(pmtNet - txAmount);
    // Amount match alone is sufficient for individual payment records
    if (diff < 0.01)   return 100; // exact → guaranteed above MIN_MATCH_SCORE
    if (diff <= 0.02)  return 80;  // rounding → still passes
    return 0;
  }

  function getMatchingInvoicePayments(transaction) {
    if (!transaction || transaction.amount < 0) return [];
    return invoicePayments
      .map(pmt => ({ ...pmt, _score: scoreInvoicePaymentMatch(transaction, pmt) }))
      .filter(pmt => pmt._score >= MIN_MATCH_SCORE)
      .sort((a, b) => b._score - a._score);
  }

  function getMatchingExpenses(transaction) {
    return expenses
      .map(exp => ({ ...exp, _score: scoreExpenseMatch(transaction, exp) }))
      .filter(exp => exp._score >= MIN_MATCH_SCORE)
      .sort((a, b) => b._score - a._score);
  }

  // Score a bank withdrawal/check against a paid bill. Bills are only
  // matchable here as withdrawals (money leaving the account) since that's
  // the only direction a bill payment moves.
  function scoreBillMatch(transaction, bill) {
    if (transaction.amount > 0) return 0; // bills are only paid via withdrawals/checks
    const txAmount   = Math.abs(parseFloat(transaction.amount) || 0);
    const billAmount = Math.abs(parseFloat(bill.total_amount)  || 0);
    const diff       = Math.abs(txAmount - billAmount);

    let score = 0;
    if      (diff < 0.01)  score += 50;  // exact
    else if (diff <= 0.02) score += 30;  // rounding
    else return 0;

    // Date must be within 14 days of the bill's paid_date — hard reject beyond that
    const datePts = dateProximityScore(transaction.transaction_date, bill.paid_date, 14);
    if (datePts === null) return 0;
    score += datePts;

    // Vendor name ↔ payee/description similarity (bonus)
    score += nameSimilarityScore(transaction.payee       || '', bill.vendor_name || '');
    score += nameSimilarityScore(transaction.description || '', bill.vendor_name || '');

    // Strong bonus: check/reference number on the bill matches the bank
    // transaction's reference number (e.g. check #1079 on both sides).
    if (bill.payment_reference && transaction.reference_number &&
        bill.payment_reference.trim() === transaction.reference_number.trim()) {
      score += 40;
    }

    return score;
  }

  function getMatchingBills(transaction) {
    // Only offer bills that aren't already linked to a (different) transaction.
    const linkedBillIds = new Set(
      transactions.filter(t => t.linked_bill_id && t.id !== transaction.id).map(t => t.linked_bill_id)
    );
    return bills
      .filter(bill => !linkedBillIds.has(bill.id))
      .map(bill => ({ ...bill, _score: scoreBillMatch(transaction, bill) }))
      .filter(bill => bill._score >= MIN_MATCH_SCORE)
      .sort((a, b) => b._score - a._score);
  }

  function getMatchingInvoices(transaction) {
    return invoices
      .map(inv => ({ ...inv, _score: scoreInvoiceMatch(transaction, inv) }))
      .filter(inv => inv._score >= MIN_MATCH_SCORE)
      .sort((a, b) => b._score - a._score);
  }

  // Score a transaction against a candidate transaction on a DIFFERENT bank
  // account, to detect the "other side" of a transfer (e.g. $5,000 out of
  // checking should match $5,000 into savings a day or two later).
  function scoreTransferMatch(transaction, candidate) {
    // Must be opposite direction — money leaving one account, arriving in the other.
    if ((transaction.amount > 0) === (candidate.amount > 0)) return 0;
    // Never match within the same account (shouldn't happen given the query, but be safe).
    if (candidate.bank_account_id === accountId) return 0;
    // Already paired — not a candidate anymore.
    if (candidate.transfer_pair_id) return 0;

    const txAmount = Math.abs(parseFloat(transaction.amount) || 0);
    const candAmount = Math.abs(parseFloat(candidate.amount) || 0);
    const diff = Math.abs(txAmount - candAmount);

    let score = 0;
    if      (diff < 0.01)  score += 50; // exact
    else if (diff <= 0.02) score += 30; // rounding
    else return 0;

    // Tighter date window than expenses/invoices — both legs of a real
    // transfer normally post within a few days of each other.
    const datePts = dateProximityScore(transaction.transaction_date, candidate.transaction_date, 5);
    if (datePts === null) return 0;
    score += datePts;

    // Bonus for transfer-ish language in either description.
    const desc = `${transaction.description || ''} ${candidate.description || ''}`.toLowerCase();
    if (/transfer|xfer|online banking|between accounts/.test(desc)) score += 15;

    return score;
  }

  function getMatchingTransfers(transaction) {
    if (!transaction || transaction.transaction_type === 'transfer') return [];
    return transferCandidates
      .map(cand => ({ ...cand, _score: scoreTransferMatch(transaction, cand) }))
      .filter(cand => cand._score >= MIN_MATCH_SCORE)
      .sort((a, b) => b._score - a._score);
  }

  function getMatchCount(transaction) {
    return getMatchingExpenses(transaction).length + getMatchingInvoices(transaction).length +
      getMatchingInvoicePayments(transaction).length + getMatchingTransfers(transaction).length +
      getMatchingBills(transaction).length;
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
      transfer_account_id: '',
      transfer_direction: 'out',
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
      transfer_account_id: transaction.transfer_account_id || '',
      transfer_direction: transaction.amount < 0 ? 'out' : 'in',
      payee: transaction.payee || '',
      notes: transaction.notes || '',
      project_id: transaction.project_id || ''
    });
    setShowModal(true);
  }

  async function handleSave() {
    if (!transactionForm.description || !transactionForm.amount) {
      notify('Please enter description and amount');
      return;
    }

    try {
      const amount = parseFloat(transactionForm.amount);
      if (isNaN(amount) || amount <= 0) {
        notify('Please enter a valid positive amount');
        return;
      }

      if (transactionForm.transaction_type === 'transfer' && !transactionForm.transfer_account_id) {
        notify('Please select which account this transfer is to/from');
        return;
      }

      // For deposits, amount is positive; for withdrawals, amount is negative.
      // For transfers, the direction picker decides the sign (money leaving = negative).
      const finalAmount = transactionForm.transaction_type === 'transfer'
        ? (transactionForm.transfer_direction === 'out' ? -Math.abs(amount) : Math.abs(amount))
        : (transactionForm.transaction_type === 'withdrawal' || transactionForm.transaction_type === 'fee'
            ? -Math.abs(amount)
            : Math.abs(amount));

      const transactionData = {
        bank_account_id: accountId,
        transaction_date: transactionForm.transaction_date,
        description: transactionForm.description,
        reference_number: transactionForm.reference_number || null,
        amount: finalAmount,
        transaction_type: transactionForm.transaction_type,
        category: transactionForm.transaction_type === 'transfer' ? null : (transactionForm.category || null),
        transfer_account_id: transactionForm.transaction_type === 'transfer' ? transactionForm.transfer_account_id : null,
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
        notify('Transaction updated successfully!');
      } else {
        const { error } = await supabase
          .from('bank_transactions')
          .insert([transactionData]);

        if (error) throw error;
        notify('Transaction added successfully!');
      }

      setShowModal(false);
      setEditingTransaction(null);
      loadData();
    } catch (err) {
      console.error('Error saving transaction:', err);
      notify(`Failed to save: ${err.message}`);
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
        notify('Failed to update transaction status');
        return;
      }

      // STEP 2a: If linked to a bill, clearing just confirms the match — the
      // bill is already marked 'paid' and its journal entry already exists
      // (createBillPaymentJournalEntry), so there's nothing else to update.
      if (transaction.linked_bill_id) {
        if (!bulkMode) await loadData();
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

      // ── TRANSFERS: asset-to-asset, never Expense/Income ─────────────────────
      // A transfer moves money between two of THIS company's own bank accounts,
      // so it must never touch a P&L account. This entire branch replaces the
      // generic uncleared/JE-creation logic below for transaction_type='transfer'.
      if (transaction.transaction_type === 'transfer') {
        await handleTransferClear(transaction, newClearedStatus, bulkMode);
        return;
      }

      // When UNCLEANING an UNLINKED transaction, DELETE the journal entry that was created
      if (!newClearedStatus && !transaction.linked_invoice_id && !transaction.linked_expense_id && !transaction.linked_bill_id) {
        console.log('Removing journal entry for uncleared unlinked transaction:', transaction.id);
        
        // Delete journal entry for this transaction
        await deleteJournalEntryForTransaction(transaction.id);
        
        // Remind user to refresh Chart of Accounts
        if (!bulkMode) notify('✅ Transaction uncleared! \n\n⚠️ IMPORTANT: Please go to Chart of Accounts > "Refresh Balances" to update the book values.');
      }

      // When UNCLEARING a transaction whose expense was auto-created by the
      // "Record to Books?" prompt (see createExpenseFromTransaction), reverse
      // BOTH records: delete the journal entry (same as the unlinked case
      // above) AND delete the expense row itself, then clear the link flags.
      // A transaction the user manually linked to a PRE-EXISTING expense via
      // the Matches modal (handleLinkExpense) has linked_expense_id set but
      // NOT auto_created_expense, so it's untouched here — only ever delete
      // expenses this flow created.
      if (!newClearedStatus && transaction.linked_expense_id && transaction.auto_created_expense) {
        console.log('Removing auto-created expense + journal entry for unclear:', transaction.id);

        await deleteJournalEntryForTransaction(transaction.id);

        const { error: deleteExpenseError } = await supabase
          .from('expenses')
          .delete()
          .eq('id', transaction.linked_expense_id);

        if (deleteExpenseError) {
          console.error('Error deleting auto-created expense:', deleteExpenseError);
          notify('⚠️ Transaction uncleared, but the linked expense could not be removed automatically: ' + deleteExpenseError.message);
        }

        const { error: unlinkError } = await supabase
          .from('bank_transactions')
          .update({ linked_expense_id: null, auto_created_expense: false })
          .eq('id', transaction.id);

        if (unlinkError) {
          console.error('Error clearing expense link:', unlinkError);
        }

        transaction = { ...transaction, linked_expense_id: null, auto_created_expense: false };

        if (!bulkMode) {
          notify('✅ Transaction uncleared! The expense that was created for it has been removed.\n\n⚠️ IMPORTANT: Please go to Chart of Accounts > "Refresh Balances" to update the book values.');
          await loadData();
          return;
        }
      }

        // ── AUTO-MATCH: Check if this deposit was already recorded via invoice_payments ──
        // If a matching payment record exists (net_amount after fees), just link the bank
        // transaction to that invoice and skip JE creation — prevents double-counting.
        if (newClearedStatus && !transaction.linked_invoice_id && !transaction.linked_expense_id && transaction.amount > 0) {
          const txAmt = Math.abs(parseFloat(transaction.amount) || 0);
          const txDate = transaction.transaction_date;

          const matchingPayment = invoicePayments.find(pmt => {
            // Use net_amount (after fee) first, then calculated net, then gross
            const pmtNet = (pmt.net_amount != null && parseFloat(pmt.net_amount) > 0)
              ? parseFloat(pmt.net_amount)
              : (parseFloat(pmt.processing_fee || 0) > 0
                  ? (parseFloat(pmt.amount) || 0) - parseFloat(pmt.processing_fee)
                  : parseFloat(pmt.amount) || 0);

            if (Math.abs(pmtNet - txAmt) > 0.02) return false;

            if (!pmt.payment_date) return false;
            const pDate = new Date(pmt.payment_date.includes('T') ? pmt.payment_date : pmt.payment_date + 'T00:00:00');
            const tDate = new Date(txDate.includes('T') ? txDate : txDate + 'T00:00:00');
            return Math.abs((pDate - tDate) / 86400000) <= 7;
          });

          if (matchingPayment) {
            // Link the bank transaction to the invoice so future clears also skip JE creation
            await supabase
              .from('bank_transactions')
              .update({ linked_invoice_id: matchingPayment.invoice_id })
              .eq('id', transaction.id);

            console.log('✅ Deposit auto-matched to existing invoice payment — no duplicate JE created');
            if (!bulkMode) {
              notify('✅ Cleared! This deposit matched an existing invoice payment record — no duplicate journal entry was created.');
              await loadData();
            }
            return;
          }
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
          notify('Failed to reload transaction data');
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
              notify('⚠️ Owner Draws account (#3100) not found in Chart of Accounts.\n\nPlease create an Owner Draws account first.');
              
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
              if (!bulkMode) notify('⚠️ Failed to assign Owner Draws account');
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
              notify('Failed to reload transaction');
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
              notify('⚠️ Please select a Category (Chart of Accounts) before clearing this transaction.\n\nThis ensures the transaction is properly recorded in both your Bank Account and the Chart of Accounts.');
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
          notify('Failed to reload transaction');
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
            notify('⚠️ Error fetching bank account details. Please try again.');
            return;
          }

          if (!bankAccountRecord?.chart_account_id) {
            console.error('Bank account not linked to Chart of Accounts');
            notify('⚠️ Bank account is not linked to Chart of Accounts.\n\nPlease go to Bank Accounts settings and link it to an account in your Chart of Accounts before clearing unlinked transactions.');
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
                notify('⚠️ Selected account not found in Chart of Accounts. Please select a valid account and try again.');
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
                notify('⚠️ Could not load accounts. Please try again.');
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
                  notify('⚠️ No Equity account found in Chart of Accounts. Please create an Equity account (like Owner\'s Equity) first.');
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
                  notify('⚠️ No Expense account found in Chart of Accounts. Please create an Expense account first.');
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
                  notify('⚠️ No Income account found in Chart of Accounts. Please create an Income account first.');
                  return;
                }
              }
            }

            if (!offsetAccountId) {
              console.error('Could not determine offset account for journal entry');
              notify('⚠️ Please select a category (Chart of Accounts) for this transaction before clearing it.');
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
              notify(`⚠️ Transaction cleared but journal entry failed: ${entryError.message}`);
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
                notify('⚠️ Could not fetch account details. Please try again.');
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
                notify(`⚠️ Journal entry calculation error. Total debits ($${totalDebits.toFixed(2)}) do not equal total credits ($${totalCredits.toFixed(2)}).\n\nThis is a system error. Please contact support.`);
                // Delete the journal entry since we can't post it
                await supabase.from('journal_entries').delete().eq('id', newEntry.id);
                return;
              }

              const { error: linesError } = await supabase
                .from('journal_entry_lines')
                .insert(lines);

              if (linesError) {
                console.error('Failed to create journal entry lines:', linesError);
                notify(`⚠️ Journal entry created but lines failed: ${linesError.message}`);
                return;
              }

              // Entry was already inserted with is_posted: true — no separate RPC needed
              console.log('✅ Journal entry created and posted for transaction:', transaction.id);
              console.log('Transaction', transaction.amount > 0 ? 'deposit' : 'withdrawal', 'recorded to both Bank Account and Chart of Accounts');
            }
          }
        } catch (err) {
          console.error('Error creating journal entry:', err);
          notify(`⚠️ Failed to create journal entry: ${err.message}\n\nMake sure you have both Expense and Income accounts in your Chart of Accounts.`);
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
        notify(`Failed to update: ${err.message}`);
        await loadData();
      } else {
        throw err; // re-throw so bulk caller counts it as a failure
      }
    }
  }

  // ── TRANSFERS: asset-to-asset, never Expense/Income ───────────────────────
  // A transfer moves money between two of THIS company's own bank accounts,
  // so its journal entry must debit one Asset (cash) account and credit
  // another — it must never touch Income or Expense (the old auto-fallback
  // logic in handleToggleCleared would have booked it as one or the other,
  // double-counting the money on the P&L).
  async function handleTransferClear(transaction, newClearedStatus, bulkMode) {
    try {
      if (!newClearedStatus) {
        // Unclearing — the shared journal entry is referenced by whichever
        // side happened to clear first, so try THIS transaction's id, then
        // fall back to the pair's id. A matched transfer pair is treated as
        // one event, so unclearing either side unclears BOTH (the caller
        // already set is_cleared=false on this transaction; here we also
        // uncleared the pair and recalc its account's balance). The pairing
        // itself (transfer_pair_id) is left intact — it's still the correct
        // match, just no longer cleared/posted.
        let deleted = await deleteJournalEntryForTransaction(transaction.id);
        if (!deleted && transaction.transfer_pair_id) {
          deleted = await deleteJournalEntryForTransaction(transaction.transfer_pair_id);
        }

        if (transaction.transfer_pair_id) {
          await supabase.from('bank_transactions').update({ is_cleared: false }).eq('id', transaction.transfer_pair_id);
          await recalcOtherAccountBalance(transaction.transfer_account_id);
        }

        if (!bulkMode) {
          notify(deleted
            ? '✅ Transfer uncleared on both accounts and its journal entry removed.'
            : '✅ Transfer uncleared on both accounts.');
          await recalcBalanceAndReload();
        }
        return;
      }

      if (!transaction.transfer_account_id) {
        await supabase.from('bank_transactions').update({ is_cleared: false }).eq('id', transaction.id);
        if (bulkMode) throw new Error('Transfer missing destination account — skipped');
        notify('⚠️ Please select which account this transfer is to/from before clearing it.');
        await loadData();
        return;
      }

      // If a journal entry already exists for this pair (created earlier by
      // either side), don't create a second one — just make sure both sides
      // are marked cleared and stop. This is different from merely having
      // transfer_pair_id set: Match Review sets that BEFORE either side is
      // cleared, so a pair can be linked with no journal entry yet — that
      // used to be (wrongly) treated as "already handled" and skipped
      // entirely, which is why cleared transfers were producing no journal
      // entry and the transaction never actually finished clearing.
      if (transaction.transfer_pair_id) {
        const { data: existingJe } = await supabase
          .from('journal_entries')
          .select('id')
          .eq('reference_type', 'transfer')
          .in('reference_id', [transaction.id, transaction.transfer_pair_id])
          .maybeSingle();

        if (existingJe) {
          await supabase.from('bank_transactions')
            .update({ is_cleared: true })
            .eq('id', transaction.transfer_pair_id);
          await recalcOtherAccountBalance(transaction.transfer_account_id);
          if (!bulkMode) {
            notify('✅ Transfer cleared on both accounts.');
            await recalcBalanceAndReload();
          }
          return;
        }
        // else: fall through and create the journal entry below, exactly
        // like an unpaired transfer would.
      }

      const { data: bankRec, error: bankRecErr } = await supabase
        .from('bank_accounts').select('chart_account_id').eq('id', accountId).single();
      if (bankRecErr || !bankRec?.chart_account_id) {
        notify('⚠️ This bank account is not linked to a Chart of Accounts cash account. Please link it in Bank Accounts first.');
        await supabase.from('bank_transactions').update({ is_cleared: false }).eq('id', transaction.id);
        if (!bulkMode) await loadData();
        return;
      }
      const { data: destAccount, error: destErr } = await supabase
        .from('bank_accounts').select('chart_account_id, account_name').eq('id', transaction.transfer_account_id).single();
      if (destErr || !destAccount?.chart_account_id) {
        notify('⚠️ The destination account is not linked to a Chart of Accounts cash account. Please link it in Bank Accounts first.');
        await supabase.from('bank_transactions').update({ is_cleared: false }).eq('id', transaction.id);
        if (!bulkMode) await loadData();
        return;
      }

      const absAmount = Math.abs(transaction.amount);
      const entryNumber = await getNextJournalEntryNumber(user.id);
      const { data: newEntry, error: entryError } = await supabase
        .from('journal_entries')
        .insert([{
          entry_number: entryNumber,
          entry_date: transaction.transaction_date,
          description: `Transfer: ${bankAccount?.account_name || 'Account'} <-> ${destAccount.account_name}`.substring(0, 50),
          reference_type: 'transfer',
          reference_id: transaction.id,
          created_by: user.id,
          company_id: user.id,
          is_posted: true,
          posted_at: new Date().toISOString(),
          posted_by: user.id
        }]).select().single();
      if (entryError) throw entryError;

      // This bank account is always an Asset. Money arriving (positive) is a
      // debit; money leaving (negative) is a credit. The destination account
      // gets the exact opposite — both lines are Asset accounts, so this
      // journal entry can never touch Income or Expense.
      const thisDebit = transaction.amount > 0 ? absAmount : 0;
      const thisCredit = transaction.amount < 0 ? absAmount : 0;

      const { error: linesError } = await supabase.from('journal_entry_lines').insert([
        { entry_id: newEntry.id, line_number: 1, account_id: bankRec.chart_account_id, debit: thisDebit, credit: thisCredit, description: 'Transfer' },
        { entry_id: newEntry.id, line_number: 2, account_id: destAccount.chart_account_id, debit: thisCredit, credit: thisDebit, description: 'Transfer' }
      ]);
      if (linesError) {
        await supabase.from('journal_entries').delete().eq('id', newEntry.id);
        throw linesError;
      }

      // Find the paired sibling on the destination account — either it was
      // already linked (via Match Review, before this side was cleared), or
      // we auto-match it now the same way Match Review does. Either way,
      // the sibling gets cleared automatically along with this side: a
      // matched transfer pair is one verified movement of money, and the
      // journal entry above already covers both accounts correctly, so
      // there's nothing left for clearing the sibling to duplicate.
      let sibling = null;
      if (transaction.transfer_pair_id) {
        const { data: existingSibling } = await supabase
          .from('bank_transactions').select('*').eq('id', transaction.transfer_pair_id).single();
        sibling = existingSibling || null;
      } else {
        const { data: siblingCandidates } = await supabase
          .from('bank_transactions')
          .select('*')
          .eq('bank_account_id', transaction.transfer_account_id)
          .eq('is_cleared', false)
          .is('transfer_pair_id', null);

        sibling = (siblingCandidates || []).find(s => {
          if (Math.abs(Math.abs(s.amount) - absAmount) > 0.01) return false;
          if ((s.amount > 0) === (transaction.amount > 0)) return false; // must be opposite direction
          return dateProximityScore(s.transaction_date, transaction.transaction_date, 5) !== null;
        }) || null;

        if (sibling) {
          await supabase.from('bank_transactions').update({ transfer_pair_id: sibling.id }).eq('id', transaction.id);
          await supabase.from('bank_transactions').update({
            transaction_type: 'transfer',
            transfer_account_id: accountId,
            transfer_pair_id: transaction.id
          }).eq('id', sibling.id);
        }
      }

      // No record of this transfer on the destination account yet — most
      // likely you haven't uploaded that account's statement covering this
      // date. Create the counterpart automatically so the transfer is fully
      // recorded on both sides right now, tagged auto_created so that when
      // you DO later import that account's real statement, the importer
      // can find and update this placeholder instead of inserting a
      // duplicate (see migration 103).
      let autoCreated = false;
      if (!sibling) {
        const { data: newSibling, error: createSiblingError } = await supabase
          .from('bank_transactions')
          .insert({
            bank_account_id: transaction.transfer_account_id,
            transaction_date: transaction.transaction_date,
            description: transaction.description,
            amount: -transaction.amount,
            transaction_type: 'transfer',
            transfer_account_id: accountId,
            transfer_pair_id: transaction.id,
            is_cleared: false, // set true below, after we know the insert worked
            auto_created: true,
            notes: `Auto-created from transfer cleared on ${bankAccount?.account_name || 'another account'}`,
            created_by: user.id,
          })
          .select()
          .single();

        if (!createSiblingError && newSibling) {
          await supabase.from('bank_transactions').update({ transfer_pair_id: newSibling.id }).eq('id', transaction.id);
          sibling = newSibling;
          autoCreated = true;
        } else {
          console.error('Error auto-creating transfer counterpart:', createSiblingError);
        }
      }

      if (sibling) {
        await supabase.from('bank_transactions').update({ is_cleared: true }).eq('id', sibling.id);
        await recalcOtherAccountBalance(transaction.transfer_account_id);
        if (!bulkMode) {
          notify(autoCreated
            ? `✅ Transfer cleared! No matching transaction existed on ${destAccount.account_name} yet, so one was created and cleared automatically — asset-to-asset, no impact on Profit & Loss.`
            : `✅ Transfer cleared on both accounts (${destAccount.account_name}). Journal entry created — asset-to-asset, no impact on Profit & Loss.`);
        }
      } else if (!bulkMode) {
        notify('✅ Transfer cleared! Journal entry created — asset-to-asset, no impact on Profit & Loss.\n\n⚠️ Could not create a matching transaction on the other account — please check it manually.');
      }

      if (!bulkMode) await recalcBalanceAndReload();
    } catch (err) {
      console.error('Error handling transfer clear:', err);
      if (!bulkMode) {
        notify(`⚠️ Failed to process transfer: ${err.message}`);
        await supabase.from('bank_transactions').update({ is_cleared: false }).eq('id', transaction.id);
        await loadData();
      } else {
        throw err;
      }
    }
  }

  async function recalcBalanceAndReload() {
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

  // Recalculates current_balance for a DIFFERENT bank account than the one
  // currently being viewed — needed when auto-clearing a transfer's paired
  // side, since that sibling transaction lives on another account whose
  // running balance also just changed.
  async function recalcOtherAccountBalance(otherAccountId) {
    try {
      const { data: otherAccount } = await supabase
        .from('bank_accounts').select('opening_balance').eq('id', otherAccountId).single();
      const { data: clearedTransactions } = await supabase
        .from('bank_transactions').select('amount')
        .eq('bank_account_id', otherAccountId).eq('is_cleared', true);
      const freshSum = (clearedTransactions || []).reduce((sum, t) => sum + t.amount, 0);
      const freshBalance = (otherAccount?.opening_balance || 0) + freshSum;
      await supabase.from('bank_accounts').update({ current_balance: freshBalance }).eq('id', otherAccountId);
    } catch (err) {
      console.error('Error recalculating other account balance:', err);
    }
  }

  async function handleDelete(transaction) {
    if (!await confirmDialog(`Delete transaction "${transaction.description}"?`)) {
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
      notify('Transaction deleted successfully!');
      loadData();
    } catch (err) {
      console.error('Error deleting transaction:', err);
      notify(`Failed to delete: ${err.message}`);
    }
  }

  async function handleImportTransactions(transactions) {
    try {
      // Before inserting, check for auto_created placeholder transactions on
      // THIS account (created when a transfer was cleared from the other
      // side before this account's real statement existed — see
      // handleTransferClear). If this statement's real transaction matches
      // one (same amount/direction, within 5 days), UPDATE the placeholder
      // in place instead of inserting a duplicate — otherwise every
      // auto-created transfer would double up the moment its real
      // statement is imported.
      const { data: placeholders } = await supabase
        .from('bank_transactions')
        .select('*')
        .eq('bank_account_id', accountId)
        .eq('auto_created', true);

      const usedPlaceholderIds = new Set();
      const rowsToInsert = [];
      let mergedCount = 0;

      for (const t of transactions) {
        const match = (placeholders || []).find(p =>
          !usedPlaceholderIds.has(p.id) &&
          Math.abs(Math.abs(p.amount) - Math.abs(t.amount)) < 0.01 &&
          (p.amount > 0) === (t.amount > 0) &&
          dateProximityScore(p.transaction_date, t.transaction_date, 5) !== null
        );

        if (match) {
          usedPlaceholderIds.add(match.id);
          mergedCount++;
          await supabase
            .from('bank_transactions')
            .update({
              transaction_date: t.transaction_date,
              description: t.description,
              reference_number: t.reference_number,
              payee: t.payee || match.payee,
              notes: t.notes,
              auto_created: false, // now backed by the real imported statement row
              imported_date: new Date().toISOString(),
            })
            .eq('id', match.id);
        } else {
          rowsToInsert.push({
            ...t,
            bank_account_id: accountId,
            created_by: user.id,
            imported_date: new Date().toISOString(),
          });
        }
      }

      if (rowsToInsert.length > 0) {
        const { error } = await supabase.from('bank_transactions').insert(rowsToInsert);
        if (error) throw error;
      }

      const msg = mergedCount > 0
        ? `Imported ${rowsToInsert.length} new transaction${rowsToInsert.length !== 1 ? 's' : ''} and merged ${mergedCount} into existing transfer placeholder${mergedCount !== 1 ? 's' : ''}!`
        : `Successfully imported ${transactions.length} transactions!`;
      notify(msg);
      setShowUploadModal(false);
      loadData();
    } catch (err) {
      console.error('Error importing transactions:', err);
      notify(`Failed to import transactions: ${err.message}`);
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

  async function handleClearCategorized() {
    // Find all uncleared transactions that have a category, are linked, OR
    // are a transfer with its destination account picked. Transfers use
    // transfer_account_id instead of category, so without this check they
    // silently never qualified for bulk clearing here.
    const eligible = transactions.filter(t =>
      !t.is_cleared && (
        t.category || t.linked_invoice_id || t.linked_expense_id || t.linked_bill_id ||
        (t.transaction_type === 'transfer' && t.transfer_account_id)
      )
    );
    if (eligible.length === 0) {
      notify('No uncleared transactions with a category assigned.');
      return;
    }
    if (!await confirmDialog(`Auto-clear ${eligible.length} transaction${eligible.length !== 1 ? 's' : ''} that have a category selected?`)) return;

    setIsClearing(true);
    setBulkStatusMsg(`⏳ Auto-clearing ${eligible.length} categorized transactions…`);
    let successCount = 0;
    let errorCount = 0;

    try {
      for (const transaction of eligible) {
        try {
          await handleToggleCleared(transaction, true);
          successCount++;
        } catch (err) {
          console.error(`Error clearing transaction ${transaction.id}:`, err);
          errorCount++;
        }
      }

      if (successCount > 0) {
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

      const msg = `✅ ${successCount} transaction${successCount !== 1 ? 's' : ''} auto-cleared${errorCount > 0 ? ` · ${errorCount} failed` : ''}`;
      setBulkStatusMsg(msg);
      setTimeout(() => setBulkStatusMsg(''), 6000);
    } catch (err) {
      console.error('Error in auto-clear:', err);
      setBulkStatusMsg('❌ Error during auto-clear');
      setTimeout(() => setBulkStatusMsg(''), 6000);
    } finally {
      setIsClearing(false);
    }
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

  // Shared category dropdown options — used by all three "Select Account"
  // category pickers so they stay in sync. Puts your most-frequently-used
  // categories in a "⭐ Most Used" optgroup at the top, then the complete,
  // unfiltered list below exactly as before — nothing is hidden, you just
  // don't have to scroll past 60 accounts for the 8 you actually use.
  function renderCategoryOptions() {
    const topAccounts = topCategoryIds
      .map(id => accounts.find(a => a.id === id))
      .filter(Boolean);

    return (
      <>
        {topAccounts.length > 0 && (
          <optgroup label="⭐ Most Used">
            {topAccounts.map(account => (
              <option key={`top-${account.id}`} value={account.id}>
                {account.account_number} - {account.account_name}
              </option>
            ))}
          </optgroup>
        )}
        <optgroup label="All Accounts">
          {accounts.map(account => (
            <option key={account.id} value={account.id}>
              {account.account_number} - {account.account_name}
            </option>
          ))}
        </optgroup>
      </>
    );
  }

  if (loading) {
    return (
      <div style={{ ...styles.container, backgroundColor: BRAND.bg }}>
        <div style={styles.loading}>Loading transactions...</div>
      </div>
    );
  }

  if (!bankAccount) {
    return (
      <div style={{ ...styles.container, backgroundColor: BRAND.bg }}>
        <div style={styles.error}>Bank account not found</div>
      </div>
    );
  }

  const runningBalances = calculateRunningBalance(transactions);
  const unclearedFiltered = filteredTransactions.filter(t => !t.is_cleared);
  const clearedFiltered = filteredTransactions.filter(t => t.is_cleared);

  // Match Review queue: UNCLEARED, unlinked transactions that have at least one candidate match
  const reviewQueue = transactions.filter(t =>
    !t.is_cleared && !t.linked_expense_id && !t.linked_invoice_id && !t.transfer_pair_id && getMatchCount(t) > 0
  );
  const currentReviewTx = reviewQueue[matchReviewIndex] || null;
  const reviewExpMatches = currentReviewTx
    ? getMatchingExpenses(currentReviewTx).map(e => ({...e, _type: 'expense'}))
    : [];
  const reviewInvMatches = currentReviewTx
    ? getMatchingInvoices(currentReviewTx).map(i => ({...i, _type: 'invoice'}))
    : [];
  const reviewPmtMatches = currentReviewTx
    ? getMatchingInvoicePayments(currentReviewTx).map(p => ({...p, _type: 'payment'}))
    : [];
  // Transfer matches are listed LAST — expense/invoice/payment matches carry
  // stronger evidence (vendor/customer name, linked records), so if a
  // transaction happens to score against both, the more reliable candidate
  // is shown first by default.
  const reviewXferMatches = currentReviewTx
    ? getMatchingTransfers(currentReviewTx).map(x => ({...x, _type: 'transfer'}))
    : [];
  const reviewCandidates = [...reviewExpMatches, ...reviewInvMatches, ...reviewPmtMatches, ...reviewXferMatches];
  const safeCandIdx = Math.min(matchCandidateIndex, Math.max(0, reviewCandidates.length - 1));
  const currentCandidate = reviewCandidates[safeCandIdx] || null;

  // Match Review actions
  async function confirmReviewMatch() {
    if (!currentReviewTx || !currentCandidate) return;
    if (currentCandidate._type === 'expense') {
      await handleLinkExpense(currentReviewTx.id, currentCandidate.id);
    } else if (currentCandidate._type === 'payment') {
      // Link bank transaction to the invoice this payment belongs to
      await handleLinkInvoice(currentReviewTx.id, currentCandidate.invoice_id);
    } else if (currentCandidate._type === 'transfer') {
      // Label both sides as a linked transfer. Neither side is cleared here —
      // clearing (and the single shared journal entry) still happens through
      // the normal clear flow, per-account, same as any other transaction.
      await supabase.from('bank_transactions').update({
        transaction_type: 'transfer',
        transfer_account_id: currentCandidate.bank_account_id,
        transfer_pair_id: currentCandidate.id
      }).eq('id', currentReviewTx.id);
      await supabase.from('bank_transactions').update({
        transaction_type: 'transfer',
        transfer_account_id: accountId,
        transfer_pair_id: currentReviewTx.id
      }).eq('id', currentCandidate.id);
      notify('✅ Linked as a transfer. Clear it from either account to record the journal entry.');
      await loadData();
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
          : currentCandidate._type === 'payment'
            ? ((currentCandidate.net_amount != null && parseFloat(currentCandidate.net_amount) > 0)
                ? parseFloat(currentCandidate.net_amount)
                : (parseFloat(currentCandidate.processing_fee || 0) > 0
                    ? (parseFloat(currentCandidate.amount) || 0) - parseFloat(currentCandidate.processing_fee)
                    : parseFloat(currentCandidate.amount) || 0))
            : currentCandidate._type === 'transfer'
              ? (currentCandidate.amount || 0)
              : (currentCandidate.net_deposit_amount || currentCandidate.total_amount || 0))
      )
    : 0;
  const isExactReviewMatch = reviewAmountDiff < 0.01;
  const isCloseReviewMatch = !isExactReviewMatch && reviewAmountDiff <= 0.02;
  const totalDeposits = transactions.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
  const totalWithdrawals = Math.abs(transactions.filter(t => t.amount < 0).reduce((sum, t) => sum + t.amount, 0));
  const clearedBalance = bankAccount.current_balance || 0;
  const unclearedAmount = transactions.filter(t => !t.is_cleared).reduce((sum, t) => sum + t.amount, 0);

  return (
    <div style={{ ...styles.container, backgroundColor: BRAND.bg }}>
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
            onClick={handleClearCategorized}
            disabled={isClearing}
            style={{...styles.newButton, backgroundColor: '#0ea5e9'}}
            title="Auto-clear all uncleared transactions that have a category selected"
          >
            ⚡ Clear Categorized
          </button>
          <button 
            onClick={async () => {
              console.log('Refreshing account balances...');
              await loadExpensesAndInvoices();
              notify('✅ Account balances refreshed!');
            }} 
            style={{...styles.newButton, backgroundColor: '#8b5cf6'}}
          >
            🔄 Refresh Balances
          </button>
          <button onClick={() => setShowUploadModal(true)} style={styles.uploadButton}>
            📤 Upload CSV
          </button>
          <button onClick={() => setShowStatementArchive(true)} style={{...styles.uploadButton, backgroundColor: '#0891b2'}}>
            🗄️ Statement Archive
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

      {/* ── Uncleared Transactions Section Header ── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '14px 20px',
        marginTop: 8,
        marginBottom: 0,
        backgroundColor: '#b45309',
        borderRadius: unclearedFiltered.length === 0 ? 12 : '12px 12px 0 0',
        color: '#fff',
        userSelect: 'none',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>🔲</span>
          <span style={{ fontSize: 17, fontWeight: 700 }}>Uncleared Transactions</span>
          <span style={{
            fontSize: 13, fontWeight: 600,
            backgroundColor: 'rgba(255,255,255,0.25)',
            borderRadius: 20, padding: '2px 10px'
          }}>
            {unclearedFiltered.length}
          </span>
        </span>
        <span style={{ fontSize: 13, opacity: 0.85 }}>
          Select rows + click <strong>✅ Clear Selected</strong> to move to Cleared folder
        </span>
      </div>

      {/* ── Uncleared Transactions (Main View) ── */}
      {unclearedFiltered.length === 0 ? (
        <div style={{...styles.empty, borderRadius: '0 0 12px 12px', marginBottom: 0}}>
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
                          notify('Failed to update payee');
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
                    {transaction.transaction_type === 'transfer' ? (
                      <select
                        value={transaction.transfer_account_id || ''}
                        onChange={async (e) => {
                          const newTransferAccountId = e.target.value || null;
                          try {
                            const { error } = await supabase
                              .from('bank_transactions')
                              .update({ transfer_account_id: newTransferAccountId, category: null })
                              .eq('id', transaction.id);
                            if (error) throw error;

                            setTransactions(prev => prev.map(t =>
                              t.id === transaction.id ? {...t, transfer_account_id: newTransferAccountId, category: null} : t
                            ));
                          } catch (err) {
                            console.error('Error updating transfer account:', err);
                            notify('Failed to update transfer account');
                          }
                        }}
                        style={styles.categorySelect}
                        onClick={(e) => e.stopPropagation()}
                        title="Which account did this money transfer to/from?"
                      >
                        <option value="">🔄 Transfer to/from...</option>
                        {transferAccounts.map(acct => (
                          <option key={acct.id} value={acct.id}>
                            {acct.account_name}{acct.bank_name ? ` (${acct.bank_name})` : ''}
                          </option>
                        ))}
                      </select>
                    ) : (
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
                            notify('Failed to update category');
                          }
                        }}
                        style={styles.categorySelect}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <option value="">-- Select Account --</option>
                        {renderCategoryOptions()}
                      </select>
                    )}
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
                          notify('Failed to update project');
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
                        transaction.linked_expense_id || transaction.linked_invoice_id || transaction.linked_bill_id
                          ? 'Linked to expense/invoice/bill - Click to view'
                          : getMatchCount(transaction) > 0 
                            ? `${getMatchCount(transaction)} potential match${getMatchCount(transaction) > 1 ? 'es' : ''} found`
                            : 'No matches found'
                      }
                    >
                      {transaction.linked_expense_id || transaction.linked_invoice_id || transaction.linked_bill_id ? '🔗' : getMatchCount(transaction) > 0 ? '✅' : '❌'}
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
                        onClick={() => onClickClearButton(transaction)}
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
                          notify('Failed to update payee');
                        }
                      }}
                      list="vendors-datalist-inline"
                      style={styles.inlineInput}
                      placeholder="-"
                    />
                  </td>
                  <td style={styles.td}>{transaction.reference_number || '-'}</td>
                  <td style={styles.td}>
                    {transaction.transaction_type === 'transfer' ? (
                      <span title="Linked transfer">
                        🔄 {transferAccounts.find(a => a.id === transaction.transfer_account_id)?.account_name || 'Transfer'}
                      </span>
                    ) : (
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
                          notify('Failed to update category');
                        }
                      }}
                      style={styles.categorySelect}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <option value="">-- Select Account --</option>
                      {renderCategoryOptions()}
                    </select>
                    )}
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
                          notify('Failed to update project');
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
                        transaction.linked_expense_id || transaction.linked_invoice_id || transaction.linked_bill_id
                          ? 'Linked to expense/invoice/bill - Click to view'
                          : getMatchCount(transaction) > 0
                            ? `${getMatchCount(transaction)} potential match${getMatchCount(transaction) > 1 ? 'es' : ''} found`
                            : 'No matches found'
                      }
                    >
                      {transaction.linked_expense_id || transaction.linked_invoice_id || transaction.linked_bill_id ? '🔗' : getMatchCount(transaction) > 0 ? '✅' : '❌'}
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
                        onClick={() => onClickClearButton(transaction)}
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
                    backgroundColor: currentCandidate._type === 'expense' ? '#dc2626' : currentCandidate._type === 'payment' ? '#7c3aed' : currentCandidate._type === 'transfer' ? '#2563eb' : '#059669'
                  }}>
                    {currentCandidate._type === 'expense' ? '💸 Expense Record' : currentCandidate._type === 'payment' ? '💳 Invoice Payment Record' : currentCandidate._type === 'transfer' ? '🔄 Transfer (Other Bank Account)' : '📄 Invoice Record'}
                  </div>
                  <div style={styles.matchReviewCardBody}>
                    {currentCandidate._type === 'transfer' ? (
                      <>
                        <div style={styles.matchReviewField}>
                          <span style={styles.matchReviewLabel}>Bank Account</span>
                          <span style={{...styles.matchReviewValue, color: '#2563eb', fontWeight: 700}}>
                            {transferAccounts.find(a => a.id === currentCandidate.bank_account_id)?.account_name || 'Other account'}
                          </span>
                        </div>
                        <div style={styles.matchReviewField}>
                          <span style={styles.matchReviewLabel}>Amount</span>
                          <span style={{
                            ...styles.matchReviewValue, fontSize: 22, fontWeight: 700,
                            color: currentCandidate.amount < 0 ? '#ef4444' : '#10b981'
                          }}>
                            {formatCurrency(currentCandidate.amount)}
                          </span>
                        </div>
                        <div style={styles.matchReviewField}>
                          <span style={styles.matchReviewLabel}>Date</span>
                          <span style={styles.matchReviewValue}>{formatDate(currentCandidate.transaction_date)}</span>
                        </div>
                        <div style={styles.matchReviewField}>
                          <span style={styles.matchReviewLabel}>Description</span>
                          <span style={styles.matchReviewValue}>{currentCandidate.description || '—'}</span>
                        </div>
                        <div style={{marginTop: 8, padding: '10px 12px', backgroundColor: '#dbeafe', borderRadius: 6, fontSize: 12, color: '#1e40af'}}>
                          ⚠️ Confirming links this as a transfer between your own accounts (asset-to-asset — never counted as income or expense). Neither side is cleared automatically; clear each one as you reconcile that account.
                        </div>
                      </>
                    ) : currentCandidate._type === 'payment' ? (
                      <>
                        <div style={styles.matchReviewField}>
                          <span style={styles.matchReviewLabel}>Type</span>
                          <span style={{...styles.matchReviewValue, color: '#7c3aed', fontWeight: 700}}>💳 Invoice Payment (already in books)</span>
                        </div>
                        <div style={styles.matchReviewField}>
                          <span style={styles.matchReviewLabel}>Gross Amount</span>
                          <span style={{...styles.matchReviewValue, fontSize: 18, fontWeight: 700, color: '#10b981'}}>
                            {formatCurrency(currentCandidate.amount)}
                          </span>
                        </div>
                        {currentCandidate.processing_fee > 0 && (
                          <div style={styles.matchReviewField}>
                            <span style={styles.matchReviewLabel}>Processing Fee</span>
                            <span style={{...styles.matchReviewValue, color: '#ef4444'}}>-{formatCurrency(currentCandidate.processing_fee)}</span>
                          </div>
                        )}
                        <div style={styles.matchReviewField}>
                          <span style={styles.matchReviewLabel}>Net Deposited</span>
                          <span style={{...styles.matchReviewValue, fontSize: 22, fontWeight: 700, color: '#10b981'}}>
                            {formatCurrency(
                              currentCandidate.net_amount != null && parseFloat(currentCandidate.net_amount) > 0
                                ? currentCandidate.net_amount
                                : parseFloat(currentCandidate.processing_fee || 0) > 0
                                  ? (parseFloat(currentCandidate.amount) || 0) - parseFloat(currentCandidate.processing_fee)
                                  : currentCandidate.amount
                            )}
                          </span>
                        </div>
                        <div style={styles.matchReviewField}>
                          <span style={styles.matchReviewLabel}>Payment Date</span>
                          <span style={styles.matchReviewValue}>{formatDate(currentCandidate.payment_date)}</span>
                        </div>
                        <div style={{marginTop: 8, padding: '10px 12px', backgroundColor: '#f3e8ff', borderRadius: 6, fontSize: 12, color: '#6b21a8'}}>
                          ⚠️ Confirming this match will link the bank deposit to the invoice without creating a duplicate journal entry.
                        </div>
                      </>
                    ) : currentCandidate._type === 'expense' ? (
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
              {(selectedTransaction.linked_expense_id || selectedTransaction.linked_invoice_id || selectedTransaction.linked_bill_id) && (
                <div style={{...styles.linkedSection, backgroundColor: '#dcfce7', borderColor: '#10b981'}}>
                  <h3 style={{...styles.sectionTitle, color: '#059669'}}>✓ Currently Linked</h3>
                  {selectedTransaction.linked_bill_id && (
                    <div style={styles.linkedItem}>
                      <div>
                        <strong>Bill:</strong> {bills.find(b => b.id === selectedTransaction.linked_bill_id)?.vendor_name || 'Unknown'}
                        <br />
                        <span style={{fontSize: 13, color: '#666'}}>
                          {formatDate(bills.find(b => b.id === selectedTransaction.linked_bill_id)?.paid_date)} -
                          {formatCurrency(bills.find(b => b.id === selectedTransaction.linked_bill_id)?.total_amount)}
                        </span>
                      </div>
                      <button
                        onClick={() => handleLinkBill(selectedTransaction.id, null)}
                        style={styles.unlinkButton}
                      >
                        🔗 Unlink
                      </button>
                    </div>
                  )}
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
                  {linkedInvoices.length > 1 ? (
                    <>
                      {linkedInvoices.map(row => (
                        <div key={row.invoice_id} style={styles.linkedItem}>
                          <div>
                            <strong>Invoice:</strong> #{row.invoice?.invoice_number || 'Unknown'}
                            <br />
                            <span style={{fontSize: 13, color: '#666'}}>
                              {formatDate(row.invoice?.invoice_date)} - {formatCurrency(row.amount_applied)}
                            </span>
                          </div>
                        </div>
                      ))}
                      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8}}>
                        <span style={{fontSize: 13, color: '#666'}}>
                          {linkedInvoices.length} invoices — total {formatCurrency(linkedInvoices.reduce((s, r) => s + (parseFloat(r.amount_applied) || 0), 0))}
                        </span>
                        <button
                          onClick={() => handleUnlinkAllInvoices(selectedTransaction)}
                          style={styles.unlinkButton}
                        >
                          🔗 Unlink All
                        </button>
                      </div>
                    </>
                  ) : selectedTransaction.linked_invoice_id && (
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

              {/* Matching Bills */}
              {getMatchingBills(selectedTransaction).length > 0 && (
                <div style={styles.matchesSection}>
                  <h3 style={styles.sectionTitle}>
                    📄 Matching Bills ({getMatchingBills(selectedTransaction).length})
                  </h3>
                  <div style={styles.matchesList}>
                    {getMatchingBills(selectedTransaction).map(bill => (
                      <div
                        key={bill.id}
                        style={{
                          ...styles.matchCard,
                          backgroundColor: selectedTransaction.linked_bill_id === bill.id ? '#dcfce7' : '#fff'
                        }}
                      >
                        <div style={styles.matchCardContent}>
                          <div style={styles.matchCardHeader}>
                            <strong style={{fontSize: 16}}>{bill.vendor_name || 'Unknown Vendor'}</strong>
                            <span style={{fontSize: 18, fontWeight: 'bold', color: '#ef4444'}}>
                              {formatCurrency(bill.total_amount)}
                            </span>
                          </div>
                          <div style={styles.matchCardDetails}>
                            <div>📅 Paid: {formatDate(bill.paid_date)}</div>
                            {bill.payment_method && (
                              <div>💳 {bill.payment_method === 'check' ? 'Check' : bill.payment_method.replace('_', ' ')}
                                {bill.payment_reference ? ` #${bill.payment_reference}` : ''}
                              </div>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => handleLinkBill(selectedTransaction.id, bill.id)}
                          style={{
                            ...styles.linkButton,
                            backgroundColor: selectedTransaction.linked_bill_id === bill.id ? '#9ca3af' : '#fc6b04'
                          }}
                          disabled={selectedTransaction.linked_bill_id === bill.id}
                        >
                          {selectedTransaction.linked_bill_id === bill.id ? '✓ Linked' : '🔗 Link'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Matching Invoices/Payments */}
              {getMatchingInvoiceLines(selectedTransaction).length > 0 && (
                <div style={styles.matchesSection}>
                  <h3 style={styles.sectionTitle}>
                    💰 Matching Invoices ({getMatchingInvoiceLines(selectedTransaction).length})
                    {selectedTransaction.amount > 0 && (
                      <span style={{fontSize: 12, fontWeight: 400, color: '#666', marginLeft: 8}}>
                        — check multiple to split a deposit across invoices
                      </span>
                    )}
                  </h3>
                  <div style={styles.matchesList}>
                    {getMatchingInvoiceLines(selectedTransaction).map(line => (
                      <label
                        key={line.key}
                        style={{
                          ...styles.matchCard,
                          backgroundColor: multiSelectLineKeys.has(line.key) ? '#dcfce7' : '#fff',
                          cursor: 'pointer'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={multiSelectLineKeys.has(line.key)}
                          onChange={() => toggleMultiSelectLine(line.key)}
                          style={{width: 18, height: 18, marginRight: 12, cursor: 'pointer'}}
                        />
                        <div style={styles.matchCardContent}>
                          <div style={styles.matchCardHeader}>
                            <strong style={{fontSize: 16}}>Invoice #{line.invoice?.invoice_number}</strong>
                            <span style={{fontSize: 18, fontWeight: 'bold', color: '#10b981'}}>
                              {formatCurrency(line.netAmount)}
                              {line.fee > 0 && (
                                <span style={{fontSize: 12, color: '#666', marginLeft: 6, fontWeight: 400}}>
                                  (gross {formatCurrency(line.grossAmount)} − {formatCurrency(line.fee)} fee)
                                </span>
                              )}
                            </span>
                          </div>
                          <div style={styles.matchCardDetails}>
                            <div>📅 {formatDate(line.lineDate)}</div>
                            {line.type === 'payment' && <div>💳 Payment #{line.payment.id.slice(0, 8)}</div>}
                            {line.invoice?.customer_id && <div>👤 Customer: {line.invoice.customer_id}</div>}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* No Matches - show manual link list */}
              {getMatchCount(selectedTransaction) === 0 && !selectedTransaction.linked_expense_id && !selectedTransaction.linked_invoice_id && !selectedTransaction.linked_bill_id && (
                <div>
                  <div style={{textAlign: 'center', padding: '20px 0 16px'}}>
                    <div style={{fontSize: 36, marginBottom: 8}}>🔍</div>
                    <p style={{fontSize: 14, color: '#666', margin: '0 0 4px'}}>
                      No automatic match found for <strong>{formatCurrency(selectedTransaction.amount)}</strong>
                    </p>
                    {selectedTransaction.amount < 0 ? (
                      <>
                        <p style={{fontSize: 13, color: '#999', margin: '0 0 12px'}}>
                          This is a withdrawal — record it to the books, or manually link an invoice below if it's actually a customer payment.
                        </p>
                        <button
                          onClick={() => {
                            setShowMatchesModal(false);
                            setRecordToBooksTransaction(selectedTransaction);
                            setRecordToBooksCategory(selectedTransaction.category || '');
                            setShowRecordToBooksModal(true);
                          }}
                          style={{...styles.linkButton, backgroundColor: '#10b981'}}
                        >
                          💸 Create Expense / Record to Books
                        </button>
                      </>
                    ) : (
                      <p style={{fontSize: 13, color: '#999', margin: 0}}>
                        Manually link this transaction to one or more invoices below — check multiple to split a deposit across invoices:
                      </p>
                    )}
                  </div>
                  <div style={{...styles.matchesSection, marginBottom: 0}}>
                    <h3 style={styles.sectionTitle}>💰 All Invoices — Manual Link</h3>
                    <div style={{maxHeight: 400, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10}}>
                      {getAllInvoiceLines().length === 0 ? (
                        <p style={{color: '#999', fontSize: 14, padding: 12}}>No invoices found.</p>
                      ) : (
                        getAllInvoiceLines().map(line => (
                          <label
                            key={line.key}
                            style={{
                              ...styles.matchCard,
                              backgroundColor: multiSelectLineKeys.has(line.key) ? '#dcfce7' : '#fff',
                              alignItems: 'center',
                              cursor: 'pointer'
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={multiSelectLineKeys.has(line.key)}
                              onChange={() => toggleMultiSelectLine(line.key)}
                              style={{width: 18, height: 18, marginRight: 12, cursor: 'pointer'}}
                            />
                            <div style={styles.matchCardContent}>
                              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                                <strong style={{fontSize: 15}}>Invoice #{line.invoice?.invoice_number}</strong>
                                <span style={{fontWeight: 700, color: '#10b981', fontSize: 15}}>
                                  {formatCurrency(line.netAmount)}
                                  {line.fee > 0 && (
                                    <span style={{fontSize: 12, color: '#666', marginLeft: 6}}>
                                      (gross {formatCurrency(line.grossAmount)} − {formatCurrency(line.fee)} fee)
                                    </span>
                                  )}
                                </span>
                              </div>
                              <div style={{fontSize: 13, color: '#666', marginTop: 4}}>
                                📅 {formatDate(line.lineDate)}
                                {line.type === 'payment' && <span style={{marginLeft: 12}}>💳 Payment #{line.payment.id.slice(0, 8)}</span>}
                                {line.invoice?.customer_id && <span style={{marginLeft: 12}}>👤 {line.invoice.customer_id}</span>}
                              </div>
                            </div>
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Multi-select summary + Link action */}
              {selectedTransaction.amount > 0 && (getMatchingInvoiceLines(selectedTransaction).length > 0 || (getMatchCount(selectedTransaction) === 0 && !selectedTransaction.linked_expense_id)) && (
                <div style={{
                  position: 'sticky',
                  bottom: 0,
                  marginTop: 12,
                  padding: '12px 16px',
                  backgroundColor: '#f9fafb',
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12
                }}>
                  <div style={{fontSize: 13, color: '#374151'}}>
                    {multiSelectLineKeys.size === 0 ? (
                      <span style={{color: '#999'}}>No invoices selected</span>
                    ) : (
                      <>
                        <strong>{multiSelectLineKeys.size}</strong> item{multiSelectLineKeys.size > 1 ? 's' : ''} selected — {formatCurrency(getMultiSelectTotal())} net
                        {' '}of{' '}{formatCurrency(Math.abs(selectedTransaction.amount))}
                        {Math.abs(getMultiSelectTotal() - Math.abs(selectedTransaction.amount)) > 0.02 && (
                          <span style={{color: '#ef4444', marginLeft: 6}}>
                            ({formatCurrency(Math.abs(selectedTransaction.amount) - getMultiSelectTotal())} remaining)
                          </span>
                        )}
                        {getMultiSelectGrossTotal() !== getMultiSelectTotal() && (
                          <div style={{fontSize: 12, color: '#999', marginTop: 2}}>
                            {formatCurrency(getMultiSelectGrossTotal())} gross − {formatCurrency(getMultiSelectGrossTotal() - getMultiSelectTotal())} processing fees
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  <button
                    onClick={() => handleLinkMultipleInvoices(selectedTransaction)}
                    disabled={multiSelectLineKeys.size === 0 || Math.abs(getMultiSelectTotal() - Math.abs(selectedTransaction.amount)) > 0.02}
                    style={{
                      ...styles.linkButton,
                      backgroundColor: (multiSelectLineKeys.size === 0 || Math.abs(getMultiSelectTotal() - Math.abs(selectedTransaction.amount)) > 0.02) ? '#9ca3af' : '#10b981',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    🔗 Link {multiSelectLineKeys.size > 1 ? `${multiSelectLineKeys.size} Items` : 'Invoice'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* "Record to Books?" prompt — shown when clearing an unmatched,
          unlinked withdrawal. Lets the user choose whether this should also
          become a real, editable expenses row in addition to the journal
          entry that's always created. See onClickClearButton /
          handleRecordToBooksChoice. */}
      {showRecordToBooksModal && recordToBooksTransaction && (
        <div style={styles.modalOverlay} onClick={() => { setShowRecordToBooksModal(false); setRecordToBooksTransaction(null); }}>
          <div style={{...styles.modalContent, maxWidth: 480}} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>Record to Books?</h2>
              <button
                onClick={() => { setShowRecordToBooksModal(false); setRecordToBooksTransaction(null); }}
                style={styles.closeButton}
              >✕</button>
            </div>

            <div style={{padding: '0 24px 24px'}}>
              <p style={{fontSize: 14, color: '#666', margin: '0 0 16px'}}>
                No automatic match was found for this withdrawal. Choose how it should be recorded:
              </p>

              <div style={{background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 14, marginBottom: 16}}>
                <div style={{display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 6}}>
                  <span style={{color: '#666'}}>Date</span>
                  <strong>{formatDate(recordToBooksTransaction.transaction_date)}</strong>
                </div>
                <div style={{display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 6}}>
                  <span style={{color: '#666'}}>Amount</span>
                  <strong style={{color: '#ef4444'}}>{formatCurrency(recordToBooksTransaction.amount)}</strong>
                </div>
                <div style={{display: 'flex', justifyContent: 'space-between', fontSize: 14}}>
                  <span style={{color: '#666'}}>Payee</span>
                  <strong>{recordToBooksTransaction.payee || recordToBooksTransaction.description || '—'}</strong>
                </div>
              </div>

              <label style={{display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6}}>Category</label>
              <select
                value={recordToBooksCategory}
                onChange={(e) => setRecordToBooksCategory(e.target.value)}
                style={{...styles.categorySelect, width: '100%', marginBottom: 20}}
              >
                <option value="">-- Select Account --</option>
                {renderCategoryOptions()}
              </select>

              <div style={{display: 'flex', flexDirection: 'column', gap: 10}}>
                <button
                  onClick={() => handleRecordToBooksChoice('expense')}
                  style={{...styles.linkButton, backgroundColor: '#10b981', width: '100%'}}
                >
                  💸 Create Expense + Journal Entry
                </button>
                <button
                  onClick={() => handleRecordToBooksChoice('journal-only')}
                  style={{...styles.linkButton, backgroundColor: '#3b82f6', width: '100%'}}
                >
                  📖 Journal Entry Only
                </button>
                <button
                  onClick={() => handleRecordToBooksChoice('skip')}
                  style={{...styles.linkButton, backgroundColor: '#9ca3af', width: '100%'}}
                >
                  ❌ Just Clear It — No Books Impact
                </button>
              </div>
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
              transferAccounts={transferAccounts}
              onImportComplete={handleImportTransactions}
            />
          </div>
        </div>
      )}

      {/* Statement Archive Modal — original PDF/image/CSV files kept for
          audits/disputes/CPA requests, separate from importing transactions above */}
      {showStatementArchive && (
        <div style={styles.modalOverlay} onClick={() => setShowStatementArchive(false)}>
          <div style={styles.uploadModalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>Bank Statement Archive</h2>
              <button onClick={() => setShowStatementArchive(false)} style={styles.closeButton}>
                ×
              </button>
            </div>
            <BankStatementArchive bankAccountId={accountId} />
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
                {transactionForm.transaction_type === 'transfer' ? (
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Transfer To/From Account *</label>
                    <select
                      value={transactionForm.transfer_account_id}
                      onChange={(e) => setTransactionForm({...transactionForm, transfer_account_id: e.target.value})}
                      style={styles.input}
                    >
                      <option value="">-- Select bank account --</option>
                      {transferAccounts.map(acct => (
                        <option key={acct.id} value={acct.id}>
                          {acct.account_name}{acct.bank_name ? ` (${acct.bank_name})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Category</label>
                    <select
                      value={transactionForm.category}
                      onChange={(e) => setTransactionForm({...transactionForm, category: e.target.value})}
                      style={styles.input}
                    >
                      <option value="">-- Select Account --</option>
                      {renderCategoryOptions()}
                    </select>
                  </div>
                )}
              </div>

              {transactionForm.transaction_type === 'transfer' && (
                <div style={styles.formRow}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Direction *</label>
                    <select
                      value={transactionForm.transfer_direction}
                      onChange={(e) => setTransactionForm({...transactionForm, transfer_direction: e.target.value})}
                      style={styles.input}
                    >
                      <option value="out">Money left THIS account (withdrawal)</option>
                      <option value="in">Money arrived in THIS account (deposit)</option>
                    </select>
                  </div>
                </div>
              )}

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
    backgroundColor: "#0b3ea8", // static fallback; overridden inline via BRAND.bg above
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

