# How to Reset Your Chart of Accounts Balances

## 🔍 The Problem

You deleted all invoices, estimates, and expenses, but your Chart of Accounts still shows balances. **Why?**

### Understanding Account Balances

Your Chart of Accounts balances come from **Journal Entries**, not directly from invoices or expenses:

```
Invoices/Expenses → Journal Entries → Journal Entry Lines → Account Balances
```

When you delete invoices or expenses, the **journal entries remain** in the database, so your accounts still show balances.

---

## ✅ The Solution

Run the SQL script `RESET_ACCOUNTING_DATA.sql` to delete all journal entries and reset your accounting system.

---

## 📋 Step-by-Step Instructions

### Step 1: Open Supabase Dashboard

1. Go to [supabase.com](https://supabase.com)
2. Sign in to your account
3. Select your TradeFlow project

### Step 2: Open SQL Editor

1. In the left sidebar, click **"SQL Editor"**
2. Click **"New Query"**

### Step 3: Copy and Paste the SQL Script

1. Open the file `RESET_ACCOUNTING_DATA.sql` in VS Code
2. Copy **ALL** the SQL commands (from BEGIN; to COMMIT;)
3. Paste into the Supabase SQL Editor

### Step 4: Review What Will Be Deleted

The script will delete:
- ❌ All journal entries
- ❌ All journal entry lines
- ❌ All bank transactions (optional)
- ❌ Bank reconciliation data

The script will KEEP:
- ✅ Your Chart of Accounts structure
- ✅ All account definitions
- ✅ Customers, Employees, Projects
- ✅ Time entries
- ✅ Settings

### Step 5: Run the Script

1. Click **"Run"** button (or press Ctrl+Enter / Cmd+Enter)
2. Wait for the query to complete
3. You should see "Success" message

### Step 6: Verify the Reset

Run these verification queries in Supabase SQL Editor:

```sql
-- Should return 0
SELECT COUNT(*) as journal_entries_count FROM journal_entries;

-- Should return 0
SELECT COUNT(*) as journal_lines_count FROM journal_entry_lines;

-- Should show all accounts with $0.00 balance
SELECT account_number, account_name, balance 
FROM accounts 
ORDER BY account_number;
```

### Step 7: Refresh Your App

1. Go back to your TradeFlow application
2. Navigate to **Accounting → Chart of Accounts**
3. Press **Ctrl+F5** (or Cmd+Shift+R on Mac) to hard refresh
4. All account balances should now show **$0.00**

---

## 🎯 Quick Reference: What Tables Store What

| What You See | Where It's Stored |
|-------------|------------------|
| Chart of Accounts | `accounts` table |
| Account Balances | Calculated from `journal_entry_lines` |
| General Ledger | `journal_entries` + `journal_entry_lines` |
| Invoices | `invoices` table |
| Expenses | `expenses` table |
| Bank Transactions | `bank_transactions` table |
| Bills | `bills` table |

---

## ⚠️ Important Notes

### This is Permanent
Once you run this script, the journal entries are **permanently deleted**. There is no undo.

### When to Use This
- ✅ Testing the system with sample data
- ✅ Starting fresh after a trial period
- ✅ Resetting after importing bad data
- ❌ DON'T use this if you have real financial data you need to keep!

### Alternative: Archive Instead of Delete
If you want to keep your data but start fresh, consider:
1. Export your current data first
2. Create a backup of your database
3. Then run the reset script

---

## 🔄 After Reset - Next Steps

Now that your accounts are at zero, you can:

1. **Manual Journal Entries**: Create journal entries through the app
   - Go to: Accounting → Journal Entry
   - Create properly balanced entries (debits = credits)

2. **Automated Entries (Phase 7 - Not Yet Implemented)**:
   - Eventually, invoices/expenses will auto-create journal entries
   - This is planned for Phase 7 of the accounting system

3. **Import Opening Balances**: 
   - Create a journal entry dated at your "start date"
   - Enter your opening balances for each account
   - Common pattern:
     ```
     Debit: Assets (what you own)
     Credit: Liabilities (what you owe) + Equity (net worth)
     ```

---

## 🆘 Troubleshooting

### Balances Still Showing After Reset

**Problem**: You ran the script but balances still show.

**Solutions**:
1. Hard refresh the page (Ctrl+F5)
2. Clear browser cache
3. Verify the script ran successfully (check verification queries)
4. Check if there are journal entries with `is_posted = false` (script only deletes all entries)

### Permission Errors

**Problem**: "Permission denied" when running SQL script.

**Solutions**:
1. Make sure you're logged into Supabase as the project owner
2. Check that you have admin access to the database
3. Try running sections of the script one at a time

### Script Hangs or Times Out

**Problem**: Script takes too long to run.

**Solutions**:
1. Break the script into smaller parts
2. Run DELETE statements one at a time
3. Contact Supabase support if you have millions of records

---

## 📞 Need Help?

If you encounter issues:
1. Check the Supabase logs for error messages
2. Verify your database schema matches the expected structure
3. Review the `ACCOUNTING_SYSTEM_IMPLEMENTATION_PLAN.md` for context
4. Check that all migrations have been run (001 through 041)

---

## 📚 Related Files

- `RESET_ACCOUNTING_DATA.sql` - The SQL script to run
- `ACCOUNTING_SYSTEM_IMPLEMENTATION_PLAN.md` - Overall accounting system documentation
- `src/pages/ChartOfAccounts.jsx` - Where balances are displayed
- `supabase/migrations/025_create_journal_entries_tables.sql` - Journal entry schema
