# Unlinked Transaction Auto-Posting Feature

## Overview
When you **clear a bank transaction that is NOT linked to an invoice or expense**, the system automatically creates a journal entry to record it in both the **Chart of Accounts (Book)** and the **Bank Account (Actual)**.

## How It Works

### When You Clear an Unlinked Transaction:
1. **Check if transaction is linked** - if it's linked to an invoice/expense, skip auto-posting (it's already recorded)
2. **Create journal entry** with two lines:
   - **Line 1 (Bank Account)**: Records the transaction in your bank account
     - **Deposit**: Debit Bank Account
     - **Withdrawal**: Credit Bank Account
   - **Line 2 (Offset Account)**: Records the opposite entry
     - **For Deposits**: Credit Income Account (or category selected)
     - **For Withdrawals**: Debit Expense Account (or category selected)

### Example:
**Scenario**: You receive a $1,000 deposit and clear it without linking it to an invoice

**Journal Entry Created**:
```
Bank Account (1010)         Debit: $1,000
Service Revenue (4000)                    Credit: $1,000
```

This updates:
- **Chart of Accounts**: Both accounts show the transaction
- **Bank Account Balance**: Automatically recalculated to include the cleared amount

## Requirements

### Before clearing an unlinked transaction:
1. **Bank account must be linked to Chart of Accounts**
   - Go to Bank Accounts → Click settings on your bank account
   - Make sure it's linked to a bank account in your Chart of Accounts

2. **Must have at least one:**
   - **Income Account** (for deposits)
   - **Expense Account** (for withdrawals)

3. **Recommended**: **Assign a category** to the transaction
   - If no category is assigned, system will auto-select first available Income/Expense account
   - It's better to be specific about where money came from or went to

## User Experience

### When Clearing a Transaction:
1. ✅ **Checkmark** the "is_cleared" checkbox
2. System checks if it's linked:
   - ✅ **Linked**: Just marks as cleared (no journal entry needed - already recorded)
   - ⬜ **Unlinked**: Creates journal entry AND marks as cleared

3. ✅ Success alert shows:
   - What offset account was used
   - Bank account was updated
   - Confirmation that both book and actual accounts are updated

## Workflow Comparison

### Linked Transaction (e.g., Invoice Payment):
```
Clear Transaction → Mark as Paid → Journal Entry (AR → Bank) → Both accounts updated
```

### Unlinked Transaction:
```
Clear Transaction → Create Journal Entry (Bank ↔ Category) → Both accounts updated
```

## Troubleshooting

### Error: "Bank account is not linked to Chart of Accounts"
- **Solution**: Go to Bank Accounts settings and link it to a Chart account

### Error: "No Expense/Income account found"
- **Solution**: Create at least one Expense and one Income account in Chart of Accounts

### Error: "Journal entry created but posting failed"
- **What happened**: Entry created but couldn't post to balances
- **Solution**: The entry exists, you can manually post it from Journal Entries page
- **Note**: This is rare and usually auto-recovers on next load

## Features

✅ Automatic journal entry creation
✅ Handles both deposits and withdrawals
✅ Respects transaction categories if assigned
✅ Fallback to Income/Expense if no category
✅ Robust error handling with helpful messages
✅ Works with custom project tracking
✅ Supports clearing/unclearing with automatic reversals
✅ Prevents duplicate entries (checks before creating)

## Database Fields Used

- `bank_transactions.is_cleared` - marks transaction as cleared
- `bank_transactions.linked_invoice_id` - if linked to invoice (skips auto-post)
- `bank_transactions.linked_expense_id` - if linked to expense (skips auto-post)
- `journal_entries` - stores the auto-created entries
- `journal_entry_lines` - stores the debit/credit lines
- `accounts` - Chart of Accounts for offsetting transactions

## Implementation Details

**File**: `src/pages/BankTransactions.jsx`
**Function**: `handleToggleCleared()` - lines 620-870
**Key Logic**: 
- Checks `linked_invoice_id` and `linked_expense_id` to determine if auto-post needed
- Creates entry with `reference_type: 'bank_transaction'`
- Attempts RPC posting, falls back to manual flag if needed
- Provides detailed console logging for debugging

## Future Enhancements

Possible improvements:
- Allow batch clearing of multiple transactions
- Customizable default offset accounts per transaction type
- Scheduled auto-posting for pending transactions
- Reconciliation reports showing posted vs unposted
