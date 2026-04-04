-- ============================================================
-- AUDIT: Compare Cleared Bank Transactions vs Journal Entries
-- Shows which cleared transactions are MISSING journal entries
-- and which journal entries are ORPHANED (no matching transaction)
-- ============================================================


-- ============================================================
-- SECTION 1: CLEARED TRANSACTIONS WITH NO JOURNAL ENTRY
-- These are the problem ones — cleared but not recorded in ledger
-- ============================================================
SELECT
  bt.id                   AS transaction_id,
  bt.transaction_date,
  bt.description,
  bt.payee,
  bt.amount,
  bt.transaction_type,
  ba.account_name         AS bank_account,
  'MISSING JOURNAL ENTRY' AS status
FROM bank_transactions bt
JOIN bank_accounts ba ON ba.id = bt.bank_account_id
LEFT JOIN journal_entries je
  ON je.reference_type = 'bank_transaction'
  AND je.reference_id = bt.id
WHERE bt.is_cleared = true
  AND je.id IS NULL
ORDER BY bt.transaction_date ASC;


-- ============================================================
-- SECTION 2: CLEARED TRANSACTIONS THAT DO HAVE A JOURNAL ENTRY
-- Good — these are properly recorded
-- ============================================================
SELECT
  bt.id                   AS transaction_id,
  bt.transaction_date,
  bt.description,
  bt.payee,
  bt.amount,
  je.entry_number,
  je.is_posted,
  '✅ HAS JOURNAL ENTRY'  AS status
FROM bank_transactions bt
JOIN bank_accounts ba ON ba.id = bt.bank_account_id
JOIN journal_entries je
  ON je.reference_type = 'bank_transaction'
  AND je.reference_id = bt.id
WHERE bt.is_cleared = true
ORDER BY bt.transaction_date ASC;


-- ============================================================
-- SECTION 3: JOURNAL ENTRIES REFERENCING bank_transaction
-- but the transaction is NOT cleared (or doesn't exist)
-- These are orphaned / stale journal entries
-- ============================================================
SELECT
  je.id                     AS journal_entry_id,
  je.entry_number,
  je.entry_date,
  je.description,
  je.reference_id           AS transaction_id,
  bt.is_cleared,
  CASE
    WHEN bt.id IS NULL      THEN '❌ ORPHANED - Transaction deleted'
    WHEN bt.is_cleared = false THEN '⚠️ Transaction was uncleared'
    ELSE '✅ OK'
  END AS status
FROM journal_entries je
LEFT JOIN bank_transactions bt ON bt.id = je.reference_id
WHERE je.reference_type = 'bank_transaction'
ORDER BY je.entry_date ASC;


-- ============================================================
-- SECTION 4: SUMMARY COUNTS
-- Quick overview of the health of your journal entries
-- ============================================================
SELECT
  COUNT(*) FILTER (WHERE bt.is_cleared = true AND je.id IS NULL)   AS cleared_missing_journal,
  COUNT(*) FILTER (WHERE bt.is_cleared = true AND je.id IS NOT NULL) AS cleared_with_journal,
  COUNT(*) FILTER (WHERE bt.is_cleared = false)                     AS uncleared_transactions,
  COUNT(DISTINCT bt.id)                                             AS total_transactions
FROM bank_transactions bt
LEFT JOIN journal_entries je
  ON je.reference_type = 'bank_transaction'
  AND je.reference_id = bt.id;
