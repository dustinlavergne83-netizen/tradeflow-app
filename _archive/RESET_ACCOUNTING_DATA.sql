-- =====================================================
-- RESET ALL ACCOUNTING DATA (Keep Chart of Accounts)
-- =====================================================
-- This script will delete ALL journal entries, bank transactions,
-- and reconciliations to reset your Chart of Accounts balances to zero.
-- The Chart of Accounts structure will remain intact.
--
-- ⚠️ WARNING: This cannot be undone!
-- ⚠️ Run this ONLY if you want to completely reset your accounting data.
-- =====================================================

-- Run these commands in your Supabase SQL Editor:

BEGIN;

-- 1. Delete all journal entry lines (this will cascade to journal_entries if set up that way)
DELETE FROM journal_entry_lines;

-- 2. Delete all journal entries
DELETE FROM journal_entries;

-- 3. Delete all bank transactions (optional - comment out if you want to keep them)
DELETE FROM bank_transactions;

-- 4. Reset bank account balances (optional - comment out if you want to keep them)
UPDATE bank_accounts 
SET current_balance = opening_balance,
    last_reconciled_date = NULL,
    last_reconciled_balance = 0;

-- 5. Delete all bills (optional - comment out if you want to keep bill records)
-- DELETE FROM bill_line_items;
-- DELETE FROM bills;

-- 6. Reset the accounts table balance column to 0 (if it exists)
-- Note: Balances are calculated from journal entries, so this is just cleanup
UPDATE accounts SET balance = 0 WHERE balance IS NOT NULL;

-- Commit the transaction
COMMIT;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================
-- Run these to verify everything was reset:

-- Check journal entries (should return 0)
SELECT COUNT(*) as journal_entry_count FROM journal_entries;

-- Check journal entry lines (should return 0)
SELECT COUNT(*) as journal_line_count FROM journal_entry_lines;

-- Check bank transactions (should return 0 if you deleted them)
SELECT COUNT(*) as bank_transaction_count FROM bank_transactions;

-- Check accounts (should all show $0 balance)
SELECT account_number, account_name, balance 
FROM accounts 
ORDER BY account_number;

-- =====================================================
-- WHAT THIS PRESERVES
-- =====================================================
-- ✅ Chart of Accounts structure (all accounts remain)
-- ✅ Bank accounts (structure remains, balances reset to opening)
-- ✅ Customer records
-- ✅ Employee records
-- ✅ Project records
-- ✅ Time entries
-- ✅ Settings and configurations

-- =====================================================
-- WHAT THIS DELETES
-- =====================================================
-- ❌ All journal entries and lines
-- ❌ All bank transactions (if uncommented)
-- ❌ Bank reconciliation data
-- ❌ All accounting history

-- =====================================================
-- AFTER RUNNING THIS SCRIPT
-- =====================================================
-- 1. Refresh your Chart of Accounts page - all balances should show $0.00
-- 2. Refresh your General Ledger - should show no entries
-- 3. Your Balance Sheet should show all zeros
-- 4. You can now start fresh with new transactions
