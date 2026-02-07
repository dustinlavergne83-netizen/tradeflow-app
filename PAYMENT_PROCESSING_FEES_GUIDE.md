# Payment Processing Fees - Setup and Usage Guide

## Overview

This feature solves the problem of matching bank deposits to invoices when payment processing services (Venmo, PayPal, Stripe, etc.) deduct fees from the transfer amount.

### The Problem

When you receive a $1,000 payment through Venmo/PayPal:
- **Invoice amount:** $1,000.00
- **Processing fee:** $29.00 (2.9%)
- **Bank deposit:** $971.00

Previously, the system couldn't match the $971 bank deposit to the $1,000 invoice because the amounts didn't match.

### The Solution

The system now tracks:
1. **Payment Amount** - The full amount the customer paid ($1,000)
2. **Processing Fee** - The fee charged by the processor ($29)
3. **Net Deposit Amount** - The actual amount deposited to your bank ($971)

This allows proper matching and creates accurate accounting entries.

## How to Use

### Step 1: Record Payment with Processing Fee

1. Go to **Invoices** page
2. Find the invoice that was paid
3. Click the **💰 Paid** button
4. Fill in the payment form:
   - **Payment Amount:** Enter the full amount the customer paid (e.g., $1,000)
   - **Payment Date:** Date the customer made the payment
   - **Payment Method:** Select `Venmo`, `PayPal`, or other method
   - **Processing Fee:** Enter the fee charged (e.g., $29.00)
   - **Bank Account:** Select where the money will be deposited
   - **Notes:** Optional notes

5. The system automatically calculates and displays the **Net Deposit** amount

6. Click **💰 Record Payment**

### Step 2: Link to Bank Transaction & Clear

When the deposit appears in your bank account:

**Option A: Automatic Matching (Recommended)**

1. Go to **Bank Transactions** page for your bank account
2. Find the deposit transaction (e.g., $971.00 from Venmo)
3. Look at the **🔗 column** - you'll see:
   - **✅ Green checkmark** = Potential matches found
   - **❌ Red X** = No matches found
   - **🔗 Link icon** = Already linked

4. Click the **✅** icon to open the matches modal
5. You'll see the matching invoice listed with:
   - Invoice number
   - Customer name  
   - Amount ($1,000 full invoice or $971 net deposit)
   
6. Click the **🔗 Link** button next to the correct invoice
7. Click the **⬜ checkbox** in the first column to mark the transaction as cleared ✅
8. Done! The transaction is now linked and cleared

**Option B: Manual Linking (If No Auto-Match)**

If the system doesn't auto-detect a match:

1. Go to **Bank Transactions** page
2. Find your deposit transaction
3. Click the **❌** icon (even though it shows no matches)
4. In the modal, scroll down to see all recent invoices
5. Find the correct invoice manually
6. Click **🔗 Link** next to it
7. Check the **⬜ checkbox** to clear the transaction

### Step 3: Verify (Optional)

1. Go back to **Invoices** page
2. Your invoice should now show a **🔗** link icon in the "Linked" column
3. The payment status should be **PAID** (green badge)

## Accounting Treatment

### When Recording Payment with Fee:

**Journal Entry Created:**
```
Debit:  Bank Account             $971.00  (Net deposit)
Debit:  Payment Processing Fees   $29.00  (Expense)
Credit: Accounts Receivable    $1,000.00  (Full payment)
```

### Chart of Accounts

The system automatically creates (if needed):
- **Account 6500**: Payment Processing Fees (Expense account)

### Financial Impact

- **Bank Account** increases by the net amount actually deposited
- **Payment Processing Fees** records the cost of accepting the payment
- **Accounts Receivable** decreases by the full invoice amount
- **Profit** is reduced by the processing fee expense

## Common Processing Fees

| Service | Typical Fee |
|---------|------------|
| Venmo (Business) | 1.9% + $0.10 |
| PayPal (Standard) | 2.9% + $0.30 |
| PayPal (Invoice) | 3.49% + $0.49 |
| Stripe | 2.9% + $0.30 |
| Square | 2.6% + $0.10 |
| Zelle | Free (typically) |

## Best Practices

### 1. Enter Fees Promptly
Record the processing fee when you record the payment so matching works correctly.

