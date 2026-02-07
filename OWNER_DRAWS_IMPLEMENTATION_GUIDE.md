# Owner Draws - Implementation Guide

## ✅ Complete Implementation Ready

This guide walks through the three-phase owner draw flow that has been implemented.

---

## The Three-Phase Flow

### PHASE 1: Owner Takes Money ✓ (Already Working)
```
Owner withdraws $1,000 from bank
↓
Bank transaction imported with is_owner_draw = true
↓
User marks as cleared in Bank Transactions page
↓
System creates journal entry automatically:
  DEBIT: Owner Draws (3100)    $1,000
  CREDIT: Bank Account (1050)           $1,000
↓
Books match physical bank account
```

### PHASE 2: Accumulate ✓ (Already Working)
```
Throughout period:
  Jan: Owner Draws balance: $1,000
  Feb: Owner Draws balance: $2,500 (+$1,500)
  Mar: Owner Draws balance: $3,700 (+$1,200)
```

### PHASE 3: Settlement ✓ (NOW IMPLEMENTED)
```
At period-end (quarter/year):
  1. Open Owner Draws page
  2. Click "Settle Draws"
  3. Select period start and end dates
  4. Click "Settle Draws"
↓
System creates settlement journal entry:
  DEBIT: Owner Draws (3100)      $3,700
  CREDIT: Owner's Capital (3000)         $3,700
↓
Result:
  Owner Draws account: $0 (cleared for next period)
  Owner's Capital: Reduced by draws amount
  Bank Account: Unchanged (money already left)
  Settlement recorded in history
```

---

## What Was Implemented

### 1. Database Migration: `084_add_owner_draws_tracking.sql`

**New Fields:**
- `bank_transactions.draw_status` - Tracks draw lifecycle
  - `pending` = Newly detected draw
  - `reviewed` = User reviewed but not approved
  - `approved` = Ready for settlement
  - `settled` = Closed in journal entry

**New Table: `owner_draw_settlements`**
```sql
Columns:
  - id: UUID (primary key)
  - company_id: UUID
  - settlement_date: DATE (when settled)
  - period_start: DATE
  - period_end: DATE
  - total_draws: DECIMAL (total amount settled)
  - journal_entry_id: UUID (reference to created entry)
  - description: TEXT
  - created_at, updated_at
```

**New Function: `settle_owner_draws()`**
```sql
FUNCTION settle_owner_draws(
  p_company_id UUID,
  p_period_start DATE,
  p_period_end DATE
)
RETURNS (settlement_id, journal_entry_id, total_draws, message)
```

This function:
1. Calculates total draws for the period
2. Creates journal entry closing draws to capital
3. Records settlement in owner_draw_settlements table
4. Marks all draws as "settled"

**New Views:**
- `vw_owner_draws_summary` - Monthly summary with counts and totals
- `vw_pending_owner_draws` - List of unsettled draws

### 2. React Component: `src/pages/OwnerDraws.jsx`

**Features:**
- YTD total draws display
- Pending draws table with status management
- Monthly summary breakdown
- Settlement history
- "Settle Draws" button with date picker modal
- Automatic data reload after settlement

**Data Loaded:**
```javascript
1. vw_owner_draws_summary - Monthly breakdown
2. vw_pending_owner_draws - Draws ready to settle
3. owner_draw_settlements - Historical settlements
```

**Status Transitions:**
```
pending → reviewed → approved → settled
```

Users can change status of draws before settlement.

### 3. Styling: `src/pages/OwnerDraws.css`

- Professional dashboard layout
- Color-coded status badges
- Responsive tables
- Modal dialog for settlement
- Proper spacing and typography

---

## How to Use

### Step 1: Deploy the Migration

```bash
# The migration file is ready at:
supabase/migrations/084_add_owner_draws_tracking.sql

# Deploy via Supabase CLI:
supabase db push
```

### Step 2: Add Navigation Link

In your main navigation (e.g., `src/App.jsx` or navigation component):

```jsx
import OwnerDraws from './pages/OwnerDraws';

// Add route:
<Route path="/owner-draws" element={<OwnerDraws />} />

// Add navigation link:
<NavLink to="/owner-draws">Owner Draws</NavLink>
```

### Step 3: Use the Owner Draws Page

**Normal Workflow:**

1. **Owner takes money** → Bank transaction created automatically
   - System detects it's an owner draw
   - Shows as "pending" in Owner Draws page

2. **Review draws** → Open Owner Draws page
   - See all pending draws in "Pending Draws" section
   - See monthly totals in "Monthly Summary"
   - See YTD total at top

3. **Mark as approved** → Change status from pending → reviewed → approved
   - Use the status dropdown in "Pending Draws" table

4. **Settle at period-end** → Click "Settle Draws"
   - Select period start date (e.g., 2026-01-01)
   - Select period end date (e.g., 2026-03-31)
   - Click "Settle Draws" button
   - System creates journal entry automatically
   - All draws for that period marked as "settled"

