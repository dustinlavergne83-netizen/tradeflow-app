# Customer Deposit Account Setup Guide

## Quick Answer
**Customer Deposits account should be a CREDIT account** (Liability account type)

---

## Account Setup Requirements

### ✅ Correct Setup (for Unearned Revenue / Customer Deposits):

| Property | Value |
|----------|-------|
| **Account Type** | Liability |
| **Account Name** | "Unearned Revenue" OR "Customer Deposits" OR "Deferred Revenue" |
| **Normal Balance** | CREDIT |
| **Account Number** | 2100-2999 (typical range for liabilities) |

---

## Why CREDIT Normal Balance?

### Accounting Rule:
- **Liability accounts** have a normal balance of **CREDIT**
- **Debit** decreases liabilities
- **Credit** increases liabilities

### Example: $4,000 Deposit Received

**Entry:**
```
Debit:  Bank Account           $4,000
Credit: Unearned Revenue       $4,000
```

**Result:**
- Bank Account balance: +$4,000 ✓
- Unearned Revenue balance: +$4,000 Credit ✓ (liability)

---

## When Work is Completed (Invoice Sent)

**Entry:**
```
Debit:  Unearned Revenue       $4,000
Credit: Service Revenue        $4,000
```

**Result:**
- Unearned Revenue: -$4,000 (converted to revenue)
- Service Revenue: +$4,000 (earned)

---

## Common Mistake ❌

If Unearned Revenue is set as a DEBIT account:
- Bank: +$4,000 ✓
- Unearned Revenue: -$4,000 (shows as a NEGATIVE, which is wrong!)

---

## Where Does the Deposit Money Go?

When you record a deposit in the system:

### 1. **The Bank Account** (Debit)
- Select your actual **Bank Account** (Checking, Savings, etc.)
- The deposit money goes HERE
- Example: "Checking - First National Bank"

### 2. **Unearned Revenue** (Credit)
- The system automatically credits "Unearned Revenue" or "Customer Deposits"
- This shows you owe the customer that amount of work

### In ProjectDetail.jsx:
When you click "+ Add Deposit", you'll see:
```
Deposit Amount: $4,000
Bank Account: [Select your checking account] ← Click here
```

**The journal entry created:**
```
Debit:  First National Bank (Checking)  $4,000
Credit: Unearned Revenue               $4,000
```

---

## How to Verify in Your Chart of Accounts

1. Go to **Chart of Accounts** page
2. Find "Unearned Revenue", "Customer Deposits", or "Deferred Revenue"
3. Check that:
   - **Account Type** = "Liability" ✓
   - **Normal Balance** = "Credit" ✓

If not correct, edit the account and fix these values!

---

## What if the Bank Account is Closed?

**Use a Holding Account instead!**

If the bank account the deposit was deposited into is now closed:

1. **Option A: Create a Holding Account**
   - Go to **Chart of Accounts** → Add New Account
   - Name: "Undeposited Funds" or "Deposits in Transit"
   - Account Type: **Asset** (this is a temporary holding place)
   - Normal Balance: **Debit**
   - Account Number: 1050 (between checking and other assets)

2. **Option B: Use an Existing Holding Account**
   - Use "Previous Income" or similar account
   - Must be an Asset or Liability account
   - Not an Income or Expense account

3. **How to Record the Deposit:**
   - Click **"+ Add Deposit"** button
   - Enter: Deposit Amount ($4,000)
   - Enter: Deposit Date
   - **Select: Holding Account (Previous Income)** ← Not the closed bank!
   - Optional: Reference Notes (check #, which bank, etc.)
   - Click **"Record Deposit"**

**Journal Entry Created:**
```
Debit:  Undeposited Funds / Previous Income  $4,000
Credit: Unearned Revenue                             $4,000
```

**Later When Money is Moved:**
- Transfer from holding account to new active bank account
- Create journal entry:
  ```
  Debit:  New Active Bank Account     $4,000
  Credit: Undeposited Funds                   $4,000
  ```

---

## Quick Steps to Record a Deposit

1. **In Project Detail page:**
   - Click **"+ Add Deposit"** button
   - Enter: Deposit Amount ($4,000)
   - Enter: Deposit Date (today)
   - **Select: Bank Account** (your ACTIVE checking/savings account)
     - OR select **Holding Account** if using closed/temporary account
   - Optional: Reference Notes (check #, wire transfer, etc.)
   - Click **"Record Deposit"**

2. **What Happens:**
   - ✅ Deposit recorded to project
   - ✅ Selected account balance updated
   - ✅ Unearned Revenue liability created
   - ✅ Journal entry posted to Chart of Accounts

3. **On Invoice List:**
   - Invoice now shows "PARTIAL PAID" status
   - Balance reduces by deposit amount
   - Ready to apply to invoices

---

## Summary

When you see your deposit showing as a **positive balance on Unearned Revenue**, that's correct! It means:
- You owe the customer that much work (it's a LIABILITY)
- The money is in your bank account (selected when recording)
- Once you complete the work and invoice them, the balance converts to revenue

This is proper double-entry bookkeeping! ✓
