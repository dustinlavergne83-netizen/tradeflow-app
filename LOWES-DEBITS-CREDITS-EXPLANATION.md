# Lowes Credit Card (2110) - Debits & Credits Verification

## For a LIABILITY Account (Credit Card), Here's What's CORRECT:

### Account Setup
- **Account Type**: Liability ✓
- **Normal Balance**: Credit ✓
- **Displayed as**: Negative (e.g., -$6,311.57) ✓

---

## Journal Entry Rules for Lowes (LIABILITY)

| Action | Account Entry | Debit | Credit | Effect |
|--------|---------------|-------|--------|--------|
| Opening Balance | Lowes Credit Card | - | $6,311.57 | INCREASES liability (owes more) ✓ |
| Payment Made | Lowes Credit Card | $411.57 | - | DECREASES liability (owes less) ✓ |
| Payment Made | Lowes Credit Card | $250.00 | - | DECREASES liability (owes less) ✓ |

---

## Balance Calculation for Lowes

**Formula:** `TOTAL CREDITS - TOTAL DEBITS`

### Example:
- Total Credits: $6,311.57 (opening balance)
- Total Debits: $661.57 (two payments: $411.57 + $250.00)
- **Balance**: $6,311.57 - $661.57 = $5,650.00
- **Shown as**: **-$5,650.00** (negative, because it's a liability)

---

## How to Verify Your Lowes Account

Run this SQL query in Supabase and check:

```sql
SELECT 
  account_number,
  account_type,
  normal_balance,
  SUM(CASE WHEN debit > 0 THEN debit ELSE 0 END) as total_debits,
  SUM(CASE WHEN credit > 0 THEN credit ELSE 0 END) as total_credits,
  SUM(CASE WHEN credit > 0 THEN credit ELSE 0 END) - 
  SUM(CASE WHEN debit > 0 THEN debit ELSE 0 END) as balance_shown_as_negative
FROM journal_entry_lines jel
JOIN accounts a ON jel.account_id = a.id
WHERE a.account_number = '2110'
GROUP BY account_number, account_type, normal_balance;
```

---

## Expected Results for YOUR Lowes Account

✅ **Correct debits/credits means:**
1. Opening balance entry shows **CREDIT** (not debit)
2. All payment entries show **DEBIT** (not credit)
3. Balance = Credits - Debits = Shown as negative
4. When you make a payment, debits increase, balance becomes less negative ✓

❌ **WRONG debits/credits would be:**
- Opening balance showing as DEBIT (backward!)
- Payments showing as CREDIT (backward!)
- Balance showing positive (wrong for a liability)

---

## Summary

For your Lowes Credit Card account:
- **Are debits correct?** ✓ YES - if payments are DEBITS
- **Are credits correct?** ✓ YES - if opening balance is CREDIT
- **Is the balance shown negative?** ✓ YES - that's correct for a liability

Run the verification SQL above to confirm!
