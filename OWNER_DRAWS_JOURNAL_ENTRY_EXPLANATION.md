# Owner Draws - Journal Entry Explanation

## Your Question: Should Clearing Create a Journal Entry?

**Answer: YES - And it should already be doing this! Here's how it works:**

---

## What Happens When You Clear an Owner Draw

When you clear an owner draw transaction in the bank reconciliation:

### The System Creates a Journal Entry:

```javascript
DEBIT:   Owner Draws Account (3100)    $1,000
CREDIT:  Bank Account (1050)                    $1,000
```

**This journal entry is what REDUCES the bank account in the books.**

---

## How This Matches the Physical Bank

### Physical Bank (Real Money):
```
Starting balance:  $10,000
Owner withdraws:  -$1,000
Ending balance:   $9,000  ← Real cash is gone
```

### Books (General Ledger):
```
Bank Account (1050) starts:     $10,000
Journal Entry created:
  Credit Bank Account:          -$1,000  ← Reduces books balance
Bank Account (1050) ends:       $9,000   ✓ MATCHES physical bank
```

---

## Is It an "Expense"?

**NO - Owner Draws are NOT expenses.**

Here's the difference:

### EXPENSE Record:
```
When you write a check to Office Depot for supplies:

Journal Entry:
  DEBIT:  Office Supplies Expense (5100)    $500
  CREDIT: Bank Account (1050)                       $500
  
This REDUCES bank AND INCREASES an expense (reducing net income)
```

### OWNER DRAW:
```
When owner withdraws cash:

Journal Entry:
  DEBIT:  Owner Draws (3100)           $1,000
  CREDIT: Bank Account (1050)                  $1,000
  
This REDUCES bank BUT INCREASES equity (not an expense)
Owner Draws is an EQUITY account (balance sheet), not an EXPENSE account (income statement)
```

---

## Why Owner Draws Are Different From Expenses

```
EXPENSE (Operating):
  Reduces: Bank account (asset)
  Increases: Expense account (reduces profit)
  Effect: Lowers net income, affects profit/loss
  Example: $500 office supplies expense reduces profits by $500

OWNER DRAW (Distribution of Profits):
  Reduces: Bank account (asset)
  Increases: Owner Draws (equity contra account)
  Effect: NO impact on profit/loss (already earned)
  Meaning: Owner taking out cash that profits already generated
  Example: Owner withdraws $1,000 that they already earned
```

---

## The Complete Flow (What Your System Does)

### Step 1: Bank Transaction Imported
```
Bank statement shows:
  Date: Jan 15, 2026
  Description: ATM Withdrawal
  Amount: -$1,000
  
System creates bank_transactions record:
  transaction_date: 2026-01-15
  amount: -1000
  description: ATM Withdrawal (or "Owner Draw" if you categorize it)
  is_cleared: false (initially)
```

### Step 2: You Identify It as Owner Draw
```
In Bank Transactions page:
  - You enter: "Owner Draw" in description OR category
  - System detects owner draw pattern
  - Marks as: Owner Draw category (Account 3100)
```

### Step 3: You Click "Clear" Transaction
```
System automatically creates:

Journal Entry:
  Entry #JE-2026-00001
  DEBIT:   Owner Draws (3100)    $1,000
  CREDIT:  Bank Account (1050)           $1,000
  
This journal entry REDUCES the bank account in the books!
```

### Step 4: Books Now Match Bank
```
BEFORE CLEAR:
  Bank Books: $10,000
  Physical Bank: $10,000
  Owner Draws: $0

AFTER CLEAR:
  Bank Books: $9,000  ← REDUCED by journal entry
  Physical Bank: $9,000  ← Same as bank statement
  Owner Draws: $1,000  ← Tracks what owner took
  
  ✓ CORRESPONDENCE ACHIEVED
```

---

## How It Should Work Currently

Your system in `BankTransactions.jsx` should already do this:

```javascript
// When clearing an owner draw transaction:
if (isOwnerDraw && newClearedStatus) {
  // Create journal entry
  const journalEntry = {
    DEBIT: ownerDrawsAccountId, $1,000
    CREDIT: bankAccountId,           $1,000
  };
  
  // This credit to bank account reduces it in the books
  // Matching the physical bank withdrawal
}
```

---

## If Your System Isn't Creating the Journal Entry

You might need to check:

1. **Is the journal entry being created?**
   - Check General Ledger page
   - Look for entries on the day you cleared the draw
   - Search for "Owner Draw" or reference transaction ID

2. **Is the bank account balance updating?**
   - Bank Account (1050) should decrease
   - Should match your physical bank statement
   - If not, the journal entry might not be posting

3. **Is the owner draw being detected correctly?**
   - Check BankTransactions.jsx detection logic
   - Must match: description, payee, or category
   - Currently looks for: "owner draw", "owner withdrawal", "dustin lavergne", or Owner Draws category

---

## Why This Is Better Than Creating an Expense

```
Creating Expense (WRONG):
  DB: Office Supplies Expense  $1,000
  CR: Bank Account                    $1,000
  
  Result: Bank is down ✓
  Problem: Expense account shows $1,000 office supply cost ✗
  Problem: Makes net income look worse (owner draw isn't a business expense)

Creating Owner Draw Entry (CORRECT):
  DB: Owner Draws              $1,000
  CR: Bank Account                    $1,000
  
  Result: Bank is down ✓
  Benefit: Equity account shows $1,000 owner withdrawal ✓
  Benefit: Net income unchanged (owner drew from already-earned profits) ✓
  Benefit: Financial statements are correct (no false expense) ✓
```

---

## Summary

**When you clear an owner draw:**
1. ✓ Journal entry SHOULD be created
2. ✓ Journal entry DOES reduce bank account in the books
3. ✓ This matches the physical bank withdrawal
4. ✓ Owner Draws equity account INCREASES (tracks distributions)
5. ✓ No expense is created (owner draws aren't expenses)
6. ✓ Net income is unaffected (draws are from already-earned profits)

**The correspondence is maintained by the journal entry credit to the bank account, which reduces the books balance to match the physical withdrawal.**

If this isn't happening, check that:
- Owner draw is being detected correctly
- Journal entry creation is being triggered on clear
- Journal entry is actually posting to General Ledger
