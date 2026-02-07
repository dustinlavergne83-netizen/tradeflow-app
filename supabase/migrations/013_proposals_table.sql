-- ====================================
-- PROPOSALS TABLE
-- ====================================

CREATE TABLE proposals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  
  -- Estimate References
  base_estimate_id UUID REFERENCES estimates(id) ON DELETE SET NULL,
  
  -- Recipient Information
  contractor_id UUID REFERENCES project_contractors(id) ON DELETE SET NULL,
  contractor_name TEXT,
  contractor_email TEXT,
  
  -- Proposal Details
  proposal_number TEXT,
  proposal_date DATE DEFAULT CURRENT_DATE,
  valid_until DATE,
  
  -- Financial Summary
  base_bid_amount DECIMAL(12,2) DEFAULT 0,
  total_amount DECIMAL(12,2) DEFAULT 0,
  
  -- Status and Tracking
  status TEXT DEFAULT 'draft', -- 'draft', 'sent', 'viewed', 'accepted', 'rejected'
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  
  -- Notes
  notes TEXT,
  internal_notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Proposal Alternates (junction table)
CREATE TABLE proposal_alternates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id UUID REFERENCES proposals(id) ON DELETE CASCADE,
  alternate_estimate_id UUID REFERENCES estimates(id) ON DELETE CASCADE,
  alternate_number INTEGER,
  alternate_title TEXT,
  amount DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_proposals_company ON proposals(company_id);
CREATE INDEX idx_proposals_project ON proposals(project_id);
CREATE INDEX idx_proposals_base_estimate ON proposals(base_estimate_id);
CREATE INDEX idx_proposals_contractor ON proposals(contractor_id);
CREATE INDEX idx_proposals_status ON proposals(status);
CREATE INDEX idx_proposal_alternates_proposal ON proposal_alternates(proposal_id);

-- Enable Row Level Security
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_alternates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for proposals
CREATE POLICY "Users can view their own proposals"
  ON proposals FOR SELECT
  USING (auth.uid() = company_id);

CREATE POLICY "Users can insert their own proposals"
  ON proposals FOR INSERT
  WITH CHECK (auth.uid() = company_id);

CREATE POLICY "Users can update their own proposals"
  ON proposals FOR UPDATE
  USING (auth.uid() = company_id);

CREATE POLICY "Users can delete their own proposals"
  ON proposals FOR DELETE
  USING (auth.uid() = company_id);

-- RLS Policies for proposal_alternates
CREATE POLICY "Users can view proposal alternates"
  ON proposal_alternates FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM proposals 
    WHERE proposals.id = proposal_alternates.proposal_id 
    AND proposals.company_id = auth.uid()
  ));

CREATE POLICY "Users can insert proposal alternates"
  ON proposal_alternates FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM proposals 
    WHERE proposals.id = proposal_alternates.proposal_id 
    AND proposals.company_id = auth.uid()
  ));

CREATE POLICY "Users can update proposal alternates"
  ON proposal_alternates FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM proposals 
    WHERE proposals.id = proposal_alternates.proposal_id 
    AND proposals.company_id = auth.uid()
  ));

CREATE POLICY "Users can delete proposal alternates"
  ON proposal_alternates FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM proposals 
    WHERE proposals.id = proposal_alternates.proposal_id 
    AND proposals.company_id = auth.uid()
  ));

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_proposals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER proposals_update_timestamp
BEFORE UPDATE ON proposals
FOR EACH ROW
EXECUTE FUNCTION update_proposals_updated_at();

-- Function to generate proposal number
CREATE OR REPLACE FUNCTION generate_proposal_number()
RETURNS TRIGGER AS $$
DECLARE
  next_num INTEGER;
  year_str TEXT;
BEGIN
  IF NEW.proposal_number IS NULL THEN
    year_str := TO_CHAR(CURRENT_DATE, 'YY');
    
    SELECT COALESCE(MAX(CAST(SUBSTRING(proposal_number FROM '\d+$') AS INTEGER)), 0) + 1
    INTO next_num
    FROM proposals
    WHERE company_id = NEW.company_id
    AND proposal_number LIKE 'PROP-' || year_str || '-%';
    
    NEW.proposal_number := 'PROP-' || year_str || '-' || LPAD(next_num::TEXT, 4, '0');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate proposal number
CREATE TRIGGER generate_proposal_number_trigger
BEFORE INSERT ON proposals
FOR EACH ROW
EXECUTE FUNCTION generate_proposal_number();
