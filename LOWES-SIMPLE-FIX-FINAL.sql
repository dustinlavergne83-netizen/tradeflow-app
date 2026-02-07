-- ============================================
-- LOWES CREDIT CARD - SIMPLE FINAL FIX
-- ============================================
-- This creates the CORRECT opening balance entry
-- so payments will work properly going forward

-- STEP 1: Delete ALL bad journal entries for account 2110
DELETE FROM journal_entry_lines 
WHERE entry_id IN (
  SELECT id FROM journal_entries 
  WHERE reference_id = '2110' 
     OR reference_id IN (
       SELECT id FROM accounts WHERE account_number = '2110'
     )
);

DELETE FROM journal_entries 
WHERE reference_id = '2110' 
   OR reference_id IN (
     SELECT id FROM accounts WHERE account_number = '2110'
   );

-- STEP 2: Get the account ID for Lowes
-- (We'll use this in Step 3)

-- STEP 3: Create ONE correct opening balance entry
-- This creates: EQUITY (or Opening Balance) account CREDITED 6,723.14
--              Lowes Card account CREDITED 6,723.14
-- This matches the -$6,723.14 you see in Chart

-- Get the next entry number
DO $$
DECLARE
  v_next_entry_num INT;
  v_account_id UUID;
  v_equity_account_id UUID;
  v_company_id UUID;
  v_entry_id UUID;
BEGIN
  -- Get the company ID (assuming first/only company)
  SELECT id INTO v_company_id FROM accounts WHERE account_number = '2110' LIMIT 1;
  
  IF v_company_id IS NOT NULL THEN
    -- Get the account ID for Lowes 2110
    SELECT id INTO v_account_id FROM accounts WHERE account_number = '2110' AND company_id = v_company_id LIMIT 1;
    
    -- Get or find an Equity account for opening balance
    SELECT id INTO v_equity_account_id 
    FROM accounts 
    WHERE company_id = v_company_id 
      AND account_type = 'Equity' 
    LIMIT 1;
    
    -- If no Equity account, use Opening Balance Equity if it exists
    IF v_equity_account_id IS NULL THEN
      SELECT id INTO v_equity_account_id 
      FROM accounts 
      WHERE company_id = v_company_id 
        AND account_name ILIKE '%opening%' 
      LIMIT 1;
    END IF;
    
    IF v_account_id IS NOT NULL AND v_equity_account_id IS NOT NULL THEN
      -- Get next entry number
      SELECT COALESCE(MAX(entry_number), 0) + 1 
      INTO v_next_entry_num 
      FROM journal_entries 
      WHERE company_id = v_company_id;
      
      -- Create the journal entry for opening balance
      INSERT INTO journal_entries (
        entry_number, 
        entry_date, 
        description, 
        reference_type, 
        reference_id, 
        created_by, 
        company_id,
        is_posted,
        posted_date
      ) VALUES (
        v_next_entry_num,
        CURRENT_DATE,
        'Opening balance for Lowes Credit Card',
        'opening_balance',
        v_account_id::text,
        (SELECT id FROM auth.users LIMIT 1),
        v_company_id,
        true,
        CURRENT_TIMESTAMP
      ) RETURNING id INTO v_entry_id;
      
      -- Create the journal entry lines:
      -- Line 1: Equity/Opening account = DEBIT 6,723.14
      -- Line 2: Lowes Card account = CREDIT 6,723.14
      INSERT INTO journal_entry_lines (
        entry_id, 
        line_number, 
        account_id, 
        debit, 
        credit, 
        description
      ) VALUES 
        (v_entry_id, 1, v_equity_account_id, 6723.14, 0, 'Opening balance credit'),
        (v_entry_id, 2, v_account_id, 0, 6723.14, 'Lowes Credit Card liability');
      
      RAISE NOTICE 'SUCCESS: Opening balance entry created for Lowes Credit Card';
    ELSE
      RAISE EXCEPTION 'Account or Equity account not found';
    END IF;
  ELSE
    RAISE EXCEPTION 'Company ID not found';
  END IF;
END $$;

-- VERIFY the entry was created
SELECT je.entry_number, je.description, je.is_posted
FROM journal_entries je
WHERE je.description ILIKE '%lowes%'
ORDER BY je.created_at DESC
LIMIT 1;

SELECT jel.debit, jel.credit, a.account_name
FROM journal_entry_lines jel
JOIN accounts a ON jel.account_id = a.id
WHERE jel.entry_id = (
  SELECT id FROM journal_entries 
  WHERE description ILIKE '%lowes%'
  ORDER BY created_at DESC LIMIT 1
);
