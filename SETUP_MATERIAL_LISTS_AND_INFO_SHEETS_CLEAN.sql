-- ============================================
-- SETUP: Material Lists & Project Info Sheets (CLEAN VERSION)
-- Run this in your Supabase SQL Editor
-- This version handles existing tables/policies safely
-- ============================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow all for authenticated users" ON project_material_lists;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON material_list_items;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON project_info_sheets;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON project_file_attachments;

-- 1. Project Material Lists (header)
CREATE TABLE IF NOT EXISTS project_material_lists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT 'Material List',
  description TEXT,
  status TEXT DEFAULT 'draft', -- draft, ordered, received, complete
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Material List Items (line items)
CREATE TABLE IF NOT EXISTS material_list_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  material_list_id UUID NOT NULL REFERENCES project_material_lists(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC DEFAULT 1,
  unit TEXT DEFAULT 'ea', -- ea, ft, roll, box, etc
  unit_cost NUMERIC DEFAULT 0,
  total_cost NUMERIC GENERATED ALWAYS AS (quantity * unit_cost) STORED,
  vendor TEXT,
  manufacturer TEXT,
  part_number TEXT,
  category TEXT, -- wire, conduit, fittings, devices, fixtures, panels, etc
  status TEXT DEFAULT 'needed', -- needed, ordered, received, installed
  notes TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Project Info Sheets (Simple written documents)
CREATE TABLE IF NOT EXISTS project_info_sheets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  sheet_date DATE,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. File Attachments (for both material lists and info sheets)
CREATE TABLE IF NOT EXISTS project_file_attachments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  material_list_id UUID REFERENCES project_material_lists(id) ON DELETE CASCADE,
  info_sheet_id UUID REFERENCES project_info_sheets(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT,
  file_path TEXT NOT NULL, -- Storage path in Supabase
  description TEXT,
  uploaded_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure attachment belongs to either material list OR info sheet, not both
  CONSTRAINT check_attachment_type CHECK (
    (material_list_id IS NOT NULL AND info_sheet_id IS NULL) OR
    (material_list_id IS NULL AND info_sheet_id IS NOT NULL)
  )
);

-- Enable RLS
ALTER TABLE project_material_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_info_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_file_attachments ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies (allow all for authenticated users)
CREATE POLICY "Allow all for authenticated users" ON project_material_lists
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow all for authenticated users" ON material_list_items
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow all for authenticated users" ON project_info_sheets
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow all for authenticated users" ON project_file_attachments
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Drop existing indexes if they exist
DROP INDEX IF EXISTS idx_material_lists_project;
DROP INDEX IF EXISTS idx_material_list_items_list;
DROP INDEX IF EXISTS idx_info_sheets_project;
DROP INDEX IF EXISTS idx_file_attachments_project;
DROP INDEX IF EXISTS idx_file_attachments_material_list;
DROP INDEX IF EXISTS idx_file_attachments_info_sheet;

-- Create Indexes
CREATE INDEX idx_material_lists_project ON project_material_lists(project_id);
CREATE INDEX idx_material_list_items_list ON material_list_items(material_list_id);
CREATE INDEX idx_info_sheets_project ON project_info_sheets(project_id);
CREATE INDEX idx_file_attachments_project ON project_file_attachments(project_id);
CREATE INDEX idx_file_attachments_material_list ON project_file_attachments(material_list_id);
CREATE INDEX idx_file_attachments_info_sheet ON project_file_attachments(info_sheet_id);

-- Success message
SELECT 'Material Lists & Info Sheets tables created successfully!' as status;