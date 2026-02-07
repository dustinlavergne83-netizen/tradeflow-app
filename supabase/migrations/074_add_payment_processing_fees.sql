-- Add payment processing fee tracking to invoices table
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS processing_fee DECIMAL(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS net_deposit_amount DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS bank_account_id UUID REFERENCES bank_accounts(id);

-- Add comment explaining the fields
COMMENT ON COLUMN invoices.processing_fee IS 'Payment processing fee charged by Venmo, PayPal, Stripe, etc.';
COMMENT ON COLUMN invoices.net_deposit_amount IS 'Actual amount deposited to bank after fees (amount_paid - processing_fee)';
COMMENT ON COLUMN invoices.bank_account_id IS 'Bank account where payment was deposited';

-- Create index for querying invoices with fees
CREATE INDEX IF NOT EXISTS idx_invoices_processing_fee ON invoices(processing_fee) WHERE processing_fee > 0;

-- Update existing invoices to have default values
UPDATE invoices 
SET 
  processing_fee = 0,
  net_deposit_amount = amount_paid
WHERE processing_fee IS NULL;
