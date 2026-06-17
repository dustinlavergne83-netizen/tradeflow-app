-- Fix: Add 'lighting-project' to the valid_project_type check constraint on the projects table
-- Run this in Supabase SQL Editor

-- Step 1: Drop the existing check constraint
ALTER TABLE projects
  DROP CONSTRAINT IF EXISTS valid_project_type;

-- Step 2: Re-add it with 'lighting-project' included
ALTER TABLE projects
  ADD CONSTRAINT valid_project_type
  CHECK (project_type IN (
    'commercial-public',
    'commercial-private',
    'residential-contractor',
    'residential-owner',
    'lighting-project'
  ));
