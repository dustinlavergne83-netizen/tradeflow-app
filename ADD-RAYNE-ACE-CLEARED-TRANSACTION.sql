-- Add RAYNE ACE HARDW Transaction as CLEARED (not reconciled)
-- Date: Dec 17, 2025
-- Amount: -$205.61
-- Account: HW Checking Account
-- Status: Cleared but NOT Reconciled

-- First, verify the HW Checking Account exists and get its ID
SELECT id, account_name FROM bank_accounts 
WHERE account_name ILIKE '%HW Checking%' OR account_name ILIKE '%Checking%';

-- Insert the transaction as cleared but not reconciled
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
  (SELECT id FROM bank_accounts WHERE account_name ILIKE '%HW Checking%' LIMIT 1),
  '2025-12-17'::date,
  'RAYNE ACE HARDW',
  -205.61,
  'withdrawal',
  'Supplies',
  true,  -- CLEARED
  false, -- NOT RECONCILED
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
WHERE account_name ILIKE '%HW Checking%';
