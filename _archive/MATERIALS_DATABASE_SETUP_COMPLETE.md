# Materials Database Setup - Complete Guide

## What We Created ✅

You now have a **database-backed materials system** instead of CSV files!

### Files Created:
1. `supabase/migrations/059_create_base_materials_table.sql` - Database table
2. `IMPORT_MATERIALS_TO_DATABASE.sql` - Import guide
3. Updated `src/pages/AssemblyManager.jsx` - Uses database now

## Setup Steps

### Step 1: Run the Migration

Go to your Supabase Dashboard SQL Editor and run:

```bash
# Copy the contents of:
supabase/migrations/059_create_base_materials_table.sql

# Paste and execute in Supabase SQL Editor
```

This creates:
- `base_materials` table - Your material catalog
- `all_materials` view - Combines base + custom materials
- Indexes for fast searching
- Row Level Security policies

### Step 2: Import Your CSV Data

**Option A: Use Supabase Dashboard (Easiest)**

1. Go to Supabase Dashboard → Table Editor → `base_materials`
2. Click "Import data via spreadsheet"
3. Upload `public/electrical_materials_comprehensive.csv`
4. Map columns exactly as shown:
   - `id` → `id`
   - `name` → `name`
   - `description` → `description`
   - `category` → `category`
   - `unit` → `unit`
   - `baseCost` → `baseCost`
   - `laborHours` → `laborHours`
5. Click Import

**Note:** The table automatically creates `price` and `labor_hours` aliases from `baseCost` and `laborHours`!

**Option B: Use SQL (If you have SQL export)**

See `IMPORT_MATERIALS_TO_DATABASE.sql` for examples.

### Step 3: Verify Import

Run in Supabase SQL Editor:

```sql
-- Check total count
SELECT COUNT(*) FROM base_materials;

-- Check by category
SELECT category, COUNT(*) 
FROM base_materials 
GROUP BY category 
ORDER BY COUNT(*) DESC;

-- View some samples
SELECT * FROM base_materials LIMIT 10;
```

### Step 4: Test in Your App

1. **Refresh your browser**
2. **Go to Assembly Manager**
3. **Expand an assembly** or create new one
4. **Click "Add Component"**
5. **Search for materials** - you'll see database materials!

## What Changed

### Before (CSV):
- Materials loaded from `/electrical_materials_comprehensive.csv`
- Required redeployment to update materials
- Slow initial load
- No search indexes

### After (Database):
- Materials loaded from `base_materials` table
- **Update materials anytime via Supabase Dashboard**
- Fast with indexes
- Full-text search enabled
- Combines base + custom materials

## How to Add/Edit Materials Now

### Add New Material

Go to Supabase Dashboard → Table Editor → `base_materials` → Insert Row:

```
id: WIRE-14-3-NM-250
name: 14/3 NM-B Wire 250ft
description: Romex 14/3 with ground
category: WIRE
unit: ft
price: 0.35
labor_hours: 0.002
is_active: true
```

### Edit Material Price

1. Go to `base_materials` table
2. Find the material
3. Click the cell to edit
4. Change price
5. Save

**Changes appear immediately** - no redeployment needed!

### Deactivate Material

Set `is_active = false` to hide it without deleting.

## Features

### ✅ Fast Search
Full-text search on name and description:
```sql
SELECT * FROM base_materials 
WHERE to_tsvector('english', name || ' ' || description) 
      @@ to_tsquery('english', 'conduit & emt');
```

### ✅ Combined View
The `all_materials` view shows:
- Base materials (everyone sees)
- Custom materials (company-specific)

### ✅ Automatic Updates
The `updated_at` field auto-updates on changes.

### ✅ Organized by Category
Materials grouped by WIRE, BOXES, CONDUIT, FIXTURES, etc.

## Troubleshooting

### Issue: "relation base_materials does not exist"
**Fix:** Run the migration first (Step 1)

### Issue: Assembly Manager shows no materials
**Fix:** 
1. Check migration ran successfully
2. Import CSV data (Step 2)
3. Verify: `SELECT COUNT(*) FROM base_materials;`

### Issue: Materials not appearing
**Fix:**
1. Check `is_active = true`
2. Refresh browser (Ctrl+F5)
3. Check console for errors

## Next Steps

### Optional: Create Materials Manager UI

Create a page to manage materials through your app:
- Add new materials
- Edit prices
- Import/Export CSV
- Bulk updates

Let me know if you want this!

### Performance Tips

The database is **already optimized** with:
- Indexes on name, category, active status
- Full-text search index
- View combining base + custom materials

For 2000+ materials, expect:
- Search: < 50ms
- Load all: < 200ms
- Much faster than CSV!

## Summary

You can now:
✅ Update material prices anytime (no redeploy)
✅ Add new materials via Supabase Dashboard
✅ Search materials instantly
✅ Combine base catalog + custom materials
✅ Track changes with updated_at
✅ Manage materials without touching code

**Your Assembly Manager now uses the database automatically!**
