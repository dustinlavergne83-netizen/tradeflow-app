# Assembly Schema Issue Explanation

## The Problem

You have existing assemblies in your database that were created with an older schema. Looking at your Supabase table, the visible columns are:
- `id`
- `company_id`
- `name`
- `category`
- `description`
- `is_custom` (partially visible as "is_cust...")
- `created_at`

## Missing Columns

The current code is trying to insert two columns that don't exist in your table:
1. **`is_active`** - A boolean to mark assemblies as active/inactive
2. **`unit`** - The unit of measurement (e.g., "ea", "ft", "sf")

## Why This Happened

The assemblies you created earlier were likely created:
- Through a different version of the code that didn't require these columns
- Or through database imports/migrations
- Or the table schema changed but existing data wasn't migrated

## The Solution

You need to run the SQL migration I created (`ADD_IS_ACTIVE_TO_ASSEMBLIES.sql`) which will:

1. **Add the missing columns** without breaking existing data
2. **Set default values** for all existing assemblies:
   - `is_active = true` (all existing assemblies will remain visible)
   - `unit = 'ea'` (most assemblies use "each" as the unit)
3. **Allow new assemblies** to be created with the new code

## How to Run the Migration

1. You're already in Supabase (I can see it in your screenshot)
2. Click on "SQL Editor" in the left sidebar
3. Click "New query"
4. Copy the contents of `ADD_IS_ACTIVE_TO_ASSEMBLIES.sql`
5. Paste it into the editor
6. Click "Run"

## After Migration

Once you run this SQL, your table will have all the required columns and you'll be able to:
- Create new assemblies ✅
- Edit existing assemblies ✅
- All existing assemblies will work normally ✅
