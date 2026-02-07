## Subaccounts for Chart of Accounts - Complete Implementation

The CSV bank statement upload task is complete! This is a NEW separate feature request.

### Database Migration Created ✅
**File**: `supabase/migrations/045_add_parent_account_to_accounts.sql`

**Run this SQL in Supabase Dashboard:**
```sql
ALTER TABLE accounts
ADD COLUMN parent_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL;

CREATE INDEX idx_accounts_parent_account_id ON accounts(parent_account_id);
```

### What Needs to Be Done:

1. **Update Chart of Accounts UI** (`src/pages/ChartOfAccounts.jsx`):
   - Add "➕ Add Subaccount" button on each account card
   - Update the account form modal to include parent account dropdown
   - Display subaccounts indented under parent accounts
   - Show hierarchical structure (parent > child)

2. **Features to Add**:
   - Click "+ Add Subaccount" on Insurance account
   - Modal opens with "Parent Account: 6500 - Insurance" pre-filled
   - Create subaccounts like:
     - 6510 - Vehicle Insurance
     - 6520 - Business Insurance  
     - 6530 - Worker's Comp
   - Subaccounts display indented under parent
   - Roll-up totals (parent shows sum of subaccounts)

3. **UI Changes Needed**:
   ```javascript
   // Add button in account actions:
   <button onClick={() => openAddSubaccountModal(account)}>
     ➕ Add Subaccount
   </button>

   // In form modal, add parent selection:
   {editingParent && (
     <div>Parent Account: {editingParent.account_number} - {editingParent.account_name}</div>
   )}
   
   // Display hierarchy:
   {account.parent_account_id === null && (
     // Show parent account
     // Then show its subaccounts indented
   )}
   ```

### Example Structure:
```
6500 Insurance [$15,000 total]
  ├─ 6510 Vehicle Insurance [$8,000]
  ├─ 6520 Business Insurance [$5,000]
  └─ 6530 Worker's Comp [$2,000]
```

Would you like me to implement this subaccount feature now?
