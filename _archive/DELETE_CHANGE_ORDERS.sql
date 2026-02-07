-- ============================================
-- DELETE CHANGE ORDERS
-- ============================================
-- This script deletes change orders and their related data
-- Use this when you can't delete change orders through the UI
-- 
-- WARNING: This will permanently delete change order data!
-- Make sure you have a backup before running this.
-- ============================================

-- ============================================
-- STEP 1: View all existing change orders
-- ============================================
-- Run this first to see what you have

SELECT 
    id,
    project_id,
    co_number,
    description,
    total_amount,
    status,
    created_at
FROM change_orders
ORDER BY created_at DESC;

-- ============================================
-- OPTION A: Delete ALL change orders
-- ============================================
-- Use this if you want to delete all change orders

-- Step 1: Delete change order items (child table first)
DELETE FROM change_order_items;

-- Step 2: Delete change order sections
DELETE FROM change_order_sections;

-- Step 3: Delete change orders
DELETE FROM change_orders;

-- ============================================
-- OPTION B: Delete specific change orders by ID
-- ============================================
-- Replace 'YOUR_CHANGE_ORDER_ID' with the actual ID from the SELECT above

-- Example: Delete change order with ID 1
-- DELETE FROM change_order_items WHERE change_order_id = 1;
-- DELETE FROM change_order_sections WHERE change_order_id = 1;
-- DELETE FROM change_orders WHERE id = 1;

-- You can run multiple deletes for multiple IDs:
-- DELETE FROM change_order_items WHERE change_order_id IN (1, 2, 3);
-- DELETE FROM change_order_sections WHERE change_order_id IN (1, 2, 3);
-- DELETE FROM change_orders WHERE id IN (1, 2, 3);

-- ============================================
-- OPTION C: Delete change orders by project
-- ============================================
-- Replace 'YOUR_PROJECT_ID' with the actual project ID

-- DELETE FROM change_order_items 
-- WHERE change_order_id IN (
--     SELECT id FROM change_orders WHERE project_id = 'YOUR_PROJECT_ID'
-- );

-- DELETE FROM change_order_sections 
-- WHERE change_order_id IN (
--     SELECT id FROM change_orders WHERE project_id = 'YOUR_PROJECT_ID'
-- );

-- DELETE FROM change_orders WHERE project_id = 'YOUR_PROJECT_ID';

-- ============================================
-- OPTION D: Delete change orders by CO number
-- ============================================
-- Replace 'CO-01' with the actual CO number

-- DELETE FROM change_order_items 
-- WHERE change_order_id IN (
--     SELECT id FROM change_orders WHERE co_number = 'CO-01'
-- );

-- DELETE FROM change_order_sections 
-- WHERE change_order_id IN (
--     SELECT id FROM change_orders WHERE co_number = 'CO-01'
-- );

-- DELETE FROM change_orders WHERE co_number = 'CO-01';

-- ============================================
-- STEP 2: Verify deletion
-- ============================================

-- Check how many change orders remain
SELECT COUNT(*) AS remaining_change_orders FROM change_orders;

-- Check how many items remain
SELECT COUNT(*) AS remaining_items FROM change_order_items;

-- Check how many sections remain
SELECT COUNT(*) AS remaining_sections FROM change_order_sections;

-- View what's left
SELECT * FROM change_orders ORDER BY created_at DESC;

-- ============================================
-- TROUBLESHOOTING
-- ============================================

-- If you get a foreign key error, it means there are related records
-- Try this order:
-- 1. Delete change_order_items first
-- 2. Delete change_order_sections second
-- 3. Delete change_orders last

-- To see what tables reference change_orders:
-- SELECT 
--     tc.table_schema, 
--     tc.constraint_name, 
--     tc.table_name, 
--     kcu.column_name, 
--     ccu.table_name AS foreign_table_name,
--     ccu.column_name AS foreign_column_name 
-- FROM information_schema.table_constraints AS tc 
-- JOIN information_schema.key_column_usage AS kcu
--   ON tc.constraint_name = kcu.constraint_name
-- JOIN information_schema.constraint_column_usage AS ccu
--   ON ccu.constraint_name = tc.constraint_name
-- WHERE constraint_type = 'FOREIGN KEY' 
--   AND ccu.table_name='change_orders';

-- ============================================
-- NOTES
-- ============================================
-- 
-- What gets deleted:
-- ❌ Change orders
-- ❌ Change order items (materials, labor, etc.)
-- ❌ Change order sections
-- 
-- What stays:
-- ✅ Projects
-- ✅ Estimates
-- ✅ Invoices
-- ✅ All other project data
-- 
-- After deletion:
-- - Change orders will no longer appear in project details
-- - Any invoices linked to deleted change orders may show as "(deleted)"
-- - Project totals will be recalculated without change order amounts
-- 
-- ============================================
