-- =============================================
-- FIND ALL JOURNAL ENTRIES FOR $165.92 PAYMENT
-- =============================================

-- Step 1: Find ALL journal entries with $165.92 amount
SELECT 
    je.id,
    je.entry_number,
    je.entry_date,
    je.description,
    je.is_posted,
    je.reference_type,
    je.reference_id,
    je.created_at
FROM journal_entries je
JOIN journal_entry_lines jel ON jel.entry_id = je.id
WHERE jel.debit = 165.92 OR jel.credit = 165.92
GROUP BY je.id, je.entry_number, je.entry_date, je.description, je.is_posted, je.reference_type, je.reference_id, je.created_at
ORDER BY je.created_at DESC;

-- Step 2: Show the lines for those entries
SELECT 
    je.entry_number,
    je.description,
    je.reference_type,
    a.account_number,
    a.account_name,
    jel.debit,
    jel.credit
FROM journal_entries je
JOIN journal_entry_lines jel ON jel.entry_id = je.id
JOIN accounts a ON jel.account_id = a.id
WHERE je.id IN (
    SELECT DISTINCT je2.id
    FROM journal_entries je2
    JOIN journal_entry_lines jel2 ON jel2.entry_id = je2.id
    WHERE jel2.debit = 165.92 OR jel2.credit = 165.92
)
ORDER BY je.entry_number, jel.line_number;

-- Step 3: DELETE ALL journal entries for $165.92 (uncomment to run)

DELETE FROM journal_entries
WHERE id IN (
    SELECT DISTINCT je.id
    FROM journal_entries je
    JOIN journal_entry_lines jel ON jel.entry_id = je.id
    WHERE jel.debit = 165.92 OR jel.credit = 165.92
)
RETURNING entry_number, description, reference_type;
*/
