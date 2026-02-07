# How to Clear Time Clock Data

## Purpose
This guide explains how to clear all time clock entries from your TradeFlow system. This is useful when:
- Preparing for production release (removing test data)
- Starting fresh after testing
- Getting ready for your 12 testers to use the app

## What Gets Deleted

**Time Clock Data (DELETED):**
- ❌ All clock in/out records
- ❌ All project time segments
- ❌ All automated timesheet reports
- ❌ All timesheet approvals

**What Stays (PRESERVED):**
- ✅ Employee records
- ✅ Project data
- ✅ Time off requests (vacation/PTO)
- ✅ All accounting data (invoices, expenses, etc.)
- ✅ Estimates and proposals
- ✅ All other app data

## Step-by-Step Instructions

### Option 1: Using Supabase Dashboard (Easiest)

1. **Open Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Select your project

2. **Open SQL Editor**
   - Click **SQL Editor** in the left sidebar
   - Click **New Query**

3. **Copy and Paste the Script**
   - Open the file `CLEAR_TIME_CLOCK_DATA.sql`
   - Copy the entire contents
   - Paste into the SQL Editor

4. **Run the Script**
   - Click **Run** (or press Ctrl+Enter)
   - Wait for completion

5. **Verify the Results**
   - The verification queries at the end will show:
     - `remaining_shifts: 0`
     - `remaining_segments: 0`
     - `remaining_reports: 0`
     - `remaining_approvals: 0`

### Option 2: Using Supabase CLI (Advanced)

```bash
# Connect to your Supabase project
supabase db reset --db-url "your_connection_string"

# Or run the SQL file directly
psql "your_connection_string" -f CLEAR_TIME_CLOCK_DATA.sql
```

## After Running the Script

### In the Web App:
1. Go to **Time Clock** page
2. You should see:
   - All employees showing "Not currently clocked in"
   - Current week timesheet showing 0 hours for everyone
   - No active shifts

### In the Mobile App:
1. Open TradeFlow app
2. Go to the **TimeClock** tab
3. You should see:
   - No active shift
   - Ability to clock in fresh

## Before Running - IMPORTANT!

### ⚠️ Backup Your Data First

**Option A: Export from Supabase Dashboard**
1. Go to **Database** → **Backups** in Supabase
2. Create a backup before proceeding
3. Note the backup date/time

**Option B: Manual Export**
```sql
-- Save these tables before clearing
SELECT * FROM shifts INTO OUTFILE 'backup_shifts.csv';
SELECT * FROM shift_segments INTO OUTFILE 'backup_segments.csv';
```

### ✅ When to Run This Script

**Good times to clear:**
- ✅ Before production launch
- ✅ After testing with fake data
- ✅ Before inviting your 12 testers
- ✅ When starting a new pay period (after exporting reports)

**DON'T run if:**
- ❌ You need the historical time data
- ❌ You haven't backed up your database
- ❌ Employees are currently clocked in
- ❌ You need the data for payroll

## Troubleshooting

### Error: "violates foreign key constraint"
- This means there are related records
- The script handles this by deleting child tables first
- If you still get errors, check for custom constraints

### Error: "permission denied"
- Make sure you're using the service_role key or postgres user
- Regular app users don't have permission to delete all data

### Nothing was deleted (0 rows affected)
- This is fine! It means there was no data to delete
- Your time clock tables were already empty

## For Production Launch

**Recommended cleanup before launching:**

1. ✅ Clear time clock data (this script)
2. ✅ Clear accounting test data (use `CLEAR_ACCOUNTING_DATA_FOR_PRODUCTION.sql`)
3. ✅ Remove test employees (optional, or just mark inactive)
4. ✅ Remove test projects (optional, or just mark completed)
5. ✅ Verify all test data is gone

## Support

If you have issues:
- Check Supabase logs for error messages
- Verify you have the correct permissions
- Ensure you backed up first
- The script is safe to run multiple times (idempotent)

---

**File:** `CLEAR_TIME_CLOCK_DATA.sql`  
**Last Updated:** January 4, 2026  
**Status:** Ready to Use
