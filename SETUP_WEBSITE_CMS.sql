-- ============================================================
-- WEBSITE CMS TABLES
-- Run this in Supabase SQL editor
-- ============================================================

-- Gallery photos shown on the public website
CREATE TABLE IF NOT EXISTS website_gallery (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text,
  description text,
  image_url text NOT NULL,
  category text DEFAULT 'work', -- 'work', 'residential', 'commercial', 'industrial', 'team'
  display_order int DEFAULT 0,
  visible boolean DEFAULT true,
  created_by text,
  created_at timestamptz DEFAULT now()
);

-- Text content blocks for the website
CREATE TABLE IF NOT EXISTS website_content (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  content_key text UNIQUE NOT NULL,  -- e.g. 'announcement', 'hero_text', 'about_text'
  content_value text,
  content_type text DEFAULT 'text',  -- 'text', 'announcement'
  active boolean DEFAULT true,
  updated_at timestamptz DEFAULT now()
);

-- RLS Policies
ALTER TABLE website_gallery ENABLE ROW LEVEL SECURITY;
ALTER TABLE website_content ENABLE ROW LEVEL SECURITY;

-- Public can read visible gallery photos
DROP POLICY IF EXISTS "Public read gallery" ON website_gallery;
CREATE POLICY "Public read gallery" ON website_gallery
  FOR SELECT TO anon, authenticated USING (visible = true);

-- Authenticated users can manage gallery
DROP POLICY IF EXISTS "Auth manage gallery" ON website_gallery;
CREATE POLICY "Auth manage gallery" ON website_gallery
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Public can read content
DROP POLICY IF EXISTS "Public read content" ON website_content;
CREATE POLICY "Public read content" ON website_content
  FOR SELECT TO anon, authenticated USING (true);

-- Authenticated users can manage content
DROP POLICY IF EXISTS "Auth manage content" ON website_content;
CREATE POLICY "Auth manage content" ON website_content
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Create storage bucket for website gallery images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'website-gallery',
  'website-gallery',
  true,
  10485760,  -- 10MB
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
DROP POLICY IF EXISTS "Public read website gallery" ON storage.objects;
CREATE POLICY "Public read website gallery" ON storage.objects
  FOR SELECT TO anon, authenticated USING (bucket_id = 'website-gallery');

DROP POLICY IF EXISTS "Auth upload website gallery" ON storage.objects;
CREATE POLICY "Auth upload website gallery" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'website-gallery');

DROP POLICY IF EXISTS "Auth delete website gallery" ON storage.objects;
CREATE POLICY "Auth delete website gallery" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'website-gallery');

-- Insert default content slots
INSERT INTO website_content (content_key, content_value, content_type, active)
VALUES
  ('announcement', '', 'announcement', false),
  ('hero_tagline', 'Residential • Commercial • Industrial', 'text', true),
  ('about_text', 'DML Electrical Service is a locally owned and operated electrical contractor based in Jennings, Louisiana.', 'text', true)
ON CONFLICT (content_key) DO NOTHING;

SELECT 'Website CMS tables created successfully!' as result;
