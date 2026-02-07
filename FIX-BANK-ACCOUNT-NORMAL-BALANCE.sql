-- Update bank account normal_balance from 'debit' to 'credit'
-- This fixes the debit/credit perspective so deposits are CREDITS and expenses are DEBITS

UPDATE accounts 
SET normal_balance = 'credit'
WHERE account_type = 'Asset' 
  AND normal_balance = 'debit'
  AND account_name LIKE '%checking%'
RETURNING id, account_number, account_name, normal_balance, balance;
