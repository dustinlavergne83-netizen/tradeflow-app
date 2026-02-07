# Integrate Web Projects into Mobile App

## Current Situation:

### ❌ Problem:
- **Web app**: Projects stored in `projects` table in Supabase
- **Mobile app**: Project names stored locally on each phone (AsyncStorage)
- **Result**: Employees can't see projects you create in the web app!

### ✅ Solution:
Make mobile app load projects from the same `projects` table as the web app.

---

## Step 1: Update Database Permissions

First, we need to allow employees to VIEW projects (they can't edit, just view to select them).

### Run this SQL in Supabase Dashboard:

```sql
-- Allow employees to view their company's projects
CREATE POLICY "Employees can view company projects"
  ON projects FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
      AND employees.company_id = projects.company_id
    )
  );
```

**What this does:**
- Employees can SELECT (view) projects
- But only if the project's `company_id` matches their `company_id` in the employees table
- They still can't create, update, or delete projects (only admins can)

---

## Step 2: Update Mobile App Code

We need to change `timeclock-mobile/app/(tabs)/timeclock.tsx` to load projects from database instead of AsyncStorage.

### Changes Needed:

#### A. Replace the `loadProjects` function:

**Current code (around line 470):**
```typescript
async function loadProjects() {
  try {
    const raw = await AsyncStorage.getItem(LS_PROJECTS_KEY);
    if (!raw) return setProjects([]);
    const arr = JSON.parse(raw);
    setProjects(Array.isArray(arr) ? arr : []);
  } catch {
    setProjects([]);
  }
}
```

**Replace with:**
```typescript
async function loadProjects() {
  try {
    // Get employee's company_id
    if (!employee?.company_id) {
      setProjects([]);
      return;
    }

    // Load active projects from database
    const { data, error } = await supabase
      .from("projects")
      .select("name")
      .eq("company_id", employee.company_id)
      .eq("status", "active")
      .order("name", { ascending: true });

    if (error) {
      console.log("Load projects error:", error.message);
      setProjects([]);
      return;
    }

    // Extract project names
    const names = (data || []).map(p => p.name);
    setProjects(names);

  } catch (e) {
    console.log("loadProjects error:", e);
    setProjects([]);
  }
}
```

#### B. Update when projects are loaded:

**Find this code (around line 410):**
```typescript
await withTimeout(loadEmployeeProfile(userId), 8000, "loadEmployeeProfile");
await withTimeout(loadProjects(), 8000, "loadProjects");
```

**Change to:**
```typescript
await withTimeout(loadEmployeeProfile(userId), 8000, "loadEmployeeProfile");
// Load projects AFTER employee is loaded (need company_id)
if (employee?.company_id) {
  await withTimeout(loadProjects(), 8000, "loadProjects");
}
```

#### C. Remove or simplify `upsertProjectName`:

Since projects are now managed in the web app, you don't need to save them locally. You can either:

**Option 1: Remove it completely** - Projects only come from database

**Option 2: Keep for "recent" tracking** - Still save recently used ones locally for quick access

---

## Step 3: Test the Integration

### 1. Run the SQL in Supabase:
- Go to Supabase Dashboard
- SQL Editor
- Paste the policy SQL above
- Run it

### 2. Create a test project in web app:
- Go to your web app
- Create a new project called "Test Project Integration"
- Make sure status is "active"

### 3. Test in mobile app (Expo Go):
- Sign in as an employee
- Click "Clock In"
- **You should now see "Test Project Integration" in the list!**

---

## Benefits of This Approach:

✅ **Single source of truth** - Projects managed in one place (web app)  
✅ **Real-time sync** - Create project in web, employees see it immediately  
✅ **No duplicate entry** - Employees don't manually type project names  
✅ **Better reporting** - Time entries linked to actual projects  
✅ **Admin control** - You decide which projects are active/visible  

---

## Alternative: Hybrid Approach (Recommended)

For best user experience, combine both:

### Show BOTH:
1. **Company projects from database** (from web app)
2. **Plus recent projects** (from local storage for quick access)

```typescript
async function loadProjects() {
  try {
    let allProjects: string[] = [];

    // 1. Load from database if employee has company_id
    if (employee?.company_id) {
      const { data } = await supabase
        .from("projects")
        .select("name")
        .eq("company_id", employee.company_id)
        .eq("status", "active")
        .order("name");

      if (data) {
        allProjects = data.map(p => p.name);
      }
    }

    // 2. Also load recent local projects
    const raw = await AsyncStorage.getItem(LS_PROJECTS_KEY);
    if (raw) {
      const recent = JSON.parse(raw);
      if (Array.isArray(recent)) {
        // Combine and remove duplicates
        allProjects = [...new Set([...allProjects, ...recent])];
      }
    }

    setProjects(allProjects);
  } catch (e) {
    console.log("loadProjects error:", e);
    setProjects([]);
  }
}
```

This way:
- Employees see official company projects from web app
- Plus any custom/ad-hoc project names they've used before
- Best of both worlds!

---

## Quick Implementation Guide:

### Do This Now:

1. **Copy the SQL policy above**
2. **Go to Supabase Dashboard** → SQL Editor
3. **Paste and run the SQL**
4. **Test**: Create a project in web app, check if employees can see it

### Do Tomorrow (When Building APK):

1. **Update the mobile app code** with the changes above
2. **Test in Expo Go** first
3. **Build new APK** with updated code
4. **Employees will see your web projects!**

---

## Summary:

Right now your setup:
- ❌ Web projects stored in database
- ❌ Mobile projects stored on each phone
- ❌ They're NOT connected

After this fix:
- ✅ Web projects in database
- ✅ Mobile app reads from database
- ✅ **Perfect sync!**

**You create a project in the web app → Employees instantly see it in their mobile app!**
