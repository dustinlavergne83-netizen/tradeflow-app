-- =====================================================
-- SETUP SCRIPT FOR REPORTS & PHOTOS FUNCTIONALITY
-- Run this in your Supabase SQL Editor
-- =====================================================

-- Create project_reports table
CREATE TABLE IF NOT EXISTS public.project_reports (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    report_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create report_photos table
CREATE TABLE IF NOT EXISTS public.report_photos (
    id BIGSERIAL PRIMARY KEY,
    report_id BIGINT NOT NULL REFERENCES public.project_reports(id) ON DELETE CASCADE,
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

-- Create RLS policies
-- Allow authenticated users to read all reports
CREATE POLICY IF NOT EXISTS "Allow authenticated users to view reports" 
    ON public.project_reports FOR SELECT 
    TO authenticated 
    USING (true);

-- Allow authenticated users to create reports
CREATE POLICY IF NOT EXISTS "Allow authenticated users to create reports" 
    ON public.project_reports FOR INSERT 
    TO authenticated 
    WITH CHECK (true);

-- Allow users to update their own reports
CREATE POLICY IF NOT EXISTS "Allow users to update own reports" 
    ON public.project_reports FOR UPDATE 
    TO authenticated 
    USING (created_by = auth.uid());

-- Allow users to delete their own reports
CREATE POLICY IF NOT EXISTS "Allow users to delete own reports" 
    ON public.project_reports FOR DELETE 
    TO authenticated 
    USING (created_by = auth.uid());

-- Report Photos policies
CREATE POLICY IF NOT EXISTS "Allow authenticated users to view report photos" 
    ON public.report_photos FOR SELECT 
    TO authenticated 
    USING (true);

CREATE POLICY IF NOT EXISTS "Allow authenticated users to create report photos" 
    ON public.report_photos FOR INSERT 
    TO authenticated 
    WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Allow authenticated users to update report photos" 
    ON public.report_photos FOR UPDATE 
    TO authenticated 
    USING (true);

CREATE POLICY IF NOT EXISTS "Allow authenticated users to delete report photos" 
    ON public.report_photos FOR DELETE 
    TO authenticated 
    USING (true);

-- Grant permissions
GRANT ALL ON public.project_reports TO authenticated;
GRANT ALL ON public.report_photos TO authenticated;
GRANT USAGE ON SEQUENCE public.project_reports_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE public.report_photos_id_seq TO authenticated;

-- Create storage bucket for project photos (if it doesn't exist)
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-photos', 'project-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for project-photos bucket
CREATE POLICY IF NOT EXISTS "Allow authenticated users to upload project photos" 
    ON storage.objects FOR INSERT 
    TO authenticated 
    WITH CHECK (bucket_id = 'project-photos');

CREATE POLICY IF NOT EXISTS "Allow public to view project photos" 
    ON storage.objects FOR SELECT 
    TO public 
    USING (bucket_id = 'project-photos');

CREATE POLICY IF NOT EXISTS "Allow authenticated users to delete project photos" 
    ON storage.objects FOR DELETE 
    TO authenticated 
    USING (bucket_id = 'project-photos');

-- =====================================================
-- SETUP COMPLETE!
-- Your Reports & Photos functionality should now work.
-- =====================================================