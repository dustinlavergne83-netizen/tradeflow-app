-- Add living sq ft column to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS sq_ft_living numeric;
