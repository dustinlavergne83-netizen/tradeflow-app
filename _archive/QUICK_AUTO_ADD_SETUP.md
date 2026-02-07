# Quick Setup: Auto-Add Couplings/Connectors (NO assembly rebuild needed!)

## 🎯 You DON'T need to recreate your assemblies!

Your assemblies are fine as-is. We're just adding 2 pieces of info to existing components.

---

## What We're Doing

For each fitting component (elbows, 45s, bodies) in your assemblies, we're just telling it:
- "When someone picks this elbow, also add THIS coupling" (using the coupling's ID)
- "When someone picks this body, also add THIS connector" (using the connector's ID)

That's it. The assembly stays the same, we're just filling in 2 empty fields.

---

## Step 1: Get the IDs (One Time Only)

Open Supabase → SQL Editor → Run this:

```sql
-- Get coupling IDs
SELECT id, name, size 
FROM base_materials 
WHERE name LIKE '%Coupling%' 
  AND name LIKE '%Set Screw%'
ORDER BY size;

-- Get connector IDs  
SELECT id, name, size
FROM base_materials
WHERE name LIKE '%Connector%'
  AND name NOT LIKE '%Splice%'
ORDER BY size;
```

Copy the IDs into a notepad. Example:
```
3/4" Set Screw Coupling: 12345678-abcd-1234-abcd-123456789abc
1" Set Screw Coupling: 87654321-dcba-4321-dcba-987654321cba
3/4" Connector: aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee
1" Connector: ffffffff-gggg-hhhh-iiii-jjjjjjjjjjjj
```

---

## Step 2: Update Existing Components (One Query!)

Replace the IDs below with yours, then run:

```sql
-- Tell 3/4" elbows & 45s to auto-add 3/4" coupling
UPDATE assembly_components
SET auto_add_coupling_id = '12345678-abcd-1234-abcd-123456789abc'
WHERE material_name LIKE '3/4"%EMT%' 
  AND (material_name LIKE '%90%' OR material_name LIKE '%45%');

-- Tell 3/4" bodies to auto-add 3/4" connectors
UPDATE assembly_components
SET auto_add_connector_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
WHERE material_name LIKE '3/4"%' 
  AND (material_name LIKE '%LB%' OR material_name LIKE '%Body%');

-- Tell 1" elbows & 45s to auto-add 1" coupling
UPDATE assembly_components
SET auto_add_coupling_id = '87654321-dcba-4321-dcba-987654321cba'
WHERE material_name LIKE '1"%EMT%' 
  AND (material_name LIKE '%90%' OR material_name LIKE '%45%');

-- Tell 1" bodies to auto-add 1" connectors
UPDATE assembly_components
SET auto_add_connector_id = 'ffffffff-gggg-hhhh-iiii-jjjjjjjjjjjj'
WHERE material_name LIKE '1"%' 
  AND (material_name LIKE '%LB%' OR material_name LIKE '%Body%');
```

**That's it! Your assemblies now know what to auto-add.**

---

## Step 3: Test

1. Go to Takeoff
2. Draw a measurement with an assembly
3. Enter fitting quantities (e.g., 2 elbows)
4. Save
5. Check if couplings/connectors were added automatically

---

## What Actually Changed?

**Before this update:**
- Assembly component: `{ material_name: "3/4" EMT 90° Elbow" }`

**After this update:**
- Assembly component: `{ material_name: "3/4" EMT 90° Elbow", auto_add_coupling_id: "12345..." }`

Same component, just added an ID field. **Nothing else changes.**

---

## Verify It Worked

Check what got updated:

```sql
SELECT 
  material_name,
  auto_add_coupling_id,
  auto_add_connector_id
FROM assembly_components
WHERE auto_add_coupling_id IS NOT NULL 
   OR auto_add_connector_id IS NOT NULL;
```

You should see your fittings with IDs filled in!
