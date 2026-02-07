# PENDING JOBS FIX - FINAL DEPLOYMENT

## PROBLEM FOUND ✅
The pending_jobs view was querying the **WRONG TABLE**:
- ❌ Migration 089 was querying `shift_segments` table (which has NO unlinked entries)
- ✅ Fixed: Now queries `time_entries` table (where your unlinked entries ARE stored)

---

## DEPLOYMENT STEPS

### Step 1: Run Migration 089 (CORRECTED)
- **File:** `supabase/migrations/089_fix_pending_jobs_view_for_time_entries.sql`
- Go to Supabase Dashboard → SQL Editor
- Copy & paste the ENTIRE file contents
- Click "RUN"
- ✅ This recreates the pending_jobs view to query time_entries correctly

### Step 2: Run Migration 091 (UPDATED)
- **File:** `supabase/migrations/091_update_link_function_for_time_entries.sql`
- Copy & paste the ENTIRE file contents
- Click "RUN"
- ✅ This updates the link function to work with date-based grouping

### Step 3: DELETE Migration 090 (Optional but recommended)
- **File:** `supabase/migrations/090_fix_pending_jobs_use_time_entries.sql`
- You can safely delete this - it's redundant now
- Migration 089 does the same thing but was broken, now it's fixed

### Step 4: Verify in Browser
1. Go to Pending Jobs page (or refresh F5)
2. Should now see entries like:
   - ✅ `UNLINKED - 02/06/2026` (Ty Weldon - 5.66 hrs)
   - ✅ `UNLINKED - 02/05/2026` (Ty Weldon - 16.71 hrs)
   - ✅ `UNLINKED - 02/04/2026` (Ty Weldon - 6.50 hrs)
3. Click "Link to Project" dropdown and select "Richard Residence"
4. Confirm the linking dialog
5. Done! Entries will be removed from pending jobs

---

## KEY FIXES MADE

| Issue | Solution |
|-------|----------|
| Wrong table | Changed from `shift_segments` → `time_entries` |
| Grouping | Changed from `project_task` → `DATE(clock_in)` |
| Labeling | Added `'UNLINKED - '` prefix to date for clarity |
| Linking function | Updated to extract date and link by date range |

---

## WHAT CHANGED IN MIGRATIONS

### Migration 089 
**Before (BROKEN):**
```sql
FROM shift_segments ss  -- ❌ WRONG TABLE
LEFT JOIN employees e ON ss.user_id = e.user_id
```

**After (FIXED):**
```sql
FROM time_entries te  -- ✅ CORRECT TABLE
LEFT JOIN employees e ON te.employee_id = e.user_id
```

### Migration 091
**Now extracts the date from the project_task string:**
```sql
v_entry_date := TO_DATE(SUBSTRING(p_project_task FROM 'UNLINKED - (.+)'), 'YYYY-MM-DD');

UPDATE time_entries
SET project_id = p_project_id
WHERE DATE(clock_in) = v_entry_date 
  AND project_id IS NULL;
```

---

## TEST SCRIPT (Optional)
Run this in Supabase SQL Editor to verify:
```sql
-- Check if unlinked time_entries exist
SELECT COUNT(*) as unlinked_entries FROM time_entries WHERE project_id IS NULL;

-- Check if pending_jobs view returns data
SELECT * FROM pending_jobs;

-- Check the view query works
SELECT 
  'UNLINKED - ' || DATE(te.clock_in) as project_task,
  COUNT(te.id) as segment_count
FROM time_entries te
WHERE te.project_id IS NULL
GROUP BY DATE(te.clock_in)
ORDER BY MAX(te.clock_in) DESC;
```

---

## TROUBLESHOOTING

**Still not showing up?**
1. Make sure you ran BOTH migrations 089 and 091 in order
2. Refresh the browser (F5 or Ctrl+Shift+R for hard refresh)
3. Check Supabase > SQL Editor > Run the test script above
4. Check browser console (F12) for any errors

**RLS Blocking?**
- The view has `GRANT SELECT ON pending_jobs TO authenticated;`
- Make sure you're logged in
- Check that your user_id matches in employees table

**Function not working?**
- Make sure migration 091 ran successfully
- Check that the function signature matches what PendingJobs.jsx calls
