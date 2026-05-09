-- Add show_line_items column to proposals table
-- This persists the Summary vs Itemized toggle on proposals
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS show_line_items boolean DEFAULT true;
