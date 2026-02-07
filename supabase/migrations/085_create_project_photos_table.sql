-- ====================================
-- PROJECT PHOTOS TABLE
-- ====================================

CREATE TABLE project_photos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  company_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  
  -- Photo Details
  filename TEXT NOT NULL,
  file_path TEXT NOT NULL,
  storage_key TEXT NOT NULL, -- Path in Supabase storage
  file_size INT,
  mime_type TEXT DEFAULT 'image/jpeg',
  
  -- Organization
  folder_name TEXT DEFAULT 'general', -- e.g., 'general', 'before', 'after', 'progress', etc.
  description TEXT,
  
  -- Metadata
  taken_at TIMESTAMPTZ,
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_project_photos_project ON project_photos(project_id);
CREATE INDEX idx_project_photos_company ON project_photos(company_id);
CREATE INDEX idx_project_photos_folder ON project_photos(project_id, folder_name);
CREATE INDEX idx_project_photos_taken_at ON project_photos(taken_at DESC);

-- Enable Row Level Security
ALTER TABLE project_photos ENABLE ROW LEVEL SECURITY;

-- RLS Policies for project_photos
CREATE POLICY "Users can view photos for their own projects"
  ON project_photos FOR SELECT
  USING (auth.uid() = company_id);

CREATE POLICY "Users can insert photos for their own projects"
  ON project_photos FOR INSERT
  WITH CHECK (auth.uid() = company_id);

CREATE POLICY "Users can update photos for their own projects"
  ON project_photos FOR UPDATE
  USING (auth.uid() = company_id);

CREATE POLICY "Users can delete photos for their own projects"
  ON project_photos FOR DELETE
  USING (auth.uid() = company_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_project_photos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER project_photos_update_timestamp
BEFORE UPDATE ON project_photos
FOR EACH ROW
EXECUTE FUNCTION update_project_photos_updated_at();

-- Create storage bucket for project photos if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('project_photos', 'project_photos', false)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS for storage bucket
CREATE POLICY "Users can upload photos to their company folder"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'project_photos' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view photos from their company folder"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'project_photos' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete photos from their company folder"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'project_photos' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );
