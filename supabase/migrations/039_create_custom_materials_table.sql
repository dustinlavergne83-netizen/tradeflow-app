-- Create custom_materials table for user-defined materials
CREATE TABLE IF NOT EXISTS custom_materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Custom',
    description TEXT,
    unit TEXT NOT NULL DEFAULT 'ea',
    price DECIMAL(10, 2) NOT NULL DEFAULT 0,
    labor_hours DECIMAL(10, 2) NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX idx_custom_materials_company ON custom_materials(company_id);
CREATE INDEX idx_custom_materials_active ON custom_materials(is_active) WHERE is_active = true;
CREATE INDEX idx_custom_materials_category ON custom_materials(category);

-- Enable Row Level Security
ALTER TABLE custom_materials ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own custom materials
CREATE POLICY "Users can view own custom materials"
    ON custom_materials
    FOR SELECT
    USING (auth.uid() = company_id);

-- Policy: Users can insert their own custom materials
CREATE POLICY "Users can insert own custom materials"
    ON custom_materials
    FOR INSERT
    WITH CHECK (auth.uid() = company_id);

-- Policy: Users can update their own custom materials
CREATE POLICY "Users can update own custom materials"
    ON custom_materials
    FOR UPDATE
    USING (auth.uid() = company_id);

-- Policy: Users can delete their own custom materials
CREATE POLICY "Users can delete own custom materials"
    ON custom_materials
    FOR DELETE
    USING (auth.uid() = company_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_custom_materials_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER trigger_update_custom_materials_updated_at
    BEFORE UPDATE ON custom_materials
    FOR EACH ROW
    EXECUTE FUNCTION update_custom_materials_updated_at();
