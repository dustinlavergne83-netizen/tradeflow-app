# EMT Materials Clean Slate - Complete Guide

## 🎯 Overview
This guide walks you through deleting all EMT materials and re-importing them with clean, consistent IDs.

## 📋 New Naming Structure

### Pattern: `emt[size]_[component]`

### Sizes:
- **1/2"** → `emt12`
- **3/4"** → `emt34`
- **1"** → `emt1`
- **1-1/4"** → `emt114`
- **1-1/2"** → `emt112`
- **2"** → `emt2`
- **2-1/2"** → `emt212`
- **3"** → `emt3`
- **3-1/2"** → `emt312`
- **4"** → `emt4`

### Components:
- **(none)** = Conduit (e.g., `emt12` = 1/2" EMT conduit)
- **_90** = 90° elbow
- **_45** = 45° elbow
- **_ssconn** = Set-screw connector
- **_cpconn** = Compression connector
- **_sscpl** = Set-screw coupling
- **_cpcpl** = Compression coupling
- **_flexcpl** = Flex to EMT coupling
- **_lb** = LB conduit body
- **_ll** = LL conduit body
- **_lr** = LR conduit body
- **_t** = T conduit body
- **_c** = C conduit body
- **_1hole** = 1-hole strap
- **_2hole** = 2-hole strap
- **_strap** = Generic strap/clamp
- **_standoff** = Standoff strap
- **_bushing** = Bushing
- **_offset** = Offset connector
- **_bender** = Bender tool

## 📝 Step-by-Step Process

### Step 1: Export Current Materials
```sql
-- Run this in Supabase SQL Editor
-- Copy results to CSV
```
**File:** `EXPORT_EMT_MATERIALS_FOR_REIMPORT.sql`

This exports:
- old_id (for reference)
- **new_id** (what it should be)
- name
- basecost ✅
- laborhours ✅
- category
- unit
- All other fields

**Action:** Save the results as CSV (e.g., `emt_materials_backup.csv`)

### Step 2: Review the Export
- Check that all materials have a `new_id`
- Look for any `emt_unknown` or `emt[size]_other` entries
- Manually assign proper IDs if needed

### Step 3: Delete All EMT Materials
```sql
-- Run this AFTER you have the CSV backup!
```
**File:** `DELETE_ALL_EMT_MATERIALS.sql`

1. Run the SELECT queries first (see what will be deleted)
2. Uncomment the DELETE section
3. Run the DELETE
4. Verify count is 0

### Step 4: Re-Import with New IDs

Create a Python script or use Supabase bulk import:

```python
import csv
import supabase

# Your CSV columns:
# new_id, name, basecost, laborhours, category, unit, etc.

with open('emt_materials_backup.csv', 'r') as f:
    reader = csv.DictReader(f)
    for row in reader:
        data = {
            'id': row['new_id'],  # Use the NEW ID!
            'name': row['name'],
            'basecost': float(row['basecost']),
            'laborhours': float(row['laborhours']),
            'category': row['category'],
            'unit': row['unit'],
            # Add other fields as needed
        }
        supabase_client.table('base_materials').insert(data).execute()
```

## ✅ Benefits of Clean Slate Approach

1. **No Duplicate Conflicts** - Fresh start eliminates all existing issues
2. **Consistent Naming** - All materials follow same pattern
3. **Easy to Understand** - `emt12_90` is obviously 1/2" 90° elbow
4. **Assembly-Ready** - IDs are logical for building assemblies
5. **Data Preserved** - All costs and labor hours maintained

## 📊 Examples

### Before vs After:
| Old ID | Name | New ID |
|--------|------|--------|
| emt_0_5 | "1/2"" EMT" | emt12 |
| emt45_0_5 | "1/2"" EMT 45°" | emt12_45 |
| emt_setscrew_0_5 | "1/2"" EMT Set-Screw Connector" | emt12_ssconn |
| flex_emt_cpl_0_5 | "1/2"" Flex to EMT Coupling" | emt12_flexcpl |
| emt_strap1_0_5 | "1/2"" EMT 1-Hole Strap" | emt12_1hole |
| emt_1_5 | "1-1/2"" EMT" | emt112 |
| emt_elbow_1_5 | "1-1/2"" EMT 90° Elbow" | emt112_90 |
| emt_2_5 | "2-1/2"" EMT" | emt212 |

## 🚀 Ready to Execute?

1. ✅ Run `EXPORT_EMT_MATERIALS_FOR_REIMPORT.sql`
2. ✅ Save results to CSV
3. ✅ Review new IDs
4. ✅ Run `DELETE_ALL_EMT_MATERIALS.sql`
5. ✅ Re-import using CSV with new IDs

## 💾 Backup Safety

Your CSV will have EVERYTHING:
- Material names
- Base costs
- Labor hours
- Categories
- Units
- Suppliers
- Part numbers
- Dates

Nothing is lost - it's all in the export!
