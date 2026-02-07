-- Diagnostic: Find cleared owner draws missing from Owner Draws account ledger

-- Step 1: Find the Owner Draws account (usually #3100)
SELECT id, account_number, account_name FROM accounts 
WHERE account_number = '3100' OR account_name ILIKE '%owner%draw%'
LIMIT 1;

-- Step 2: Look at bank transactions that are cleared and marked as owner draws
SELECT 
  bt.id,
  bt.transaction_date,
  bt.amount,
  bt.description,
  bt.is_cleared,
  bt.is_owner_draw,
  bt.category,
  bt.draw_status
FROM bank_transactions bt
WHERE bt.is_cleared = TRUE
  AND bt.is_owner_draw = TRUE
ORDER BY bt.transaction_date DESC
LIMIT 20;

-- Step 3: Find which of these cleared owner draws DON'T have journal entries
SELECT 
  bt.id,
  bt.transaction_date,
  bt.amount,
  bt.description,
  bt.category,
  CASE WHEN je.id IS NULL THEN 'MISSING ENTRY' ELSE 'Has entry' END as entry_status,
  je.id as journal_entry_id,
  je.entry_number
FROM bank_transactions bt
LEFT JOIN journal_entries je ON je.reference_id = bt.id AND je.reference_type = 'bank_transaction'
WHERE bt.is_cleared = TRUE
  AND bt.is_owner_draw = TRUE
ORDER BY bt.transaction_date DESC;

-- Step 4: Check if any of the cleared owner draws are missing a category
SELECT 
  id,
  transaction_date,
  amount,
  description,
  category
FROM bank_transactions
WHERE is_cleared = TRUE
  AND is_owner_draw = TRUE
  AND category IS NULL
ORDER BY transaction_date DESC;
