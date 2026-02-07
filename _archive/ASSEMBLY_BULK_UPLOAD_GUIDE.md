# Assembly Bulk Upload Guide

## Quick Start

This guide shows you how to bulk-upload custom assemblies using CSV templates.

## Files You Need

1. **assembly_bulk_upload_template.csv** - Blank template (use this to create your own)
2. **assembly_bulk_upload_example.csv** - Example with sample assemblies (reference this)
3. **import_assemblies_from_csv.py** - Python script to convert CSV to SQL

## Step-by-Step Instructions

### Step 1: Get Your Material IDs

Before creating assemblies, you need the actual material IDs from your database.

#### Option A: Query in Supabase SQL Editor
```sql
-- Find materials by name
SELECT id, name, category, unit, unit_cost 
FROM base_materials 
WHERE name ILIKE '%emt%' 
  OR name ILIKE '%box%'
  OR name ILIKE '%wire%'
ORDER BY category, name;

-- Find specific materials
SELECT id, name, unit_cost 
FROM base_materials 
WHERE name ILIKE '%3/4" emt%'
ORDER BY name;
```

#### Option B: Use Base Materials Manager
1. Go to **Admin** → **Base Materials Manager**
2. Use the search to find materials
3. Copy the material ID from the table

### Step 2: Fill Out CSV Template

Open `public/assembly_bulk_upload_template.csv` and add your assemblies.

#### CSV Format:
```
assembly_name,assembly_category,assembly_description,component_material_id,component_quantity,component_quantity_type,component_description
```

#### Column Definitions:

| Column | Description | Example |
|--------|-------------|---------|
| **assembly_name** | Name of the assembly (multiple rows with same name = one assembly with multiple components) | `"1"" EMT LB Body Assembly"` |
| **assembly_category** | Category for organizing assemblies | `Fittings`, `Conduit`, `Boxes`, `Devices`, `Circuits` |
| **assembly_description** | Brief description of the assembly | `"Complete LB body with connectors"` |
| **component_material_id** | Material ID from base_materials table (MUST MATCH EXACTLY) | `emt_lb_1` |
| **component_quantity** | Quantity of this component | `1`, `2`, `0.5`, `0.33` |
| **component_quantity_type** | How quantity is calculated | `fixed`, `per_foot`, `per_10_feet`, `per_100_feet` |
| **component_description** | Description of this specific component | `"LB body"`, `"Set screw connectors"` |

#### Quantity Types Explained:

- **fixed** - Fixed quantity per assembly (e.g., 1 LB body per assembly)
- **per_foot** - Quantity per linear foot (e.g., 0.2 connectors per foot = 1 connector per 5 feet)
- **per_10_feet** - Quantity per 10 feet (e.g., 1 connector per 10 feet)
- **per_100_feet** - Quantity per 100 feet (e.g., 1 coupling per 100 feet)

#### Important CSV Rules:

1. **Same assembly name** = Components get grouped into one assembly
2. **Quote inch marks** - Use `"2"" EMT` (double-double quotes) not `"2" EMT`
3. **No extra spaces** - Keep data clean and consistent
4. **Material IDs must match** - IDs are case-sensitive and must exist in base_materials table

### Step 3: Example Assembly

Here's a complete example of a 2" EMT LB Assembly with 3 components:

```csv
assembly_name,assembly_category,assembly_description,component_material_id,component_quantity,component_quantity_type,component_description
"2"" EMT LB Body Assembly",Fittings,"Complete 2"" LB body with connectors",emt_lb_2,1,fixed,"2"" LB body"
"2"" EMT LB Body Assembly",Fittings,"Complete 2"" LB body with connectors",emt_connector_2,2,fixed,"Set screw connectors"
"2"" EMT LB Body Assembly",Fittings,"Complete 2"" LB body with connectors",lb_gasket_2,1,fixed,"LB gasket"
```

This creates **ONE assembly** called "2" EMT LB Body Assembly" with **THREE components**.

### Step 4: Generate SQL from CSV

Once your CSV is ready, convert it to SQL:

```bash
python import_assemblies_from_csv.py public/assembly_bulk_upload_template.csv > import_assemblies.sql
```

This creates an SQL file with all the INSERT statements.

### Step 5: Get Your Company ID

You need your user ID to associate assemblies with your account:

```sql
SELECT id, email FROM auth.users;
```

Copy your ID (format: `a1b2c3d4-1234-5678-9abc-def123456789`)

### Step 6: Update SQL File

Open `import_assemblies.sql` and replace all instances of `YOUR_COMPANY_ID`:

**Find:** `YOUR_COMPANY_ID`  
**Replace with:** `a1b2c3d4-1234-5678-9abc-def123456789` (your actual ID)

💡 **Tip:** Use Find & Replace (Ctrl+H) to replace all instances at once.

### Step 7: Import to Database

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Create a **New Query**
3. Paste the entire contents of `import_assemblies.sql`
4. Click **Run**

