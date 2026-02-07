-- Add owner draws tracking and settlement functionality
-- Implements proper three-phase owner draw flow:
-- 1. Owner takes money (withdrawal) 
-- 2. Accumulate in Owner Draws account
-- 3. Settle at period-end (close to capital)

-- Add draw_status to bank_transactions
ALTER TABLE bank_transactions 
ADD COLUMN IF NOT EXISTS draw_status VARCHAR(50) DEFAULT 'pending'
  CHECK (draw_status IN ('pending', 'reviewed', 'approved', 'settled'));

-- Add comment explaining the status values
COMMENT ON COLUMN bank_transactions.draw_status IS 
'Status of owner draw transaction: 
  pending = detected as draw, awaiting review
  reviewed = reviewed but not approved
  approved = approved for settlement
  settled = closed out in journal entry';

-- Add is_owner_draw flag if not exists
ALTER TABLE bank_transactions 
ADD COLUMN IF NOT EXISTS is_owner_draw BOOLEAN DEFAULT FALSE;

-- Create owner_draw_settlements table to track settlement history
CREATE TABLE IF NOT EXISTS owner_draw_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  settlement_date DATE NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_draws DECIMAL(12, 2) NOT NULL,
  journal_entry_id UUID,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT positive_draws CHECK (total_draws >= 0)
);

-- Add index for fast lookups
CREATE INDEX IF NOT EXISTS idx_owner_draw_settlements_company 
  ON owner_draw_settlements(company_id);
CREATE INDEX IF NOT EXISTS idx_owner_draw_settlements_date 
  ON owner_draw_settlements(settlement_date);

-- Create function to settle owner draws
-- This creates a journal entry closing draws to capital
-- CRITICAL FIX: Only affects is_owner_draw = TRUE transactions, never touches other transactions
CREATE OR REPLACE FUNCTION settle_owner_draws(
  p_company_id UUID,
  p_period_start DATE,
  p_period_end DATE
)
RETURNS TABLE (
  settlement_id UUID,
  journal_entry_id UUID,
  total_draws DECIMAL,
  message TEXT
) AS $$
DECLARE
  v_total_draws DECIMAL(12, 2);
  v_owner_draws_account_id UUID;
  v_owner_capital_account_id UUID;
  v_journal_entry_id UUID;
  v_settlement_id UUID;
  v_settled_count INT;
