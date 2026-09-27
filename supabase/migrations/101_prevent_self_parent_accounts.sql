-- ═══════════════════════════════════════════════════════════════════════
--  Prevent an account from being its own parent in the Chart of Accounts.
--
--  Bug found: ChartOfAccounts.jsx's "Edit Account" modal never reset the
--  parentAccount state left over from a previous "Add Sub-account" click,
--  so opening "Add Sub-account" on an account and later editing THAT SAME
--  account could save it with parent_account_id = its own id. Because the
--  page only lists top-level accounts (parent_account_id IS NULL) and
--  nests children under their parent, a self-referencing account matches
--  neither branch and silently disappears from the UI — nothing was
--  deleted, it just became unrenderable.
--
--  Fixed in code (ChartOfAccounts.jsx): openEditAccountModal now resets
--  parentAccount to the account's own real parent (or null), and
--  handleSaveAccount rejects saving with parentAccount.id === editingAccount.id.
--
--  This constraint is the belt-and-suspenders backstop at the database
--  level, so the same class of bug can't silently corrupt data again via
--  any other code path (or a future migration/script) that touches
--  parent_account_id directly.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE accounts
  ADD CONSTRAINT accounts_parent_not_self CHECK (parent_account_id IS DISTINCT FROM id);

COMMENT ON CONSTRAINT accounts_parent_not_self ON accounts IS
  'An account cannot be its own parent — this caused the account to silently disappear from the Chart of Accounts UI (see ChartOfAccounts.jsx openEditAccountModal/handleSaveAccount fix).';
