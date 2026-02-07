# Deploy Digital Takeoff System - Phase 1

## Overview
This guide walks you through deploying the Phase 1 database schema for the Digital Takeoff System.

---

## Step 1: Run the Migration in Supabase

### Option A: Using Supabase Dashboard (Recommended)

1. **Open Supabase Dashboard**
   - Go to https://app.supabase.com
   - Select your project

2. **Navigate to SQL Editor**
   - Click "SQL Editor" in the left sidebar
   - Click "New Query"

3. **Copy and Paste Migration**
   - Open `supabase/migrations/049_create_digital_takeoff_tables.sql`
   - Copy the entire contents
   - Paste into the SQL Editor

4. **Run the Migration**
   - Click "Run" or press `Ctrl+Enter`
   - Wait for success message
   - Check for any errors (there should be none)

### Option B: Using Supabase CLI

```bash
# Make sure you're in the project directory
cd c:/Users/dusti/estimator-react

# Run the migration
supabase db push

# Or run specific migration
supabase migration up --db-url "your-database-url"
```

---

## Step 2: Verify Tables Were Created

Run this query in SQL Editor to verify:

```sql
-- Check if all tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('plans', 'takeoff_layers', 'plan_calibrations', 'takeoff_measurements')
ORDER BY table_name;

-- Should return 4 rows:
-- plan_calibrations
-- plans
-- takeoff_layers
-- takeoff_measurements
```

---

## Step 3: Create Storage Bucket for Plans

Run this in SQL Editor:

```sql
-- Create storage bucket for plan files
INSERT INTO storage.buckets (id, name, public)
VALUES ('plans', 'plans', false)
ON CONFLICT (id) DO NOTHING;
```

---

## Step 4: Set Up Storage Policies

Run this in SQL Editor:

```sql
-- Policy: Users can upload their own plans
CREATE POLICY "Users can upload plans"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'plans' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Users can view their own plans
CREATE POLICY "Users can view their plans"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'plans' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Users can update their own plans
CREATE POLICY "Users can update their plans"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'plans' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Users can delete their own plans
CREATE POLICY "Users can delete their plans"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'plans' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);
```

---

## Step 5: Verify Everything Works

### Test 1: Check Table Structure

```sql
-- View plans table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'plans'
ORDER BY ordinal_position;
```

### Test 2: Check RLS Policies

```sql
-- Check Row Level Security policies
SELECT tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename IN ('plans', 'takeoff_layers', 'plan_calibrations', 'takeoff_measurements')
ORDER BY tablename, policyname;
```

### Test 3: Check Helper Functions

```sql
-- Verify helper functions exist
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('get_plan_measurement_count', 'get_plan_summary', 'calculate_calibration_scale')
ORDER BY routine_name;
```

### Test 4: Check Storage Bucket

```sql
-- Verify storage bucket exists
SELECT * FROM storage.buckets WHERE id = 'plans';
```

---

## What Was Created

### Tables (4)
1. **plans** - Stores uploaded construction plans/drawings
2. **takeoff_layers** - Organizes measurements into logical layers
3. **plan_calibrations** - Stores scale calibration data
4. **takeoff_measurements** - Stores individual measurements

### Indexes (26)
- Optimized for fast queries on common fields
- GIN index on JSONB geometry data

### Row Level Security
- All tables have RLS enabled
- Users can only access their own data
- Proper authentication required

### Helper Functions (3)
1. **get_plan_measurement_count()** - Count measurements for a plan
2. **get_plan_summary()** - Get statistics for a plan
3. **calculate_calibration_scale()** - Auto-calculate scale factors

### Triggers (4)
- Auto-update timestamps on changes
- Auto-calculate scale factor on calibration

---

## Storage Bucket Structure

Plans will be stored with this folder structure:
```
plans/
  ├── {user_id}/
  │   ├── {project_id}/
  │   │   ├── 1234567890.pdf
  │   │   ├── 1234567891.png
  │   │   └── ...
```

---

## Troubleshooting

### Error: "function update_updated_at_column does not exist"

This function should already exist from previous migrations. If not, create it:

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Error: "bucket already exists"

This is fine - the bucket was already created. Just continue with the storage policies.

### Error: "relation already exists"

If tables already exist, you may need to drop them first (⚠️ **WARNING: This will delete all data**):

```sql
-- Only run if you need to start fresh
DROP TABLE IF EXISTS takeoff_measurements CASCADE;
DROP TABLE IF EXISTS plan_calibrations CASCADE;
DROP TABLE IF EXISTS takeoff_layers CASCADE;
DROP TABLE IF EXISTS plans CASCADE;

-- Then re-run the migration
```

---

## Next Steps

After successfully deploying Phase 1:

1. ✅ **Phase 1 Complete** - Database schema is ready
2. 🚀 **Phase 2** - Implement file upload component
3. 🚀 **Phase 3** - Build PDF viewer interface
4. 🚀 **Phase 4** - Add measurement tools
5. 🚀 **Phase 5** - Integrate with estimates

---

## Testing the Schema

You can test the schema by inserting sample data:

```sql
-- Insert a test plan (replace with your user ID and project ID)
INSERT INTO plans (
  company_id,
  project_id,
  file_name,
  file_url,
  plan_name,
  plan_type,
  file_type
) VALUES (
  auth.uid(), -- Your user ID
  'your-project-id', -- Replace with actual project ID
  'test-plan.pdf',
  'https://example.com/test.pdf',
  'Test Electrical Plan',
  'electrical',
  'pdf'
);

-- Create a test layer
INSERT INTO takeoff_layers (
  company_id,
  project_id,
  layer_name,
  color,
  estimate_section
) VALUES (
  auth.uid(),
  'your-project-id',
  'Receptacles',
  '#FF6B00',
  'power'
);

-- Verify inserts
SELECT * FROM plans WHERE company_id = auth.uid();
SELECT * FROM takeoff_layers WHERE company_id = auth.uid();
```

---

## Success Criteria

✅ All 4 tables created  
✅ All indexes created  
✅ RLS policies active  
✅ Helper functions working  
✅ Storage bucket created  
✅ Storage policies set  
✅ Test queries successful  

Once all items are checked, Phase 1 is complete!
