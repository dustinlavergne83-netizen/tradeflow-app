# 🚨 Run This Migration NOW

You're seeing an error because the database doesn't have the `materials` column yet.

## Steps to Fix:

1. **Go to your Supabase Dashboard** (supabase.com)
2. **Navigate to SQL Editor**
3. **Copy and paste this SQL code:**

```sql
ALTER TABLE plan_measurements
ADD COLUMN IF NOT EXISTS materials JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN plan_measurements.materials IS 'Array of materials with quantities: [{material_id: "123", quantity: 5}, ...]';
```

4. **Click "Run"** or press `Ctrl+Enter`
5. **Wait for "Success"** message
6. **Go back to your app** and try saving the measurement again

## What This Does:

This adds a new column called `materials` to the `plan_measurements` table that stores an array of materials with their quantities as JSON data.

## After Running:

Once you run this migration, you'll be able to:
- Add multiple materials to each length measurement
- Save quantities for each material
- Export all materials to your estimate

The UI is already complete - it just needs this database column to work! 🎉
