# Progress Billing Implementation Plan

## Overview
Create a comprehensive Progress Billing feature that allows generating invoices from estimates/contracts with partial billing capabilities.

## Workflow
1. **From Project Detail** → Click "Create Progress Invoice" button
2. **Select Estimate** → Choose which approved estimate to bill from
3. **Select Items** → Choose line items to include in this billing cycle
4. **Specify Amounts** → For each selected item:
   - Choose: Percentage OR Fixed Amount
   - Enter value (e.g., 50% or $500)
   - System calculates billing amount
5. **Review & Create** → Generate invoice with selected items

## Database Requirements

### New Table: `estimate_item_billing_history`
Track what has been billed for each estimate item to prevent over-billing.

```sql
CREATE TABLE estimate_item_billing_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_item_id UUID REFERENCES estimate_items(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
  original_amount DECIMAL(12,2),
  billed_amount DECIMAL(12,2),
  billing_type TEXT, -- 'percentage' or 'fixed'
  billing_value DECIMAL(10,2), -- 50 for 50% or 500 for $500
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## UI Components Needed

### 1. Progress Billing Page (`/progress-billing`)
**URL**: `/project/:projectId/progress-billing?estimateId=:estimateId`

**Features**:
- Display estimate header info
- List all estimate items with:
  - ☑️ Checkbox to select
  - Description
  - Original amount
  - Previously billed amount
  - Remaining amount
  - Billing method selector (% or $)
  - Input field for billing value
  - Calculated billing amount
- Summary section:
  - Total original amount
  - Total previously billed
  - Total remaining
  - Current billing total
- "Create Invoice" button

### 2. Button in ProjectDetail
Add "📊 Progress Invoice" button next to existing invoice buttons that navigates to progress billing page.

## Component Structure

```javascript
// src/pages/ProgressBilling.jsx
export default function ProgressBilling() {
  const [estimate, setEstimate] = useState(null);
  const [estimateItems, setEstimateItems] = useState([]);
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [billingConfig, setBillingConfig] = useState({}); // {itemId: {type: 'percentage', value: 50}}
  const [billingHistory, setBillingHistory] = useState({}); // {itemId: totalBilled}
  
  // Load estimate and items
  // Load billing history for each item
  // Calculate billing amounts
  // Create invoice
}
```

## Key Functions

### 1. Load Billing History
```javascript
async function loadBillingHistory(estimateId) {
  // Get all invoice items that reference estimate items
  // Sum up billed amounts per estimate item
  // Return map of {estimateItemId: totalBilled}
}
```

### 2. Calculate Billing Amount
```javascript
function calculateBillingAmount(item, config) {
  const originalAmount = item.total;
  const previouslyBilled = billingHistory[item.id] || 0;
  const remaining = originalAmount - previouslyBilled;
  
  if (config.type === 'percentage') {
    return (originalAmount * config.value) / 100;
  } else {
    return config.value;
  }
}
```

### 3. Create Progress Invoice
```javascript
async function handleCreateInvoice() {
  // 1. Create invoice record
  // 2. For each selected item:
  //    - Create invoice_items entry
  //    - Create estimate_item_billing_history entry
  // 3. Navigate to new invoice
}
```

## Migration File

```sql
-- supabase/migrations/014_progress_billing.sql

-- Track billing history for estimate items
CREATE TABLE IF NOT EXISTS estimate_item_billing_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_item_id UUID REFERENCES estimate_items(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
  original_amount DECIMAL(12,2) NOT NULL,
  billed_amount DECIMAL(12,2) NOT NULL,
  billing_type TEXT NOT NULL CHECK (billing_type IN ('percentage', 'fixed')),
  billing_value DECIMAL(10,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_billing_history_estimate_item 
  ON estimate_item_billing_history(estimate_item_id);
  
CREATE INDEX IF NOT EXISTS idx_billing_history_invoice 
  ON estimate_item_billing_history(invoice_id);

-- RLS
ALTER TABLE estimate_item_billing_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their billing history"
  ON estimate_item_billing_history FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM estimate_items 
    JOIN estimates ON estimates.id = estimate_items.estimate_id 
    WHERE estimate_items.id = estimate_item_billing_history.estimate_item_id 
    AND estimates.company_id = auth.uid()
  ));

CREATE POLICY "Users can insert their billing history"
  ON estimate_item_billing_history FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM estimate_items 
    JOIN estimates ON estimates.id = estimate_items.estimate_id 
    WHERE estimate_items.id = estimate_item_billing_history.estimate_item_id 
    AND estimates.company_id = auth.uid()
  ));
```

## Route Configuration

```javascript
// Add to App.jsx
<Route
  path="/project/:projectId/progress-billing"
  element={
    <ProtectedRoute>
      <ProgressBilling />
    </ProtectedRoute>
  }
/>
```

## UI/UX Features

### Visual Indicators
- ✅ Green checkmark for fully billed items
- ⚠️ Yellow for partially billed items
- ⭕ Empty circle for unbilled items
- Progress bar showing % billed

### Validation
- Can't bill more than remaining amount
- Warn if billing amount exceeds remaining
- Show running total as items are selected

### Smart Defaults
- Pre-select unbilled items
- Default to 100% of remaining amount
- Remember last billing method used

## Benefits

1. **Prevents Over-Billing**: Tracks what's been billed per item
2. **Flexible**: Support both percentage and fixed amounts
3. **Transparent**: Clear view of billing history
4. **Audit Trail**: Complete record of when items were billed
5. **Professional**: Proper progress billing like enterprise systems

## Future Enhancements

- Billing milestones (25%, 50%, 75%, 100%)
- Retainage tracking (hold back 10% until completion)
- Lien waivers integration
- Payment schedule templates
- Automatic reminders for next billing cycle

---

**Status**: Ready for Implementation
**Priority**: High
**Estimated Time**: 4-6 hours
**Dependencies**: Migration 014 must be run first
