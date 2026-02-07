-- Add summary page fields to estimates table

ALTER TABLE estimates ADD COLUMN IF NOT EXISTS mobilization DECIMAL(12,2) DEFAULT 0;
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS room_board DECIMAL(12,2) DEFAULT 0;
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS equipment_rental DECIMAL(12,2) DEFAULT 0;
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS material_storage DECIMAL(12,2) DEFAULT 0;
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS misc_expenses DECIMAL(12,2) DEFAULT 0;
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS permit_fees DECIMAL(12,2) DEFAULT 0;

-- Markup percentages
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS material_markup_percent DECIMAL(5,2) DEFAULT 0;
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS fees_markup_percent DECIMAL(5,2) DEFAULT 0;
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS packages_markup_percent DECIMAL(5,2) DEFAULT 0;

-- Packages/Subs fields
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS lighting_package_cost DECIMAL(12,2) DEFAULT 0;
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS lighting_package_supplier TEXT;
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS switchgear_package_cost DECIMAL(12,2) DEFAULT 0;
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS switchgear_package_supplier TEXT;
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS special_systems_cost DECIMAL(12,2) DEFAULT 0;
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS special_systems_supplier TEXT;
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS subcontractors_cost DECIMAL(12,2) DEFAULT 0;
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS subcontractors_supplier TEXT;
