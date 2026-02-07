-- Add price scraping fields to materials and custom_materials tables

-- Add scraping fields to custom_materials table
ALTER TABLE custom_materials ADD COLUMN IF NOT EXISTS lowes_url TEXT;
ALTER TABLE custom_materials ADD COLUMN IF NOT EXISTS lowes_item_number VARCHAR(50);
ALTER TABLE custom_materials ADD COLUMN IF NOT EXISTS lowes_price DECIMAL(10,2);
ALTER TABLE custom_materials ADD COLUMN IF NOT EXISTS lowes_last_scraped TIMESTAMP;

ALTER TABLE custom_materials ADD COLUMN IF NOT EXISTS homedepot_url TEXT;
ALTER TABLE custom_materials ADD COLUMN IF NOT EXISTS homedepot_sku VARCHAR(50);
ALTER TABLE custom_materials ADD COLUMN IF NOT EXISTS homedepot_price DECIMAL(10,2);
ALTER TABLE custom_materials ADD COLUMN IF NOT EXISTS homedepot_last_scraped TIMESTAMP;

ALTER TABLE custom_materials ADD COLUMN IF NOT EXISTS amazon_url TEXT;
ALTER TABLE custom_materials ADD COLUMN IF NOT EXISTS amazon_asin VARCHAR(50);
ALTER TABLE custom_materials ADD COLUMN IF NOT EXISTS amazon_price DECIMAL(10,2);
ALTER TABLE custom_materials ADD COLUMN IF NOT EXISTS amazon_last_scraped TIMESTAMP;

ALTER TABLE custom_materials ADD COLUMN IF NOT EXISTS preferred_source VARCHAR(20) DEFAULT 'manual';

-- Create price scrape logs table
CREATE TABLE IF NOT EXISTS price_scrape_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    material_id UUID,
    material_name TEXT,
    source VARCHAR(20),
    old_price DECIMAL(10,2),
    new_price DECIMAL(10,2),
    price_change DECIMAL(10,2),
    price_change_percent DECIMAL(5,2),
    scraped_at TIMESTAMP DEFAULT NOW(),
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    company_id UUID REFERENCES auth.users(id)
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_price_logs_material ON price_scrape_logs(material_id);
CREATE INDEX IF NOT EXISTS idx_price_logs_company ON price_scrape_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_price_logs_date ON price_scrape_logs(scraped_at DESC);

-- Enable Row Level Security
ALTER TABLE price_scrape_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own price logs
CREATE POLICY "Users can view own price logs"
    ON price_scrape_logs
    FOR SELECT
    USING (auth.uid() = company_id);

-- Policy: System can insert price logs
CREATE POLICY "System can insert price logs"
    ON price_scrape_logs
    FOR INSERT
    WITH CHECK (true);
