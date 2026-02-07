-- DELETE unposted journal entry lines from AR and Customer Deposits accounts

DELETE FROM journal_entry_lines jel
WHERE jel.account_id IN (
  SELECT id FROM accounts WHERE account_number IN ('1100', '2700')
)
AND jel.entry_id IN (
  SELECT id FROM journal_entries WHERE is_posted = false
);

-- Verify deletion
SELECT COUNT(*) as remaining_unposted_lines
FROM journal_entry_lines jel
WHERE jel.account_id IN (
  SELECT id FROM accounts WHERE account_number IN ('1100', '2700')
);
