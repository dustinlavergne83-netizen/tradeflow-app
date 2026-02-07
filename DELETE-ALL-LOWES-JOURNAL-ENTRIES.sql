-- DELETE ALL OLD LOWES JOURNAL ENTRIES (they have wrong debit/credit because account was Asset before)
-- This is why payments are adding instead of subtracting

DELETE FROM journal_entry_lines
WHERE entry_id IN (
  SELECT je.id FROM journal_entries je
  WHERE je.description ILIKE '%lowes%' 
     OR je.description ILIKE '%credit card%'
     OR je.reference_type = 'bank_transaction'
);

DELETE FROM journal_entries
WHERE description ILIKE '%lowes%' 
   OR description ILIKE '%credit card%'
   OR reference_type = 'bank_transaction';

-- Reset the balance to 0, then manually set it to -6311.57
UPDATE accounts
SET balance = -6311.57
WHERE account_number = '2110';

-- Verify
SELECT account_number, account_name, balance FROM accounts WHERE account_number = '2110';
