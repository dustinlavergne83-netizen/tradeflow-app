# Pending Jobs Management - Setup Guide

## Overview

The Pending Jobs feature allows you to manage temporary job names that employees enter when clocking in before projects are officially created in the system. This gives employees flexibility while maintaining data quality.

## What This Feature Does

### For Employees
- Clock in using **any project/job name** they want (e.g., "Smith Service Call", "Jones House", "Downtown Warehouse")
- No need to wait for you to create the project first
- Continue working while you organize the data later

### For Admins
- **View all pending jobs** in one place with statistics:
  - How many time segments
  - Total hours worked
  - Which employees worked on it
  - First and last usage dates
- **Rename jobs** to fix typos or standardize names (e.g., "smith job" → "Smith Service Call")
- **Link to actual projects** - all time segments automatically update when you match a pending job to a real project

## Installation Steps

### 1. Run the Database Migration

Open your terminal and navigate to your project directory, then run:

```bash
# If using Supabase CLI (recommended)
npx supabase db push

# OR manually run the migration file in Supabase Dashboard
# Go to SQL Editor and run the contents of:
# supabase/migrations/075_create_pending_jobs_view.sql
```

### 2. Verify the Migration

Check that the following were created:
- ✅ View: `pending_jobs`
- ✅ Function: `link_pending_job_to_project()`
- ✅ Function: `rename_pending_job()`

You can verify in Supabase Dashboard → SQL Editor:

```sql
-- Check if view exists
SELECT * FROM pending_jobs LIMIT 1;

-- Check if functions exist
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('link_pending_job_to_project', 'rename_pending_job');
```

### 3. Access the Feature

Navigate to: **Time Clock Dashboard → Pending Jobs button** (orange button)

Or directly access: `http://localhost:5173/pending-jobs`

## How to Use

### Viewing Pending Jobs

1. Go to the Time Clock page (`/timeclock`)
2. Click the **"📋 Pending Jobs"** button (orange)
3. You'll see a table with:
   - Job Name
   - Number of time segments
   - Total hours
   - Employees who worked on it
   - First and last usage dates

### Renaming a Job (Fix Typos)

1. Click the **"✏️ Rename"** button next to a job
2. Edit the name in the text field
3. Click **"✓ Save"**
4. All time segments with that job name will be updated

**Example use case:**
- Employee enters: "smih house" (typo)
- You rename to: "Smith House"
- All segments updated automatically

### Linking to a Project

1. Use the **"🔗 Link to Project"** dropdown
2. Select the actual project from your projects list
3. Confirm the action
4. All time segments for that job name will:
   - Be linked to the project via `project_id`
   - Disappear from the pending jobs list
   - Appear in project reports and timesheets

**Example workflow:**
1. Employee clocks in Monday and enters "Johnson Commercial"
2. Tuesday you create the official project "Johnson Commercial Building"
3. You link the pending job to the project
4. All Monday hours now show up in the project reports

## Database Structure

### The `pending_jobs` View

This view automatically shows jobs that haven't been linked yet:

```sql
SELECT * FROM pending_jobs;
```

Returns:
- `project_task` - The job name entered by employee
- `employee_count` - How many different employees worked on it
- `segment_count` - Total number of time segments
- `first_used` - When it was first used
- `last_used` - When it was last used
- `total_hours` - Sum of all hours
- `employee_names` - Array of employee names

### The Functions

**link_pending_job_to_project(job_name, project_id)**
- Links all segments with the job name to a project
- Returns number of segments updated

**rename_pending_job(old_name, new_name)**
- Renames all segments with the old name
- Returns number of segments updated

## Workflow Example

### Day 1 - Monday
- Employee John clocks in at 8 AM
- Enters job name: "Emergency call - downtown"
- Works 8 hours

### Day 2 - Tuesday  
- You check Pending Jobs page
- See "Emergency call - downtown" with 8 hours
- Rename it to: "ABC Corp Emergency Service"
- Create official project: "ABC Corp - Emergency HVAC Repair"

### Day 3 - Wednesday
- Link "ABC Corp Emergency Service" to the project
- All 8 hours from Monday now show in project reports
- John clocks in again, selects the official project name from history

## Tips and Best Practices

1. **Review pending jobs weekly** to keep data organized
2. **Standardize naming** before linking to projects
3. **Create projects first** when possible, but don't stress - pending jobs has you covered
4. **Train employees** to use descriptive names (customer name or address)
5. **Check pending jobs** before creating new projects to avoid duplicates

## Troubleshooting

### "No pending jobs" showing
- ✅ This is good! It means all time entries are linked to projects
- Or employees are selecting existing projects when clocking in

### Can't link to project
- Make sure the project exists and has status="active"
- Refresh the page to reload projects list

### Renamed job still showing old name
- Hard refresh the page (Ctrl+Shift+R or Cmd+Shift+R)
- The rename updates the database immediately

### Time segments missing after linking
- They're not missing! Check the project reports
- Segments now have a `project_id` and won't show in pending jobs

## Database Queries (Advanced)

### See all unlinked segments
```sql
SELECT 
  ss.project_task,
  e.first_name || ' ' || e.last_name as employee,
  ss.start_at,
  ss.end_at
FROM shift_segments ss
LEFT JOIN employees e ON ss.user_id = e.user_id
WHERE ss.project_id IS NULL
  AND ss.project_task IS NOT NULL
ORDER BY ss.start_at DESC;
```

### Manually link a specific job
```sql
-- Find the project ID
SELECT id, name FROM projects WHERE name ILIKE '%search term%';

-- Link it
SELECT link_pending_job_to_project('Job Name Here', 'project-uuid-here');
```

### See segment counts by project status
```sql
SELECT 
  CASE 
    WHEN project_id IS NULL THEN 'Pending'
    ELSE 'Linked'
  END as status,
  COUNT(*) as segment_count,
  ROUND(SUM(EXTRACT(EPOCH FROM (end_at - start_at)) / 3600)::numeric, 2) as total_hours
FROM shift_segments
WHERE project_task IS NOT NULL
GROUP BY status;
```

## Support

If you encounter issues:
1. Check the browser console for errors
2. Verify the migration ran successfully
3. Make sure you have admin permissions
4. Check Supabase logs in the Dashboard

---

**Feature Created:** January 2026
**Version:** 1.0
**Database Migration:** 075_create_pending_jobs_view.sql
