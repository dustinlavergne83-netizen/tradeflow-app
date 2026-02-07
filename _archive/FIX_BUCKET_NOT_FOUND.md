# Fix "Bucket not found" Error

## The Problem
You're getting "Failed to upload plan: Bucket not found" because the Supabase storage bucket hasn't been created yet.

## Quick Fix

### Step 1: Create Storage Bucket

Go to your Supabase Dashboard and run this SQL:

```sql
-- Create the storage bucket for plans
INSERT INTO storage.buckets (id, name, public)
VALUES ('plans', 'plans', false)
ON CONFLICT (id) DO NOTHING;
```

### Step 2: Set Up Storage Policies

Then run this to set up the security policies:

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

-- Policy: Users can delete their own plans
CREATE POLICY "Users can delete their plans"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'plans' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);
```

### Step 3: Test Upload Again

After running both SQL commands above:
1. Refresh your Plans & Takeoffs page
2. Try uploading a plan again
3. It should work now!

## Alternative: Use Supabase Dashboard UI

If you prefer using the UI instead of SQL:

1. Go to Supabase Dashboard
2. Click "Storage" in the left sidebar
3. Click "New Bucket"
4. Name it: `plans`
5. Make it **Private** (not public)
6. Click "Create Bucket"
7. Then run the storage policies SQL from Step 2 above

---

That's it! The bucket will be created and uploads will work.
