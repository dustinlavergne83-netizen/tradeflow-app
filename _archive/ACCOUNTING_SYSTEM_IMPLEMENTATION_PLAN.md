# Full Accounting System Implementation Plan
## QuickBooks Replacement for TradeFlow

**Status: Phase 5 Complete - Phase 6 Next**  
**Last Updated: January 1, 2026, 5:40 PM**

---

## Overview
This document tracks the implementation of a complete double-entry accounting system to replace QuickBooks. The system will include Chart of Accounts, Bank Reconciliation, General Ledger, Journal Entries, and comprehensive financial reporting.

---

## Implementation Phases

### ✅ Phase 0: Foundation (COMPLETED)
**Status: DONE**
- [x] Basic Accounting Dashboard created (`src/pages/AccountingDashboard.jsx`)
- [x] Routes added to App.jsx (`/accounting`)
- [x] Navigation updated in Home.jsx and DesktopHeader.jsx
- [x] Current features: Revenue tracking, Expense tracking, Profit calculations
- [x] Integration with existing Invoices and Expenses tables

**What's Working:**
- Dashboard shows Year-to-Date, Monthly, Quarterly financial summaries
- Integration with existing `invoices` and `expenses` tables
- Monthly profit trends and expense category breakdowns
- Quick access to recent invoices and expenses

---

### ✅ Phase 1: Chart of Accounts (COMPLETED)
**Status: DONE**
**Time Spent: ~1 hour**

#### Database Setup
- [x] Create `accounts` table in Supabase
  - Fields: id, company_id, account_number, account_name, account_type, parent_account_id, is_active, balance, created_at, updated_at
  - Account types: Asset, Liability, Equity, Income, Expense
  - Sub-types: Current Asset, Fixed Asset, Current Liability, etc.

#### Frontend Components
- [x] Create `src/pages/ChartOfAccounts.jsx`
  - Display all accounts grouped by type
  - Filter by account type
  - Search functionality
  - Add/Edit/Archive accounts
  - Show account balances
  - Color coding by type
  - One-click initialization with default accounts

- [x] Add route `/accounting/chart-of-accounts` to App.jsx
- [x] Update DesktopHeader.jsx title mapping

#### Default Accounts Setup
- [x] Create migration script with default accounts:
  - **ASSETS**: Cash, Checking, Savings, A/R, Inventory, Equipment, Vehicles, Tools, Depreciation
  - **LIABILITIES**: A/P, Credit Cards, Sales Tax, Payroll Liabilities, Notes Payable, Loans
  - **EQUITY**: Owner's Equity, Retained Earnings, Owner Draws
  - **INCOME**: Service Revenue, Material Sales, Labor Revenue, Other Income
  - **EXPENSES**: COGS, Materials, Subcontractors, Labor, Payroll, Rent, Utilities, Insurance, Vehicle, Fuel, Office, Equipment Rental, Tools, Permits, Marketing, Professional Fees, Bank Fees, Depreciation, Repairs, Telephone, Interest, Misc

#### Files Created/Modified:
- ✅ `supabase/migrations/024_create_accounts_table.sql`
- ✅ `src/pages/ChartOfAccounts.jsx`
- ✅ `src/App.jsx` (added route)
- ✅ `src/Components/DesktopHeader.jsx` (added title mapping)

---

### ✅ Phase 2: General Ledger & Journal Entries (COMPLETED)
**Status: DONE**
**Time Spent: ~1 hour**

#### Database Setup
- [x] Create `journal_entries` table
  - Fields: id, company_id, entry_number, entry_date, description, is_posted, posted_at, posted_by, created_by, created_at, updated_at
  - Auto-generates entry numbers (JE-2026-00001)
  
- [x] Create `journal_entry_lines` table
  - Fields: id, entry_id, line_number, account_id, debit, credit, description
  - Constraint: Each line must have EITHER debit OR credit (not both)
  - Reference types: invoice, expense, payment, manual, etc.

- [x] Helper Functions Created:
  - `validate_journal_entry_balance()` - ensures debits = credits
  - `post_journal_entry()` - posts entry and updates account balances automatically
  - `get_next_journal_entry_number()` - generates sequential numbers (JE-YYYY-00001)

#### Frontend Components
- [x] Create `src/pages/GeneralLedger.jsx`
  - View all journal entries in table format
  - Filter by posted/draft status
  - Search by entry number or description
  - Shows total debits and credits for each entry
  - Edit draft entries, view posted entries
  - Delete draft entries (cannot delete posted)
  
