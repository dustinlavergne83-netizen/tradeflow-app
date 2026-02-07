-- ============================================
-- RUN THIS IN SUPABASE DASHBOARD SQL EDITOR
-- ============================================
-- Add Contract Value Field to Projects
-- This separates Contract Value (sale price) from Budget (internal cost estimate)

-- Add contract_value to projects table
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS contract_value DECIMAL(12,2) DEFAULT 0;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_projects_contract_value 
ON projects(contract_value);

-- Done! Now you have:
-- contract_value = What you're selling the job for (from winning proposal)
-- budget = Your internal cost estimate (what you plan to spend)
-- actual_cost = Labor + Materials actually spent (calculated from tracking)
