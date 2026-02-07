-- Create change_order_items table (separate from estimate_items)
-- This keeps change order work completely separate from base estimates

CREATE TABLE IF NOT EXISTS change_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  change_order_id UUID NOT NULL REFERENCES change_orders(id) ON DELETE CASCADE,
  line_type TEXT NOT NULL DEFAULT 'material',
  section TEXT NOT NULL, -- 'lighting', 'power', 'branch', etc.
  sequence INTEGER NOT NULL DEFAULT 0,
  description TEXT NOT NULL,
  quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'ea',
  material_unit_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
  material_total DECIMAL(10,2) NOT NULL DEFAULT 0,
  waste_factor DECIMAL(10,2) NOT NULL DEFAULT 0,
  labor_hours DECIMAL(10,2) NOT NULL DEFAULT 0,
  labor_multiplier DECIMAL(10,2) NOT NULL DEFAULT 1.0,
  labor_rate DECIMAL(10,2) NOT NULL DEFAULT 0,
  labor_total DECIMAL(10,2) NOT NULL DEFAULT 0,
  equipment_total DECIMAL(10,2) NOT NULL DEFAULT 0,
  subcontractor_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
  line_total DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_change_order_items_change_order_id 
  ON change_order_items(change_order_id);

CREATE INDEX IF NOT EXISTS idx_change_order_items_section 
  ON change_order_items(change_order_id, "section");

-- Add Row Level Security (if needed)
-- Note: Temporarily disable RLS to avoid policy issues
-- You can add policies later if needed
-- ALTER TABLE change_order_items ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE change_order_items IS 'Line items for change orders - completely separate from base estimate items';
