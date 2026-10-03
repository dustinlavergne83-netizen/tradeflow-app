-- Fixes a bug in 083_auto_fix_account_balances.sql's balance-recalculation
-- trigger/function:
--
--   1. It bucketed accounts by account_type IN ('Asset','Expense','Drawing')
--      vs ('Liability','Equity','Revenue') to decide debit-vs-credit sign.
--      This app's actual account_type values are 'Asset', 'Expense',
--      'Liability', 'Equity', and 'Income' (NOT 'Revenue' or 'Drawing').
--      Any account_type that didn't literally match one of those six
--      strings fell into the trigger's "ELSE 0" branch and got its
--      balance silently zeroed out every time any journal entry touching
--      that account was posted (this is why Labor Revenue and Other
--      Income, both type 'Income', kept resetting to 0.00).
--   2. It also got the sign wrong for accounts whose account_type doesn't
--      match their normal_balance (e.g. "Owner Draws" is Equity but has
--      normal_balance = 'debit' since draws reduce equity) — those got
--      computed with the opposite formula from what they should use.
--
-- The fix: always use the account's own normal_balance column to decide
-- the sign, rather than guessing from account_type. This also means the
-- function no longer needs to hardcode a list of type strings, so it
-- can't drift out of sync with whatever account_type values get added later.

CREATE OR REPLACE FUNCTION recalculate_account_balance_from_entries()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE accounts
  SET balance = (
    SELECT COALESCE(SUM(
      CASE
        WHEN accounts.normal_balance = 'debit' THEN
          COALESCE(jel.debit, 0) - COALESCE(jel.credit, 0)
        ELSE
          COALESCE(jel.credit, 0) - COALESCE(jel.debit, 0)
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

-- One-time full recalculation to clear out any balances that drifted due to
-- the bug above, or due to journal_entry_lines being edited/reclassified
-- directly (UPDATEs to journal_entry_lines never fire this trigger, which
-- only runs on journal_entries insert/is_posted changes — so any script
-- that moves a line to a different account without also touching
-- journal_entries.is_posted will leave the cached balance stale until this
-- kind of full resync runs).
UPDATE accounts a
SET balance = (
  SELECT COALESCE(SUM(
    CASE
      WHEN a.normal_balance = 'debit' THEN
        COALESCE(jel.debit, 0) - COALESCE(jel.credit, 0)
      ELSE
        COALESCE(jel.credit, 0) - COALESCE(jel.debit, 0)
    END
  ), 0)
  FROM journal_entry_lines jel
  JOIN journal_entries je ON jel.entry_id = je.id
  WHERE jel.account_id = a.id
    AND je.is_posted = true
    AND je.company_id = a.company_id
)
WHERE a.is_active = true;

COMMENT ON FUNCTION recalculate_account_balance_from_entries IS
  'Recalculates accounts.balance from posted journal_entry_lines using each account''s own normal_balance column (not account_type) to determine debit/credit sign. Fixed in migration 106 after discovering account_type=''Income'' and the Equity/debit-normal "Owner Draws" account were being computed incorrectly or zeroed out by the original 083 version.';
