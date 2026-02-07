-- This migration creates a trigger that automatically recalculates account balances
-- whenever a journal entry is posted. This ensures the Chart of Accounts always
-- shows correct balances based on posted journal entries.

CREATE OR REPLACE FUNCTION recalculate_account_balance_from_entries()
RETURNS TRIGGER AS $$
BEGIN
  -- When a journal entry is posted, recalculate all affected account balances
  -- Update balances for all accounts in this journal entry
  
  UPDATE accounts
  SET balance = (
    SELECT COALESCE(SUM(
      CASE 
        WHEN account_type IN ('Asset', 'Expense', 'Drawing') THEN
          COALESCE(jel.debit, 0) - COALESCE(jel.credit, 0)
        WHEN account_type IN ('Liability', 'Equity', 'Revenue') THEN
          COALESCE(jel.credit, 0) - COALESCE(jel.debit, 0)
        ELSE 0
      END
    ), 0)
    FROM journal_entry_lines jel
    JOIN journal_entries je ON jel.entry_id = je.id
    WHERE jel.account_id = accounts.id
      AND je.is_posted = true
      AND je.company_id = NEW.company_id
  )
  WHERE id IN (
    SELECT DISTINCT jel.account_id
    FROM journal_entry_lines jel
    WHERE jel.entry_id = NEW.id
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop the old trigger if it exists
DROP TRIGGER IF EXISTS after_journal_entry_posted ON journal_entries;

-- Create the trigger that fires AFTER a journal entry is marked as posted
CREATE TRIGGER after_journal_entry_posted
AFTER UPDATE OF is_posted ON journal_entries
FOR EACH ROW
WHEN (NEW.is_posted = true AND OLD.is_posted = false)
EXECUTE FUNCTION recalculate_account_balance_from_entries();

-- Also add a trigger for new journal entries that start as posted
CREATE TRIGGER after_journal_entry_insert_posted
AFTER INSERT ON journal_entries
FOR EACH ROW
WHEN (NEW.is_posted = true)
EXECUTE FUNCTION recalculate_account_balance_from_entries();

-- IMMEDIATE FIX: Recalculate all account balances right now
UPDATE accounts a
SET balance = (
  SELECT COALESCE(SUM(
    CASE 
      WHEN a.account_type IN ('Asset', 'Expense', 'Drawing') THEN
        COALESCE(jel.debit, 0) - COALESCE(jel.credit, 0)
      WHEN a.account_type IN ('Liability', 'Equity', 'Revenue') THEN
        COALESCE(jel.credit, 0) - COALESCE(jel.debit, 0)
      ELSE 0
    END
  ), 0)
  FROM journal_entry_lines jel
  JOIN journal_entries je ON jel.entry_id = je.id
  WHERE jel.account_id = a.id
    AND je.is_posted = true
    AND je.company_id = a.company_id
)
WHERE a.is_active = true;
