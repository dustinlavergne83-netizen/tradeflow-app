# Materials Catalog Showing $0.00 - SOLUTION

## The Issue
The materials catalog is displaying $0.00 for price and 0.0 for labor hours for all items.

## Root Cause
The code is correct - the issue is that the `base_materials` table in the database has NULL or 0 values for the `price` and `labor_hours` columns.

## Verification
1. Run the `CHECK_BASE_MATERIALS_DATA.sql` query in Supabase SQL Editor
2. Check if materials have actual price and labor_hours values

## How to Fix

### Option 1: Use the Base Materials Manager
1. Go to **Admin → Base Materials Manager**
2. Find the materials you want to use
3. Click the edit icon for each material
4. Enter the correct **Price** and **Labor Hours**
5. Click Save

### Option 2: Bulk Import with CSV
If you have materials data in a spreadsheet:

1. Create a CSV file with columns: `name`, `category`, `price`, `labor_hours`, `unit`, `description`
2. Go to **Admin → Base Materials Manager**
3. Use the CSV import feature (if available)
4. Or manually update materials one by one

### Option 3: SQL Update
If you have a materials list, you can update them via SQL:

```sql
-- Example: Update specific materials
UPDATE base_materials 
SET 
    price = 1.50,
    labor_hours = 0.05
WHERE name = '1/2 Conduit Sealing Compound';

UPDATE base_materials 
SET 
    price = 0.25,
    labor_hours = 0.01
WHERE name = '100ft Fish Tape';

-- Continue for other materials...
```

## Why This Happened
When the `base_materials` table was created or imported, the price and labor_hours columns were likely:
- Not included in the import
- Set to NULL or 0 by default
- Not populated from the source data

## The Code is Working Correctly
✅ Materials are loading from database correctly
✅ Property mapping is correct (`price` → `price`, `labor_hours` → `laborHours`)
✅ Catalog display is showing the data correctly
❌ The database just doesn't have the price/labor data yet

## Next Steps
1. Run `CHECK_BASE_MATERIALS_DATA.sql` to verify the issue
2. Choose one of the fix options above
3. Start entering price and labor hour data for your commonly used materials
4. The catalog will immediately show the correct values once the database is updated

## Note
You don't need to fix ALL materials at once - just update the ones you use most frequently. As you encounter materials you need, you can add their price and labor hours through the Base Materials Manager.