### 2. Check Processor Statements
Verify fees match your processor's statements:
- Venmo: Business profile → Transaction history
- PayPal: Reports → Transaction history
- Stripe: Dashboard → Payments

### 3. Leave Fee Blank for No-Fee Methods
For payments via:
- Check
- Cash
- Wire transfer (sometimes)
- Zelle

Leave the Processing Fee field empty or enter $0.00.

### 4. Partial Payments with Fees
If receiving partial payments with fees, enter the fee for each partial payment:
- **First payment:** $500 - $14.50 fee = $485.50 deposit
- **Second payment:** $500 - $14.50 fee = $485.50 deposit
- **Total paid:** $1,000 with $29 in fees = $971 net deposit

## Troubleshooting

### Bank Transaction Won't Match Invoice

**Problem:** The deposit amount doesn't match any invoice.

**Solution:**
1. Check if you recorded the processing fee when recording payment
2. Verify the fee amount matches what was actually charged
3. Look at the invoice - does it show a `net_deposit_amount`?
4. If not, edit the payment and add the processing fee

### Fee Account Not Found

**Problem:** Error about Payment Processing Fees account.

**Solution:**
The system should auto-create this account. If it doesn't:
1. Go to **Chart of Accounts**
2. Create new account:
   - **Account Number:** 6500
   - **Account Name:** Payment Processing Fees
   - **Account Type:** Expense
   - **Description:** Fees charged by payment processors

### Wrong Fee Amount

**Problem:** Entered wrong processing fee.

**Solution:**
1. Go to **Invoices** page
2. Find the invoice
3. Click **💰 Paid** button again
4. Re-enter the correct fee amount
5. The system will update the journal entries

## Database Schema

New fields added to `invoices` table:

```sql
processing_fee DECIMAL(12,2) DEFAULT 0
net_deposit_amount DECIMAL(12,2)
```

## Migration

To apply this feature to your database:

```bash
# Run the migration
psql -h your-db-host -U your-user -d your-database -f supabase/migrations/074_add_payment_processing_fees.sql
```

Or via Supabase CLI:
```bash
supabase db push
```

## Example Scenarios

### Scenario 1: Venmo Payment with Fee

**Invoice:** #2024-001 for $1,500.00

**Customer pays via Venmo:**
- Payment Amount: $1,500.00
- Venmo Fee (1.9% + $0.10): $28.60
- Net Deposit: $1,471.40

**In System:**
1. Record payment: $1,500 - $28.60 fee
2. Bank shows deposit: $1,471.40
3. System matches automatically ✓

### Scenario 2: PayPal Invoice Payment

**Invoice:** #2024-002 for $750.00

**Customer pays via PayPal Invoice:**
- Payment Amount: $750.00
- PayPal Fee (3.49% + $0.49): $26.67
- Net Deposit: $723.33

**In System:**
1. Record payment: $750 - $26.67 fee
2. Bank shows deposit: $723.33
3. System matches automatically ✓

### Scenario 3: Check Payment (No Fee)

**Invoice:** #2024-003 for $2,000.00

**Customer pays by check:**
- Payment Amount: $2,000.00
- Processing Fee: $0.00
- Net Deposit: $2,000.00

**In System:**
1. Record payment: $2,000 - no fee
2. Bank shows deposit: $2,000.00
3. System matches automatically ✓

## Reporting

### View Processing Fees

To see total processing fees:

1. **General Ledger** → Filter by Account 6500
2. **Profit & Loss Report** → See "Payment Processing Fees" line item
3. **Invoices List** → Shows processing fees on each invoice

### Calculate Fee Percentage

```
Fee % = (Processing Fee ÷ Payment Amount) × 100
```

Example:
```
$29 ÷ $1,000 × 100 = 2.9%
```

## Support

If you encounter issues:

1. Check this guide for troubleshooting steps
2. Verify the database migration was applied
3. Check browser console for error messages
4. Ensure bank accounts are linked to Chart of Accounts

## Version History

- **v1.0** (January 2026): Initial implementation
  - Added processing_fee and net_deposit_amount fields
  - Updated payment modal UI
  - Created automatic journal entries
  - Enhanced bank transaction matching
