-- ============================================
-- MINIMAL SETUP: Just Create Tables
-- Run this in your Supabase SQL Editor
-- ============================================

-- 1. Project Material Lists (header)
CREATE TABLE IF NOT EXISTS project_material_lists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT 'Material List',
  description TEXT,
  status TEXT DEFAULT 'draft',
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
  unit TEXT DEFAULT 'ea',
  unit_cost NUMERIC DEFAULT 0,
  total_cost NUMERIC GENERATED ALWAYS AS (quantity * unit_cost) STORED,
  vendor TEXT,
  manufacturer TEXT,
  part_number TEXT,
  category TEXT,
  status TEXT DEFAULT 'needed',
  notes TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Project Info Sheets
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

-- 4. File Attachments
CREATE TABLE IF NOT EXISTS project_file_attachments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  material_list_id UUID REFERENCES project_material_lists(id) ON DELETE CASCADE,
  info_sheet_id UUID REFERENCES project_info_sheets(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT,
  file_path TEXT NOT NULL,
  description TEXT,
  uploaded_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT check_attachment_type CHECK (
    (material_list_id IS NOT NULL AND info_sheet_id IS NULL) OR
    (material_list_id IS NULL AND info_sheet_id IS NOT NULL)
  )
);

-- Enable RLS (tables need this enabled)
ALTER TABLE project_material_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_info_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_file_attachments ENABLE ROW LEVEL SECURITY;

-- Simple success message
SELECT 'Tables created successfully! Policies may need to be set up manually.' as result;