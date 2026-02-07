# Lowes Credit Card Account (2110) Setup Guide

## Problem Summary

You want to set up a **Lowes Credit Card** account with:
- **Account Number**: 2110
- **Opening Balance**: -$6,311.57 (negative = amount owed to Lowes)
- **Issue**: When clearing a payment, the negative balance should DECREASE (get smaller), not increase (get more negative)

## Root Cause

The account needs to be properly configured as a **LIABILITY** account. In accounting:

**ASSET Accounts** (Bank, Cash):
- Normal Balance = **DEBIT** (positive)
- Increased by: DEBIT
- Decreased by: CREDIT

**LIABILITY Accounts** (Credit Cards, Loans Payable):
- Normal Balance = **CREDIT** (negative when shown)
- Increased by: CREDIT
- Decreased by: DEBIT

When you make a **payment** on a credit card:
1. **Bank account** (Asset): DEBIT (reduces cash/bank)
2. **Lowes account** (Liability): DEBIT (reduces what you owe)

### Current State vs. Correct State

**Before Setup:**
- Account 2110 doesn't exist in Chart of Accounts

**After Setup (Correct):**
- Account Number: 2110
- Account Name: Lowes Credit Card
- Account Type: **Liability** ← CRITICAL
- Normal Balance: **credit** ← CRITICAL
- Opening Balance: -$6,311.57

## Solution: Complete Setup Steps

### Step 1: Create the Account in Chart of Accounts

You can create the account manually in the UI:

1. Go to **Chart of Accounts**
2. Click **+ New Account**
3. Fill in:
   - **Account Number**: 2110
   - **Account Name**: Lowes Credit Card
   - **Account Type**: Liability ← MUST BE LIABILITY
   - **Normal Balance**: credit ← MUST BE CREDIT
   - **Opening Balance**: -6311.57 (negative)
4. Click **Save**

### Step 2: Clear/Reconcile Transactions

Once the account is created properly:

1. Go to **Bank Transactions** 
2. For each payment made to Lowes:
   - Make sure the transaction amount is correct
   - Select the **Lowes Credit Card (2110)** as the category
   - Mark the transaction as **Cleared**
3. The journal entry will automatically be created with correct debit/credit logic

### Step 3: Verify the Math

**Opening Balance**: -$6,311.57 (you owe $6,311.57)

**Payment of $500** (withdrawal from bank):
- Journal Entry:
  - Debit: Bank Account = -$500 (reduces cash)
  - Debit: Lowes Card = -$500 (reduces liability)
- New Lowes Balance: -$6,311.57 - (-$500) = -$6,311.57 + $500 = **-$5,811.57** ✓

## How the System Works

### Journal Entry Logic (from BankTransactions.jsx)

When you **clear a bank transaction**, the system creates a journal entry:

```
For LIABILITY accounts (normal_balance = 'credit'):
- Withdrawal (negative amount) → DEBIT offset account (reduce liability)
- Deposit (positive amount) → CREDIT offset account (increase liability)

For ASSET accounts (normal_balance = 'debit'):
- Withdrawal (negative amount) → CREDIT offset account (reduce asset)
- Deposit (positive amount) → DEBIT offset account (increase asset)
```

The system automatically handles the correct debit/credit application based on:
1. Account type (Asset vs. Liability)
2. Transaction direction (Deposit vs. Withdrawal)
3. Normal balance setting

## What NOT to Do

❌ **Don't** set the account type to "Credit Card" or "Expense"
- Only use: Asset, Liability, Income, Expense, Equity

❌ **Don't** set normal_balance to "debit" for a credit card
- Credit cards are liabilities, which should be "credit"

❌ **Don't** set the opening balance to positive
- Credit card balances are negative (you owe money)

## Testing

Once set up, test with a small payment:

1. **Opening Balance**: -$6,311.57
2. **Payment to Lowes**: $100 (withdrawal from bank)
3. **Clear the transaction**
4. **Check Chart of Accounts**: Balance should show **-$6,211.57**

If it shows -$6,411.57, then the account type is wrong.

## Troubleshooting

**Q: The negative is getting MORE negative instead of smaller?**
A: The account type or normal_balance is configured wrong. Check:
   - account_type = 'Liability'
   - normal_balance = 'credit'

**Q: How do I fix an existing account with wrong settings?**
A: Go to Chart of Accounts, edit account 2110:
   1. Change account_type to "Liability"
   2. Change normal_balance to "credit"
   3. Save
   4. UNCLEAR any transactions with incorrect journal entries
   5. RE-CLEAR them so new entries are created with correct logic

**Q: I deleted the wrong transactions?**
A: Check the General Ledger to see all journal entries and manually fix as needed.

## Account Type Quick Reference

| Type | Normal Balance | Used For | Example |
|------|---|---|---|
| Asset | Debit | Money you own | Bank, Cash, Equipment |
| Liability | Credit | Money you owe | Credit Card, Loan, Accounts Payable |
| Income | Credit | Money earned | Sales, Services Revenue |
| Expense | Debit | Money spent | Utilities, Office Supplies |
| Equity | Credit | Owner's stake | Owner's Equity, Retained Earnings |

---

## Quick Setup Script

Run this script to verify your account setup:

```bash
node verify-lowes-setup.js
```

Or manually check in Chart of Accounts:
- Account 2110 exists
- Type = Liability
- Normal Balance = credit
- Balance = -$6,311.57
