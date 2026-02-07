# ⚠️ IMPORTANT: How to Copy the SQL Script Correctly

## The Problem in Your Screenshot
Looking at your Supabase SQL Editor screenshot, I can see the script starts at line 2 with `DECLARE`, but it's **missing the first line `DO $$`**. This is why you're getting the syntax error.

## The Solution

When copying from `CREATE_PREDEFINED_LAYERS_FOR_ALL_PLANS.sql`, you need to:

### Step 1: Open the File
Open `CREATE_PREDEFINED_LAYERS_FOR_ALL_PLANS.sql` in VS Code

### Step 2: Select Starting from Line 7
Skip the comments at the top and start selecting from line 7 which says:
```
DO $$
```

### Step 3: Select ALL the Way to the End
Make sure you select:
- The `DO $$` line (CRITICAL!)
- All the way through the DECLARE, BEGIN, LOOP, END sections
- All the way to the final SELECT query at the bottom

### Step 4: Copy and Paste into Supabase
Paste the entire block into Supabase SQL Editor and click Run.

## Quick Copy-Paste Text

Here's the exact text to copy (starts with `DO $$`):

```sql
DO $$
DECLARE
  plan_record RECORD;
  layers_created INTEGER;
BEGIN
  -- Loop through all plans
  FOR plan_record IN 
    SELECT p.id as plan_id, p.plan_name, p.company_id
    FROM plans p
    ORDER BY p.created_at DESC
  LOOP
    -- Check if this plan already has predefined layers
    IF NOT EXISTS (
      SELECT 1 FROM measurement_layers 
      WHERE plan_id = plan_record.plan_id 
      AND is_predefined = TRUE
    ) THEN
      -- Create the 7 predefined layers
      INSERT INTO measurement_layers (plan_id, name, section_name, color, visible, is_predefined, display_order, company_id)
      VALUES
        (plan_record.plan_id, 'Fixtures', 'Fixtures', '#EF4444', TRUE, TRUE, 1, plan_record.company_id),
        (plan_record.plan_id, 'Power', 'Power', '#F59E0B', TRUE, TRUE, 2, plan_record.company_id),
        (plan_record.plan_id, 'Branch', 'Branch', '#10B981', TRUE, TRUE, 3, plan_record.company_id),
        (plan_record.plan_id, 'Feeders', 'Feeders', '#3B82F6', TRUE, TRUE, 4, plan_record.company_id),
        (plan_record.plan_id, 'Switchgear', 'Switchgear', '#8B5CF6', TRUE, TRUE, 5, plan_record.company_id),
        (plan_record.plan_id, 'Equipment', 'Equipment', '#EC4899', TRUE, TRUE, 6, plan_record.company_id),
        (plan_record.plan_id, 'Special Systems', 'Special Systems', '#06B6D4', TRUE, TRUE, 7, plan_record.company_id);
      
      RAISE NOTICE '✅ Created 7 predefined layers for plan: % (ID: %)', plan_record.plan_name, plan_record.plan_id;
    ELSE
      RAISE NOTICE '⏭️  Plan "%" already has predefined layers', plan_record.plan_name;
    END IF;
  END LOOP;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ COMPLETED! All plans now have predefined layers.';
  RAISE NOTICE '========================================';
END $$;

-- Step 2: Verify the results
SELECT 
  p.plan_name,
  p.created_at,
  COUNT(*) FILTER (WHERE ml.is_predefined = TRUE) as predefined_layers,
  COUNT(*) FILTER (WHERE ml.is_predefined = FALSE OR ml.is_predefined IS NULL) as custom_layers
FROM plans p
LEFT JOIN measurement_layers ml ON ml.plan_id = p.id
GROUP BY p.id, p.plan_name, p.created_at
ORDER BY p.created_at DESC;
```

## Verify Before Running
Before clicking "Run" in Supabase, check:
1. ✅ The first line shows: `DO $$`
2. ✅ The second line shows: `DECLARE`
3. ✅ The last section has a SELECT query

If you don't see `DO $$` at the very top, it won't work!

## After Running Successfully
You should see output like:
```
✅ Created 7 predefined layers for plan: [Your Plan Name] (ID: xxx)
========================================
✅ COMPLETED! All plans now have predefined layers.
========================================
```

Then refresh your Takeoff page and the 7 section layers will appear!
