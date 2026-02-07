-- ============================================
-- RUN THIS IN SUPABASE DASHBOARD SQL EDITOR
-- ============================================
-- Add Labor Cost and Markup Fields to Estimates

-- Add labor_cost_rate (what you PAY per hour)
ALTER TABLE estimates
ADD COLUMN IF NOT EXISTS labor_cost_rate DECIMAL(10,2) DEFAULT 25.00;

-- Add labor_markup_percent (markup percentage on labor)
ALTER TABLE estimates
ADD COLUMN IF NOT EXISTS labor_markup_percent DECIMAL(5,2) DEFAULT 50.00;

-- Add labor_budget_total (calculated: hours × cost rate)
ALTER TABLE estimates
ADD COLUMN IF NOT EXISTS labor_budget_total DECIMAL(12,2) DEFAULT 0;

-- Done! Now you can track:
-- labor_cost_rate = What you pay ($25/hr)
-- labor_markup_percent = Your markup (50%)
-- labor_budget_total = Your internal cost (hours × $25)
-- labor_subtotal = Customer pays (budget × 1.50)
