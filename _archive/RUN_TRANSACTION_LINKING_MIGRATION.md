# Run Bank Transaction Linking Migration

## Step 1: Run in Supabase Dashboard

1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to **SQL Editor**
4. Copy and paste this SQL:

```sql
-- Add fields to link bank transactions to expenses and invoices
ALTER TABLE bank_transactions
ADD COLUMN IF NOT EXISTS linked_expense_id UUID REFERENCES expenses(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS linked_invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS is_reconciled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS reconciled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS reconciled_by UUID REFERENCES auth.users(id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_bank_transactions_expense ON bank_transactions(linked_expense_id);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_invoice ON bank_transactions(linked_invoice_id);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_reconciled ON bank_transactions(is_reconciled);

-- Add comment
COMMENT ON COLUMN bank_transactions.linked_expense_id IS 'Links this transaction to an expense record';
COMMENT ON COLUMN bank_transactions.linked_invoice_id IS 'Links this transaction to an invoice payment';
COMMENT ON COLUMN bank_transactions.is_reconciled IS 'Whether this transaction has been reconciled/matched';
```

5. Click **RUN** or press **Ctrl+Enter**

## Step 2: Refresh Your App

After running the migration, refresh your browser to use the new features!
