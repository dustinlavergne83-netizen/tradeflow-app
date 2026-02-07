-- ============================================
-- FIX BROKEN JOURNAL ENTRIES AND SETUP AUTOMATION
-- ============================================

-- Step 1: Delete the broken journal entry (unbalanced entry JE-2026-00001)
-- This will cascade and delete the related journal_entry_lines
DELETE FROM journal_entries WHERE entry_number = 'JE-2026-00001';

-- Step 2: Create proper journal entries for existing invoices
-- Invoice #1001 - $5,330 (CET Consulting, LLC)
-- Invoice #1002 - $240 (Kimberly Holleman)

-- Create journal entry for Invoice #1001
INSERT INTO journal_entries (
  entry_number,
  entry_date,
  description,
  reference_type,
  reference_id,
  is_posted,
  created_by,
  company_id
)
SELECT 
  'JE-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' || LPAD((
    SELECT COALESCE(
      MAX(CAST(SUBSTRING(entry_number FROM 9) AS INTEGER)), 0
    ) + 1
    FROM journal_entries 
    WHERE entry_number LIKE 'JE-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-%'
  )::text, 5, '0'),
  invoice_date,
  'Invoice #' || invoice_number || ' - ' || customer_name,
  'invoice',
  id,
  true,
  created_by,
  created_by
FROM invoices
WHERE invoice_number = '1001';

-- Create journal entry lines for Invoice #1001
INSERT INTO journal_entry_lines (
  entry_id,
  line_number,
  account_id,
  debit,
  credit,
  description
)
SELECT 
  (SELECT id FROM journal_entries WHERE reference_type = 'invoice' AND reference_id = (SELECT id FROM invoices WHERE invoice_number = '1001')),
  1,
  (SELECT id FROM accounts WHERE account_number = '1100'),  -- Accounts Receivable
  5330.00,
  0,
  'Invoice #1001 - Accounts Receivable'
UNION ALL
SELECT 
  (SELECT id FROM journal_entries WHERE reference_type = 'invoice' AND reference_id = (SELECT id FROM invoices WHERE invoice_number = '1001')),
  2,
  (SELECT id FROM accounts WHERE account_number = '4000'),  -- Service Revenue
  0,
  5330.00,
  'Invoice #1001 - Service Revenue';

-- Create journal entry for Invoice #1002
INSERT INTO journal_entries (
  entry_number,
  entry_date,
  description,
  reference_type,
  reference_id,
  is_posted,
  created_by,
  company_id
)
SELECT 
  'JE-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' || LPAD((
    SELECT COALESCE(
      MAX(CAST(SUBSTRING(entry_number FROM 9) AS INTEGER)), 0
    ) + 1
    FROM journal_entries 
    WHERE entry_number LIKE 'JE-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-%'
  )::text, 5, '0'),
  invoice_date,
  'Invoice #' || invoice_number || ' - ' || customer_name,
  'invoice',
  id,
  true,
  created_by,
  created_by
FROM invoices
WHERE invoice_number = '1002';

-- Create journal entry lines for Invoice #1002
INSERT INTO journal_entry_lines (
  entry_id,
  line_number,
  account_id,
  debit,
  credit,
  description
)
SELECT 
  (SELECT id FROM journal_entries WHERE reference_type = 'invoice' AND reference_id = (SELECT id FROM invoices WHERE invoice_number = '1002')),
  1,
  (SELECT id FROM accounts WHERE account_number = '1100'),  -- Accounts Receivable
  240.00,
  0,
  'Invoice #1002 - Accounts Receivable'
UNION ALL
SELECT 
  (SELECT id FROM journal_entries WHERE reference_type = 'invoice' AND reference_id = (SELECT id FROM invoices WHERE invoice_number = '1002')),
  2,
  (SELECT id FROM accounts WHERE account_number = '4000'),  -- Service Revenue
  0,
  240.00,
  'Invoice #1002 - Service Revenue';

