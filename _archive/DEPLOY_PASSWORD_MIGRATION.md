# Deploy Password Migration - Step by Step

The invite function is failing because the `password_must_change` column doesn't exist in your remote Supabase database yet.

## Step 1: Check Migration File Exists

The file should exist at:
```
supabase/migrations/061_add_password_must_change.sql
```

## Step 2: Deploy to Remote Database

**Option A: Using Supabase CLI** (If you have it set up)
```bash
npx supabase db push
```

**Option B: Using Supabase Dashboard** (Recommended if CLI doesn't work)

1. Open the migration file: `supabase/migrations/061_add_password_must_change.sql`

2. Copy this SQL code:
```sql
-- Add password_must_change column to employees table
ALTER TABLE employees 
ADD COLUMN IF NOT EXISTS password_must_change BOOLEAN DEFAULT false;

-- Set existing employees to false (they're already onboarded)
UPDATE employees 
SET password_must_change = false 
WHERE password_must_change IS NULL;
```

3. Go to **Supabase Dashboard** → **SQL Editor**

4. Paste the SQL and click **Run**

5. You should see: "Success. No rows returned"

## Step 3: Verify It Worked

Run this in SQL Editor:
```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'employees' 
AND column_name = 'password_must_change';
```

You should see one row showing the column exists.

## Step 4: Test Inviting an Employee

1. Go to your Admin page
2. Try inviting the employee again
3. It should work now!

## Step 5: For Your Existing Account (Testing)

If you want to test the password change screen with your existing account:

```sql
UPDATE employees 
SET password_must_change = true 
WHERE email = 'dustinlavergne83@gmail.com';
```

Then sign out and sign back in to the mobile app.

## Troubleshooting

If you still get errors after running the migration:
- Make sure you're connected to the RIGHT Supabase project
- Check your Supabase project URL in your `.env` file
- Try refreshing the Supabase Dashboard page
- Wait 30 seconds for the change to propagate