- [x] Create `src/pages/JournalEntry.jsx`
  - Create/edit manual journal entries
  - Multiple debit/credit lines
  - Real-time balance validation (debits must equal credits)
  - Visual indicator: ✅ BALANCED or difference amount
  - Save as draft OR post immediately
  - Auto-generates entry numbers
  - Posted entries cannot be edited (accounting best practice)
  - Prevents posting unbalanced entries

- [x] Add routes to App.jsx
  - `/accounting/general-ledger`
  - `/accounting/journal-entry`
  - `/accounting/journal-entry?entryId=xxx` (for editing)

- [x] Update DesktopHeader.jsx title mapping

#### Business Logic (FUTURE - Phase 7)
- [ ] Create utility functions for auto-posting transactions
  - Auto-generate journal entries when:
    - Invoice is paid (Debit: Cash, Credit: A/R and Revenue)
    - Expense is recorded (Debit: Expense Account, Credit: Cash/A/P)
    - Payment is made (Debit: A/P, Credit: Cash)

#### Files Created/Modified:
- ✅ `supabase/migrations/025_create_journal_entries_tables.sql`
- ✅ `src/pages/GeneralLedger.jsx`
- ✅ `src/pages/JournalEntry.jsx`
- ✅ `src/App.jsx` (added 2 routes)
- ✅ `src/Components/DesktopHeader.jsx` (added title mappings)

**Notes:**
- Account Register page deferred to later (can access via Chart of Accounts)
- Auto-posting utility will be built in Phase 7 (Integration & Automation)

---

### ✅ Phase 3: Bank Accounts & Transactions (COMPLETED)
**Status: DONE**
**Time Spent: ~2 hours**

#### Database Setup
- [x] Create `bank_accounts` table
  - Fields: id, company_id, account_name, account_number, bank_name, account_type, routing_number, current_balance, opening_balance, opening_date, last_reconciled_date, last_reconciled_balance, chart_account_id, is_active, notes, created_at, updated_at, created_by
  - Automatic balance calculation via triggers
  
- [x] Create `bank_transactions` table
  - Fields: id, bank_account_id, transaction_date, description, reference_number, amount, transaction_type, category, payee, is_cleared, is_reconciled, reconciliation_id, matched_journal_entry_id, imported_date, notes, created_at, created_by
  - Positive amounts = deposits, Negative amounts = withdrawals
  - Triggers to auto-update bank account balance when transactions cleared

#### Frontend Components
- [x] Create `src/pages/BankAccounts.jsx`
  - List all bank accounts in card layout
  - Add/edit/delete bank accounts
  - Link to Chart of Accounts
  - Track opening balance and current balance
  - Support multiple account types: Checking, Savings, Credit Card, Money Market, Line of Credit
  - Activate/deactivate accounts
  - Navigate to transactions for each account
  
- [x] Create `src/pages/BankTransactions.jsx`
  - Display transactions for specific bank account (via URL param)
  - Add manual transactions (deposits, withdrawals, transfers, fees, interest)
  - Edit/delete transactions
  - Mark transactions as cleared/uncleared (one-click toggle)
  - Search functionality (description, payee, reference, category)
  - Filter by transaction type and cleared status
  - Running balance calculation (opening balance + cleared transactions)
  - Summary cards: Cleared Balance, Uncleared Amount, Total Deposits, Total Withdrawals
  - Visual distinction for uncleared transactions (yellow background)
  - Full transaction table with debit/credit columns

#### Business Logic Implemented
- [x] Automatic balance updates via database triggers
- [x] Running balance calculation based on cleared transactions only
- [x] Transaction validation (positive amounts enforced in UI)
- [x] Proper debit/credit handling (withdrawals stored as negative)
- [x] RLS policies for company-level security

#### Files Created/Modified:
- ✅ `supabase/migrations/026_create_bank_accounts_tables.sql`
- ✅ `src/pages/BankAccounts.jsx`
- ✅ `src/pages/BankTransactions.jsx`
- ✅ `src/App.jsx` (added routes)

**Features Ready:**
- Full bank account management
- Transaction tracking with running balance
- Search and filtering
- Mark transactions as cleared
- Links to Chart of Accounts
- Mobile responsive design

**Notes:**
- CSV/OFX import deferred to future enhancement
- Currently supports manual transaction entry
- Ready for Phase 4: Bank Reconciliation

---

### ✅ Phase 4: Bank Reconciliation (COMPLETED)
**Status: DONE**
**Time Spent: ~2 hours**

