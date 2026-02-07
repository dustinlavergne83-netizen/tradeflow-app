-- Check what columns actually exist in change_order_items table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'change_order_items'
ORDER BY ordinal_position;
