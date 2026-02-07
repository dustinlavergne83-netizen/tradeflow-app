# Subaccounts Feature - Ready to Complete

## What's Done:
✅ Parent account state added
✅ openAddSubaccountModal() function created
✅ Database column exists (parent_account_id)

## To Finish - Copy these changes to ChartOfAccounts.jsx:

### 1. Update handleSaveAccount (around line 150):
```javascript
async function handleSaveAccount() {
  if (!accountForm.account_number || !accountForm.account_name) {
    alert('Please enter both account number and account name');
    return;
  }

  try {
    const accountData = {
      ...accountForm,
      parent_account_id: parentAccount ? parentAccount.id : null,  // ADD THIS LINE
      company_id: user.id,
      created_by: user.id
    };

    if (editingAccount) {
      const { error } = await supabase
        .from('accounts')
        .update(accountData)
        .eq('id', editingAccount.id);

      if (error) throw error;
      alert('Account updated successfully!');
    } else {
      const { error } = await supabase
        .from('accounts')
        .insert([accountData]);

      if (error) throw error;
      alert(parentAccount ? 'Subaccount added successfully!' : 'Account added successfully!');
    }

    setShowModal(false);
    setEditingAccount(null);
    setParentAccount(null);  // ADD THIS LINE
    loadAccounts();
  } catch (err) {
    console.error('Error saving account:', err);
    alert(`Failed to save account: ${err.message}`);
  }
}
```

### 2. Add "+ Subaccount" button to account actions (around line 450):
```javascript
<div style={styles.accountActions}>
  <button
    onClick={() => openAddSubaccountModal(account)}
    style={{...styles.actionButton, backgroundColor: '#10b981', color: '#fff', borderColor: '#10b981'}}
  >
    ➕ Add Subaccount
  </button>
  <button
    onClick={() => openEditAccountModal(account)}
    style={styles.actionButton}
  >
    ✏️ Edit
  </button>
  {/* rest of buttons... */}
</div>
```

### 3. Show parent account in modal (around line 500, after modalTitle):
```javascript
<div style={styles.modalHeader}>
  <h2 style={styles.modalTitle}>
    {editingAccount ? 'Edit Account' : parentAccount ? 'Add Subaccount' : 'Add New Account'}
  </h2>
  <button onClick={() => setShowModal(false)} style={styles.closeButton}>
    ×
  </button>
</div>

{/* ADD THIS SECTION */}
{parentAccount && (
  <div style={{padding: '16px 24px', backgroundColor: '#f0fdf4', borderBottom: '2px solid #e5e7eb'}}>
    <div style={{fontSize: 14, fontWeight: 600, color: '#059669', marginBottom: 4}}>
      Creating Subaccount For:
    </div>
    <div style={{fontSize: 16, fontWeight: 700, color: '#111'}}>
      {parentAccount.account_number} - {parentAccount.account_name}
    </div>
  </div>
)}
```

### 4. Display hierarchy with indentation (around line 430):
```javascript
<div style={styles.accountsList}>
  {typeAccounts
    .filter(a => !a.parent_account_id)  // Only parent accounts
    .map(account => {
      const subaccounts = typeAccounts.filter(sub => sub.parent_account_id === account.id);
      const totalBalance = account.balance + subaccounts.reduce((sum, sub) => sum + sub.balance, 0);
      
      return (
        <React.Fragment key={account.id}>
          {/* Parent Account Card */}
          <div style={{...styles.accountCard, ...}}>
            {/* existing account card content */}
            <div style={styles.accountRight}>
              <div style={styles.accountBalance}>
                {formatCurrency(totalBalance)}
                {subaccounts.length > 0 && <span style={{fontSize: 12, color: '#666'}}> (incl. subs)</span>}
              </div>
            </div>
          </div>

          {/* Subaccounts - Indented */}
          {subaccounts.map(sub => (
            <div key={sub.id} style={{...styles.accountCard, marginLeft: 40, backgroundColor: '#f9fafb'}}>
              <div style={{fontSize: 12, color: '#666', marginBottom: 4}}>└─ Subaccount</div>
              {/* same content as parent but indented */}
            </div>
          ))}
        </React.Fragment>
      );
    })}
</div>
```

## Result:
- Click "➕ Add Subaccount" on Insurance
- Modal shows "Creating Subaccount For: 6500 - Insurance"
- Create: 6510 - Vehicle Insurance
- Displays indented under parent
- Parent shows total including subaccounts

Would you like me to make these changes for you?
