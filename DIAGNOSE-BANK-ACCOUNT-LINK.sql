-- ============================================================================
-- DIAGNOSE BANK ACCOUNT LINK ISSUE
-- ============================================================================
-- This script checks what's actually stored in the bank_accounts table
-- and helps identify why the journal entry creation is failing

-- Step 1: Check HW Business Checking account details
SELECT 
  id,
  account_name,
  bank_name,
  account_number,
  chart_account_id,
  created_at,
  updated_at
FROM bank_accounts
WHERE account_name ILIKE '%business%checking%'
  OR account_name ILIKE '%HW%'
  OR account_number = '1186'
LIMIT 5;

-- ============================================================================
-- Step 2: Check if there's a column name issue
-- ============================================================================
-- If chart_account_id is null, try to see what columns exist
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_name = 'bank_accounts'
-- ORDER BY ordinal_position;

-- ============================================================================
-- Step 3: Get the account ID of account 1010
-- ============================================================================
SELECT 
  id,
  account_number,
  account_name,
  account_type
FROM accounts
WHERE account_number = '1010'
  OR account_name ILIKE '%HW Business Checking%'
  OR account_name ILIKE '%Checking%'
LIMIT 5;

-- ============================================================================
-- Step 4: Update the bank_accounts to link chart_account_id if missing
-- ============================================================================
-- If the HW Business Checking bank account is missing the chart_account_id link:

-- First, get the chart account ID for 1010
-- Then update the bank account with it
UPDATE bank_accounts
SET chart_account_id = (
  SELECT id FROM accounts 
  WHERE account_number = '1010' 
  LIMIT 1
)
WHERE account_name LIKE '%Business Checking%'
  AND chart_account_id IS NULL;

-- ============================================================================
-- Step 5: Verify the update
-- ============================================================================
SELECT 
  id,
  account_name,
  bank_name,
  account_number,
  chart_account_id,
  (SELECT account_number FROM accounts WHERE id = chart_account_id) as linked_account_number,
  (SELECT account_name FROM accounts WHERE id = chart_account_id) as linked_account_name
FROM bank_accounts
WHERE account_name ILIKE '%business%checking%'
  OR account_name ILIKE '%HW%'
  OR account_number = '1186';

-- ============================================================================
-- Step 6: If still null, check if there's a different field name being used
-- ============================================================================
-- SELECT * FROM bank_accounts 
-- WHERE account_number = '1186'
-- LIMIT 1;
