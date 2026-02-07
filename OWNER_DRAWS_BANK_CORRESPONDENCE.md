# Owner Draws & Bank Account Correspondence

## The Key Question: How Do Draws Correspond to Bank Account?

**Short Answer**: When owner takes money, the bank account balance IMMEDIATELY decreases. The settlement entry at period-end does NOT change the bank account - it only reorganizes equity accounts.

## Complete Example: Month by Month

Let's walk through a real scenario with BOTH bank and books side by side.

### STARTING BALANCES (Jan 1)
```
BANK ACCOUNT (physical):
  Opening balance: $10,000

GENERAL LEDGER (chart of accounts):
  Bank Account (1050):      $10,000
  Owner's Capital (3000):  $50,000 (owner's initial investment)
  Owner Draws (3100):          $0
```

---

## JANUARY: Owner Takes $1,000

### STEP 1: Owner Withdraws Cash
```
PHYSICAL BANK (what actually happens):
  Starting balance:        $10,000
  Owner withdraws:         - $1,000
  Ending balance:          $ 9,000
  ↑ THIS IS REAL MONEY LEAVING

IN THE BOOKS (journal entry created):
  DEBIT:  Owner Draws (3100)   $1,000
  CREDIT: Bank Account (1050)          $1,000
  
  This entry MATCHES the physical withdrawal
```

### AFTER JANUARY WITHDRAWAL
```
BANK ACCOUNT (physical reality):
  Balance: $9,000 ← Money is GONE

GENERAL LEDGER (accounting records):
  Bank Account (1050):      $9,000 ✓ MATCHES physical bank
  Owner's Capital (3000):  $50,000
  Owner Draws (3100):      $1,000 ← Shows owner took $1,000
```

---

## FEBRUARY: Owner Takes $1,500

### STEP 1: Owner Withdraws Cash
```
PHYSICAL BANK:
  Starting balance:         $9,000
  Owner withdraws:         -$1,500
  Ending balance:          $7,500
  
JOURNAL ENTRY:
  DEBIT:  Owner Draws (3100)   $1,500
  CREDIT: Bank Account (1050)          $1,500
```

### AFTER FEBRUARY WITHDRAWAL
```
BANK ACCOUNT (physical reality):
  Balance: $7,500 ← More money GONE

GENERAL LEDGER:
  Bank Account (1050):      $7,500 ✓ MATCHES physical bank
  Owner's Capital (3000):  $50,000
  Owner Draws (3100):      $2,500 ← YTD total
```

---

## MARCH: Owner Takes $1,200

### STEP 1: Owner Withdraws Cash
```
PHYSICAL BANK:
  Starting balance:         $7,500
  Owner withdraws:         -$1,200
  Ending balance:          $6,300

JOURNAL ENTRY:
  DEBIT:  Owner Draws (3100)   $1,200
  CREDIT: Bank Account (1050)          $1,200
```

### AFTER MARCH WITHDRAWAL
```
BANK ACCOUNT (physical reality):
  Balance: $6,300 ← All withdrawals accounted for

GENERAL LEDGER:
  Bank Account (1050):      $6,300 ✓ MATCHES physical bank
  Owner's Capital (3000):  $50,000
  Owner Draws (3100):      $3,700 ← Q1 Total taken
```

---

## END OF Q1: Settlement Entry (NO BANK IMPACT)

### STEP 1: Close Owner Draws to Capital
```
IMPORTANT: This is a JOURNAL ENTRY ONLY
          No physical money moves!

JOURNAL ENTRY:
  DEBIT:  Owner Draws (3100)      $3,700
  CREDIT: Owner's Capital (3000)         $3,700

This entry just reorganizes the EQUITY accounts.
It does NOT affect the bank account!
```

### AFTER SETTLEMENT
```
BANK ACCOUNT (physical reality):
  Balance: $6,300 ← UNCHANGED!
  ↑ Owner's withdrawals already happened

GENERAL LEDGER (Option A - With Separate Draws):
  Bank Account (1050):      $6,300
  Owner's Capital (3000):  $50,000
  Owner Draws (3100):      $3,700
  Net Equity: $50,000 - $3,700 = $46,300

GENERAL LEDGER (Option B - Closed Draws):
  Bank Account (1050):      $6,300
  Owner's Capital (3000):  $46,300 ← Now includes the draw deduction
  Owner Draws (3100):           $0 ← Cleared for next period
  Net Equity: $46,300
```

---

