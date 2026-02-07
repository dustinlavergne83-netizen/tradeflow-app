# Link Employee Time to Projects - Setup Guide

## 🎯 What This Does

When employees clock in/out in the mobile app, their time will be **automatically linked to the specific project** they worked on.

### Example:
- Employee clocks in → Selects "Smith Residence"
- Works 4 hours
- Clocks out → **Time entry is created and linked to "Smith Residence" project**
- You can now see all employee time by project in reports!

---

## ✅ Step 1: Run the Migration

### Copy this SQL and run in Supabase Dashboard → SQL Editor:

```sql
-- ====================================
-- TIME ENTRIES TABLE
-- ====================================
-- Links employee time to specific projects for reporting

CREATE TABLE IF NOT EXISTS time_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL,
  project_id UUID,
  
  -- Time tracking
  clock_in TIMESTAMPTZ NOT NULL,
  clock_out TIMESTAMPTZ,
  
  -- Additional info
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Foreign keys (added separately to avoid errors if tables don't exist)
  CONSTRAINT fk_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  CONSTRAINT fk_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_time_entries_employee ON time_entries(employee_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_project ON time_entries(project_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_clock_in ON time_entries(clock_in);

-- Enable Row Level Security
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Employees can view their own time entries
CREATE POLICY "Employees can view own time entries"
  ON time_entries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = time_entries.employee_id
      AND employees.user_id = auth.uid()
    )
  );

-- Employees can insert their own time entries
CREATE POLICY "Employees can insert own time entries"
  ON time_entries FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = time_entries.employee_id
      AND employees.user_id = auth.uid()
    )
  );

-- Employees can update their own time entries
CREATE POLICY "Employees can update own time entries"
  ON time_entries FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = time_entries.employee_id
      AND employees.user_id = auth.uid()
    )
  );

-- Employees can delete their own time entries
CREATE POLICY "Employees can delete own time entries"
  ON time_entries FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = time_entries.employee_id
      AND employees.user_id = auth.uid()
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_time_entries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS time_entries_update_timestamp ON time_entries;
CREATE TRIGGER time_entries_update_timestamp
BEFORE UPDATE ON time_entries
FOR EACH ROW
EXECUTE FUNCTION update_time_entries_updated_at();
```

---

## ✅ Step 2: How It Works (Automatic!)

### When Employee Clocks Out:

1. **Employee selects project**: "Smith Residence"
2. **Clocks in and works**
3. **Clocks out**
4. **Mobile app automatically**:
   - Finds the "Smith Residence" project in database
   - Creates a time_entry linked to that project
   - Stores employee_id, project_id, clock_in, clock_out

### The Code (Already in Mobile App):

```typescript
// When employee clocks out, this runs automatically:
const { data: projectData } = await supabase
  .from("projects")
  .select("id")
  .ilike("name", seg.project_task)  // Matches project name
  .limit(1)
  .single();

await supabase.from("time_entries").insert({
  employee_id: empData.id,
  clock_in: seg.start_at,
  clock_out: seg.end_at,
  project_id: projectData?.id || null,  // ✅ Linked!
  notes: seg.project_task,
});
```

---

## ✅ Step 3: View Time by Project

### Query to See All Time by Project:

```sql
-- See total hours per project
SELECT 
  p.name as project_name,
  e.first_name || ' ' || e.last_name as employee_name,
  COUNT(*) as entries,
  SUM(EXTRACT(EPOCH FROM (te.clock_out - te.clock_in))/3600) as total_hours
FROM time_entries te
LEFT JOIN projects p ON te.project_id = p.id
LEFT JOIN employees e ON te.employee_id = e.id
GROUP BY p.name, e.first_name, e.last_name
ORDER BY p.name, employee_name;
```

### Query for Specific Project:

```sql
-- See all time for "Smith Residence"
SELECT 
  e.first_name || ' ' || e.last_name as employee_name,
  te.clock_in,
  te.clock_out,
  EXTRACT(EPOCH FROM (te.clock_out - te.clock_in))/3600 as hours,
  te.notes
FROM time_entries te
JOIN employees e ON te.employee_id = e.id
JOIN projects p ON te.project_id = p.id
WHERE p.name = 'Smith Residence'
ORDER BY te.clock_in DESC;
```

