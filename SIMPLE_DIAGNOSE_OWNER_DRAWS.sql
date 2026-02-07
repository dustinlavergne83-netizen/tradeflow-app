-- SIMPLE DIAGNOSTIC - Show ALL owner draw transactions currently in database
SELECT 
  id,
  transaction_date,
  amount,
  description,
  is_cleared,
  is_owner_draw,
  draw_status
FROM bank_transactions
WHERE is_owner_draw = TRUE
ORDER BY transaction_date DESC;
