-- =============================================
-- NUCLEAR OPTION - DELETE ALL JOURNAL ENTRIES
-- =============================================
-- This deletes EVERY journal entry in the system
-- Use this to completely start over

-- Step 1: See what will be deleted
SELECT COUNT(*) as total_journal_entries FROM journal_entries;

-- Step 2: DELETE EVERYTHING
DELETE FROM journal_entries;

-- Step 3: Reset ALL account balances to 0
UPDATE accounts SET balance = 0;

-- Done. ALL journal entries deleted. Chart of Accounts reset to $0.
-- Now go check the Opening Balance transaction in Bank Transactions
-- and it will create a fresh journal entry.
