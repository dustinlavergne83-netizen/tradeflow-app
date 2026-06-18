-- ============================================================
-- SERVICE CALLS TABLE
-- Stores service call details for T&M billing
-- ============================================================

CREATE TABLE IF NOT EXISTS service_calls (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id      uuid REFERENCES companies(id) ON DELETE SET NULL,
  employee_id     uuid,  -- references employees.id (not FK to avoid circular issues)
  employee_name   text,
  shift_segment_id uuid, -- references shift_segments.id
  
  -- Call details
  customer_name   text NOT NULL,
  description     text NOT NULL,
  address         text,
  
  -- Time
  started_at      timestamptz,
  ended_at        timestamptz,
  labor_hours     numeric(8,2),
  hourly_rate     numeric(10,2) DEFAULT 95.00,
  
  -- Materials as JSON array: [{name, qty, unit_price, total}]
  materials       jsonb DEFAULT '[]'::jsonb,
  
  -- Invoice link (set when converted to invoice)
  invoice_id      uuid,
  
  -- Status: pending, invoiced, voided
  status          text DEFAULT 'pending',
  
  notes           text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- Index for company lookups
CREATE INDEX IF NOT EXISTS idx_service_calls_company ON service_calls(company_id);
CREATE INDEX IF NOT EXISTS idx_service_calls_status ON service_calls(status);
CREATE INDEX IF NOT EXISTS idx_service_calls_segment ON service_calls(shift_segment_id);

-- RLS
ALTER TABLE service_calls ENABLE ROW LEVEL SECURITY;

-- Company members can view their own company's service calls
CREATE POLICY "company_view_service_calls" ON service_calls
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM employees WHERE user_id = auth.uid()
    )
  );

-- Company members can insert
CREATE POLICY "company_insert_service_calls" ON service_calls
  FOR INSERT WITH CHECK (
    company_id IN (
      SELECT company_id FROM employees WHERE user_id = auth.uid()
    )
  );

-- Company members can update
CREATE POLICY "company_update_service_calls" ON service_calls
  FOR UPDATE USING (
    company_id IN (
      SELECT company_id FROM employees WHERE user_id = auth.uid()
    )
  );
