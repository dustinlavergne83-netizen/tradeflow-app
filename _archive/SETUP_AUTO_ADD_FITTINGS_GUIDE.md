# 🔧 Setup Guide: Auto-Add Couplings & Connectors

## What This Does

Instead of searching by name (unreliable!), assemblies now use **material IDs** to specify exactly what couplings/connectors to add automatically.

---

## How It Works

In the `assembly_components` table, we added two new columns:

- `auto_add_coupling_id` - Material ID to auto-add (for elbows/45s, adds 1 coupling per fitting)
- `auto_add_connector_id` - Material ID to auto-add (for bodies, adds 2 connectors per body)

When you use an assembly in takeoff, the system:
1. Looks at each component
2. If it has `auto_add_coupling_id` → adds that many couplings
3. If it has `auto_add_connector_id` → adds that many connectors × 2

---

## 🎯 Step 1: Find the Material IDs

Open Supabase → Table Editor → `base_materials`

**Find your couplings:**
1. Filter by category = "Fittings" (or wherever yours are)
2. Search for "coupling"
3. Copy the `id` for each size you need:
   - Example: 3/4" Set Screw Coupling → `12345678-1234-1234-1234-123456789abc`

**Find your connectors:**
1. Search for "connector" (NOT splice connector)
2. Copy the `id` for each size:
   - Example: 3/4" Connector → `87654321-4321-4321-4321-cba987654321`

---

## 🎯 Step 2: Update Assembly Components

### Option A: Direct Database Update (Fastest)

Open Supabase → SQL Editor → Run this query:

```sql
-- Example: Set up 3/4" EMT 90° Elbow to auto-add coupling
UPDATE assembly_components
SET auto_add_coupling_id = 'YOUR-COUPLING-ID-HERE'
WHERE material_name LIKE '3/4" EMT 90%';

-- Example: Set up 3/4" EMT 45° Elbow to auto-add coupling
UPDATE assembly_components
SET auto_add_coupling_id = 'YOUR-COUPLING-ID-HERE'
WHERE material_name LIKE '3/4" EMT 45%';

-- Example: Set up 3/4" FS Box (LB) to auto-add connectors
UPDATE assembly_components
SET auto_add_connector_id = 'YOUR-CONNECTOR-ID-HERE'
WHERE material_name LIKE '3/4"%' AND material_name LIKE '%LB';
```

**Replace `YOUR-COUPLING-ID-HERE` with the actual UUID from step 1!**

---

### Option B: Manual Entry in Assembly Manager

1. Go to Assembly Manager
2. Edit an assembly (e.g., "3/4" EMT with Fittings")
3. For each component (elbow, 45, body, etc.):
   - Find the `auto_add_coupling_id` field
   - Paste the material ID of the coupling you want to auto-add
4. Save the assembly

**Note:** This option requires updating the Assembly Manager UI to show these fields.

---

## 🎯 Step 3: Test It!

1. Go to Takeoff
2. Draw a length measurement
3. Select an assembly with auto-add IDs configured
4. Enter quantities for the parametric components (if any)
5. Check the console log - you should see:
   ```
   ✅ Component "3/4" EMT 90° Elbow" (qty=2) wants coupling ID: 12345...
   ➕ Adding coupling: 3/4" Set Screw Coupling (qty=2)
   ```
6. Save the measurement
7. Check that couplings/connectors were added automatically!

---

## 📋 Example: Complete Setup for 3/4" EMT

```sql
-- First, get the IDs (run SELECT queries)
SELECT id, name FROM base_materials WHERE name LIKE '3/4" Set Screw Coupling%';
-- Result: 12345678-1234-1234-1234-123456789abc

SELECT id, name FROM base_materials WHERE name LIKE '3/4" Connector%' AND name NOT LIKE '%Splice%';
-- Result: 87654321-4321-4321-4321-cba987654321

-- Now update the assembly components
UPDATE assembly_components
SET auto_add_coupling_id = '12345678-1234-1234-1234-123456789abc'
WHERE material_name LIKE '3/4" EMT 90%' OR material_name LIKE '3/4" EMT 45%';

UPDATE assembly_components
SET auto_add_connector_id = '87654321-4321-4321-4321-cba987654321'
WHERE material_name LIKE '3/4"%' AND (material_name LIKE '%LB' OR material_name LIKE '%LL' OR material_name LIKE '%LR');
```

---

## 🔍 Verify Setup

Check which components have auto-add IDs configured:

```sql
SELECT 
  ac.material_name,
  ac.quantity,
  bm_coupling.name as coupling_to_add,
  bm_connector.name as connector_to_add
FROM assembly_components ac
LEFT JOIN base_materials bm_coupling ON ac.auto_add_coupling_id = bm_coupling.id
LEFT JOIN base_materials bm_connector ON ac.auto_add_connector_id = bm_connector.id
WHERE ac.auto_add_coupling_id IS NOT NULL OR ac.auto_add_connector_id IS NOT NULL
ORDER BY ac.material_name;
```

---

## 💡 Tips

1. **One size at a time**: Set up 3/4" first, test it, then do 1", etc.
2. **Check your naming**: Material names must match exactly for the `LIKE` queries
3. **Different coupling types**: If you use compression couplings for some sizes, update those separately
4. **Bodies need 2 connectors**: The system automatically multiplies by 2 for connector quantities

---

## 🚫 Troubleshooting

**Problem:** Couplings/connectors not being added

**Solutions:**
1. Check console logs for errors
2. Verify the IDs are correct UUIDs (not material names!)
3. Make sure the components have `quantity > 0`
4. Check that `auto_add_coupling_id`/`auto_add_connector_id` columns exist:
   ```sql
   SELECT column_name FROM information_schema.columns 
   WHERE table_name = 'assembly_components' 
   AND column_name LIKE 'auto_add%';
   ```

---

## 📊 Quick Setup Script for All Common Sizes

Once you have the IDs, run this (customize for your material IDs):

```sql
-- 3/4" EMT
UPDATE assembly_components SET auto_add_coupling_id = 'YOUR-3/4-COUPLING-ID'
WHERE material_name LIKE '3/4"%EMT%' AND (material_name LIKE '%90%' OR material_name LIKE '%45%');

UPDATE assembly_components SET auto_add_connector_id = 'YOUR-3/4-CONNECTOR-ID'
WHERE material_name LIKE '3/4"%' AND material_name LIKE '%Body%';

-- 1" EMT
UPDATE assembly_components SET auto_add_coupling_id = 'YOUR-1-COUPLING-ID'
WHERE material_name LIKE '1"%EMT%' AND (material_name LIKE '%90%' OR material_name LIKE '%45%');

UPDATE assembly_components SET auto_add_connector_id = 'YOUR-1-CONNECTOR-ID'
WHERE material_name LIKE '1"%' AND material_name LIKE '%Body%';

-- Add more sizes as needed...
```

---

## ✅ Done!

Now when you use assemblies in takeoff, couplings and connectors will be added automatically based on the exact material IDs you specified - no more name parsing issues! 🎉