BEGIN
  -- STEP 1: Calculate total draws ONLY for transactions explicitly marked as owner draws
  SELECT COALESCE(SUM(ABS(bt.amount)), 0)
  INTO v_total_draws
  FROM bank_transactions bt
  JOIN bank_accounts ba ON bt.bank_account_id = ba.id
  WHERE ba.company_id = p_company_id
    AND bt.is_owner_draw = TRUE  -- CRITICAL: Only count owner draws
    AND bt.draw_status NOT IN ('settled')  -- Don't count already-settled draws
    AND bt.transaction_date >= p_period_start
    AND bt.transaction_date <= p_period_end;

  -- If no draws, return early
  IF v_total_draws = 0 THEN
    RETURN QUERY SELECT 
      NULL::UUID, 
      NULL::UUID, 
      0::DECIMAL, 
      'No owner draws to settle for this period'::TEXT;
    RETURN;
  END IF;

  -- Get owner draws account (3100)
  SELECT id INTO v_owner_draws_account_id
  FROM accounts
  WHERE company_id = p_company_id
    AND account_number = '3100'
    AND account_type = 'equity'
  LIMIT 1;

  -- Get owner capital account (3000)
  SELECT id INTO v_owner_capital_account_id
  FROM accounts
  WHERE company_id = p_company_id
    AND account_number = '3000'
    AND account_type = 'equity'
  LIMIT 1;

  -- Validate accounts exist
  IF v_owner_draws_account_id IS NULL THEN
    RETURN QUERY SELECT 
      NULL::UUID, 
      NULL::UUID, 
      0::DECIMAL, 
      'ERROR: Owner Draws account (3100) not found'::TEXT;
    RETURN;
  END IF;

  IF v_owner_capital_account_id IS NULL THEN
    RETURN QUERY SELECT 
      NULL::UUID, 
      NULL::UUID, 
      0::DECIMAL, 
      'ERROR: Owner Capital account (3000) not found'::TEXT;
    RETURN;
  END IF;

  -- Create journal entry
  INSERT INTO journal_entries (
    company_id,
    entry_date,
    description,
    is_posted,
    reference_type,
    reference_id
  )
  VALUES (
    p_company_id,
    p_period_end,
    'Close owner draws to capital - Period ' || TO_CHAR(p_period_start, 'YYYY-MM-DD') || ' to ' || TO_CHAR(p_period_end, 'YYYY-MM-DD'),
    TRUE,
    'OWNER_DRAW_SETTLEMENT',
    NULL
  )
  RETURNING id INTO v_journal_entry_id;

  -- Create journal entry lines
  -- DEBIT: Owner Draws Account
  INSERT INTO journal_entry_lines (
    journal_entry_id,
    account_id,
    debit,
    credit,
    description
  )
  VALUES (
    v_journal_entry_id,
    v_owner_draws_account_id,
    v_total_draws,
    0,
    'Settlement of owner draws'
  );

  -- CREDIT: Owner Capital Account
  INSERT INTO journal_entry_lines (
    journal_entry_id,
    account_id,
    debit,
    credit,
    description
  )
  VALUES (
    v_journal_entry_id,
    v_owner_capital_account_id,
    0,
    v_total_draws,
    'Settlement of owner draws'
  );

  -- Create settlement record
  INSERT INTO owner_draw_settlements (
    company_id,
    settlement_date,
    period_start,
    period_end,
    total_draws,
    journal_entry_id,
    description
  )
  VALUES (
    p_company_id,
    p_period_end,
    p_period_start,
    p_period_end,
    v_total_draws,
    v_journal_entry_id,
    'Automatic settlement of ' || v_total_draws::TEXT || ' owner draws'
  )
  RETURNING id INTO v_settlement_id;

  -- STEP 2: Mark all draws as settled ONLY for is_owner_draw = TRUE transactions
  -- THIS IS THE CRITICAL FIX - We explicitly check is_owner_draw = TRUE to prevent affecting other transactions
  UPDATE bank_transactions bt
  SET draw_status = 'settled'
  WHERE bt.is_owner_draw = TRUE  -- ABSOLUTELY CRITICAL: Only owner draws
    AND bt.draw_status NOT IN ('settled')  -- Don't update already-settled
    AND bt.transaction_date >= p_period_start
    AND bt.transaction_date <= p_period_end
    AND EXISTS (
      SELECT 1 FROM bank_accounts ba 
      WHERE ba.id = bt.bank_account_id 
      AND ba.company_id = p_company_id
    );

  GET DIAGNOSTICS v_settled_count = ROW_COUNT;

  -- Return success
  RETURN QUERY SELECT 
    v_settlement_id, 
    v_journal_entry_id, 
    v_total_draws::DECIMAL, 
    ('Successfully settled ' || v_settled_count || ' owner draws for total of $' || v_total_draws::TEXT)::TEXT;

END;
$$ LANGUAGE plpgsql;

-- Create view for owner draws dashboard
CREATE OR REPLACE VIEW vw_owner_draws_summary AS
SELECT
  ba.company_id,
  DATE_TRUNC('month', bt.transaction_date)::DATE as month,
  COUNT(*) as draw_count,
  SUM(ABS(bt.amount)) as total_draws,
  bt.draw_status,
  MAX(bt.transaction_date) as latest_draw_date
FROM bank_transactions bt
JOIN bank_accounts ba ON bt.bank_account_id = ba.id
WHERE bt.is_owner_draw = TRUE
  AND bt.is_cleared = TRUE
GROUP BY ba.company_id, DATE_TRUNC('month', bt.transaction_date), bt.draw_status
ORDER BY month DESC;

-- Create view for pending settlements
CREATE OR REPLACE VIEW vw_pending_owner_draws AS
SELECT
  bt.id,
  ba.company_id,
  bt.transaction_date,
  bt.amount,
  bt.description,
  bt.draw_status,
  CASE 
    WHEN bt.draw_status = 'pending' THEN 'Awaiting Review'
    WHEN bt.draw_status = 'reviewed' THEN 'Reviewed - Not Approved'
    WHEN bt.draw_status = 'approved' THEN 'Ready to Settle'
    WHEN bt.draw_status = 'settled' THEN 'Settled'
    ELSE bt.draw_status
  END as status_label
FROM bank_transactions bt
JOIN bank_accounts ba ON bt.bank_account_id = ba.id
WHERE bt.is_owner_draw = TRUE
  AND bt.is_cleared = TRUE
ORDER BY bt.transaction_date DESC;

-- RLS: Allow users to see their company's owner draw settlements
CREATE POLICY owner_draw_settlements_rls ON owner_draw_settlements
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM bank_accounts ba
      WHERE ba.company_id = owner_draw_settlements.company_id
      AND ba.company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

ALTER TABLE owner_draw_settlements ENABLE ROW LEVEL SECURITY;
