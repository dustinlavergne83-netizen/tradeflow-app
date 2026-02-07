# 🔧 Rigid Conduit Assembly Import Guide

## Problem
Your CSV has a **denormalized format** combining assemblies and components, but the database needs TWO separate tables:
- `assemblies` table (assembly header info)
- `assembly_components` table (individual materials in each assembly)

## Solution
Use the Python import script: `import_rigid_assemblies.py`

---

## Step-by-Step Instructions

### 1. Install Required Package
Open a terminal and run:
```bash
pip install supabase
```

### 2. Get Your Company ID
You need your company ID from the database. Run this SQL query in Supabase:

```sql
SELECT id FROM profiles LIMIT 1;
```

Copy the UUID that's returned (something like: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`)

### 3. Edit the Script
Open `import_rigid_assemblies.py` and update line 18:

**BEFORE:**
```python
COMPANY_ID = "YOUR_COMPANY_ID_HERE"  # Replace with your actual company ID
```

**AFTER:**
```python
COMPANY_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"  # Your actual company ID
```

### 4. Update Supabase Credentials (if needed)
The script tries to read from your `.env` file. If that doesn't work, you can hardcode them in the script:

**Around lines 11-12, change from:**
```python
SUPABASE_URL = os.getenv("VITE_SUPABASE_URL")
SUPABASE_KEY = os.getenv("VITE_SUPABASE_ANON_KEY")
```

**To (with your actual values):**
```python
SUPABASE_URL = "https://your-project.supabase.co"
SUPABASE_KEY = "your-anon-key-here"
```

### 5. Run the Script
```bash
python import_rigid_assemblies.py
```

---

## What the Script Does

1. **Loads Materials** - Reads all base materials from your database and creates a mapping
2. **Parses CSV** - Reads your rigid assemblies CSV and groups components by assembly
3. **Matches Materials** - Maps the short IDs (like `thhn_14`, `rigid_0_5`) to actual database material IDs
4. **Calculates Totals** - Computes total material cost and labor hours for each assembly
5. **Inserts Data** - Creates assembly records and their components properly

---

## Expected Output

```
🚀 Starting assembly import...
📦 Loading materials from database...
✅ Loaded 250 material mappings
📄 Reading CSV file: Rigid Con Assemblies.csv
✅ Found 13 unique assemblies

📝 Processing: 1/2" Rigid Run w/ (2) #14 + #14 GND
  ✅ Assembly created (ID: 123)
  ✅ Added 5 components
  💰 Total cost: $2.45, Labor: 0.85h

... (continues for each assembly)

============================================================
✅ Import complete!
   Successful: 13
   Errors: 0
============================================================
```

---

## Material ID Mappings

The script automatically maps these material IDs from your CSV:

### Wire
- `thhn_14` → THHN #14 wire
- `thhn_12` → THHN #12 wire
- `thhn_10` → THHN #10 wire
- `thhn_8` → THHN #8 wire
- `thhn_6` → THHN #6 wire
- `thhn_1_0` → THHN 1/0 wire
- `thhn_2_0` → THHN 2/0 wire
- `thhn_300` → THHN 300 kcmil
- `thhn_350` → THHN 350 kcmil
- `thhn_600` → THHN 600 kcmil

### Ground Wire
- `grn_14` → #14 ground wire
- `grn_12` → #12 ground wire
- `grn_10` → #10 ground wire
- `grn_8` → #8 ground wire
- `grn_6` → #6 ground wire
- `grn_4` → #4 ground wire
- `grn_2` → #2 ground wire
- `grn_1_0` → 1/0 ground wire

### Rigid Conduit
- `rigid_0_5` → 1/2" rigid conduit
- `rigid_0_75` → 3/4" rigid conduit
- `rigid_1` → 1" rigid conduit
- `rigid_1_25` → 1-1/4" rigid conduit
- `rigid_1_5` → 1-1/2" rigid conduit
- `rigid_2` → 2" rigid conduit
- `rigid_2_5` → 2-1/2" rigid conduit
- `rigid_3` → 3" rigid conduit
- `rigid_4` → 4" rigid conduit

### Straps
- `rigid_strap_0_5` → 1/2" rigid strap
- `rigid_strap_0_75` → 3/4" rigid strap
- `rigid_strap_1` → 1" rigid strap
- etc.

---

## Troubleshooting

### Error: "Material 'xxx' not found in database"
- The material doesn't exist in your `base_materials` table
- Add it manually first, or update the script's mapping logic

### Error: "Supabase credentials not found"
- Either set environment variables or hardcode them in the script (see Step 4)

### Error: "Please update COMPANY_ID"
- You forgot to update the COMPANY_ID in the script (see Step 3)

---

## After Import

Once imported successfully, these assemblies will appear in:
- Assembly Manager page (`/assemblies`)
- Right sidebar catalog when creating estimates
- Available for digital takeoff

Each assembly will have:
- ✅ Proper material costs calculated
- ✅ Labor hours calculated
- ✅ All components linked correctly
- ✅ Ready to use in estimates
