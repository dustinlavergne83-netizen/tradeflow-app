-- Clear All Accounting Data - Fresh Start for Production
-- Run this in your Supabase SQL Editor to start with clean accounting data

-- ============================================================================
-- RECOMMENDED: KEEP CHART OF ACCOUNTS, RESET BALANCES ONLY
-- ============================================================================
-- This keeps your existing Chart of Accounts structure
-- and just resets all balances to zero

-- Step 1: Delete all journal entry lines
DELETE FROM journal_entry_lines;

-- Step 2: Delete all journal entries
DELETE FROM journal_entries;

-- Step 3: Reset all account balances to zero (keep the accounts)
UPDATE accounts SET balance = 0;

-- Step 4: Clear bank transaction category links (optional)
UPDATE bank_transactions SET category = NULL WHERE category IS NOT NULL;

-- DONE! Your Chart of Accounts structure is preserved but all balances are zero


-- ============================================================================
-- OPTION 2: COMPLETE RESET (Only if you want to rebuild everything)
-- ============================================================================
-- Use this ONLY if you want to delete ALL accounts and start completely from scratch

/*
-- Step 1: Delete all journal entry lines
DELETE FROM journal_entry_lines;

-- Step 2: Delete all journal entries
DELETE FROM journal_entries;

-- Step 3: Delete all accounts
DELETE FROM accounts;

-- Step 4: Clear bank transaction links (optional - removes accounting links but keeps transactions)
UPDATE bank_transactions SET category = NULL WHERE category IS NOT NULL;

-- DONE! You now have a completely clean accounting system
-- You can now rebuild your Chart of Accounts from scratch
*/


-- ============================================================================
-- VERIFICATION QUERIES - Run these to confirm everything is clean
-- ============================================================================

-- Check that all journal entries are deleted
SELECT COUNT(*) as journal_entry_count FROM journal_entries;
-- Should return: 0

-- Check that all journal entry lines are deleted
SELECT COUNT(*) as journal_entry_lines_count FROM journal_entry_lines;
-- Should return: 0

-- Check account balances (Option 1 - should be empty, Option 2 - should all be 0)
SELECT 
    account_number,
    account_name,
    balance,
    account_type
FROM accounts
ORDER BY account_number;


-- ============================================================================
-- NEXT STEPS AFTER RUNNING THIS SCRIPT
-- ============================================================================
-- 1. Go to Chart of Accounts page and rebuild your accounts structure
-- 2. Set up your bank accounts in Bank Accounts page
-- 3. Link bank accounts to Chart of Accounts
-- 4. Start entering real transactions!
-- 5. All journal entries will be automatically created as you work
