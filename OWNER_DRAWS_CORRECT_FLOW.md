# Owner Draws - The Correct Accounting Flow

## The Problem with Current System
You have owner draws tracked, but **there's no clear mechanism to close them out or mark them as "distributed/settled"**. They just accumulate in the Owner Draws account indefinitely.

## The Correct Flow (What Should Happen)

### PHASE 1: OWNER TAKES MONEY FROM COMPANY ✓ (You have this)
```
STEP 1: Owner withdraws cash from bank account
├─ Bank Transaction: -$1,000 (withdrawal)
├─ Description: "Owner Draw"
├─ Category: "Owner Draws" (equity account)
└─ System detects owner draw and marks as such

STEP 2: Mark as cleared in bank reconciliation
├─ Bank transaction is cleared
├─ Triggers journal entry creation:
│   ├─ DEBIT: Owner Draws Account (3100)    $1,000
│   └─ CREDIT: Bank Account (1050)                  $1,000

RESULT IN GENERAL LEDGER:
├─ Bank Account: Down $1,000 (cash left company)
└─ Owner Draws: Up $1,000 (owed to/taken by owner)
```

### PHASE 2: ACCUMULATE DRAWS DURING PERIOD ✓ (You have partial)
```
Throughout the month/quarter/year:
├─ Jan: Owner Draw $1,000 → Owner Draws bal: $1,000
├─ Feb: Owner Draw $1,500 → Owner Draws bal: $2,500
├─ Mar: Owner Draw $1,200 → Owner Draws bal: $3,700
│
└─ YTD Owner Draws: $3,700 (amount owner has taken out)
```

### PHASE 3: PERIOD-END SETTLEMENT ✗ (You DON'T have this - THIS IS THE GAP!)
```
AT END OF QUARTER/YEAR:

STEP 1: Review all draws
├─ Total draws this period: $3,700
├─ Owner capital at start: $50,000
└─ Owner capital remaining: $46,300

STEP 2: Decide what to do with draws
Option A: Leave in Owner Draws (passive method)
├─ Owner Draws: $3,700
├─ Means: Owner has taken $3,700 and it's "settled"
└─ Balance sheet shows: Capital $50,000 - Draws $3,700 = $46,300 Net

Option B: Close to Capital (closing entry method)
├─ Create journal entry:
│   ├─ DEBIT: Owner Draws Account   $3,700
│   └─ CREDIT: Owner's Capital              $3,700
├─ This moves draws out and back to capital
└─ Clears the draws account for next period

Option C: Partial payback (owner contributes)
├─ Owner puts back $2,000:
│   ├─ DEBIT: Bank Account          $2,000
│   └─ CREDIT: Owner Draws                  $2,000
├─ New draws balance: $1,700
└─ Owner's net for period: $1,700 taken
```

## Recommended Flow for Your System

### CURRENT STATE (What you have):
1. ✅ Owner takes money → detected as owner draw
2. ✅ Journal entry created → tracks in Owner Draws account
3. ❌ Draws accumulate forever → no settlement process

### WHAT YOU NEED TO ADD:

**STEP 1: Add Draws Tracking Field** (in bank_transactions table)
```sql
ALTER TABLE bank_transactions ADD COLUMN draw_status VARCHAR(50);
-- Values: 'pending', 'reviewed', 'approved', 'settled'
```

**STEP 2: Add Owner Draws Management Page**
```
Features needed:
├─ List all owner draws (YTD, by month)
├─ Total amount taken
├─ Mark as 'pending' → 'reviewed' → 'approved'
├─ Option to "Settle" (create closing entry)
├─ Show remaining capital
└─ Generate Owner Draws Report
```

**STEP 3: Add Settlement Function**
```javascript
async function settleOwnerDraws(drawIds, action) {
  // action = 'close_to_capital' or 'mark_paid'
  
  if (action === 'close_to_capital') {
    // Create journal entry to close draws to capital
    const totalDraws = calculateTotalDraws(drawIds);
    
    const journalEntry = {
      description: `Close owner draws - Q1 2026`,
      lines: [
        { 
          account: 'Owner Draws',     // 3100
          debit: totalDraws, 
          credit: 0 
        },
        { 
          account: 'Owner Capital',   // 3000
          debit: 0, 
          credit: totalDraws 
        }
      ]
    };
    
    // Create and post the entry
    // Mark all draws as 'settled'
  }
}
```

## The Final Balance Sheet Presentation

### WITHOUT Settlement (shows draws separately):
```
EQUITY SECTION:
  Owner's Capital:        $50,000
  Owner Draws:            ($3,700)
  ─────────────────────────────
  Net Owner's Equity:     $46,300
```

### WITH Settlement (draws closed to capital):
```
EQUITY SECTION:
  Owner's Capital:        $46,300  (already includes draws)
  ─────────────────────────────
  Net Owner's Equity:     $46,300
```

## Recommended Implementation Order

### Phase 1 (Right Now):
1. Add `draw_status` field to bank_transactions
2. Create "Owner Draws Report" page showing:
   - Total draws YTD
   - Draws by month
   - Current balance
   - Remaining capital

### Phase 2 (Next):
1. Add status tracking UI (mark draws as reviewed/approved)
2. Add "Settle Draws" button that:
   - Sums all pending draws
   - Creates closing journal entry
   - Marks draws as "settled"

### Phase 3 (Polish):
1. Add Owner Draws History page
2. Add contributing/capital addition tracking
3. Add owner distributions/payouts feature

## Simple SQL to Check Current State

```sql
-- Check total owner draws
SELECT 
  account_name,
  SUM(debit - credit) as balance
FROM journal_entry_lines jel
JOIN accounts a ON jel.account_id = a.id
WHERE a.account_name LIKE '%owner%draw%'
GROUP BY account_name;

-- Check all owner draw transactions
SELECT 
  DATE_TRUNC('month', bt.transaction_date) as month,
  COUNT(*) as draw_count,
  SUM(ABS(bt.amount)) as total
FROM bank_transactions bt
WHERE bt.description ILIKE '%owner%draw%'
  OR bt.payee ILIKE '%dustin%'
  OR (bt.category = (SELECT id FROM accounts WHERE account_name LIKE '%owner%draw%'))
GROUP BY DATE_TRUNC('month', bt.transaction_date)
ORDER BY month DESC;
```

## Summary

**The Gap**: You have the CAPTURE phase (recording draws) but not the SETTLEMENT phase (closing them out).

**What to Add**:
1. Draws status field ('pending', 'reviewed', 'approved', 'settled')
2. Owner Draws Report showing YTD totals and remaining capital
3. Settlement function to close draws to capital at period-end
4. UI to manage and track draws through their lifecycle

**Result**: Owner draws will have a complete lifecycle from "taken" → "reviewed" → "settled", and the accounting will be complete and auditable.