#### Frontend Components
- [x] Create `src/pages/BankReconciliation.jsx`
  - Select bank account and statement date
  - Enter ending balance from bank statement
  - Show unreconciled transactions with checkbox selection
  - Pre-select cleared transactions automatically
  - Real-time balance calculation
  - Visual difference indicator (green = balanced, red = unbalanced)
  - Mark transactions as reconciled when complete
  - Calculate difference (shows when balanced to $0.00)
  - Save reconciliation and update bank account records
  - Summary cards showing: Beginning Balance, Selected Deposits, Selected Withdrawals, Calculated Balance, Statement Balance, Difference
  
- [x] Reconciliation workflow implemented:
  1. User selects bank account from card grid
  2. User enters statement ending balance and date
  3. System shows all unreconciled transactions
  4. Pre-selects cleared transactions
  5. User checks/unchecks transactions to reconcile
  6. System calculates: Start Balance + Selected Transactions = Ending Balance
  7. Visual indicator shows if balanced (within 1 cent tolerance)
  8. User completes reconciliation - transactions marked as reconciled
  9. Bank account updated with last reconciled date and balance

#### Business Logic Implemented
- [x] Two-step interface: account selection → reconciliation
- [x] Uses last_reconciled_balance as starting point (or opening_balance)
- [x] Only shows unreconciled transactions
- [x] Real-time calculation of reconciled balance
- [x] Difference calculation with visual feedback
- [x] Prevents reconciliation without statement balance
- [x] Confirms unbalanced reconciliations
- [x] Bulk updates transactions as reconciled
- [x] Updates bank account reconciliation info
- [x] "Select All" checkbox for convenience
- [x] Click row to toggle selection

#### Files Created/Modified:
- ✅ `src/pages/BankReconciliation.jsx`
- ✅ `src/App.jsx` (added route)
- ✅ `src/Components/DesktopHeader.jsx` (added title mapping)

**Features Ready:**
- Complete bank reconciliation workflow
- Visual balance checking
- Transaction selection interface
- Summary calculations
- Reconciliation history tracking
- Mobile responsive design

**Notes:**
- Auto-matching algorithm deferred (manual selection sufficient for MVP)
- Journal entry creation from reconciliation deferred to Phase 7
- Currently handles reconciliation workflow end-to-end

---

### ✅ Phase 5: Accounts Payable (A/P) - Bills (COMPLETED)
**Status: DONE**
**Time Spent: ~1 hour**

#### Database Setup
- [x] Create `bills` table
  - Fields: id, company_id, vendor_name, bill_number, bill_date, due_date, amount, paid_date, payment_status, description, category, notes, created_at, updated_at, created_by
  - Payment status: 'unpaid' (default), 'paid'
  - Includes overdue tracking based on due_date
  
- [x] Create `bill_line_items` table (for future itemized bills)
  - Fields: id, bill_id, line_number, description, quantity, unit_price, amount, account_id
  - Ready for future Phase 5B enhancement

#### Frontend Components
- [x] Create `src/pages/Bills.jsx`
  - List all vendor bills in table format
  - Add/edit/delete bills
  - Track vendor name, bill number, amounts, due dates
  - Mark bills as paid/unpaid (one-click toggle)
  - Automatic overdue detection (visual red background)
  - Payment status badges: ✓ Paid, ○ Unpaid, ⚠ Overdue
  - Search functionality (vendor, bill number, description, category)
  - Filter by payment status (all, unpaid, paid)
  - Summary cards: Total Bills, Unpaid Bills, Overdue Bills, Amount Due
  - Visual distinction for paid (green) and overdue (red) bills
  - Categories for expense tracking
  - Notes field for additional details
  
- [x] Add route `/accounting/bills` to App.jsx
- [x] Update DesktopHeader.jsx title mapping

#### Business Logic Implemented
- [x] Automatic overdue calculation (due_date < today AND unpaid)
- [x] Payment tracking with paid_date
- [x] One-click payment status toggling
- [x] Validation for required fields (vendor, amount)
- [x] RLS policies for company-level security
- [x] Real-time summary calculations

#### Files Created/Modified:
- ✅ `supabase/migrations/027_create_bills_tables.sql`
- ✅ `src/pages/Bills.jsx`
- ✅ `src/App.jsx` (added route)
- ✅ `src/Components/DesktopHeader.jsx` (added title mapping)

