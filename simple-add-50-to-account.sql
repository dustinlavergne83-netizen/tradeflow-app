-- ============================================
-- SIMPLE FIX: Add $50 to Bank Account Balance
-- Directly updates the account balance
-- ============================================

DO $$
DECLARE
    v_user_id UUID;
    v_bank_account_id UUID;
BEGIN
    -- Get the user ID
    SELECT id INTO v_user_id FROM auth.users LIMIT 1;
    
    RAISE NOTICE 'User ID: %', v_user_id;
    
    -- Find the HW Business Checking account
    SELECT id INTO v_bank_account_id 
    FROM accounts 
    WHERE (account_name ILIKE '%HW Business Checking%' OR account_number = '1010')
    AND company_id = v_user_id
    LIMIT 1;
    
    IF v_bank_account_id IS NULL THEN
        RAISE EXCEPTION 'HW Business Checking account not found!';
    END IF;
    
    RAISE NOTICE 'Found bank account ID: %', v_bank_account_id;
    
    -- Update the balance directly
    UPDATE accounts 
    SET balance = COALESCE(balance, 0) + 50.00
    WHERE id = v_bank_account_id;
    
    RAISE NOTICE '✓ Added $50.00 to account balance';
    
END $$;

-- Show the updated balance
SELECT 
    account_number,
    account_name,
    account_type,
    balance as current_balance
FROM accounts
WHERE account_name ILIKE '%HW Business Checking%' OR account_number = '1010';
