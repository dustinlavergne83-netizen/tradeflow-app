-- Create check stubs table for storing employee pay stub information
CREATE TABLE IF NOT EXISTS check_stubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  pay_period_start DATE NOT NULL,
  pay_period_end DATE NOT NULL,
  pay_date DATE NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  uploaded_by UUID REFERENCES auth.users(id),
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(employee_id, pay_period_end)
);

-- Add comments
COMMENT ON TABLE check_stubs IS 'Stores employee check stub files and metadata';
COMMENT ON COLUMN check_stubs.employee_id IS 'Reference to the employee';
COMMENT ON COLUMN check_stubs.pay_period_start IS 'Start date of the pay period';
COMMENT ON COLUMN check_stubs.pay_period_end IS 'End date of the pay period (unique per employee)';
COMMENT ON COLUMN check_stubs.pay_date IS 'Date the employee was paid';
COMMENT ON COLUMN check_stubs.file_path IS 'Storage path in Supabase storage bucket';
COMMENT ON COLUMN check_stubs.file_name IS 'Original filename of the uploaded check stub';
COMMENT ON COLUMN check_stubs.uploaded_by IS 'Admin user who uploaded the check stub';

-- Create index for faster queries
CREATE INDEX idx_check_stubs_employee_id ON check_stubs(employee_id);
CREATE INDEX idx_check_stubs_pay_date ON check_stubs(pay_date DESC);

-- Enable RLS
ALTER TABLE check_stubs ENABLE ROW LEVEL SECURITY;

-- Policy: Employees can only view their own check stubs
CREATE POLICY "Employees can view their own check stubs"
  ON check_stubs
  FOR SELECT
  TO authenticated
  USING (
    employee_id IN (
      SELECT id FROM employees WHERE user_id = auth.uid()
    )
  );

-- Policy: Admins can view all check stubs
CREATE POLICY "Admins can view all check stubs"
  ON check_stubs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Policy: Admins can insert check stubs
CREATE POLICY "Admins can insert check stubs"
  ON check_stubs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Policy: Admins can delete check stubs
CREATE POLICY "Admins can delete check stubs"
  ON check_stubs
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
