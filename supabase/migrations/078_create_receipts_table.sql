-- Create receipts table for storing receipt images and parsed data
CREATE TABLE IF NOT EXISTS receipts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Image storage
  image_url TEXT NOT NULL,
  image_size_bytes INTEGER,
  image_filename TEXT,
  
  -- Parsed data from AI
  vendor_name TEXT,
  amount DECIMAL(10,2),
  receipt_date DATE,
  receipt_items JSONB, -- Array of {description, quantity, price}
  raw_text TEXT, -- Full OCR text from receipt
  
  -- Expense linking
  expense_id UUID REFERENCES expenses(id) ON DELETE SET NULL,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  
  -- Confidence & AI data
  ai_confidence DECIMAL(3,2), -- 0.0 to 1.0
  ai_model TEXT, -- Which model parsed this (gpt-4-vision, etc)
  parsing_status TEXT DEFAULT 'pending', -- pending, success, failed
  parsing_error TEXT,
  
  -- User info
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_receipts_project_id ON receipts(project_id);
CREATE INDEX idx_receipts_expense_id ON receipts(expense_id);
CREATE INDEX idx_receipts_created_by ON receipts(created_by);
CREATE INDEX idx_receipts_parsing_status ON receipts(parsing_status);
CREATE INDEX idx_receipts_created_at ON receipts(created_at);

-- Add RLS policies
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view receipts for their projects
CREATE POLICY "Users can view receipts for their projects"
  ON receipts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects 
      WHERE projects.id = receipts.project_id 
      AND (projects.created_by = auth.uid() OR created_by = auth.uid())
    )
    OR created_by = auth.uid()
  );

-- Policy: Only admins/supervisors can insert receipts
CREATE POLICY "Admins and supervisors can insert receipts"
  ON receipts
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees 
      WHERE employees.user_id = auth.uid() 
      AND (employees.role = 'admin' OR employees.role = 'supervisor')
    )
  );

-- Policy: Only admins/supervisors can update receipts
CREATE POLICY "Admins and supervisors can update receipts"
  ON receipts
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM employees 
      WHERE employees.user_id = auth.uid() 
      AND (employees.role = 'admin' OR employees.role = 'supervisor')
    )
  );

-- Policy: Only admins/supervisors can delete receipts
CREATE POLICY "Admins and supervisors can delete receipts"
  ON receipts
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM employees 
      WHERE employees.user_id = auth.uid() 
      AND (employees.role = 'admin' OR employees.role = 'supervisor')
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_receipts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER receipts_update_timestamp
BEFORE UPDATE ON receipts
FOR EACH ROW
EXECUTE FUNCTION update_receipts_updated_at();
