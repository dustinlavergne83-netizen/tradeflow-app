-- ============================================================
-- FIX: Create missing journal entries for cleared bank transactions
-- Run STEP 1 first to preview, then STEP 2 to apply the fix
-- ============================================================


-- ============================================================
-- STEP 1: PREVIEW - See what will be created (and what will be skipped)
-- ============================================================

-- Transactions that WILL get a journal entry created (have a category assigned)
SELECT
  bt.id,
  bt.transaction_date,
  bt.description,
  bt.amount,
  bt.category                    AS offset_account_id,
  a.account_name                 AS offset_account_name,
  ba.account_name                AS bank_account,
  ba.chart_account_id            AS bank_chart_account_id,
  'WILL BE FIXED'                AS action
FROM bank_transactions bt
JOIN bank_accounts ba ON ba.id = bt.bank_account_id
LEFT JOIN accounts a ON a.id = bt.category::uuid
LEFT JOIN journal_entries je
  ON je.reference_type = 'bank_transaction'
  AND je.reference_id = bt.id
WHERE bt.is_cleared = true
  AND je.id IS NULL
  AND bt.category IS NOT NULL
  AND ba.chart_account_id IS NOT NULL
ORDER BY bt.transaction_date ASC;

-- Transactions that WILL BE SKIPPED (missing category or bank not linked to chart of accounts)
SELECT
  bt.id,
  bt.transaction_date,
  bt.description,
  bt.amount,
  CASE
    WHEN bt.category IS NULL THEN '⚠️ No category assigned'
    WHEN ba.chart_account_id IS NULL THEN '⚠️ Bank account not linked to Chart of Accounts'
    ELSE '❓ Unknown reason'
  END AS skip_reason
FROM bank_transactions bt
JOIN bank_accounts ba ON ba.id = bt.bank_account_id
LEFT JOIN journal_entries je
  ON je.reference_type = 'bank_transaction'
  AND je.reference_id = bt.id
WHERE bt.is_cleared = true
  AND je.id IS NULL
  AND (bt.category IS NULL OR ba.chart_account_id IS NULL)
ORDER BY bt.transaction_date ASC;


-- ============================================================
-- STEP 2: APPLY THE FIX
-- Creates journal entries + lines for all cleared transactions
-- that have a category AND have the bank linked to chart of accounts
-- ============================================================

DO $$
DECLARE
  rec         RECORD;
  new_entry   RECORD;
  max_num     INTEGER;
  entry_num   TEXT;
  bank_debit  NUMERIC;
  bank_credit NUMERIC;
  off_debit   NUMERIC;
  off_credit  NUMERIC;
  count_fixed INTEGER := 0;
  count_skipped INTEGER := 0;
BEGIN

  -- Find current max sequential entry number for this year
  SELECT COALESCE(MAX(
    CASE
      WHEN entry_number ~ ('^JE-' || EXTRACT(YEAR FROM NOW())::TEXT || '-[0-9]+$')
      THEN SUBSTRING(entry_number FROM '[0-9]+$')::INTEGER
      ELSE 0
    END
  ), 0)
  INTO max_num
  FROM journal_entries;

  RAISE NOTICE 'Starting from entry number: %', max_num;

  -- Loop through every cleared transaction missing a journal entry
  FOR rec IN
    SELECT
      bt.id               AS transaction_id,
      bt.transaction_date,
      bt.description,
      bt.amount,
      bt.category::uuid   AS offset_account_id,
      bt.created_by,
      ba.chart_account_id AS bank_account_id
    FROM bank_transactions bt
    JOIN bank_accounts ba ON ba.id = bt.bank_account_id
    LEFT JOIN journal_entries je
      ON je.reference_type = 'bank_transaction'
      AND je.reference_id = bt.id
    WHERE bt.is_cleared = true
      AND je.id IS NULL
      AND bt.category IS NOT NULL
      AND ba.chart_account_id IS NOT NULL
    ORDER BY bt.transaction_date ASC, bt.created_at ASC
  LOOP
    -- Build sequential entry number
    max_num   := max_num + 1;
    entry_num := 'JE-' || EXTRACT(YEAR FROM rec.transaction_date::date)::TEXT ||
                 '-' || LPAD(max_num::TEXT, 5, '0');

    -- Debit/Credit logic:
    -- Deposit (amount > 0):  Bank DEBIT,   Offset CREDIT
    -- Withdrawal (amount < 0): Bank CREDIT, Offset DEBIT
    bank_debit  := CASE WHEN rec.amount > 0 THEN ABS(rec.amount) ELSE 0 END;
    bank_credit := CASE WHEN rec.amount < 0 THEN ABS(rec.amount) ELSE 0 END;
    off_debit   := CASE WHEN rec.amount < 0 THEN ABS(rec.amount) ELSE 0 END;
    off_credit  := CASE WHEN rec.amount > 0 THEN ABS(rec.amount) ELSE 0 END;

    -- Create the journal entry header
    INSERT INTO journal_entries (
      company_id,
      entry_number,
      entry_date,
      description,
      is_posted,
      posted_at,
      posted_by,
      created_by,
      reference_type,
      reference_id
    ) VALUES (
      rec.created_by,
      entry_num,
      rec.transaction_date::date,
      SUBSTRING(COALESCE(rec.description, 'Bank transaction'), 1, 50),
      true,
      NOW(),
      rec.created_by,
      rec.created_by,
      'bank_transaction',
      rec.transaction_id
    )
    RETURNING * INTO new_entry;

    -- Create Line 1: Bank account
    INSERT INTO journal_entry_lines (entry_id, line_number, account_id, debit, credit, description)
    VALUES (new_entry.id, 1, rec.bank_account_id, bank_debit, bank_credit, 'Bank transaction');

    -- Create Line 2: Offset account (expense/income/equity)
    INSERT INTO journal_entry_lines (entry_id, line_number, account_id, debit, credit, description)
    VALUES (new_entry.id, 2, rec.offset_account_id, off_debit, off_credit,
            SUBSTRING(COALESCE(rec.description, 'Offset'), 1, 50));

    count_fixed := count_fixed + 1;
    RAISE NOTICE '✅ Created % for transaction % (%) | $%',
      entry_num, rec.transaction_id, rec.description, rec.amount;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '==============================';
  RAISE NOTICE 'DONE! Created % journal entries', count_fixed;
  RAISE NOTICE '==============================';

END $$;


-- ============================================================
-- STEP 3: VERIFY - Confirm all cleared transactions now have entries
-- ============================================================

-- Should return 0 rows if everything was fixed
SELECT
  COUNT(*) AS still_missing
FROM bank_transactions bt
JOIN bank_accounts ba ON ba.id = bt.bank_account_id
LEFT JOIN journal_entries je
  ON je.reference_type = 'bank_transaction'
  AND je.reference_id = bt.id
WHERE bt.is_cleared = true
  AND je.id IS NULL
  AND bt.category IS NOT NULL
  AND ba.chart_account_id IS NOT NULL;

-- Show the newly created entries
SELECT
  je.entry_number,
  je.entry_date,
  je.description,
  bt.amount,
  je.is_posted
FROM journal_entries je
JOIN bank_transactions bt ON bt.id = je.reference_id
WHERE je.reference_type = 'bank_transaction'
ORDER BY je.entry_date ASC, je.entry_number ASC;
