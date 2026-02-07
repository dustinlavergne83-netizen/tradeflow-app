# Assembly CSV Import Guide

## Overview
This guide explains how to bulk-import fitting assemblies using a CSV template.

## Step 1: Get Material IDs

Before filling out the CSV, you need to find the actual material IDs from your database.

### Option A: Query Supabase
Run this query in Supabase SQL Editor to find your material IDs:

```sql
-- Find all EMT fittings and connectors
SELECT id, name, category 
FROM base_materials 
WHERE name ILIKE '%emt%' 
  AND (name ILIKE '%lb%' 
    OR name ILIKE '%elbow%' 
    OR name ILIKE '%90%' 
    OR name ILIKE '%45%'
    OR name ILIKE '%connector%'
    OR name ILIKE '%coupling%')
ORDER BY name;
```

### Option B: Check Base Materials Manager
1. Go to Admin → Base Materials Manager
2. Search for materials (e.g., "EMT LB")
3. Copy the material ID (shown in the table)

## Step 2: Fill Out CSV Template

Open `public/assemblies_import_template.csv` and fill it with your actual material IDs:

### CSV Format:
```
assembly_name,assembly_category,assembly_description,component_material_id,component_quantity,component_quantity_type,component_description
```

### Example Row:
```csv
"2"" EMT LB Body Assembly",Fittings,"Complete LB body with connectors",emt_lb_2,1,fixed,"LB body"
"2"" EMT LB Body Assembly",Fittings,"Complete LB body with connectors",emt_connector_2,2,fixed,"Set screw connectors"
```

### Important Notes:
- **Same assembly name** = components get grouped together
- **component_material_id** = Must match ID from base_materials table
- **component_quantity_type** options: `fixed`, `per_foot`, `per_10_feet`, `per_100_feet`
- Use double-double quotes for inch marks in CSV: `"2"" EMT` (not `"2" EMT`)

## Step 3: Generate SQL

Run the Python script to convert your CSV to SQL:

```bash
python import_assemblies_from_csv.py public/assemblies_import_template.csv > import_assemblies.sql
```

This will create an SQL file with all INSERT statements.

## Step 4: Find Your Company ID

Run this in Supabase to get your user ID:

```sql
SELECT id, email FROM auth.users;
```

Copy your ID (looks like: `a1b2c3d4-1234-5678-9abc-def123456789`)

## Step 5: Update SQL File

Open `import_assemblies.sql` and replace **ALL** instances of `YOUR_COMPANY_ID` with your actual ID.

Find and replace:
- Find: `YOUR_COMPANY_ID`
- Replace with: `a1b2c3d4-1234-5678-9abc-def123456789` (your actual ID)

## Step 6: Run SQL in Supabase

1. Go to Supabase Dashboard → SQL Editor
2. Create new query
3. Paste the entire SQL content
4. Click "Run"

## Verification

After import, verify the assemblies:

```sql
-- Check assemblies
SELECT id, name, category 
FROM assemblies 
WHERE is_custom = true
ORDER BY name;

-- Check components for a specific assembly
SELECT 
  a.name as assembly_name,
  ac.material_id,
  bm.name as material_name,
  ac.quantity,
  ac.quantity_type,
  ac.description
FROM assembly_components ac
JOIN assemblies a ON ac.assembly_id = a.id
JOIN base_materials bm ON ac.material_id = bm.id
WHERE a.name LIKE '%LB Body%'
ORDER BY a.name, ac.sequence;
```

## Example: Complete CSV for 2" EMT Fittings

Assuming you found these material IDs:
- 2" EMT LB Body = `emt_lb_2`
- 2" EMT 90° Elbow = `emt_90_elbow_2`
- 2" EMT Connector = `emt_ss_connector_2`
- 2" EMT Coupling = `emt_ss_coupling_2`

Your CSV would be:

```csv
assembly_name,assembly_category,assembly_description,component_material_id,component_quantity,component_quantity_type,component_description
"2"" EMT LB Body Assembly",Fittings,"Complete LB body with connectors",emt_lb_2,1,fixed,"LB body"
"2"" EMT LB Body Assembly",Fittings,"Complete LB body with connectors",emt_ss_connector_2,2,fixed,"Set screw connectors"
"2"" EMT 90° Elbow Assembly",Fittings,"Complete 90° elbow with coupling",emt_90_elbow_2,1,fixed,"90° elbow"
"2"" EMT 90° Elbow Assembly",Fittings,"Complete 90° elbow with coupling",emt_ss_coupling_2,1,fixed,"Set screw coupling"
```

## Troubleshooting

### Error: Material ID not found
- Double-check material IDs in base_materials table
- Make sure IDs match exactly (case-sensitive)

### Error: Duplicate assembly name
- Each assembly name must be unique per company
- Add size or variation to make names unique

### Assemblies not showing in takeoff
- Check `is_active = true` in assemblies table
- Refresh the takeoff page
- Check that materials are in the "Fittings" or appropriate category

## Next Steps

After importing assemblies:
1. Go to Admin → Assembly Manager to verify
2. Test in Takeoff → Length Tool → Add Materials
3. Select your new assembly and verify components appear correctly