**Features Ready:**
- Complete bill management workflow
- Payment tracking with status indicators
- Overdue detection and alerts
- Search and filtering
- Summary analytics
- Mobile responsive design

**Notes:**
- Bill line items table created for future enhancement (Phase 5B)
- Bill payments page deferred to Phase 5B (pay multiple bills at once, generate checks)
- Currently supports single bill payment via mark as paid
- Journal entry creation deferred to Phase 7 (Integration & Automation)
- Ready for Phase 6: Financial Reports

---

### Phase 5B: Bill Payments (FUTURE)
**Status: NOT STARTED**
**Estimated Time: 2-3 hours**

#### Future Enhancements
- [ ] Create `src/pages/BillPayments.jsx`
  - Pay multiple bills at once
  - Generate checks
  - Record payment transactions
  - Link to bank accounts
  
- [ ] Itemized bill entry
  - Use bill_line_items table
  - Multiple line items per bill
  - Account assignment per line

#### Files to Create/Modify:
- `src/pages/BillPayments.jsx`
- `src/App.jsx` (add route)

---

### Phase 6: Financial Reports
**Status: NOT STARTED**
**Estimated Time: 5-6 hours**

#### Reports to Build
- [ ] **Balance Sheet** (`src/pages/reports/BalanceSheet.jsx`)
  - Assets (Current + Fixed)
  - Liabilities (Current + Long-term)
  - Equity
  - As of a specific date
  - Export to PDF/Excel

- [ ] **Profit & Loss Statement** (`src/pages/reports/ProfitLoss.jsx`)
  - Income
  - Cost of Goods Sold
  - Expenses
  - Net Income
  - For a date range (monthly, quarterly, yearly)
  - Comparison with previous period

- [ ] **Cash Flow Statement** (`src/pages/reports/CashFlow.jsx`)
  - Operating Activities
  - Investing Activities
  - Financing Activities
  - For a date range

- [ ] **Trial Balance** (`src/pages/reports/TrialBalance.jsx`)
  - All accounts with debit/credit balances
  - Verify debits = credits
  - As of a specific date

- [ ] **Account Aging** (`src/pages/reports/AccountAging.jsx`)
  - A/R Aging (who owes us money)
  - A/P Aging (who we owe money)
  - 30/60/90+ day buckets

#### Files to Create/Modify:
- `src/pages/reports/BalanceSheet.jsx`
- `src/pages/reports/ProfitLoss.jsx`
- `src/pages/reports/CashFlow.jsx`
- `src/pages/reports/TrialBalance.jsx`
- `src/pages/reports/AccountAging.jsx`
- `src/utils/financialReports.js` (calculation utilities)
- `src/App.jsx` (add routes)

---

### Phase 7: Integration & Automation
**Status: NOT STARTED**
**Estimated Time: 3-4 hours**

#### Auto-Generate Journal Entries
- [ ] When invoice is created → create A/R and Revenue journal entry
- [ ] When invoice is paid → create Cash and A/R journal entry
- [ ] When expense is recorded → create Expense and Cash/A/P journal entry
- [ ] When bill is paid → create A/P and Cash journal entry
- [ ] When payroll is run → create Payroll Expense and Cash journal entries

#### Update Existing Pages
- [ ] Modify `src/pages/InvoicesList.jsx` to post to accounts
- [ ] Modify `src/pages/Expenses.jsx` to post to accounts
- [ ] Ensure all transactions flow through double-entry system

#### Files to Modify:
- `src/pages/InvoicesList.jsx`
- `src/pages/Expenses.jsx`
- `src/pages/Invoice.jsx`
- `src/utils/accountingJournals.js`

---

### Phase 8: Advanced Features
**Status: NOT STARTED**
**Estimated Time: 4-5 hours**

- [ ] **Budgeting**
  - Set budget amounts by account
  - Compare actual vs budget
  - Variance reports

- [ ] **Fixed Assets & Depreciation**
  - Track fixed assets
  - Calculate depreciation
  - Generate depreciation journal entries

- [ ] **1099 Contractor Tracking**
  - Mark vendors as 1099 contractors
  - Track payments over $600
  - Generate 1099 reports

- [ ] **Multi-Currency Support**
  - Handle foreign currency transactions
  - Exchange rate tracking
  - Currency conversion

---

## Database Schema Summary