5. **View settlement history** → Check "Settlement History" section
   - See all past settlements
   - See journal entry reference
   - See settlement details

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│ Bank Statement (Physical)                               │
│ Owner withdrawal: -$1,000                               │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│ Bank Transactions Page                                  │
│ User marks as cleared                                   │
│ System creates journal entry:                           │
│   DB: Owner Draws $1,000                                │
│   CR: Bank Account    $1,000                            │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│ Owner Draws Page                                        │
│ Shows:                                                  │
│ - YTD Total: $3,700                                     │
│ - Pending: 3 draws                                      │
│ - Monthly totals                                        │
│ - Status management                                     │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│ Settle Draws Modal                                      │
│ User clicks "Settle Draws"                              │
│ Enters period dates                                     │
│ System creates settlement:                              │
│   DB: Owner Draws $3,700                                │
│   CR: Owner Capital $3,700                              │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│ General Ledger                                          │
│ Owner Draws: $0 (cleared)                               │
│ Owner Capital: -$3,700 (reduced by draws)               │
│ Bank Account: No change (already reduced)               │
└─────────────────────────────────────────────────────────┘
```

---

## Database Views Explained

### vw_owner_draws_summary
```sql
Shows:
  company_id, month, draw_count, total_draws, draw_status, latest_draw_date

Example:
  Month: 2026-03, Count: 3, Total: $3,700, Status: pending
  Month: 2026-02, Count: 2, Total: $2,500, Status: approved
  Month: 2026-01, Count: 1, Total: $1,000, Status: settled
```

### vw_pending_owner_draws
```sql
Shows:
  id, company_id, transaction_date, amount, description, draw_status, status_label

Filters:
  Only shows cleared draws (is_cleared = true)
  Only shows owner draws (is_owner_draw = true)
```

---

## Settlement Function Details

### Function: settle_owner_draws()

**Input Parameters:**
```sql
p_company_id   UUID      -- Company to settle
p_period_start DATE      -- Start of period (e.g., 2026-01-01)
p_period_end   DATE      -- End of period (e.g., 2026-03-31)
```

**Returns:**
```sql
settlement_id        UUID      -- ID of settlement record
journal_entry_id     UUID      -- ID of created journal entry
total_draws          DECIMAL   -- Total amount settled
message              TEXT      -- Success/error message
```

**What It Does:**
1. Calculates sum of all owner draws for period
2. Validates Owner Draws (3100) and Owner Capital (3000) accounts exist
3. Creates journal entry with:
   - DEBIT Owner Draws: total_draws
   - CREDIT Owner Capital: total_draws
4. Posts the journal entry (is_posted = true)
5. Creates settlement record in owner_draw_settlements
6. Marks all period draws as "settled"
7. Returns success message with amounts

**Error Handling:**
- Returns error if accounts not found
- Returns message if no draws to settle
- Validates all parameters

---

## Testing the Implementation

### Test Scenario

```
1. Create test owner draw:
   - Date: 2026-01-15
   - Amount: $1,000
   - Description: "Test Draw"
   - is_owner_draw: true
   - is_cleared: false

2. Mark as cleared in Bank Transactions page
   - Should create journal entry automatically

3. Go to Owner Draws page
   - Should show YTD total: $1,000
   - Should show draw as "pending" in Pending Draws

4. Change draw status to "approved"
   - Should update immediately

5. Click "Settle Draws"
   - Period: 2026-01-01 to 2026-01-31
   - Should create settlement journal entry
   - Should mark draw as "settled"

6. Verify in General Ledger:
   - Owner Draws account should be $0 (or settlement amount)
   - Owner Capital should be reduced by $1,000
```

---

## Common Questions

### Q: What if I don't settle draws?
A: Draws will accumulate in the Owner Draws account. It's good practice to settle at period-end, but the system works either way. The difference is:
- WITHOUT settlement: Owner Draws account shows YTD amount
- WITH settlement: Owner Draws cleared, Capital reduced

### Q: Can I settle multiple times?
A: Yes! You can settle per month, quarter, or year. Each settlement creates its own journal entry and settlement record.

### Q: What if an owner contributes money back?
A: Create a positive bank transaction with is_owner_draw = true and amount > 0. This will reverse draws. Or manually adjust via Bank Transactions.

### Q: Are there audit trails?
A: Yes! The owner_draw_settlements table records:
- When settled
- What period
- Total amount
- Linking journal entry
- Settlement description

### Q: Can I undo a settlement?
A: You would need to reverse the journal entry manually. The settlement record remains for audit purposes.

---

## Account Requirements

Ensure these accounts exist in your Chart of Accounts:

**Account 3100: Owner Draws**
- Type: Equity
- Normal Balance: Debit
- Used for: Owner distributions

**Account 3000: Owner's Capital**
- Type: Equity
- Normal Balance: Credit
- Used for: Owner's investment/net equity

If accounts don't exist, the function will return an error. Create them in Chart of Accounts first.

---

## Next Steps

1. ✅ Deploy migration: `supabase db push`
2. ✅ Import component in App.jsx
3. ✅ Add navigation link
4. ✅ Test with sample owner draw
5. ✅ Document for team
6. ✅ Train on workflow

---

## Summary

The owner draws system now has the complete three-phase flow:

| Phase | Status | Component |
|-------|--------|-----------|
| Owner withdraws | ✅ Working | Bank Transactions page |
| Accumulate in equity | ✅ Working | Journal entries |
| Settlement/closing | ✅ NEW | Owner Draws page + settle_owner_draws() |

**Bank Correspondence Maintained:**
- Physical bank decreased ✓
- Books bank decreased ✓
- Owner Draws increased ✓
- Owner Capital adjusted at settlement ✓

All three phases are now properly implemented and ready for use!