### Query for Date Range:

```sql
-- Time entries for last 30 days
SELECT 
  p.name as project,
  e.first_name || ' ' || e.last_name as employee,
  DATE(te.clock_in) as date,
  ROUND(CAST(EXTRACT(EPOCH FROM (te.clock_out - te.clock_in))/3600 AS NUMERIC), 2) as hours
FROM time_entries te
LEFT JOIN projects p ON te.project_id = p.id
JOIN employees e ON te.employee_id = e.id
WHERE te.clock_in >= NOW() - INTERVAL '30 days'
ORDER BY te.clock_in DESC;
```

---

## ✅ Step 4: Test It!

### Testing Process:

1. **Run the SQL** (Step 1 above)

2. **Create a test project** in web app:
   - Go to Projects page
   - Create project: "Test Project 123"

3. **Test in mobile app** (Expo Go):
   - Sign in as employee
   - Clock in → Select "Test Project 123"
   - Wait 1 minute
   - Clock out

4. **Check if it worked**:
   ```sql
   -- Run in Supabase SQL Editor
   SELECT * FROM time_entries ORDER BY created_at DESC LIMIT 5;
   ```

   **You should see:**
   - employee_id: Your employee's ID
   - project_id: The project's ID (linked!)
   - clock_in/clock_out: Your times
   - notes: "Test Project 123"

---

## 📊 Benefits

### Now You Can:

✅ **Track labor costs by project**
```sql
SELECT 
  p.name,
  SUM(EXTRACT(EPOCH FROM (te.clock_out - te.clock_in))/3600) as total_hours,
  SUM(EXTRACT(EPOCH FROM (te.clock_out - te.clock_in))/3600) * 50 as labor_cost
FROM time_entries te
JOIN projects p ON te.project_id = p.id
GROUP BY p.name;
```

✅ **See who worked on each project**
```sql
SELECT DISTINCT
  p.name as project,
  e.first_name || ' ' || e.last_name as employee
FROM time_entries te
JOIN projects p ON te.project_id = p.id
JOIN employees e ON te.employee_id = e.id
ORDER BY p.name;
```

✅ **Generate project reports**
- Total hours per project
- Labor cost per project
- Which employees worked where
- Project profitability

---

## 🔧 Troubleshooting

### If Time Entries Not Creating:

#### Check 1: Table exists?
```sql
SELECT * FROM time_entries LIMIT 1;
```
If error → Run Step 1 SQL again

#### Check 2: Employees have IDs?
```sql
SELECT id, email, first_name, last_name FROM employees;
```
Should show your employees with UUIDs

#### Check 3: Projects exist?
```sql
SELECT id, name, status FROM projects WHERE status = 'active';
```
Should show your active projects

#### Check 4: Check mobile app logs
In Expo Go, when you clock out, check console for errors

---

## ⚠️ Important Notes

### Project Name Matching:

The app matches project names **case-insensitive**:
- "Smith Residence" = "smith residence" = "SMITH RESIDENCE"

If project name doesn't match exactly:
- Time entry is still created
- project_id will be NULL
- notes field stores the project name entered

### Unlinked Entries:

You can see entries without project links:
```sql
SELECT * FROM time_entries WHERE project_id IS NULL;
```

These happen when:
- Employee types custom project name
- Project name changed after time entry
- Project was deleted

---

## 🎯 What's Next?

After running the SQL:

1. **✅ Time automatically links to projects**
2. **✅ No code changes needed** (already in mobile app)
3. **✅ Works in new APK build**
4. **✅ Ready for reporting!**

### Future Enhancements:

Want to add:
- Weekly time reports by project?
- Email project time summaries?
- Export to CSV/Excel?
- Project budgets vs actual time?

**Let me know and I can build those features!**

---

## Summary

**Run the SQL above → Time automatically links to projects! 🎉**

The mobile app code is already there, just needs the table to exist.
