# Owner Draws Accounting Flow Analysis

## Current Implementation

### 1. Where Owner Draws are Recorded

**Detection Criteria** (BankTransactions.jsx):
- Description contains: "owner draw", "owner withdrawal", "owner distribution"
- Payee is: "Dustin Lavergne"
- Category account name contains: "owner" AND "draw"

**Journal Entry Created**:
```
DEBIT:  Bank Account (reduces cash)
CREDIT: Owner Draws Account (increases owner draws liability)
```

Example:
- Owner withdrawal: $1,000
- Bank Account (1050): -$1,000 debit effect (actually a credit)
- Owner Draws (3100): +$1,000 credit (shown as liability increase)

### 2. How They Flow Through the System

```
BANK TRANSACTIONS
       ↓
   [Mark as Cleared]
       ↓
   [Detect as Owner Draw]
       ↓
   [Set Category to "Owner Draws" Account]
       ↓
   [CREATE JOURNAL ENTRY]
       ↓
GENERAL LEDGER
   Bank Account: -$1,000
   Owner Draws: +$1,000 (as liability/equity)
```

### 3. Current Issues with the Flow

#### Problem #1: Owner Draws are Equity Account (should be)
- They CREDIT (increase) the account when money is withdrawn
- But Owner Draws account is typically an EQUITY CONTRA account
- This makes the balance show the amount OWED to the owner

#### Problem #2: No Clear "Distribution" Process
- Once recorded in Owner Draws account, there's no mechanism to:
  1. Withdraw the funds (happens at bank level)
  2. Clear/close the draws to Owner's Capital at period end
  3. Track draws vs. capital contributions

#### Problem #3: Balance Semantics
- Owner Draws account balance = total amount withdrawn from company
- Should be offset against Owner's Capital account
- Need a process to "pay back" or "distribute" these draws

### 4. Proposed Corrected Flow

```
┌─────────────────────────────────────────────────────┐
│             OWNER DRAWS CYCLE                       │
└─────────────────────────────────────────────────────┘

STEP 1: OWNER TAKES FUNDS
┌─────────────────────────┐
│ Bank Account withdrawal │  $1,000
│ Category: Owner Draws   │
│ Description: Owner Draw │
└─────────────────────────┘
           ↓
   Journal Entry Created:
   DB: Owner Draws Account (3100)  $1,000
   CR: Bank Account               $1,000

STEP 2: TRACK ACCUMULATED DRAWS
┌──────────────────────────┐
│ Owner Draws Account      │
│ (Tracking total drawn)   │
│ Balance: $5,000 (YTD)    │
└──────────────────────────┘

STEP 3: PERIOD-END CLOSING (Optional)
┌──────────────────────────────┐
│ At year-end:                 │
│ - Determine owner's capital  │
│ - Less: draws during year    │
│ - Equals: ending capital     │
│                              │
│ No journal entry needed      │
│ (draws already in equity)    │
└──────────────────────────────┘

STEP 4: BALANCE SHEET PRESENTATION
┌──────────────────────────┐
│ EQUITY SECTION           │
├──────────────────────────┤
│ Owner's Capital   $50,000│
│ Less: Draws      ($5,000)│
│ ───────────────────────  │
│ Net Owner's Equity $45,000
└──────────────────────────┘
```

### 5. Your Current Account Structure Needs

```
Account #3100: Owner Draws (Equity - Contra)
  - Normal Balance: DEBIT (shows as negative in equity)
  - Increases when: Owner takes money out
  - Decreases when: Owner puts money back in / distributions made
  
Account #3000: Owner's Capital (Equity)
  - Normal Balance: CREDIT (shows as positive)
  - Represents: Owner's investment in the business
```

### 6. Recommended Enhancements

#### A. Add "Owner Distribution/Payout" Feature
When owner draws are formally distributed/paid:
```
[Owner Draws Account] → [Manual Journal Entry] → [Close to Capital]
$5,000 YTD Draws      [DB: Capital $5,000]      [Cleared status]
                      [CR: Owner Draws $5,000]   [at period end]
```

#### B. Add Owner Draws Report
- Total draws YTD: $5,000
- Draws by month: breakdown
- Remaining capital: $45,000
- Status: "Pending review" or "Distributed"

#### C. Add Draws Management Page
- View all owner withdrawals
- Mark draws as "pending", "reviewed", "distributed"
- Generate period-end settlement journal entries

### 7. Accounting Treatment Summary

**Double-Entry System**:
```
Owner Takes $1,000 from Bank:
  DEBIT:  Owner Draws Account       $1,000
  CREDIT: Bank Account                      $1,000

At Period End (No entry needed):
  - Draws are already in Owner Draws account
  - Balance sheet shows: Capital - Draws = Net Equity
  - OR close draws to capital if preferred accounting

When Owner Contributes $5,000 Back:
  DEBIT:  Bank Account              $5,000
  CREDIT: Owner Draws Account               $5,000
  (Or: CREDIT: Owner's Capital              $5,000)
```

### 8. Current Code Flow (BankTransactions.jsx)

```javascript
// Line ~570 in handleToggleCleared()

if (isOwnerDraw) {
  // Find Owner Draws account
  // Set transaction.category = ownerDrawsAccount.id
  // Update database with this category
  // Skip automatic expense creation ✓
  
  // Then create journal entry:
  // DEBIT: Owner Draws Account
  // CREDIT: Bank Account
}
```

### 9. What's Working Well ✓

1. Detection of owner draws is solid
2. Proper journal entry creation
3. Skips creating expense entry (correct)
4. Tracks in dedicated account (good for reporting)
5. Double-entry is balanced

### 10. What Needs Improvement

1. **No closing mechanism** - Draws stay in account indefinitely
2. **No "payout confirmation"** - No way to mark draws as distributed/settled
3. **No period-end reporting** - Hard to see draws vs. capital relationship
4. **No reversal mechanism** - If owner puts money back, it just creates new transactions

## Recommended Next Steps

1. **Create "Owner Draws" report** showing:
   - Draws by month
   - YTD total
   - Percentage of capital drawn
   - Remaining available draws

2. **Add Period-End Workflow**:
   - Review all draws for the period
   - Approve/mark as distributed
   - Generate closing journal entries if desired

3. **Track draw history** with approval status:
   - "Pending review"
   - "Approved"  
   - "Distributed/Paid back"

4. **Add owner contribution tracking**:
   - When owner contributes funds
   - Automatically increases Owner's Capital
   - Can offset draws for net calculation
