-- Add RAYNE ACE HARDW Transaction as CLEARED (not reconciled)
-- Account: Main Checking (ID: 8815abd9-a681-4c81-857c-753a9e13e23d)
-- Date: Dec 17, 2025
-- Amount: -$205.61
-- Status: Cleared but NOT Reconciled

INSERT INTO bank_transactions (
  bank_account_id,
  transaction_date,
  description,
  amount,
  transaction_type,
  category,
  is_cleared,
  is_reconciled,
  created_at
) 
VALUES (
  '8815abd9-a681-4c81-857c-753a9e13e23d',
  '2025-12-17'::date,
  'RAYNE ACE HARDW',
  -205.61,
  'withdrawal',
  'Supplies',
  true,
  false,
  NOW()
);

-- Verify the transaction was added
SELECT id, transaction_date, description, amount, is_cleared, is_reconciled 
FROM bank_transactions 
WHERE description = 'RAYNE ACE HARDW' 
  AND transaction_date = '2025-12-17'
ORDER BY created_at DESC 
LIMIT 1;

-- Show the updated account balance
SELECT id, account_name, current_balance FROM bank_accounts 
WHERE account_name = 'Main Checking';
