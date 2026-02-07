# Assembly Bulk Upload - Quick Start

## 🎯 What You Need

1. **Blank Template**: `public/assembly_bulk_upload_template.csv`
2. **Example Reference**: `public/assembly_bulk_upload_example.csv`
3. **Full Guide**: `ASSEMBLY_BULK_UPLOAD_GUIDE.md`

## ⚡ Quick Steps

### 1. Get Material IDs
```sql
SELECT id, name, category FROM base_materials ORDER BY name;
```

### 2. Fill CSV Template
Open `public/assembly_bulk_upload_template.csv` and add your assemblies:
```csv
assembly_name,assembly_category,assembly_description,component_material_id,component_quantity,component_quantity_type,component_description
"2"" EMT LB Assembly",Fittings,"Complete LB",emt_lb_2,1,fixed,"LB body"
"2"" EMT LB Assembly",Fittings,"Complete LB",emt_connector_2,2,fixed,"Connectors"
```

### 3. Generate SQL
```bash
python import_assemblies_from_csv.py public/assembly_bulk_upload_template.csv > import_assemblies.sql
```

### 4. Get Your Company ID
```sql
SELECT id, email FROM auth.users;
```
Copy your ID (e.g., `a1b2c3d4-1234-5678-9abc-def123456789`)

### 5. Replace Company ID
Open `import_assemblies.sql` and replace all `YOUR_COMPANY_ID` with your actual ID.

### 6. Import to Database
- Go to Supabase → SQL Editor
- Paste the SQL
- Click Run

### 7. Verify
```sql
SELECT name, category, 
  (SELECT COUNT(*) FROM assembly_components WHERE assembly_id = assemblies.id) as components
FROM assemblies WHERE is_custom = true;
```

## 📋 CSV Columns

| Column | Example | Notes |
|--------|---------|-------|
| assembly_name | `"1"" EMT LB"` | Use `""` for inches |
| assembly_category | `Fittings` | Conduit, Fittings, Boxes, etc. |
| assembly_description | `"Complete LB"` | Brief description |
| component_material_id | `emt_lb_1` | Must exist in base_materials |
| component_quantity | `1`, `0.2` | Numeric value |
| component_quantity_type | `fixed`, `per_foot` | How to calculate |
| component_description | `"LB body"` | What this component is |

## 🔢 Quantity Types

- **fixed** - Per assembly (e.g., 1 LB body)
- **per_foot** - Per foot (e.g., 0.2 = 1 per 5 feet)
- **per_10_feet** - Per 10 feet
- **per_100_feet** - Per 100 feet

## 💡 Key Tips

- Multiple rows with **same assembly_name** = one assembly with multiple components
- Material IDs must match exactly (case-sensitive)
- Use `"2"" EMT` for 2" (double-double quotes in CSV)
- Start with 2-3 assemblies to test first

## 📚 Need More Help?

See **ASSEMBLY_BULK_UPLOAD_GUIDE.md** for complete instructions, examples, and troubleshooting.
