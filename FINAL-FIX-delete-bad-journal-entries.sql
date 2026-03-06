-- =============================================
-- DELETE BAD JOURNAL ENTRIES AND START FRESH
-- =============================================
-- The journal entries are malformed - posting to same account on both sides
-- Debits and credits to #1010 cancel each other out = $0
-- Need to delete these and recreate properly

-- Step 1: See the malformed journal entries
SELECT 
    je.id,
    je.entry_number,
    je.entry_date,
    je.description,
    bt.amount,
    bt.description as trans_desc
FROM journal_entries je
JOIN bank_transactions bt ON je.reference_id = bt.id AND je.reference_type = 'bank_transaction'
WHERE bt.bank_account_id = (SELECT id FROM bank_accounts WHERE account_name = 'Main Checking')
  AND bt.is_cleared = true;

-- Step 2: Delete the malformed journal entries (uncomment to run)

DELETE FROM journal_entries
WHERE id IN (
    SELECT je.id
    FROM journal_entries je
    JOIN bank_transactions bt ON je.reference_id = bt.id AND je.reference_type = 'bank_transaction'
    WHERE bt.bank_account_id = (SELECT id FROM bank_accounts WHERE account_name = 'Main Checking')
      AND bt.is_cleared = true
)
RETURNING entry_number, description;
*/

-- Step 3: Verify journal entries are deleted

SELECT COUNT(*) as remaining_entries
FROM journal_entries je
JOIN bank_transactions bt ON je.reference_id = bt.id AND je.reference_type = 'bank_transaction'
WHERE bt.bank_account_id = (SELECT id FROM bank_accounts WHERE account_name = 'Main Checking')
  AND bt.is_cleared = true;
*/

-- After deleting, go to Bank Transactions page and:
-- 1. UNCHECK all 4 cleared transactions
-- 2. RE-CHECK them one by one
-- 3. This will create correct journal entries
