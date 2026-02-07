-- Fix the change order total to match what's shown on the summary page
-- Run this in Supabase SQL Editor

-- First, let's see all change orders to find the right one
SELECT id, title, total, status, created_at
FROM change_orders
ORDER BY created_at DESC;

-- Update the change order with title 'as' to have the correct total of $6255.00
-- Replace 'YOUR_CO_ID_HERE' with the actual ID from the SELECT above
UPDATE change_orders
SET total = 6255.00
WHERE title = 'as';

-- Verify the update
SELECT id, title, total, status, created_at
FROM change_orders
WHERE title = 'as';
