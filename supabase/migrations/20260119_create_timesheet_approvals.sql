-- Create timesheet approvals tracking table
CREATE TABLE IF NOT EXISTS timesheet_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(week_start, week_end)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_timesheet_approvals_week ON timesheet_approvals(week_start, week_end);
CREATE INDEX IF NOT EXISTS idx_timesheet_approvals_status ON timesheet_approvals(status);

-- Create recipients table for approved timesheets
CREATE TABLE IF NOT EXISTS timesheet_approval_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE timesheet_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE timesheet_approval_recipients ENABLE ROW LEVEL SECURITY;

-- Policies for timesheet_approvals (authenticated users can read/update)
CREATE POLICY "Authenticated users can view approvals" ON timesheet_approvals
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert approvals" ON timesheet_approvals
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update approvals" ON timesheet_approvals
  FOR UPDATE TO authenticated USING (true);

-- Policies for recipients (authenticated users can manage)
CREATE POLICY "Authenticated users can view recipients" ON timesheet_approval_recipients
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage recipients" ON timesheet_approval_recipients
  FOR ALL TO authenticated USING (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_timesheet_approval_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update timestamp
CREATE TRIGGER update_timesheet_approval_timestamp
  BEFORE UPDATE ON timesheet_approvals
  FOR EACH ROW
  EXECUTE FUNCTION update_timesheet_approval_timestamp();

-- Insert default recipient (you can change this)
INSERT INTO timesheet_approval_recipients (email, name, is_active)
VALUES ('dustin@dmlelectrical.com', 'Dustin', TRUE)
ON CONFLICT (email) DO NOTHING;
