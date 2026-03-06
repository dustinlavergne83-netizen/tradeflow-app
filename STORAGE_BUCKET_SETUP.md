# Storage Bucket Setup for Material Lists & Info Sheets

## 1. Create Storage Bucket

1. Go to your Supabase dashboard
2. Navigate to **Storage** in the left sidebar
3. Click **"New bucket"**
4. Set bucket name to: `project-files`
5. Set to **Public bucket**: `OFF` (keep it private)
6. Click **"Save"**

## 2. Set Bucket Policies

After creating the bucket, you need to set up policies for file access:

### Option A: Quick Setup (Public Read Access)
Run this SQL in your Supabase SQL Editor:

```sql
-- Allow authenticated users to upload files
INSERT INTO storage.policies (id, bucket_id, name, definition, check, command, roles) 
VALUES (
  'project-files-upload',
  'project-files',
  'Allow authenticated users to upload',
  '(auth.role() = ''authenticated'')',
  '(auth.role() = ''authenticated'')',
  'INSERT',
  '{authenticated}'
);

-- Allow authenticated users to read files
INSERT INTO storage.policies (id, bucket_id, name, definition, check, command, roles)
VALUES (
  'project-files-read', 
  'project-files',
  'Allow authenticated users to read',
  '(auth.role() = ''authenticated'')',
  '(auth.role() = ''authenticated'')',
  'SELECT',
  '{authenticated}'
);

-- Allow authenticated users to delete files
INSERT INTO storage.policies (id, bucket_id, name, definition, check, command, roles)
VALUES (
  'project-files-delete',
  'project-files', 
  'Allow authenticated users to delete',
  '(auth.role() = ''authenticated'')',
  '(auth.role() = ''authenticated'')',
  'DELETE',
  '{authenticated}'
);
```

### Option B: Manual Setup (via Dashboard)
1. Go to **Storage > project-files bucket**
2. Click **"Policies"** tab
3. Click **"Add policy"** and create these 3 policies:

**Policy 1: Upload**
- Policy Name: `Allow authenticated upload`
- Allowed Operation: `INSERT`  
- Target Roles: `authenticated`
- Policy Definition: `true`

**Policy 2: Read**
- Policy Name: `Allow authenticated read`
- Allowed Operation: `SELECT`
- Target Roles: `authenticated`  
- Policy Definition: `true`

**Policy 3: Delete**
- Policy Name: `Allow authenticated delete`
- Allowed Operation: `DELETE`
- Target Roles: `authenticated`
- Policy Definition: `true`

## 3. Test the Setup

1. Run `SETUP_MATERIAL_LISTS_AND_INFO_SHEETS_CLEAN.sql` in Supabase SQL Editor
2. Go to any project in your app
3. Click "📋 Material Lists" button
4. Create a new material list
5. Click "📎 Upload Files" to test file upload
6. Try uploading a PDF or image file

## Troubleshooting

**If file uploads fail:**
1. Check that the `project-files` bucket exists
2. Verify storage policies are set correctly  
3. Make sure you're authenticated in the app
4. Check browser console for error messages

**If you see "bucket not found" errors:**
- Double-check the bucket name is exactly `project-files` (with hyphen)
- Ensure the bucket is created and policies are applied

## File Organization

Files will be organized as:
```
project-files/
├── projects/
│   ├── {projectId}/
│   │   ├── material-lists/
│   │   │   └── {listId}/
│   │   │       └── uploaded_file.pdf
│   │   └── info-sheets/
│   │       └── {sheetId}/
│   │           └── uploaded_document.docx
```

This keeps all project files organized and prevents conflicts.