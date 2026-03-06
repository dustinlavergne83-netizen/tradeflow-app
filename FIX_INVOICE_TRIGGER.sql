-- FIX: Drop the problematic trigger that auto-creates journal entries on invoice updates
-- This trigger is causing "duplicate key value violates unique constraint journal_entries_company_id_entry_number_key"
-- which rolls back the entire invoice update transaction (making status changes impossible)

-- Step 1: Find and list all triggers on the invoices table
SELECT trigger_name, event_manipulation, action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'invoices';

-- Step 2: Drop the trigger(s) that create journal entries
-- Uncomment the appropriate DROP line after running Step 1 to see the trigger names

-- Common trigger names to try:
DROP TRIGGER IF EXISTS create_invoice_journal_entry ON invoices;
DROP TRIGGER IF EXISTS invoice_journal_entry_trigger ON invoices;
DROP TRIGGER IF EXISTS auto_create_journal_entry ON invoices;
DROP TRIGGER IF EXISTS on_invoice_update ON invoices;
DROP TRIGGER IF EXISTS invoice_status_change ON invoices;
DROP TRIGGER IF EXISTS trigger_invoice_journal ON invoices;

-- If the above doesn't work, this will drop ALL triggers on invoices table:
-- DO $$ 
-- DECLARE
--     trigger_rec RECORD;
-- BEGIN
--     FOR trigger_rec IN 
--         SELECT trigger_name 
--         FROM information_schema.triggers 
--         WHERE event_object_table = 'invoices'
--     LOOP
--         EXECUTE format('DROP TRIGGER IF EXISTS %I ON invoices', trigger_rec.trigger_name);
--         RAISE NOTICE 'Dropped trigger: %', trigger_rec.trigger_name;
--     END LOOP;
-- END $$;

-- After running this, invoice saves will work properly.
-- Journal entries are already created by the app code when invoices are SENT (handleSendEmail function).
