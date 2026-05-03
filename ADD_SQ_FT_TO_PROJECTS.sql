-- Add sq_ft (square footage) column to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS sq_ft numeric;
