# Moving Deposits to Previous Income When Payment is Received

## Scenario
- Invoice Total: $11,700
- Deposit Received: $4,000 (in Customer Deposits account)
- Final Payment Received: $7,700
- You want final payment to go to "Previous Income" account

---

## Step-by-Step Workflow

### Step 1: Record Initial Deposit
1. Go to **Project Detail** → "+ Add Deposit"
2. Amount: $4,000
3. Bank Account: **Select "Previous Income"** (holding account, not a bank)
4. Click "Record Deposit"

**Journal Entry Created:**
```
Debit:  Previous Income              $4,000
Credit: Unearned Revenue (Liability)        $4,000
```

---

### Step 2: Record Final Payment (When Customer Pays Remaining Balance)

1. Go to **Invoices List** → Find the invoice → Click "💰 Paid" button
2. In the Payment Modal:
   - **Payment Amount:** $7,700
   - **Payment Date:** Today
   - **Payment Method:** Check, Venmo, etc.
   - **Deposit Type:** Select **"Holding Account"** ← IMPORTANT!
   - **Holding Account:** Select **"Previous Income"** ← SAME ACCOUNT
   - Click "Record Payment"

**Journal Entry Created:**
```
Debit:  Previous Income              $7,700
Credit: Accounts Receivable (AR)             $7,700
```

---

### Step 3: Result in Chart of Accounts

After both transactions, your accounts show:

| Account | Debit | Credit | Balance |
|---------|-------|--------|---------|
| **Previous Income** | $4,000 | — | +$4,000 |
| **Previous Income** | $7,700 | — | +$11,700 |
| **Unearned Revenue** | — | $4,000 | -$4,000 |
| **Accounts Receivable** | — | $7,700 | -$7,700 |

**Net Result:** Previous Income has $11,700 (total money "held")

---

## What This Means

✅ **Invoice shows:**
- Total: $11,700
- Paid: $4,000 (deposit) + $7,700 (final) = $11,700
- Balance Due: $0 ✓
- Status: **PAID** ✓

✅ **Chart of Accounts shows:**
- Money is held in "Previous Income" instead of scattered across bank accounts
- Unearned Revenue shows $0 after invoice completion
- When you move money from "Previous Income" to actual bank, create transfer entry

---

## Next: Transfer to Actual Bank Account

When you actually deposit the $11,700 into your bank account, create this journal entry:

**In Chart of Accounts or General Journal:**
```
Debit:  First National Bank Checking  $11,700
Credit: Previous Income                       $11,700
```

This moves money from temporary "Previous Income" holding to your actual bank account.

---

## Key Points

1. **Use "Previous Income" for BOTH deposit and final payment** - same account, keeps them together
2. **Select "Holding Account" in Payment Modal** - not bank account
3. **Invoice shows fully paid** - balance goes to $0
4. **Money is "held" in Previous Income** - until you transfer to real bank
5. **Easy to track** - all money for this invoice is in one place

---

## Visual Flow

```
Deposit $4,000 received
         ↓
    Previous Income ($4,000)
         ↓
    Unearned Revenue ($4,000) LIABILITY
         ↓
Invoice created & sent
         ↓
Final Payment $7,700 received
         ↓
    Previous Income ($4,000 + $7,700 = $11,700)
         ↓
    AR paid off ($0)
         ↓
    Unearned Revenue cleared ($0)
         ↓
Transfer to bank when ready
```

---

## Summary

✅ Both deposit ($4,000) and final payment ($7,700) go to **Previous Income**
✅ Invoice shows PAID with balance $0
✅ All money tracked in one holding account
✅ Move to real bank when convenient
