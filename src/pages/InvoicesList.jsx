import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { createInvoicePaymentJournalEntry } from "../utils/accountingJournals";

export default function InvoicesList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [projectDeposits, setProjectDeposits] = useState({});
  const [cashAccounts, setCashAccounts] = useState([]);
  const [holdingAccounts, setHoldingAccounts] = useState([]);
  const [linkedInvoiceIds, setLinkedInvoiceIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [projectDepositsMap, setProjectDepositsMap] = useState({});
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    date: new Date().toISOString().split('T')[0],
    method: 'check',
    bank_account_id: '',
    deposit_type: 'bank', // 'bank' or 'holding_account'
    holding_account_id: '', // For alternative accounts like "Undeposited Funds" or "Previous Income"
    processing_fee: '',
    notes: ''
  });

  useEffect(() => {
    loadInvoices();
    loadCashAccounts();
    loadLinkedInvoices();
    loadHoldingAccounts().then(accounts => setHoldingAccounts(accounts));
  }, [user]);

  async function loadLinkedInvoices() {
    try {
      // Get all invoices that are linked to bank transactions
      const { data, error } = await supabase
        .from("bank_transactions")
        .select("linked_invoice_id")
        .not("linked_invoice_id", "is", null);

      if (error) throw error;
      
      const linkedIds = new Set(data.map(t => t.linked_invoice_id));
      setLinkedInvoiceIds(linkedIds);
    } catch (err) {
      console.error("Error loading linked invoices:", err);
    }
  }

  async function loadInvoices() {
    try {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("created_by", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      setInvoices(data || []);
    } catch (err) {
      console.error("Error loading invoices:", err);
      alert("Failed to load invoices");
    } finally {
      setLoading(false);
    }
  }

  async function loadCashAccounts() {
    try {
      const { data, error } = await supabase
        .from("bank_accounts")
        .select("*")
        .eq("company_id", user.id)
        .eq("is_active", true)
        .order("account_name");

      if (error) throw error;
      setCashAccounts(data || []);
    } catch (err) {
      console.error("Error loading bank accounts:", err);
    }
  }

  async function loadHoldingAccounts() {
    try {
      console.log("📥 Loading holding accounts for company:", user.id);
      
      // Strategy: Load ALL active accounts and show them as options
      // The user can filter from Chart of Accounts if needed
      const { data, error } = await supabase
        .from("accounts")
        .select("id, account_name, account_number, is_active, account_type");

      if (error) {
        console.error("❌ Error loading accounts from database:", error);
        // If query fails, return empty array so UI doesn't break
        return [];
      }

      console.log(`📊 Total accounts loaded: ${data?.length || 0}`);
      
      if (!data || data.length === 0) {
        console.warn("⚠️ No accounts found in database");
        return [];
      }

      // Return only active accounts
      const activeAccounts = data.filter(a => a.is_active === true);
      console.log(`✅ Active accounts available: ${activeAccounts.length}`, 
        activeAccounts.map(a => ({ name: a.account_name, type: a.account_type, number: a.account_number })));
      
      return activeAccounts;
    } catch (err) {
      console.error("❌ Error in loadHoldingAccounts:", err);
      return [];
    }
  }

  async function handleDelete(invoice) {
    if (!confirm(`Are you sure you want to delete invoice #${invoice.invoice_number}? This will also delete any associated journal entries.`)) {
      return;
    }

    try {
      console.log(`🗑️ Deleting invoice ${invoice.id} (#${invoice.invoice_number})...`);
      
      // Step 1: Find ALL journal entries linked to this invoice
      // Search by BOTH reference_id AND invoice number in description
      // (because createInvoiceJournalEntry stores invoice number in description field)
      const { data: allJournalEntries, error: journalError } = await supabase
        .from('journal_entries')
        .select('id, reference_type, reference_id, description')
        .or(`reference_id.eq.${invoice.id},description.ilike.%Invoice #${invoice.invoice_number}%`);

      if (journalError) {
        console.error('Error finding journal entries:', journalError);
      }

      if (allJournalEntries && allJournalEntries.length > 0) {
        console.log(`Found ${allJournalEntries.length} journal entries for invoice ${invoice.id} / #${invoice.invoice_number}`);
        
        const entryIds = allJournalEntries.map(e => e.id);
        console.log('Entry IDs to delete:', entryIds);
        
        // Step 2: Delete all journal entry lines first (prevents foreign key constraint errors)
        const { error: linesError } = await supabase
          .from('journal_entry_lines')
          .delete()
          .in('entry_id', entryIds);
        
        if (linesError) {
          console.error('Error deleting journal entry lines:', linesError);
        } else {
          console.log(`✅ Deleted journal entry lines`);
        }
        
        // Step 3: Delete the journal entries themselves
        const { error: entriesDeleteError } = await supabase
          .from('journal_entries')
          .delete()
          .in('id', entryIds);
        
        if (entriesDeleteError) {
          console.error('Error deleting journal entries:', entriesDeleteError);
          alert(`⚠️ Warning: Failed to delete journal entries: ${entriesDeleteError.message}`);
        } else {
          console.log(`✅ Deleted ${entryIds.length} journal entries`);
        }
      } else {
        console.log('No journal entries found for this invoice');
      }

      // Step 4: Delete invoice items
      const { error: itemsError } = await supabase
        .from('invoice_items')
        .delete()
        .eq('invoice_id', invoice.id);
      
      if (itemsError) {
        console.error('Error deleting invoice items:', itemsError);
      }
      
      // Step 5: Finally delete the invoice itself
      const { error: invoiceError } = await supabase
        .from('invoices')
        .delete()
        .eq('id', invoice.id);
      
      if (invoiceError) throw invoiceError;
      
      console.log(`✅ Invoice ${invoice.id} (#${invoice.invoice_number}) deleted successfully with all journal entries`);
      alert('Invoice deleted successfully! All associated journal entries have been removed.');
      loadInvoices(); // Reload the list
    } catch (err) {
      console.error('Error deleting invoice:', err);
      alert(`Failed to delete invoice: ${err.message}`);
    }
  }

  async function handleQuickPaid(invoice) {
    if (!confirm(`Mark invoice #${invoice.invoice_number} as paid in full?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('invoices')
        .update({
          payment_status: 'paid',
          amount_paid: invoice.total,
          payment_date: new Date().toISOString().split('T')[0],
          payment_method: 'check'
        })
        .eq('id', invoice.id);

      if (error) throw error;
      
      alert('Invoice marked as paid!');
      loadInvoices();
    } catch (err) {
      console.error('Error marking as paid:', err);
      alert(`Failed to mark as paid: ${err.message}`);
    }
  }

  async function openPaymentModal(invoice) {
    setSelectedInvoice(invoice);
    setPaymentForm({
      amount: invoice.total - (invoice.amount_paid || 0),
      date: new Date().toISOString().split('T')[0],
      method: 'check',
      bank_account_id: '',
      deposit_type: 'bank',
      holding_account_id: '',
      processing_fee: '',
      notes: ''
    });
    // Load holding accounts when opening modal
    const accounts = await loadHoldingAccounts();
    setHoldingAccounts(accounts);
    setShowPaymentModal(true);
  }

  async function handlePayment() {
    if (!paymentForm.amount || paymentForm.amount <= 0) {
      alert('Please enter a valid payment amount');
      return;
    }

    if (paymentForm.deposit_type === 'bank' && !paymentForm.bank_account_id) {
      alert('Please select which bank account this payment should be deposited into');
      return;
    }

    if (paymentForm.deposit_type === 'holding_account' && !paymentForm.holding_account_id) {
      alert('Please select which account to deposit this payment into');
      return;
    }

    try {
      const paymentAmount = parseFloat(paymentForm.amount);
      const processingFee = parseFloat(paymentForm.processing_fee) || 0;
      const netDepositAmount = paymentAmount - processingFee;
      
      if (processingFee < 0) {
        alert('Processing fee cannot be negative');
        return;
      }
      
      if (processingFee >= paymentAmount) {
        alert('Processing fee cannot be greater than or equal to payment amount');
        return;
      }

      const totalPaid = (selectedInvoice.amount_paid || 0) + paymentAmount;
      const paymentStatus = totalPaid >= selectedInvoice.total ? 'paid' : 'partial';
      const balanceDue = selectedInvoice.total - totalPaid;

      // **CRITICAL: Store whether invoice will be fully paid (before updating DB)**
      const invoiceWillBePaid = paymentStatus === 'paid';
      const depositAmountToClare = selectedInvoice.deposit_received || 0;

      // When invoice is fully paid, clear the deposit_received field
      const updateData = {
        payment_status: paymentStatus,
        amount_paid: totalPaid,
        balance_due: balanceDue,
        payment_date: paymentForm.date,
        payment_method: paymentForm.method,
        processing_fee: processingFee,
        net_deposit_amount: netDepositAmount,
        bank_account_id: paymentForm.bank_account_id || null
      };

      // If invoice is now fully paid, clear the deposit so it doesn't show as outstanding
      if (paymentStatus === 'paid') {
        updateData.deposit_received = 0;
        updateData.deposit_date = null;
      }

      const { error } = await supabase
        .from('invoices')
        .update(updateData)
        .eq('id', selectedInvoice.id);

      if (error) throw error;

      // Auto-create journal entry for invoice payment with fee handling
      if (paymentForm.bank_account_id || paymentForm.holding_account_id) {
        // Get the AR account
        const { data: arAccount, error: arError } = await supabase
          .from('accounts')
          .select('id')
          .eq('account_number', '1100')
          .maybeSingle();

        if (arError) {
          console.error('Error fetching AR account:', arError);
          alert(`Payment recorded but journal entry failed: ${arError.message}`);
          setShowPaymentModal(false);
          setSelectedInvoice(null);
          loadInvoices();
          return;
        }

        if (!arAccount) {
          alert('Payment recorded, but Accounts Receivable account (1100) not found. Please create it in Chart of Accounts.');
          setShowPaymentModal(false);
          setSelectedInvoice(null);
          loadInvoices();
          return;
        }

        // Determine the deposit account (either bank or holding account)
        let depositAccountId = null;
        if (paymentForm.deposit_type === 'bank') {
          const { data: bankAccountRecord, error: bankAcctError } = await supabase
            .from('bank_accounts')
            .select('chart_account_id')
            .eq('id', paymentForm.bank_account_id)
            .single();

          if (bankAcctError || !bankAccountRecord?.chart_account_id) {
            console.error('Error fetching bank account:', bankAcctError);
            alert('Payment recorded, but bank account not linked to Chart of Accounts. Please link it first.');
            setShowPaymentModal(false);
            setSelectedInvoice(null);
            loadInvoices();
            return;
          }
          depositAccountId = bankAccountRecord.chart_account_id;
        } else {
          // Using holding account (like Undeposited Funds or Previous Income)
          const { data: holdingAccount, error: holdingError } = await supabase
            .from('accounts')
            .select('id')
            .eq('id', paymentForm.holding_account_id)
            .single();

          if (holdingError || !holdingAccount?.id) {
            console.error('Error fetching holding account:', holdingError);
            alert('Payment recorded, but holding account not found. Please check your selection.');
            setShowPaymentModal(false);
            setSelectedInvoice(null);
            loadInvoices();
            return;
          }
          depositAccountId = holdingAccount.id;
        }

        // If there's a processing fee, use the Bank/App Transfer Fees account (7610)
        let processingFeeAccountId = null;
        if (processingFee > 0) {
          const { data: feeAccount, error: feeError } = await supabase
            .from('accounts')
            .select('id')
            .eq('account_number', '7610')
            .maybeSingle();

          if (feeError) {
            console.error('Error fetching bank/app transfer fees account:', feeError);
            alert('Payment recorded, but could not find Bank/App Transfer Fees account (7610). Fee not recorded in journal entry.');
          } else if (!feeAccount) {
            alert('Payment recorded, but Bank/App Transfer Fees account (7610) not found in Chart of Accounts. Please create it or processing fees won\'t be recorded.');
          } else {
            processingFeeAccountId = feeAccount.id;
          }
        }

        // Create journal entry
        const { data: lastEntry } = await supabase
          .from('journal_entries')
          .select('entry_number')
          .eq('company_id', user.id)
          .order('entry_number', { ascending: false })
          .limit(1)
          .maybeSingle();

        const nextEntryNumber = (lastEntry?.entry_number || 0) + 1;

        const depositAccountDescription = paymentForm.deposit_type === 'holding_account' ? 'Payment held pending deposit' : 'Payment deposited to bank';

        const journalEntry = {
          entry_number: nextEntryNumber,
          entry_date: paymentForm.date,
          description: `Payment received for Invoice #${selectedInvoice.invoice_number}${processingFee > 0 ? ` (Fee: ${formatCurrency(processingFee)})` : ''}`,
          reference_type: 'invoice_payment',
          reference_id: selectedInvoice.id,
          created_by: user.id,
          company_id: user.id
        };

        const { data: newEntry, error: entryError } = await supabase
          .from('journal_entries')
          .insert([journalEntry])
          .select()
          .single();

        if (entryError) {
          console.error('Failed to create journal entry:', entryError);
          alert(`Payment recorded but journal entry failed: ${entryError.message}`);
        } else if (newEntry) {
          // Create journal entry lines
          const lines = [
            {
              entry_id: newEntry.id,
              line_number: 1,
              account_id: depositAccountId,
              debit: netDepositAmount, // Net amount deposited (after fee)
              credit: 0,
              description: depositAccountDescription
            },
            {
              entry_id: newEntry.id,
              line_number: 2,
              account_id: arAccount.id,
              debit: 0,
              credit: paymentAmount, // Full payment amount
              description: 'Payment applied to AR'
            }
          ];

          // Add processing fee line if applicable
          if (processingFee > 0 && processingFeeAccountId) {
            lines.splice(1, 0, {
              entry_id: newEntry.id,
              line_number: 2,
              account_id: processingFeeAccountId,
              debit: processingFee, // Fee as expense
              credit: 0,
              description: `${paymentForm.method === 'venmo' ? 'Venmo' : paymentForm.method === 'paypal' ? 'PayPal' : 'Payment processing'} fee`
            });
          }

          const { error: linesError } = await supabase
            .from('journal_entry_lines')
            .insert(lines);

          if (linesError) {
            console.error('Failed to create journal entry lines:', linesError);
            alert(`Payment recorded but journal entry failed: ${linesError.message}`);
          } else {
            // Post the journal entry
            const { error: postError } = await supabase
              .rpc('post_journal_entry', {
                p_entry_id: newEntry.id,
                p_user_id: user.id
              });

            if (postError) {
              console.error('Failed to post journal entry:', postError);
              alert(`Payment recorded and journal entry created but not posted: ${postError.message}`);
            } else {
              console.log('✅ Payment recorded and journal entry posted');
              
              // **CRITICAL: If there's a deposit on this invoice AND it's now fully paid,
              // create an additional journal entry to clear the Unearned Revenue liability**
              if (paymentStatus === 'paid' && selectedInvoice.deposit_received && selectedInvoice.deposit_received > 0) {
                console.log(`💰 Invoice is fully paid with deposit of $${selectedInvoice.deposit_received}. Clearing Unearned Revenue...`);
                
                try {
                  // Get the Unearned Revenue account - try multiple search strategies
                  let unearnedRevenueAccount = null;
                  
                  // Strategy 1: Look for accounts with specific names
                  const { data: namedAccounts } = await supabase
                    .from('accounts')
                    .select('id, account_name')
                    .eq('company_id', user.id)
                    .eq('account_type', 'Liability')
                    .or(`account_name.ilike.%Unearned%,account_name.ilike.%Deferred%,account_name.ilike.%Deposit%,account_name.ilike.%Customer%`);

                  if (namedAccounts && namedAccounts.length > 0) {
                    unearnedRevenueAccount = namedAccounts[0];
                    console.log(`✅ Found Unearned Revenue account: ${unearnedRevenueAccount.account_name}`);
                  } else {
                    // Strategy 2: Just get any liability account as fallback
                    const { data: liabilityAccounts } = await supabase
                      .from('accounts')
                      .select('id, account_name')
                      .eq('company_id', user.id)
                      .eq('account_type', 'Liability')
                      .limit(1);
                    
                    if (liabilityAccounts && liabilityAccounts.length > 0) {
                      unearnedRevenueAccount = liabilityAccounts[0];
                      console.log(`⚠️ Using fallback liability account: ${unearnedRevenueAccount.account_name}`);
                    }
                  }

                  if (unearnedRevenueAccount?.id) {
                    // Create a second journal entry to clear the Unearned Revenue
                    const { data: lastEntry2 } = await supabase
                      .from('journal_entries')
                      .select('entry_number')
                      .eq('company_id', user.id)
                      .order('entry_number', { ascending: false })
                      .limit(1)
                      .maybeSingle();

                    const nextEntryNumber2 = (lastEntry2?.entry_number || 0) + 1;

                    const clearDepositEntry = {
                      entry_number: nextEntryNumber2,
                      entry_date: paymentForm.date,
                      description: `Clear deposit liability - Invoice #${selectedInvoice.invoice_number} fully paid`,
                      reference_type: 'invoice_payment',
                      reference_id: selectedInvoice.id,
                      created_by: user.id,
                      company_id: user.id
                    };

                    const { data: newEntry2, error: entryError2 } = await supabase
                      .from('journal_entries')
                      .insert([clearDepositEntry])
                      .select()
                      .single();

                    if (newEntry2 && !entryError2) {
                      // Create lines: Debit Unearned Revenue, Credit AR
                      // This moves the deposit from liability to eliminate the outstanding balance
                      const depositClearLines = [
                        {
                          entry_id: newEntry2.id,
                          line_number: 1,
                          account_id: unearnedRevenueAccount.id,
                          debit: selectedInvoice.deposit_received,
                          credit: 0,
                          description: 'Clear deposit liability'
                        },
                        {
                          entry_id: newEntry2.id,
                          line_number: 2,
                          account_id: arAccount.id,
                          debit: 0,
                          credit: selectedInvoice.deposit_received,
                          description: 'Offset deposit in AR'
                        }
                      ];

                      const { error: linesError2 } = await supabase
                        .from('journal_entry_lines')
                        .insert(depositClearLines);

                      if (!linesError2) {
                        // Post the deposit clearing entry
                        try {
                          await supabase.rpc('post_journal_entry', {
                            p_entry_id: newEntry2.id,
                            p_user_id: user.id
                          });
                          console.log(`✅ Deposit clearing entry posted. Unearned Revenue liability cleared!`);
                        } catch (postErr2) {
                          console.error('⚠️ Warning: Could not post deposit clearing entry:', postErr2);
                        }
                      }
                    }
                  }
                } catch (err) {
                  console.error('⚠️ Warning: Error creating deposit clearing entry:', err);
                  // Don't fail the main payment, just warn
                }
              }
              
              alert('Payment recorded successfully! Journal entry created. Bank balance will update when payment clears.');
            }
          }
        }
      } else {
        alert('Payment recorded successfully! (No bank account selected, so no journal entry was created)');
      }

      // Force a hard refresh to ensure payment status updates
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (err) {
      console.error('Error recording payment:', err);
      alert(`Failed to record payment: ${err.message}`);
    }
  }

  const filteredInvoices = invoices.filter(invoice => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = (
      invoice.invoice_number?.toLowerCase().includes(searchLower) ||
      invoice.customer_name?.toLowerCase().includes(searchLower) ||
      invoice.project_name?.toLowerCase().includes(searchLower) ||
      invoice.customer_email?.toLowerCase().includes(searchLower)
    );

    const matchesStatus = statusFilter === "all" || invoice.status === statusFilter;
    const matchesPayment = paymentFilter === "all" || invoice.payment_status === paymentFilter;

    return matchesSearch && matchesStatus && matchesPayment;
  });

  // Helper function to calculate true balance accounting for both payments and deposits
  const calculateTrueBalance = (invoice) => {
    const totalDeductions = (invoice.amount_paid || 0) + (invoice.deposit_received || 0);
    return Math.max(0, (invoice.total || 0) - totalDeductions);
  };

  // Helper function to determine payment status including deposits
  const getPaymentStatusWithDeposit = (invoice) => {
    const totalDeductions = (invoice.amount_paid || 0) + (invoice.deposit_received || 0);
    const balance = (invoice.total || 0) - totalDeductions;
    
    if (balance <= 0) {
      return 'paid';
    } else if (totalDeductions > 0) {
      return 'partial';
    } else {
      return 'unpaid';
    }
  };

  // Calculate summary statistics
  const stats = {
    total: invoices.length,
    draft: invoices.filter(i => i.status === 'draft').length,
    sent: invoices.filter(i => i.status === 'sent').length,
    paid: invoices.filter(i => i.status === 'paid').length,
    overdue: invoices.filter(i => i.status === 'overdue').length,
    partial: invoices.filter(i => i.status === 'partial').length,
    totalAmount: invoices.reduce((sum, i) => sum + (i.total || 0), 0),
    // Include both amount_paid AND deposits in totalPaid
    totalPaid: invoices.reduce((sum, i) => sum + (i.amount_paid || 0) + (i.deposit_received || 0), 0),
    // Calculate total outstanding accounting for both payments AND deposits
    totalOutstanding: invoices.reduce((sum, i) => {
      const totalDeductions = (i.amount_paid || 0) + (i.deposit_received || 0);
      return sum + Math.max(0, (i.total || 0) - totalDeductions);
    }, 0),
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
  };

  const formatCurrency = (amount) => {
    if (!amount) return '$0.00';
    return `$${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'paid': return '#10b981';
      case 'sent': return '#3b82f6';
      case 'partial': return '#f59e0b';
      case 'overdue': return '#ef4444';
      case 'draft':
      default: return '#6b7280';
    }
  };

  const getPaymentStatusColor = (paymentStatus) => {
    switch (paymentStatus) {
      case 'paid': return '#10b981';
      case 'partial': return '#f59e0b';
      case 'unpaid':
      default: return '#ef4444';
    }
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading invoices...</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Invoices</h1>
        <div style={styles.headerButtons}>
          <button 
            onClick={() => navigate('/invoice/quick')}
            style={styles.newButton}
          >
            + New Invoice
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div style={styles.statsContainer}>
        <div style={styles.statCard}>
          <div style={styles.statValue}>{stats.total}</div>
          <div style={styles.statLabel}>Total Invoices</div>
        </div>
        <div style={styles.statCard}>
          <div style={{...styles.statValue, color: '#10b981'}}>{formatCurrency(stats.totalPaid)}</div>
          <div style={styles.statLabel}>Total Paid</div>
        </div>
        <div style={styles.statCard}>
          <div style={{...styles.statValue, color: '#ef4444'}}>{formatCurrency(stats.totalOutstanding)}</div>
          <div style={styles.statLabel}>Outstanding</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statValue}>{formatCurrency(stats.totalAmount)}</div>
          <div style={styles.statLabel}>Total Invoiced</div>
        </div>
      </div>

      {/* Search and Filter */}
      <div style={styles.filterBar}>
        <input
          type="text"
          placeholder="Search by invoice #, customer, project, or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={styles.searchInput}
        />
        <select
          value={paymentFilter}
          onChange={(e) => setPaymentFilter(e.target.value)}
          style={styles.filterSelect}
        >
          <option value="all">All Payments</option>
          <option value="unpaid">Unpaid</option>
          <option value="partial">Partial</option>
          <option value="paid">Paid</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={styles.filterSelect}
        >
          <option value="all">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="partial">Partial</option>
          <option value="paid">Paid</option>
          <option value="overdue">Overdue</option>
        </select>
      </div>

      {filteredInvoices.length === 0 ? (
        <div style={styles.empty}>
          <p style={styles.emptyText}>
            {searchTerm || statusFilter !== "all" 
              ? "No invoices found matching your filters." 
              : "No invoices yet. Create your first invoice from a project!"}
          </p>
          {!searchTerm && statusFilter === "all" && (
            <button 
              onClick={() => navigate('/projects')}
              style={styles.emptyButton}
            >
              Go to Projects
            </button>
          )}
        </div>
      ) : (
        <div style={styles.tableContainer}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.tableHeaderRow}>
                <th style={{...styles.th, textAlign: 'left', width: '17%'}}>Invoice #</th>
                <th style={{...styles.th, textAlign: 'left', width: '14%'}}>Customer</th>
                <th style={{...styles.th, textAlign: 'left', width: '20%'}}>Project</th>
                <th style={{...styles.th, textAlign: 'right', width: '8%'}}>Total</th>
                <th style={{...styles.th, textAlign: 'right', width: '8%'}}>Balance</th>
                <th style={{...styles.th, textAlign: 'center', width: '4%'}} title="Linked">🔗</th>
                <th style={{...styles.th, textAlign: 'center', width: '8%'}}>Date</th>
                <th style={{...styles.th, textAlign: 'center', width: '21%'}}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.map(invoice => (
                <tr 
                  key={invoice.id} 
                  style={styles.tableRow}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <td style={{...styles.td, width: '18%'}}>
                    <div style={{display: 'flex', flexDirection: 'column', gap: 6}}>
                      <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
                        <span style={{
                          ...styles.statusBadge,
                          backgroundColor: getStatusColor(invoice.status)
                        }}>
                          {invoice.status || 'draft'}
                        </span>
                        <span style={styles.invoiceNumber}>
                          #{invoice.invoice_number || 'N/A'}
                        </span>
                      </div>
                      {invoice.total > 0 && (
                        <span style={{
                          ...styles.paymentBadge,
                          backgroundColor: getPaymentStatusColor(getPaymentStatusWithDeposit(invoice))
                        }}>
                          💳 {getPaymentStatusWithDeposit(invoice)?.toUpperCase()}
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{...styles.td, width: '15%'}}>
                    <div style={styles.customerInfo}>
                      <div style={styles.customerName}>{invoice.customer_name || 'N/A'}</div>
                      {invoice.customer_email && (
                        <div style={styles.customerEmail}>{invoice.customer_email}</div>
                      )}
                    </div>
                  </td>
                  <td style={{...styles.td, width: '22%'}}>
                    <div style={styles.singleLineText}>
                      {invoice.project_name || 'N/A'}
                    </div>
                  </td>
                  <td style={{...styles.td, textAlign: 'right', width: '8%'}}>
                    <span style={styles.total}>{formatCurrency(invoice.total)}</span>
                  </td>
                  <td style={{...styles.td, textAlign: 'right', width: '8%'}}>
                    <span style={{
                      ...styles.balance,
                      color: calculateTrueBalance(invoice) > 0 ? '#ef4444' : '#10b981'
                    }}>
                      {formatCurrency(calculateTrueBalance(invoice))}
                    </span>
                  </td>
                  <td style={{...styles.td, textAlign: 'center', width: '4%'}}>
                    <span 
                      style={{fontSize: 18}} 
                      title={linkedInvoiceIds.has(invoice.id) ? 'Linked to bank transaction' : 'Not linked'}
                    >
                      {linkedInvoiceIds.has(invoice.id) ? '🔗' : '-'}
                    </span>
                  </td>
                  <td style={{...styles.td, textAlign: 'center', width: '8%'}}>
                    <span style={styles.date}>{formatDate(invoice.invoice_date)}</span>
                  </td>
                  <td style={{...styles.td, textAlign: 'center', width: '21%'}}>
                    <div style={styles.actions}>
                      <button
                        onClick={() => navigate(`/invoice?invoiceId=${invoice.id}`)}
                        style={{...styles.actionButton, ...styles.viewButton}}
                        title="View/Edit Invoice"
                      >
                        View
                      </button>
                      {calculateTrueBalance(invoice) > 0 ? (
                        <button
                          onClick={() => openPaymentModal(invoice)}
                          style={{...styles.actionButton, ...styles.paidButton}}
                          title="Record Payment"
                        >
                          💰 Paid
                        </button>
                      ) : (
                        <button
                          onClick={async () => {
                            if (!confirm(`Reset payment for invoice #${invoice.invoice_number}? This will mark it as unpaid, restore the full balance, AND create a reversal journal entry.`)) return;
                            try {
                              const fullTotal = invoice.total;
                              const previouslyPaidAmount = invoice.amount_paid || 0;
                              
                              // Step 1: Create reversal journal entry to undo the original payment
                              if (previouslyPaidAmount > 0 && invoice.bank_account_id) {
                                // Get AR account
                                const { data: arAccount } = await supabase
                                  .from('accounts')
                                  .select('id')
                                  .eq('account_number', '1100')
                                  .maybeSingle();
                                
                                // Get bank account's chart account
                                const { data: bankAccountRecord } = await supabase
                                  .from('bank_accounts')
                                  .select('chart_account_id')
                                  .eq('id', invoice.bank_account_id)
                                  .single();
                                
                                if (arAccount && bankAccountRecord?.chart_account_id) {
                                  // Create reversal journal entry
                                  const { data: lastEntry } = await supabase
                                    .from('journal_entries')
                                    .select('entry_number')
                                    .eq('company_id', user.id)
                                    .order('entry_number', { ascending: false })
                                    .limit(1)
                                    .maybeSingle();
                                  
                                  const nextEntryNumber = (lastEntry?.entry_number || 0) + 1;
                                  
                                  const reversalEntry = {
                                    entry_number: nextEntryNumber,
                                    entry_date: new Date().toISOString().split('T')[0],
                                    description: `REVERSAL: Payment reversal for Invoice #${invoice.invoice_number}`,
                                    reference_type: 'invoice_payment',
                                    reference_id: invoice.id,
                                    created_by: user.id,
                                    company_id: user.id
                                  };
                                  
                                  const { data: newEntry, error: entryError } = await supabase
                                    .from('journal_entries')
                                    .insert([reversalEntry])
                                    .select()
                                    .single();
                                  
                                  if (newEntry && !entryError) {
                                    // Create reversal journal entry lines (reverse of original)
                                    // Original: Debit Bank, Credit AR
                                    // Reversal: Credit Bank, Debit AR (opposite)
                                    const reversalLines = [
                                      {
                                        entry_id: newEntry.id,
                                        line_number: 1,
                                        account_id: arAccount.id,
                                        debit: previouslyPaidAmount,  // Reverse the AR credit
                                        credit: 0,
                                        description: 'Payment reversal - restore AR'
                                      },
                                      {
                                        entry_id: newEntry.id,
                                        line_number: 2,
                                        account_id: bankAccountRecord.chart_account_id,
                                        debit: 0,
                                        credit: previouslyPaidAmount,  // Reverse the bank debit
                                        description: 'Payment reversal - remove from bank'
                                      }
                                    ];
                                    
                                    await supabase
                                      .from('journal_entry_lines')
                                      .insert(reversalLines);
                                    
                                    // Post the reversal entry
                                    try {
                                      await supabase.rpc('post_journal_entry', {
                                        p_entry_id: newEntry.id,
                                        p_user_id: user.id
                                      });
                                    } catch (err) {
                                      console.error('Error posting reversal entry:', err);
                                    }
                                    
                                    // Recalculate affected account balances
                                    try {
                                      await supabase.rpc('recalculate_account_balance', {
                                        p_account_id: arAccount.id
                                      });
                                      console.log('✅ AR balance recalculated after reversal');
                                    } catch (err) {
                                      console.error('Error updating AR balance:', err);
                                    }
                                    
                                    try {
                                      await supabase.rpc('recalculate_account_balance', {
                                        p_account_id: bankAccountRecord.chart_account_id
                                      });
                                      console.log('✅ Bank balance recalculated after reversal');
                                    } catch (err) {
                                      console.error('Error updating bank balance with RPC:', err);
                                    }
                                  }
                                }
                              }
                              
                              // Step 2: Reset the invoice payment status
                              const { error } = await supabase
                                .from('invoices')
                                .update({
                                  payment_status: 'unpaid',
                                  amount_paid: 0,
                                  balance_due: fullTotal,
                                  payment_date: null,
                                  payment_method: null,
                                  processing_fee: 0,
                                  net_deposit_amount: null,
                                  bank_account_id: null
                                })
                                .eq('id', invoice.id);
                              if (error) throw error;
                              alert(`✅ Payment reversed! Balance restored to ${formatCurrency(fullTotal)}. Reversal journal entry created.`);
                              loadInvoices();
                            } catch (err) {
                              console.error('Error resetting payment:', err);
                              alert(`Failed to reset payment: ${err.message}`);
                            }
                          }}
                          style={{...styles.actionButton, ...styles.resetButton}}
                          title="Reset Payment (mark as unpaid)"
                        >
                          🔄 Reset
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(invoice)}
                        style={{...styles.actionButton, ...styles.deleteButton}}
                        title="Delete Invoice"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={styles.footer}>
        <p style={styles.footerText}>
          Showing {filteredInvoices.length} of {invoices.length} invoice{invoices.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && selectedInvoice && (
        <div style={styles.modalOverlay} onClick={() => setShowPaymentModal(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>Record Payment</h2>
              <button 
                onClick={() => setShowPaymentModal(false)} 
                style={styles.closeButton}
              >
                ×
              </button>
            </div>
            
            <div style={styles.modalBody}>
              <div style={styles.invoiceInfo}>
                <p style={styles.invoiceInfoText}>
                  <strong>Invoice:</strong> #{selectedInvoice.invoice_number}
                </p>
                <p style={styles.invoiceInfoText}>
                  <strong>Customer:</strong> {selectedInvoice.customer_name}
                </p>
                <p style={styles.invoiceInfoText}>
                  <strong>Total:</strong> {formatCurrency(selectedInvoice.total)}
                </p>
                <p style={styles.invoiceInfoText}>
                  <strong>Already Paid:</strong> {formatCurrency(selectedInvoice.amount_paid || 0)}
                </p>
                <p style={{...styles.invoiceInfoText, color: '#fc6b04', fontWeight: 'bold'}}>
                  <strong>Remaining:</strong> {formatCurrency(selectedInvoice.total - (selectedInvoice.amount_paid || 0))}
                </p>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Payment Amount *</label>
                <input
                  type="number"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({...paymentForm, amount: e.target.value})}
                  style={styles.input}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Payment Date *</label>
                <input
                  type="date"
                  value={paymentForm.date}
                  onChange={(e) => setPaymentForm({...paymentForm, date: e.target.value})}
                  style={styles.input}
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Payment Method *</label>
                <select
                  value={paymentForm.method}
                  onChange={(e) => setPaymentForm({...paymentForm, method: e.target.value})}
                  style={styles.input}
                >
                  <option value="check">Check</option>
                  <option value="cash">Cash</option>
                  <option value="venmo">Venmo</option>
                  <option value="paypal">PayPal</option>
                  <option value="credit_card">Credit Card</option>
                  <option value="ach">ACH/Bank Transfer</option>
                  <option value="wire">Wire Transfer</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>
                  Processing Fee (Optional)
                  <span style={{fontSize: 12, fontWeight: 'normal', color: '#666', marginLeft: 8}}>
                    Fee deducted by Venmo, PayPal, etc.
                  </span>
                </label>
                <input
                  type="number"
                  value={paymentForm.processing_fee}
                  onChange={(e) => {
                    const fee = e.target.value;
                    setPaymentForm({...paymentForm, processing_fee: fee});
                  }}
                  style={styles.input}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                />
                {paymentForm.processing_fee && paymentForm.amount && (
                  <div style={{marginTop: 8, padding: '8px 12px', backgroundColor: '#f0f9ff', borderRadius: 6, fontSize: 13}}>
                    <div style={{color: '#0369a1', fontWeight: '600'}}>
                      💰 Net Deposit: {formatCurrency(parseFloat(paymentForm.amount) - parseFloat(paymentForm.processing_fee || 0))}
                    </div>
                    <div style={{color: '#666', fontSize: 12, marginTop: 4}}>
                      This is the amount that will be deposited to your bank account
                    </div>
                  </div>
                )}
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Deposit Type</label>
                <div style={{display: 'flex', gap: 20, marginBottom: 16}}>
                  <label style={{display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer'}}>
                    <input
                      type="radio"
                      name="deposit_type"
                      value="bank"
                      checked={paymentForm.deposit_type === 'bank'}
                      onChange={(e) => setPaymentForm({...paymentForm, deposit_type: e.target.value})}
                      style={{cursor: 'pointer'}}
                    />
                    <span style={{fontWeight: 600, color: '#111'}}>Bank Account</span>
                  </label>
                  <label style={{display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer'}}>
                    <input
                      type="radio"
                      name="deposit_type"
                      value="holding_account"
                      checked={paymentForm.deposit_type === 'holding_account'}
                      onChange={(e) => setPaymentForm({...paymentForm, deposit_type: e.target.value})}
                      style={{cursor: 'pointer'}}
                    />
                    <span style={{fontWeight: 600, color: '#111'}}>Holding Account (Previous Income)</span>
                  </label>
                </div>

                {paymentForm.deposit_type === 'bank' ? (
                  <select
                    value={paymentForm.bank_account_id}
                    onChange={(e) => setPaymentForm({...paymentForm, bank_account_id: e.target.value})}
                    style={styles.input}
                  >
                    <option value="">Select Bank Account...</option>
                    {cashAccounts.map(account => (
                      <option key={account.id} value={account.id}>
                        {account.account_name} - {account.account_type}
                        {account.bank_name ? ` (${account.bank_name})` : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <select
                    value={paymentForm.holding_account_id}
                    onChange={(e) => setPaymentForm({...paymentForm, holding_account_id: e.target.value})}
                    style={styles.input}
                  >
                    <option value="">Select Holding Account...</option>
                    {holdingAccounts.map(account => (
                      <option key={account.id} value={account.id}>
                        {account.account_name} ({account.account_number})
                      </option>
                    ))}
                  </select>
                )}
                
                {paymentForm.deposit_type === 'holding_account' && holdingAccounts.length === 0 && (
                  <div style={{fontSize: 12, color: '#ef4444', marginTop: 6}}>
                    No holding accounts found. Create one in Chart of Accounts (with "Undeposited", "Previous", or "Holding" in the name).
                  </div>
                )}
                
                {paymentForm.deposit_type === 'bank' && cashAccounts.length === 0 && (
                  <div style={{fontSize: 12, color: '#ef4444', marginTop: 6}}>
                    No bank accounts found. Add one in Bank Accounts page.
                  </div>
                )}
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Notes</label>
                <textarea
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({...paymentForm, notes: e.target.value})}
                  style={{...styles.input, minHeight: 80, resize: 'vertical'}}
                  placeholder="Any additional notes about this payment..."
                />
              </div>
            </div>

            <div style={styles.modalFooter}>
              <button 
                onClick={() => setShowPaymentModal(false)} 
                style={styles.cancelButton}
              >
                Cancel
              </button>
              <button 
                onClick={handlePayment} 
                style={styles.saveButton}
              >
                💰 Record Payment
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
  headerButtons: {
    display: "flex",
    gap: 12,
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
    minWidth: 160,
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
    tableLayout: "fixed", // CRITICAL: Forces table to respect column widths
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
  invoiceNumber: {
    fontWeight: "700",
    color: "#0b3ea8",
    fontSize: 16,
  },
  customerInfo: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    overflow: "hidden",
  },
  customerName: {
    fontWeight: "600",
    color: "#111",
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
  },
  customerEmail: {
    fontSize: 13,
    color: "#666",
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
  },
  singleLineText: {
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
    fontWeight: "600",
    color: "#111",
    textAlign: "left",
  },
  total: {
    fontWeight: "700",
    color: "#111",
    fontSize: 16,
  },
  balance: {
    fontWeight: "700",
    fontSize: 16,
  },
  statusBadge: {
    display: "inline-block",
    padding: "6px 12px",
    borderRadius: 6,
    fontSize: 12,
    fontWeight: "bold",
    color: "#fff",
    textTransform: "uppercase",
  },
  paymentBadge: {
    display: "inline-block",
    padding: "4px 10px",
    borderRadius: 4,
    fontSize: 11,
    fontWeight: "bold",
    color: "#fff",
    textTransform: "uppercase",
    alignSelf: "flex-start",
  },
  date: {
    color: "#666",
    fontSize: 14,
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
    fontSize: 13,
    fontWeight: "600",
    cursor: "pointer",
    transition: "opacity 0.2s",
  },
  viewButton: {
    backgroundColor: "#3b82f6",
    color: "#fff",
  },
  paidButton: {
    backgroundColor: "#10b981",
    color: "#fff",
  },
  deleteButton: {
    backgroundColor: "#ef4444",
    color: "#fff",
  },
  resetButton: {
    backgroundColor: "#f59e0b",
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
  emptyButton: {
    padding: "12px 32px",
    backgroundColor: "#0b3ea8",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 16,
    fontWeight: "600",
    cursor: "pointer",
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
    maxWidth: 600,
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
  invoiceInfo: {
    backgroundColor: "#f9fafb",
    padding: "16px",
    borderRadius: 8,
    marginBottom: 24,
  },
  invoiceInfoText: {
    margin: "8px 0",
    fontSize: 14,
    color: "#333",
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
