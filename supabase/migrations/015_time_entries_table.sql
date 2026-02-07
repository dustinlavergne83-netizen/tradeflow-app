-- ====================================
-- TIME ENTRIES TABLE
-- ====================================
-- Links employee time to specific projects for reporting

CREATE TABLE IF NOT EXISTS time_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  
  -- Time tracking
  clock_in TIMESTAMPTZ NOT NULL,
  clock_out TIMESTAMPTZ,
  
  -- Additional info
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_time_entries_employee ON time_entries(employee_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_project ON time_entries(project_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_clock_in ON time_entries(clock_in);

-- Enable Row Level Security
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Employees can view their own time entries
CREATE POLICY "Employees can view own time entries"
  ON time_entries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = time_entries.employee_id
      AND employees.user_id = auth.uid()
    )
  );

-- Employees can insert their own time entries
CREATE POLICY "Employees can insert own time entries"
  ON time_entries FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = time_entries.employee_id
      AND employees.user_id = auth.uid()
    )
  );

-- Employees can update their own time entries
CREATE POLICY "Employees can update own time entries"
  ON time_entries FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = time_entries.employee_id
      AND employees.user_id = auth.uid()
    )
  );

-- Employees can delete their own time entries
CREATE POLICY "Employees can delete own time entries"
  ON time_entries FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = time_entries.employee_id
      AND employees.user_id = auth.uid()
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_time_entries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER time_entries_update_timestamp
BEFORE UPDATE ON time_entries
FOR EACH ROW
EXECUTE FUNCTION update_time_entries_updated_at();

-- ✅ Done! Now time entries are linked to projects
