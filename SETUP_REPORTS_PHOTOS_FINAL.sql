-- =====================================================
-- SETUP SCRIPT FOR REPORTS & PHOTOS FUNCTIONALITY
-- Final Fixed Version - Run this in your Supabase SQL Editor
-- =====================================================

-- Create project_reports table (using UUID for id to match Supabase conventions)
CREATE TABLE IF NOT EXISTS public.project_reports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id BIGINT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    report_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create report_photos table (using UUID for report_id to match)
CREATE TABLE IF NOT EXISTS public.report_photos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    report_id UUID NOT NULL REFERENCES public.project_reports(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    file_name TEXT,
    caption TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_project_reports_project_id ON public.project_reports(project_id);
CREATE INDEX IF NOT EXISTS idx_project_reports_report_date ON public.project_reports(report_date);
CREATE INDEX IF NOT EXISTS idx_report_photos_report_id ON public.report_photos(report_id);
CREATE INDEX IF NOT EXISTS idx_report_photos_sort_order ON public.report_photos(sort_order);

-- Enable Row Level Security (RLS)
ALTER TABLE public.project_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_photos ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Allow authenticated users to view reports" ON public.project_reports;
DROP POLICY IF EXISTS "Allow authenticated users to create reports" ON public.project_reports;
DROP POLICY IF EXISTS "Allow users to update own reports" ON public.project_reports;
DROP POLICY IF EXISTS "Allow users to delete own reports" ON public.project_reports;
DROP POLICY IF EXISTS "Allow authenticated users to view report photos" ON public.report_photos;
DROP POLICY IF EXISTS "Allow authenticated users to create report photos" ON public.report_photos;
DROP POLICY IF EXISTS "Allow authenticated users to update report photos" ON public.report_photos;
DROP POLICY IF EXISTS "Allow authenticated users to delete report photos" ON public.report_photos;

-- Create RLS policies for project_reports
CREATE POLICY "Allow authenticated users to view reports" 
    ON public.project_reports FOR SELECT 
    TO authenticated 
    USING (true);

CREATE POLICY "Allow authenticated users to create reports" 
    ON public.project_reports FOR INSERT 
    TO authenticated 
    WITH CHECK (true);

CREATE POLICY "Allow users to update own reports" 
    ON public.project_reports FOR UPDATE 
    TO authenticated 
    USING (created_by = auth.uid());

CREATE POLICY "Allow users to delete own reports" 
    ON public.project_reports FOR DELETE 
    TO authenticated 
    USING (created_by = auth.uid());

-- Create RLS policies for report_photos
CREATE POLICY "Allow authenticated users to view report photos" 
    ON public.report_photos FOR SELECT 
    TO authenticated 
    USING (true);

CREATE POLICY "Allow authenticated users to create report photos" 
    ON public.report_photos FOR INSERT 
    TO authenticated 
    WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update report photos" 
    ON public.report_photos FOR UPDATE 
    TO authenticated 
    USING (true);

CREATE POLICY "Allow authenticated users to delete report photos" 
    ON public.report_photos FOR DELETE 
    TO authenticated 
    USING (true);

-- Grant permissions to authenticated users
GRANT ALL ON public.project_reports TO authenticated;
GRANT ALL ON public.report_photos TO authenticated;

-- =====================================================
-- SETUP COMPLETE!
-- Your Reports & Photos functionality should now work.
-- =====================================================