### Step 8: Verify Import

Check that assemblies were created successfully:

```sql
-- View all your assemblies
SELECT 
  id, 
  name, 
  category,
  (SELECT COUNT(*) FROM assembly_components WHERE assembly_id = assemblies.id) as component_count
FROM assemblies 
WHERE is_custom = true
ORDER BY name;

-- View components for a specific assembly
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

## Common Assembly Examples

### Fixed Quantity Assembly (Fittings)
Components with fixed quantities per assembly:
```csv
"1"" EMT 90° Elbow Assembly",Fittings,"Complete 90° elbow",emt_90_1,1,fixed,"90° elbow"
"1"" EMT 90° Elbow Assembly",Fittings,"Complete 90° elbow",emt_coupling_1,1,fixed,"Coupling"
```

### Per-Foot Assembly (Conduit Runs)
Components calculated per linear foot:
```csv
"3/4"" EMT Conduit Run",Conduit,"Complete conduit run",emt_conduit_3_4,1,per_foot,"EMT conduit"
"3/4"" EMT Conduit Run",Conduit,"Complete conduit run",emt_connector_3_4,0.2,per_foot,"Connectors (1 per 5ft)"
"3/4"" EMT Conduit Run",Conduit,"Complete conduit run",emt_strap_3_4,0.33,per_foot,"Straps (1 per 3ft)"
```

### Multi-Component Assembly (Boxes)
Assembly with many components:
```csv
"4"" Square Box Complete",Boxes,"Box with cover and devices",box_4sq_deep,1,fixed,"4"" deep box"
"4"" Square Box Complete",Boxes,"Box with cover and devices",box_4sq_cover,1,fixed,"Device cover"
"4"" Square Box Complete",Boxes,"Box with cover and devices",device_bracket,1,fixed,"Mounting bracket"
"4"" Square Box Complete",Boxes,"Box with cover and devices",box_screw,4,fixed,"Mounting screws"
```

## Troubleshooting

### ❌ Error: "Material ID not found"
**Problem:** The material_id doesn't exist in base_materials table  
**Solution:** Run the material query to verify IDs:
```sql
SELECT id, name FROM base_materials WHERE id = 'your_material_id';
```

### ❌ Error: "Duplicate assembly name"
**Problem:** Assembly with that name already exists  
**Solution:** Either delete old assembly or use a different name

### ❌ Assemblies not showing in app
**Problem:** Assembly might be inactive or not associated with your company  
**Solution:** Check assembly status:
```sql
SELECT id, name, is_active, company_id 
FROM assemblies 
WHERE name = 'Your Assembly Name';
```

### ❌ CSV parsing errors
**Problem:** Incorrect CSV formatting  
**Solution:** 
- Use double-double quotes for inch marks: `"2"" EMT"`
- Ensure no extra commas in descriptions
- Check for hidden characters or encoding issues

### ❌ Components not linked to assembly
**Problem:** Material ID mismatch or sequence issues  
**Solution:** Verify components exist:
```sql
SELECT * FROM assembly_components 
WHERE assembly_id = 'your_assembly_id'
ORDER BY sequence;
```

## Tips for Success

1. **Start Small** - Import 2-3 assemblies first to test
2. **Verify Material IDs** - Double-check all material IDs before importing
3. **Use Consistent Naming** - Keep assembly names clear and organized
4. **Group by Category** - Use categories like Fittings, Conduit, Boxes, Devices
5. **Document Quantities** - Use component_description to explain calculations
6. **Test After Import** - Go to Admin → Assembly Manager to verify

## Common Categories

Suggested categories for organizing assemblies:

- **Conduit** - Conduit runs with straps and connectors
- **Fittings** - LBs, elbows, couplings, etc.
- **Boxes** - Junction boxes, device boxes with covers
- **Devices** - Receptacles, switches with wire pigtails
- **Circuits** - Complete circuits with wire and devices
- **Fixtures** - Lighting fixtures with mounting hardware
- **Panels** - Panel assemblies with breakers
- **Wire** - Wire bundles or cable assemblies

## Need Help?

1. Review the **example CSV** file for reference
2. Check the **ASSEMBLY_CSV_IMPORT_GUIDE.md** for additional details
3. Verify your material IDs in the Base Materials Manager
4. Test with 1-2 assemblies before bulk importing

## Quick Reference

```bash
# Generate SQL from CSV
python import_assemblies_from_csv.py public/assembly_bulk_upload_template.csv > import_assemblies.sql

# Get your company ID
SELECT id, email FROM auth.users;

# Replace YOUR_COMPANY_ID in the SQL file
# Run the SQL in Supabase

# Verify import
SELECT name, category, (SELECT COUNT(*) FROM assembly_components WHERE assembly_id = assemblies.id) 
FROM assemblies WHERE is_custom = true;
```

---

✅ **You're ready to bulk upload assemblies!** Start with the template, fill in your materials, and follow the steps above.
