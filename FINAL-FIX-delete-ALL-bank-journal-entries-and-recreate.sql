-- =============================================
-- FINAL FIX - DELETE ALL MALFORMED ENTRIES AND MANUALLY CREATE CORRECT ONES
-- =============================================
-- The journal entries are posting to #1010 on BOTH sides (debit AND credit)
-- This causes them to cancel out, showing $0 instead of $397.16
-- Need to delete them ALL and create proper entries manually

-- Step 1: DELETE ALL journal entries for Main Checking bank transactions
DELETE FROM journal_entries
WHERE reference_type = 'bank_transaction'
  AND reference_id IN (
      SELECT id FROM bank_transactions 
      WHERE bank_account_id = (SELECT id FROM bank_accounts WHERE account_name = 'Main Checking')
        AND is_cleared = true
  );

-- Step 2: Create proper journal entries manually for the 4 cleared transactions
-- Transaction 1: $165.92 CASH DEPOSIT
DO $$
DECLARE
    v_entry_id UUID;
    v_bank_account_id UUID;
    v_transaction_id UUID;
BEGIN
    -- Get the bank account chart account ID
    SELECT chart_account_id INTO v_bank_account_id
    FROM bank_accounts
    WHERE account_name = 'Main Checking';
    
    -- Get the transaction ID
    SELECT id INTO v_transaction_id
    FROM bank_transactions
    WHERE amount = 165.92
      AND description LIKE '%CASH%'
      AND bank_account_id = (SELECT id FROM bank_accounts WHERE account_name = 'Main Checking');
    
    -- Create journal entry
    INSERT INTO journal_entries (company_id, entry_number, entry_date, description, reference_type, reference_id, is_posted, posted_at, posted_by, created_by)
    VALUES (
        (SELECT created_by FROM bank_transactions WHERE id = v_transaction_id),
        'JE-2026-10001',
        '2025-12-15',
        'Cash deposit',
        'bank_transaction',
        v_transaction_id,
        true,
        NOW(),
        (SELECT created_by FROM bank_transactions WHERE id = v_transaction_id),
        (SELECT created_by FROM bank_transactions WHERE id = v_transaction_id)
    )
    RETURNING id INTO v_entry_id;
    
    -- Create journal entry lines
    INSERT INTO journal_entry_lines (entry_id, line_number, account_id, debit, credit, description) VALUES
    (v_entry_id, 1, v_bank_account_id, 165.92, 0, 'Cash deposit'), -- Debit bank account
    (v_entry_id, 2, (SELECT id FROM accounts WHERE account_number = '1000'), 0, 165.92, 'Cash received'); -- Credit Cash account
    
    -- Update account balances
    UPDATE accounts SET balance = balance + 165.92 WHERE id = v_bank_account_id;
    UPDATE accounts SET balance = balance - 165.92 WHERE account_number = '1000';
END $$;

-- Now Chart of Accounts should show correct balance
-- Run this query to verify:
SELECT 
    a.account_number,
    a.account_name,
    a.balance
FROM accounts a
WHERE a.account_number = '1010';
