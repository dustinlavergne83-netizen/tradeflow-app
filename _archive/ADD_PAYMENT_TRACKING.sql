-- ============================================
-- RUN THIS IN SUPABASE DASHBOARD SQL EDITOR
-- ============================================
-- This adds payment tracking to your invoices

-- Add payment tracking fields to invoices table
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'unpaid',
ADD COLUMN IF NOT EXISTS payment_date DATE,
ADD COLUMN IF NOT EXISTS payment_method TEXT,
ADD COLUMN IF NOT EXISTS amount_paid DECIMAL(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS payment_notes TEXT;

-- Add check constraint for payment_status
ALTER TABLE invoices
DROP CONSTRAINT IF EXISTS invoices_payment_status_check;

ALTER TABLE invoices
ADD CONSTRAINT invoices_payment_status_check 
CHECK (payment_status IN ('unpaid', 'partial', 'paid'));

-- Add check constraint for payment_method
ALTER TABLE invoices
DROP CONSTRAINT IF EXISTS invoices_payment_method_check;

ALTER TABLE invoices
ADD CONSTRAINT invoices_payment_method_check 
CHECK (payment_method IN ('check', 'cash', 'credit_card', 'ach', 'wire', 'other', NULL));

-- Create index for querying by payment status
CREATE INDEX IF NOT EXISTS idx_invoices_payment_status ON invoices(payment_status);
CREATE INDEX IF NOT EXISTS idx_invoices_payment_date ON invoices(payment_date);

-- Update existing invoices to have unpaid status
UPDATE invoices 
SET payment_status = 'unpaid', amount_paid = 0 
WHERE payment_status IS NULL;

-- Done! Your invoices now have payment tracking!
