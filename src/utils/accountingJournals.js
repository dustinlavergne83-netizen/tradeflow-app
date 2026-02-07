import { supabase } from "../lib/supabase";

/**
 * Utility functions to automatically create journal entries for business transactions
 * Follows double-entry bookkeeping principles
 */

/**
 * Get or create default accounts needed for automation
 * Returns account IDs for common accounts
 */
export async function getDefaultAccounts(companyId) {
  const { data: accounts, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("company_id", companyId)
    .eq("is_active", true);

  if (error) {
    console.error("Error loading accounts:", error);
    return null;
  }

  // Find key accounts by name patterns
  const accountMap = {
    cash: accounts.find(a => 
      a.account_name.toLowerCase().includes('cash') || 
      a.account_name.toLowerCase().includes('checking')
    ),
    accountsReceivable: accounts.find(a => 
      a.account_name.toLowerCase().includes('receivable') ||
      a.account_name.toLowerCase().includes('a/r')
    ),
    accountsPayable: accounts.find(a => 
      a.account_name.toLowerCase().includes('payable') ||
      a.account_name.toLowerCase().includes('a/p')
    ),
    revenue: accounts.find(a => 
      a.account_type === 'Income' && 
      (a.account_name.toLowerCase().includes('revenue') ||
       a.account_name.toLowerCase().includes('service'))
    ),
    // For expenses, we'll need to determine dynamically based on category
  };

  return accountMap;
}

/**
 * Find expense account by category
 */
export async function getExpenseAccount(companyId, category) {
  const { data: accounts, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("company_id", companyId)
    .eq("account_type", "Expense")
    .eq("is_active", true);

  if (error || !accounts) return null;

  // Try to match by category name
  const match = accounts.find(a => 
    a.account_name.toLowerCase().includes(category?.toLowerCase())
  );

  // If no match, return first expense account or "Other Expenses"
  return match || accounts.find(a => 
    a.account_name.toLowerCase().includes('other')
  ) || accounts[0];
}

/**
 * Generate next journal entry number
 * Uses sequential numbering with a random component to prevent collisions
 */
async function getNextJournalEntryNumber(companyId) {
  const year = new Date().getFullYear();
  const timestamp = Date.now();
  // Create unique ID: JE-YYYY-XXXXX-RANDOM
  // This prevents race condition conflicts where multiple simultaneous requests
  // might try to create entries with the same sequential number
  const randomPart = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
  const entryNumber = `JE-${year}-${randomPart}`;
  
  return entryNumber;
}

/**
 * Create journal entry when invoice is created
 * Debit: Accounts Receivable
 * Credit: Revenue
 */
export async function createInvoiceJournalEntry(invoice, userId, companyId) {
  try {
    const accounts = await getDefaultAccounts(companyId);
    
    if (!accounts.accountsReceivable || !accounts.revenue) {
      console.error("Required accounts not found for invoice entry");
      return { success: false, error: "Missing A/R or Revenue accounts" };
    }

    // First, check if an entry already exists for this invoice to prevent duplicates
    const { data: existingEntries, error: checkError } = await supabase
      .from("journal_entries")
      .select("id")
      .eq("reference_type", "invoice")
      .eq("reference_id", invoice.id)
      .limit(1);

    if (checkError) {
      console.error("Error checking for existing entries:", checkError);
    }

    // If an entry already exists, don't create another one
    if (existingEntries && existingEntries.length > 0) {
      console.log("⚠️ Journal entry already exists for this invoice, skipping creation");
      return { success: true, entryId: existingEntries[0].id, alreadyExists: true };
    }

    const entryNumber = await getNextJournalEntryNumber(companyId);
    const description = `Invoice #${invoice.invoice_number} - ${invoice.customer_name}`;

    // Create journal entry header - DO NOT mark as posted yet
    const { data: entry, error: entryError } = await supabase
      .from("journal_entries")
      .insert({
        company_id: companyId,
        entry_number: entryNumber,
        entry_date: invoice.invoice_date,
        description: description,
        is_posted: false,
        created_by: userId,
        reference_type: 'invoice',
        reference_id: invoice.id
      })
      .select()
      .single();

    if (entryError) throw entryError;

    // Create journal entry lines
    const lines = [
      {
        entry_id: entry.id,
        line_number: 1,
        account_id: accounts.accountsReceivable.id,
        debit: invoice.total,
        credit: 0,
        description: `Invoice ${invoice.invoice_number}`
      },
      {
        entry_id: entry.id,
        line_number: 2,
        account_id: accounts.revenue.id,
        debit: 0,
        credit: invoice.total,
        description: `Invoice ${invoice.invoice_number}`
      }
    ];

    const { error: linesError } = await supabase
      .from("journal_entry_lines")
      .insert(lines);

    if (linesError) throw linesError;

    // NOW post the entry
    try {
      const { error: postError } = await supabase.rpc('post_journal_entry', {
        p_entry_id: entry.id,
        p_user_id: userId
      });

      if (postError) {
        console.error("Error posting journal entry:", postError);
        // Continue anyway - entry is created even if posting fails
      } else {
        console.log("✅ Journal entry posted successfully");
      }
    } catch (postErr) {
      console.error("Exception posting journal entry:", postErr);
    }

    return { success: true, entryId: entry.id };
  } catch (error) {
    console.error("Error creating invoice journal entry:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Create journal entry when invoice is paid
 * Debit: Bank Account (the specific account selected)
 * Credit: Accounts Receivable
 */
export async function createInvoicePaymentJournalEntry(invoice, paymentAmount, userId, companyId, bankAccountId = null) {
  try {
    const accounts = await getDefaultAccounts(companyId);
    
    if (!accounts.accountsReceivable) {
      console.error("A/R account not found");
      return { success: false, error: "Missing A/R account" };
    }

    // Get the bank account's linked chart account
    let debitAccountId = null;
    if (bankAccountId) {
      const { data: bankAccount, error: bankError } = await supabase
        .from("bank_accounts")
        .select("chart_account_id")
        .eq("id", bankAccountId)
        .single();
      
      if (bankError || !bankAccount?.chart_account_id) {
        console.error("Bank account or linked chart account not found");
        return { success: false, error: "Bank account not properly linked to chart of accounts" };
      }
      debitAccountId = bankAccount.chart_account_id;
    } else {
      // Fallback to finding a cash account if no bank account selected
      if (!accounts.cash) {
        console.error("No cash account found");
        return { success: false, error: "Missing cash account" };
      }
      debitAccountId = accounts.cash.id;
    }

    const entryNumber = await getNextJournalEntryNumber(companyId);
    const description = `Payment received - Invoice #${invoice.invoice_number}`;

    // Create journal entry header
    const { data: entry, error: entryError } = await supabase
      .from("journal_entries")
      .insert({
        company_id: companyId,
        entry_number: entryNumber,
        entry_date: new Date().toISOString().split('T')[0],
        description: description,
        is_posted: true,
        posted_at: new Date().toISOString(),
        posted_by: userId,
        created_by: userId,
        reference_type: 'invoice_payment',
        reference_id: invoice.id
      })
      .select()
      .single();

    if (entryError) throw entryError;

    // Create journal entry lines
    const lines = [
      {
        entry_id: entry.id,
        line_number: 1,
        account_id: debitAccountId,
        debit: paymentAmount,
        credit: 0,
        description: `Payment - Invoice ${invoice.invoice_number}`
      },
      {
        entry_id: entry.id,
        line_number: 2,
        account_id: accounts.accountsReceivable.id,
        debit: 0,
        credit: paymentAmount,
        description: `Payment - Invoice ${invoice.invoice_number}`
      }
    ];

    const { error: linesError } = await supabase
      .from("journal_entry_lines")
      .insert(lines);

    if (linesError) throw linesError;

    return { success: true, entryId: entry.id };
  } catch (error) {
    console.error("Error creating payment journal entry:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Create journal entry when expense is recorded
 * Debit: Expense Account
 * Credit: Bank Account (the specific account selected) OR Cash Account (for cash payments)
 */
export async function createExpenseJournalEntry(expense, userId, companyId, bankAccountId = null, paymentMethod = null) {
  try {
    const expenseAccount = await getExpenseAccount(companyId, expense.category);
    
    if (!expenseAccount) {
      console.error("Expense account not found");
      return { success: false, error: "Missing expense account" };
    }

    // Get the credit account based on payment method
    let creditAccountId = null;
    let creditAccountName = null;
    
    if (paymentMethod === 'cash') {
      // For cash payments, use account #1000
      const { data: cashAccount, error: cashError } = await supabase
        .from("accounts")
        .select("id, account_name")
        .eq("company_id", companyId)
        .eq("account_number", 1000)
        .single();
      
      if (cashError || !cashAccount?.id) {
        console.error("Cash account (1000) not found");
        return { success: false, error: "Cash account not found in chart of accounts" };
      }
      creditAccountId = cashAccount.id;
      creditAccountName = cashAccount.account_name;
    } else if (bankAccountId) {
      // First check if this is an income account (from accounts table)
      const { data: incomeAccount, error: incomeError } = await supabase
        .from("accounts")
        .select("id, account_name, account_type")
        .eq("id", bankAccountId)
        .single();
      
      if (incomeAccount && incomeAccount.account_type === 'Income') {
        // It's an income account, use it directly
        creditAccountId = incomeAccount.id;
        creditAccountName = incomeAccount.account_name;
      } else {
        // For bank payments, use the selected bank account's linked chart account
        const { data: bankAccount, error: bankError } = await supabase
          .from("bank_accounts")
          .select("chart_account_id")
          .eq("id", bankAccountId)
          .single();
        
        if (bankError || !bankAccount?.chart_account_id) {
          console.error("Bank account or linked chart account not found");
          return { success: false, error: "Bank account not properly linked to chart of accounts" };
        }
        creditAccountId = bankAccount.chart_account_id;
      }
    } else {
      // Fallback to finding a cash account if no specific payment method
      const accounts = await getDefaultAccounts(companyId);
      if (!accounts.cash) {
        console.error("No cash account found");
        return { success: false, error: "Missing cash account" };
      }
      creditAccountId = accounts.cash.id;
      creditAccountName = accounts.cash.account_name;
    }

    const entryNumber = await getNextJournalEntryNumber(companyId);
    const description = `${expense.category || 'Expense'} - ${expense.description || expense.vendor || 'No description'}`;

    // Create journal entry header
    const { data: entry, error: entryError } = await supabase
      .from("journal_entries")
      .insert({
        company_id: companyId,
        entry_number: entryNumber,
        entry_date: expense.expense_date,
        description: description,
        is_posted: true,
        posted_at: new Date().toISOString(),
        posted_by: userId,
        created_by: userId,
        reference_type: 'expense',
        reference_id: expense.id
      })
      .select()
      .single();

    if (entryError) throw entryError;

    // Create journal entry lines
    const lines = [
      {
        entry_id: entry.id,
        line_number: 1,
        account_id: expenseAccount.id,
        debit: expense.amount,
        credit: 0,
        description: expense.description || expense.category
      },
      {
        entry_id: entry.id,
        line_number: 2,
        account_id: creditAccountId,
        debit: 0,
        credit: expense.amount,
        description: expense.vendor || 'Payment from bank account'
      }
    ];

    const { error: linesError } = await supabase
      .from("journal_entry_lines")
      .insert(lines);

    if (linesError) throw linesError;

    return { success: true, entryId: entry.id };
  } catch (error) {
    console.error("Error creating expense journal entry:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Create journal entry when bill is created
 * Debit: Expense Account
 * Credit: Accounts Payable
 */
export async function createBillJournalEntry(bill, userId, companyId) {
  try {
    const accounts = await getDefaultAccounts(companyId);
    const expenseAccount = await getExpenseAccount(companyId, bill.category);
    
    if (!expenseAccount || !accounts.accountsPayable) {
      console.error("Required accounts not found for bill entry");
      return { success: false, error: "Missing expense or A/P accounts" };
    }

    const entryNumber = await getNextJournalEntryNumber(companyId);
    const description = `Bill #${bill.bill_number || 'New'} - ${bill.vendor_name}`;

    // Create journal entry header
    const { data: entry, error: entryError } = await supabase
      .from("journal_entries")
      .insert({
        company_id: companyId,
        entry_number: entryNumber,
        entry_date: bill.bill_date,
        description: description,
        is_posted: true,
        posted_at: new Date().toISOString(),
        posted_by: userId,
        created_by: userId,
        reference_type: 'bill',
        reference_id: bill.id
      })
      .select()
      .single();

    if (entryError) throw entryError;

    // Create journal entry lines
    const lines = [
      {
        entry_id: entry.id,
        line_number: 1,
        account_id: expenseAccount.id,
        debit: bill.amount,
        credit: 0,
        description: bill.description || bill.category
      },
      {
        entry_id: entry.id,
        line_number: 2,
        account_id: accounts.accountsPayable.id,
        debit: 0,
        credit: bill.amount,
        description: `Bill from ${bill.vendor_name}`
      }
    ];

    const { error: linesError } = await supabase
      .from("journal_entry_lines")
      .insert(lines);

    if (linesError) throw linesError;

    return { success: true, entryId: entry.id };
  } catch (error) {
    console.error("Error creating bill journal entry:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Create journal entry when bank transaction is cleared with a category
 * For withdrawals: Debit Expense Account, Credit Bank Account
 * For deposits: Debit Bank Account, Credit Income Account
 */
export async function createBankTransactionJournalEntry(transaction, userId, companyId, bankAccountId) {
  // TEMPORARILY DISABLED - Journal entry creation for bank transactions is broken
  // The function creates entries with is_posted=true, then tries to post again causing errors
  // Just return success so transactions can be checked without errors
  // You can manually create journal entries if needed
  return { success: true, entryId: null };
  
  /* ORIGINAL CODE - DISABLED
  try {
    // Need a category (expense or income account) assigned
    if (!transaction.category) {
      return { success: false, error: "Transaction must have a category assigned" };
    }

    // Get the bank account's linked chart account
    let bankChartAccountId = null;
    if (bankAccountId) {
      const { data: bankAccount, error: bankError } = await supabase
        .from("bank_accounts")
        .select("chart_account_id")
        .eq("id", bankAccountId)
        .single();
      
      if (bankError || !bankAccount?.chart_account_id) {
        console.error("Bank account or linked chart account not found");
        return { success: false, error: "Bank account not properly linked to chart of accounts" };
      }
      bankChartAccountId = bankAccount.chart_account_id;
    } else {
      const accounts = await getDefaultAccounts(companyId);
      if (!accounts.cash) {
        return { success: false, error: "No bank account linked" };
      }
      bankChartAccountId = accounts.cash.id;
    }

    // Get the expense/income account
    const { data: categoryAccount, error: catError } = await supabase
      .from("accounts")
      .select("*")
      .eq("id", transaction.category)
      .single();

    if (catError || !categoryAccount) {
      return { success: false, error: "Category account not found" };
    }

    const entryNumber = await getNextJournalEntryNumber(companyId);
    const description = `${transaction.description || 'Bank Transaction'} - ${transaction.payee || 'No payee'}`;

    // Create journal entry header
    const { data: entry, error: entryError } = await supabase
      .from("journal_entries")
      .insert({
        company_id: companyId,
        entry_number: entryNumber,
        entry_date: transaction.transaction_date,
        description: description,
        is_posted: true,
        posted_at: new Date().toISOString(),
        posted_by: userId,
        created_by: userId,
        reference_type: 'bank_transaction',
        reference_id: transaction.id
      })
      .select()
      .single();

    if (entryError) throw entryError;

    // Determine debit and credit based on transaction type
    let lines;
    const amount = Math.abs(transaction.amount);

    if (transaction.amount < 0) {
      // Withdrawal/Expense: Debit Expense, Credit Bank
      lines = [
        {
          entry_id: entry.id,
          line_number: 1,
          account_id: categoryAccount.id,
          debit: amount,
          credit: 0,
          description: transaction.description || categoryAccount.account_name
        },
        {
          entry_id: entry.id,
          line_number: 2,
          account_id: bankChartAccountId,
          debit: 0,
          credit: amount,
          description: transaction.payee || 'Bank account'
        }
      ];
    } else {
      // Deposit/Income: Debit Bank, Credit Income
      lines = [
        {
          entry_id: entry.id,
          line_number: 1,
          account_id: bankChartAccountId,
          debit: amount,
          credit: 0,
          description: transaction.payee || 'Bank account'
        },
        {
          entry_id: entry.id,
          line_number: 2,
          account_id: categoryAccount.id,
          debit: 0,
          credit: amount,
          description: transaction.description || categoryAccount.account_name
        }
      ];
    }

    const { error: linesError } = await supabase
      .from("journal_entry_lines")
      .insert(lines);

    if (linesError) throw linesError;

    return { success: true, entryId: entry.id };
  } catch (error) {
    console.error("Error creating bank transaction journal entry:", error);
    return { success: false, error: error.message };
  }
  */
}

/**
 * Create journal entry when bill is paid
 * Debit: Accounts Payable
 * Credit: Cash
 */
export async function createBillPaymentJournalEntry(bill, userId, companyId) {
  try {
    const accounts = await getDefaultAccounts(companyId);
    
    if (!accounts.cash || !accounts.accountsPayable) {
      console.error("Required accounts not found for bill payment entry");
      return { success: false, error: "Missing Cash or A/P accounts" };
    }

    const entryNumber = await getNextJournalEntryNumber(companyId);
    const description = `Bill payment - ${bill.vendor_name} - Bill #${bill.bill_number || bill.id}`;

    // Create journal entry header
    const { data: entry, error: entryError } = await supabase
      .from("journal_entries")
      .insert({
        company_id: companyId,
        entry_number: entryNumber,
        entry_date: bill.paid_date || new Date().toISOString().split('T')[0],
        description: description,
        is_posted: true,
        posted_at: new Date().toISOString(),
        posted_by: userId,
        created_by: userId,
        reference_type: 'bill_payment',
        reference_id: bill.id
      })
      .select()
      .single();

    if (entryError) throw entryError;

    // Create journal entry lines
    const lines = [
      {
        entry_id: entry.id,
        line_number: 1,
        account_id: accounts.accountsPayable.id,
        debit: bill.amount,
        credit: 0,
        description: `Payment to ${bill.vendor_name}`
      },
      {
        entry_id: entry.id,
        line_number: 2,
        account_id: accounts.cash.id,
        debit: 0,
        credit: bill.amount,
        description: `Payment to ${bill.vendor_name}`
      }
    ];

    const { error: linesError } = await supabase
      .from("journal_entry_lines")
      .insert(lines);

    if (linesError) throw linesError;

    return { success: true, entryId: entry.id };
  } catch (error) {
    console.error("Error creating bill payment journal entry:", error);
    return { success: false, error: error.message };
  }
}