### Tables to Create:
1. ✅ `invoices` (already exists)
2. ✅ `expenses` (already exists)
3. ⏳ `accounts` (Chart of Accounts)
4. ⏳ `journal_entries` (General Ledger header)
5. ⏳ `journal_entry_lines` (General Ledger lines - debits/credits)
6. ⏳ `bank_accounts` (Bank account master)
7. ⏳ `bank_transactions` (Imported/manual transactions)
8. ⏳ `bills` (Accounts Payable)
9. ⏳ `bill_payments` (Bill payment records)
10. ⏳ `reconciliations` (Bank reconciliation history)

---

## Navigation Structure

### Accounting Menu (to be added to sidebar/header)
```
📊 Accounting
  ├── 📈 Dashboard (/accounting)
  ├── 📋 Chart of Accounts (/accounting/chart-of-accounts)
  ├── 📖 General Ledger (/accounting/general-ledger)
  ├── ✏️ Journal Entry (/accounting/journal-entry)
  ├── 🏦 Bank Accounts (/accounting/bank-accounts)
  ├── 🔄 Bank Reconciliation (/accounting/reconciliation)
  ├── 💵 Bills (A/P) (/accounting/bills)
  ├── 💰 Bill Payments (/accounting/bill-payments)
  └── 📊 Reports
      ├── Balance Sheet (/accounting/reports/balance-sheet)
      ├── Profit & Loss (/accounting/reports/profit-loss)
      ├── Cash Flow (/accounting/reports/cash-flow)
      ├── Trial Balance (/accounting/reports/trial-balance)
      └── A/R & A/P Aging (/accounting/reports/aging)
```

---

## Testing Checklist (Per Phase)

After each phase is implemented:
- [ ] All database tables created successfully
- [ ] Can create records via UI
- [ ] Can edit records
- [ ] Can delete/archive records
- [ ] Data validates correctly
- [ ] Navigation works
- [ ] Mobile responsive
- [ ] No console errors
- [ ] Tested with real-world scenarios

---

## Notes for Future Developers

### Key Concepts
- **Double-Entry Accounting**: Every transaction has equal debits and credits
- **Account Types**: Assets & Expenses increase with debits; Liabilities, Equity, & Income increase with credits
- **Journal Entries**: The foundation of all accounting transactions
- **Reconciliation**: Matching internal records with bank statements

### Important Rules
1. Debits must always equal credits in every journal entry
2. Never delete posted journal entries (use reversing entries instead)
3. Bank reconciliation must balance to $0.00 difference
4. All financial reports pull from journal_entry_lines table
5. Account numbers should follow a standard chart (1000s = Assets, 2000s = Liabilities, etc.)

### Development Standards
- Always use transactions when posting journal entries
- Log all accounting changes for audit trail
- Validate account types before posting
- Show clear error messages for unbalanced entries
- Allow draft mode for journal entries before posting

---

## Current Status Summary

**Completed:**
- ✅ Phase 0: Basic accounting dashboard with revenue/expense tracking
- ✅ Phase 1: Chart of Accounts with default account structure
- ✅ Phase 2: General Ledger & Journal Entries with double-entry posting
- ✅ Phase 3: Bank Accounts & Transactions with running balances
- ✅ Phase 4: Bank Reconciliation with balance checking
- ✅ Phase 5: Bills (Accounts Payable) with payment tracking

**Next Up:**
- 🔄 Phase 6: Financial Reports (STARTING NEXT)
  - Balance Sheet
  - Profit & Loss Statement
  - Cash Flow Statement
  - Trial Balance
  - Account Aging Reports

**Total Estimated Remaining Time: 15-18 hours**

---

## How to Use This Document

When a new developer/agent joins:
1. Read this entire document first
2. Check which phase is marked "IN PROGRESS"
3. Look at the checkbox items in that phase
4. Start with the first unchecked item
5. Mark items complete as you finish them
6. Update the "Last Updated" date at the top
7. Add any notes or issues you encounter

---

## Version History
- v1.0 (Jan 1, 2026, 12:00 PM) - Initial plan created, Phase 0 complete, Phase 1 starting
- v1.1 (Jan 1, 2026, 1:30 PM) - Phase 1 (Chart of Accounts) complete
- v1.2 (Jan 1, 2026, 3:00 PM) - Phase 2 (General Ledger & Journal Entries) complete
- v1.3 (Jan 1, 2026, 4:30 PM) - Phase 3 (Bank Accounts & Transactions) complete
- v1.4 (Jan 1, 2026, 5:20 PM) - Phase 4 (Bank Reconciliation) complete
- v1.5 (Jan 1, 2026, 5:40 PM) - Phase 5 (Bills/A/P) complete