## The Correspondence Chart

```
TIMELINE OF EVENTS:

Jan 1:
  Physical Bank:   $10,000  ←→  Books Bank Acct:  $10,000 ✓
                                Books Owner Draws:      $0

Jan 31 (After $1,000 withdrawal):
  Physical Bank:    $9,000  ←→  Books Bank Acct:   $9,000 ✓
                                Books Owner Draws: $1,000

Feb 28 (After $1,500 withdrawal):
  Physical Bank:    $7,500  ←→  Books Bank Acct:   $7,500 ✓
                                Books Owner Draws: $2,500

Mar 31 (After $1,200 withdrawal):
  Physical Bank:    $6,300  ←→  Books Bank Acct:   $6,300 ✓
                                Books Owner Draws: $3,700

Mar 31 (After settlement entry):
  Physical Bank:    $6,300  ←→  Books Bank Acct:   $6,300 ✓
  [UNCHANGED!]               Books Owner Draws:       $0
                             Books Owner Capital: $46,300
```

---

## Why This Matters: Bank Reconciliation

When you reconcile your bank statement:

```
BANK STATEMENT (from your bank):
  Ending balance: $6,300

YOUR RECORDS (General Ledger):
  Bank Account balance: $6,300
  
  RECONCILES? YES! ✓
```

The key insight:
- **EACH WITHDRAWAL** is recorded when owner takes money → Bank account decreases
- **SETTLEMENT ENTRY** is just reorganizing equity → Bank account stays the same

---

## Real-World Scenario: What If Owner Puts Money Back?

If in April, owner contributes $2,000 back:

```
PHYSICAL BANK:
  Starting balance:         $6,300
  Owner deposits:          +$2,000
  Ending balance:          $8,300

JOURNAL ENTRY:
  DEBIT:  Bank Account (1050)       $2,000
  CREDIT: Owner Draws (3100)               $2,000
  OR
  CREDIT: Owner's Capital (3000)          $2,000

GENERAL LEDGER (if contribution):
  Bank Account (1050):      $8,300 ✓ MATCHES physical bank
  Owner's Capital (3000):  $52,000 ← Increased by contribution
  Owner Draws (3100):      $3,700 ← Unchanged, already settled
```

---

## The Complete Picture Summary

```
OWNER DRAWS AFFECT THE BOOKS IN TWO PLACES:

1. IMMEDIATE (when money leaves):
   ├─ Bank Account DECREASES (asset account reduced)
   ├─ Owner Draws INCREASES (equity account increased)
   └─ This happens when transaction is cleared
   └─ This is recorded via journal entry
   └─ This matches the PHYSICAL bank

2. PERIOD-END (settlement only):
   ├─ Owner Draws (3100) DECREASES  ← Closed out
   ├─ Owner's Capital (3000) DECREASES ← Absorbs the draw
   ├─ Bank Account (1050) UNCHANGED ← No physical money moves
   └─ This reorganizes equity only
```

---

## How They Correspond (The Formula)

```
BANK ACCOUNT BALANCE = ALWAYS reflects physical money

OWNER DRAWS = Equity account showing owner's distributions

OWNER CAPITAL = Equity account showing owner's net investment

BALANCE SHEET:
  Assets:
    Bank Account:           $6,300
  
  Liabilities:
    (Assuming none)            $0
  
  Equity:
    Option A (with separate draws):
      Capital:             $50,000
      Draws:               ($3,700)
      Net Equity:          $46,300
    
    Option B (closed draws):
      Capital:             $46,300
      Net Equity:          $46,300
  
  ALWAYS BALANCES:
    Assets ($6,300) = Liabilities ($0) + Equity ($46,300)? NO!
    
    This reveals the issue: We have $6,300 in assets but $46,300+ equity
    The difference is:
      Capital invested: $50,000
      Owner draws:      ($3,700)
      Other assets:     Need to reconcile
```

---

## Key Takeaway

**The settlement entry (closing draws to capital) does NOT change the bank account balance.**

Why? Because the money already left the bank when the original withdrawal transaction was cleared. The settlement entry is purely about reorganizing equity accounts for financial reporting and the next accounting period.

Think of it this way:
- Owner takes $1,000 → Bank goes down $1,000 immediately
- Settle draws at period end → Bank STAYS the same, just equity reorganized

The bank correspondence is:
- **Withdrawals**: Bank account and Owner Draws move together
- **Settlement**: Only equity accounts change, bank stays fixed
