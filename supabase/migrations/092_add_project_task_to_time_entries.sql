-- ====================================
-- ADD project_task column to time_entries
-- ====================================
-- This allows storing the job/project name that employees enter when clocking in

ALTER TABLE time_entries 
ADD COLUMN IF NOT EXISTS project_task TEXT;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_time_entries_project_task ON time_entries(project_task);

-- ✅ Done! Now time_entries can store the job names employees enter
