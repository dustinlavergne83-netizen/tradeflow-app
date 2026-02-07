-- ====================================
-- CHANGE ORDERS TABLE
-- ====================================

CREATE TABLE IF NOT EXISTS change_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  change_order_number TEXT,
  project_name TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  change_order_date DATE DEFAULT CURRENT_DATE,
  subtotal DECIMAL(12,2) DEFAULT 0,
  tax_rate DECIMAL(5,2) DEFAULT 0,
  tax_amount DECIMAL(12,2) DEFAULT 0,
  total DECIMAL(12,2) DEFAULT 0,
  status TEXT DEFAULT 'pending', -- pending, approved, rejected, completed
  reason TEXT, -- Why the change order was needed
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Change order line items table
CREATE TABLE IF NOT EXISTS change_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  change_order_id UUID REFERENCES change_orders(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity DECIMAL(10,2) DEFAULT 1,
  unit_price DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_change_orders_project_name ON change_orders(project_name);
CREATE INDEX IF NOT EXISTS idx_change_orders_created_by ON change_orders(created_by);
CREATE INDEX IF NOT EXISTS idx_change_orders_status ON change_orders(status);
CREATE INDEX IF NOT EXISTS idx_change_order_items_change_order_id ON change_order_items(change_order_id);

-- Enable RLS
ALTER TABLE change_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE change_order_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for change_orders
CREATE POLICY "Users can view their own change orders"
  ON change_orders FOR SELECT
  USING (auth.uid() = created_by);

CREATE POLICY "Users can insert their own change orders"
  ON change_orders FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own change orders"
  ON change_orders FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own change orders"
  ON change_orders FOR DELETE
  USING (auth.uid() = created_by);

-- RLS Policies for change_order_items
CREATE POLICY "Users can view their change order items"
  ON change_order_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM change_orders 
    WHERE change_orders.id = change_order_items.change_order_id 
    AND change_orders.created_by = auth.uid()
  ));

CREATE POLICY "Users can insert their change order items"
  ON change_order_items FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM change_orders 
    WHERE change_orders.id = change_order_items.change_order_id 
    AND change_orders.created_by = auth.uid()
  ));

CREATE POLICY "Users can update their change order items"
  ON change_order_items FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM change_orders 
    WHERE change_orders.id = change_order_items.change_order_id 
    AND change_orders.created_by = auth.uid()
  ));

CREATE POLICY "Users can delete their change order items"
  ON change_order_items FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM change_orders 
    WHERE change_orders.id = change_order_items.change_order_id 
    AND change_orders.created_by = auth.uid()
  ));

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_change_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER change_orders_update_timestamp
BEFORE UPDATE ON change_orders
FOR EACH ROW
EXECUTE FUNCTION update_change_orders_updated_at();
