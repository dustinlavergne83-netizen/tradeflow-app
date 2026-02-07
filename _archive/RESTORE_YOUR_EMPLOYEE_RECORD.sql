-- Run this in Supabase SQL Editor to restore your employee record
-- Replace the values with YOUR information

-- First, get your auth user ID
SELECT id, email FROM auth.users WHERE email = 'dustin@dmlelectrical.com';
-- Copy the ID from the result

-- Then insert your employee record (replace the values)
INSERT INTO employees (
  user_id,
  email,
  first_name,
  last_name,
  phone,
  address1,
  city,
  state,
  zip,
  emergency_name,
  emergency_relationship,
  emergency_phone,
  role,
  is_active,
  policy_acknowledged
) VALUES (
  '3c75eb59-0549-46cb-b8d2-3a006a7a6c9a',  -- Replace with YOUR user ID from query above
  'dustin@dmlelectrical.com',               -- Your email
  'Dustin',                                  -- Your first name
  'Lavergne',                                    -- Your last name  
  '3372880395',                                -- Your phone
  '176 Gotts Cove Rd',                             -- Your address
  'Iota',                               -- Your city
  'LA',                                      -- Your state
  '70543',                                   -- Your ZIP
  'Ty Weldon',                  -- Emergency contact
  'Friend',                            -- Emergency relationship
  '3374997269',                                -- Emergency phone
  'admin',                                   -- Your role (admin or employee)
  true,                                      -- Active status
  true                                       -- Policy acknowledged
)
ON CONFLICT (user_id) DO UPDATE SET
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  phone = EXCLUDED.phone,
  address1 = EXCLUDED.address1,
  city = EXCLUDED.city,
  state = EXCLUDED.state,
  zip = EXCLUDED.zip,
  emergency_name = EXCLUDED.emergency_name,
  emergency_relationship = EXCLUDED.emergency_relationship,
  emergency_phone = EXCLUDED.emergency_phone,
  role = EXCLUDED.role,
  is_active = EXCLUDED.is_active,
  policy_acknowledged = EXCLUDED.policy_acknowledged;

-- Verify it was created
SELECT * FROM employees WHERE email = 'dustin@dmlelectrical.com';
