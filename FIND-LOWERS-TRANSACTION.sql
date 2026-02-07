-- ==========================================
-- FIND THE LOWES TRANSACTION
-- ==========================================

-- First, let's find ALL recent withdrawals to locate the Lowe's one
SELECT id, description, amount, transaction_date, is_cleared 
FROM bank_transactions 
WHERE amount < 0
ORDER BY transaction_date DESC 
LIMIT 20;

-- If the above doesn't show it, search for any transaction mentioning lowes (case insensitive)
SELECT id, description, amount, transaction_date, is_cleared 
FROM bank_transactions 
WHERE description ILIKE '%lowe%' OR description ILIKE '%lowes%'
ORDER BY transaction_date DESC;

-- Or search by the exact amount (if you remember it exactly)
-- Uncomment and replace -250 with the actual amount if needed
-- SELECT id, description, amount, transaction_date, is_cleared 
-- FROM bank_transactions 
-- WHERE amount = -250
-- ORDER BY transaction_date DESC;

-- Once you find the transaction ID, run this to see if there are journal entries for it:
-- Replace 'TRANSACTION_ID_FROM_ABOVE' with the actual ID
-- SELECT * FROM journal_entries 
-- WHERE reference_type = 'bank_transaction' 
-- AND reference_id = 'TRANSACTION_ID_FROM_ABOVE';
