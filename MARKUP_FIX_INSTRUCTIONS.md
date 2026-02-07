# MARKUP PERCENTAGE FIX - FOLLOW THESE STEPS

## Problem
Markup percentages were not saving to the database because the `markup_percentage` column was missing from the `invoice_items` table.

## Solution - DO THIS NOW

### Step 1: Run the Migration in Supabase
1. Go to your Supabase dashboard
2. Navigate to the SQL Editor
3. Open the file: `supabase/migrations/087_add_markup_percentage_to_invoice_items.sql`
4. Copy the SQL code
5. Paste it into Supabase SQL Editor
6. Click "Run" to execute

**OR** if your migrations auto-run, just push this file to your repo and it will apply automatically.

### Step 2: Test It Now
1. Open an invoice in your app
2. Set a markup percentage (e.g., 20%)
3. Click "💾 Save Changes"
4. **Important:** Reload the page - the markup should still be there
5. Go to "📊 Detailed Report" - you should see the total with markup applied

## What Was Fixed
- ✅ Added `markup_percentage` column to `invoice_items` table
- ✅ Enhanced error handling in Invoice.jsx to show any database errors
- ✅ Markups will now persist to database and reload correctly

## If Still Not Working
Check browser console (F12 → Console tab) for error messages and send them to me.

---
**CRITICAL:** Run the migration in Supabase BEFORE testing!