-- Step 3: Create a function to automatically create journal entries when invoices are sent
CREATE OR REPLACE FUNCTION create_invoice_journal_entry()
RETURNS TRIGGER AS $$
DECLARE
  v_entry_number TEXT;
  v_entry_id UUID;
  v_ar_account_id UUID;
  v_revenue_account_id UUID;
  v_next_number INTEGER;
BEGIN
  -- Only create journal entry when invoice status changes TO 'sent' (and it's not already 'sent')
  IF NEW.status = 'sent' AND (OLD.status IS NULL OR OLD.status != 'sent') THEN
    
    -- Get Accounts Receivable account (1100)
    SELECT id INTO v_ar_account_id
    FROM accounts
    WHERE account_number = '1100' AND company_id = NEW.created_by
    LIMIT 1;
    
    -- Get Service Revenue account (4000)
    SELECT id INTO v_revenue_account_id
    FROM accounts
    WHERE account_number = '4000' AND company_id = NEW.created_by
    LIMIT 1;
    
    -- Check if both accounts exist
    IF v_ar_account_id IS NULL OR v_revenue_account_id IS NULL THEN
      RAISE NOTICE 'Cannot create journal entry: Required accounts (1100 or 4000) not found';
      RETURN NEW;
    END IF;
    
    -- Get next entry number in format JE-YYYY-NNNNN
    SELECT COALESCE(
      MAX(CAST(SUBSTRING(entry_number FROM 9) AS INTEGER)), 0
    ) + 1 INTO v_next_number
    FROM journal_entries
    WHERE company_id = NEW.created_by
      AND entry_number LIKE 'JE-' || TO_CHAR(NEW.invoice_date, 'YYYY') || '-%';
    
    -- Format as JE-YYYY-NNNNN (e.g., JE-2026-00001)
    v_entry_number := 'JE-' || TO_CHAR(NEW.invoice_date, 'YYYY') || '-' || LPAD(v_next_number::text, 5, '0');
    
    -- Create journal entry
    INSERT INTO journal_entries (
      entry_number,
      entry_date,
      description,
      reference_type,
      reference_id,
      is_posted,
      created_by,
      company_id
    ) VALUES (
      v_entry_number,
      NEW.invoice_date,
      'Invoice #' || NEW.invoice_number || ' - ' || COALESCE(NEW.customer_name, 'Customer'),
      'invoice',
      NEW.id,
      true,
      NEW.created_by,
      NEW.created_by
    )
    RETURNING id INTO v_entry_id;
    
    -- Create journal entry lines (Debit AR, Credit Revenue)
    INSERT INTO journal_entry_lines (
      entry_id,
      line_number,
      account_id,
      debit,
      credit,
      description
    ) VALUES
    (
      v_entry_id,
      1,
      v_ar_account_id,
      NEW.total,
      0,
      'Accounts Receivable - Invoice #' || NEW.invoice_number
    ),
    (
      v_entry_id,
      2,
      v_revenue_account_id,
      0,
      NEW.total,
      'Service Revenue - Invoice #' || NEW.invoice_number
    );
    
    RAISE NOTICE 'Created journal entry % for invoice %', v_entry_number, NEW.invoice_number;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Create trigger to automatically create journal entries
DROP TRIGGER IF EXISTS invoice_sent_create_journal_entry ON invoices;

CREATE TRIGGER invoice_sent_create_journal_entry
  AFTER INSERT OR UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION create_invoice_journal_entry();

-- Step 5: Verify the results
SELECT 
  'Journal Entries' as type,
  je.entry_number,
  je.entry_date,
  je.description,
  SUM(jel.debit) as total_debits,
  SUM(jel.credit) as total_credits,
  CASE 
    WHEN SUM(jel.debit) = SUM(jel.credit) THEN '✓ BALANCED'
    ELSE '✗ UNBALANCED'
  END as status
FROM journal_entries je
JOIN journal_entry_lines jel ON je.id = jel.entry_id
WHERE je.reference_type = 'invoice'
GROUP BY je.id, je.entry_number, je.entry_date, je.description
ORDER BY je.entry_number;
