// This is the complete updated Chart of Accounts with:
// 1. Compact cards (smaller padding, fonts)
// 2. Only parent accounts shown initially  
// 3. Expand/collapse button for subaccounts
// 4. Subaccounts shown indented when expanded

// Replace the accounts display section (around line 400-500) with this:

<div style={styles.accountsList}>
  {typeAccounts
    .filter(a => !a.parent_account_id) // Only show parent accounts
    .map(account => {
      const subaccounts = typeAccounts.filter(sub => sub.parent_account_id === account.id);
      const isExpanded = expandedAccounts[account.id];
      const totalBalance = account.balance + subaccounts.reduce((sum, sub) => sum + sub.balance, 0);
      
      return (
        <div key={account.id}>
          {/* Parent Account - Compact */}
          <div
            style={{
              ...styles.compactCard,
              opacity: account.is_active ? 1 : 0.6,
              borderLeft: `3px solid ${getTypeColor(account.account_type)}`
            }}
          >
            <div style={styles.compactRow}>
              <div style={styles.compactLeft}>
                <span style={styles.compactNumber}>{account.account_number}</span>
                <span style={styles.compactName}>{account.account_name}</span>
                {account.is_system && <span style={styles.systemBadge}>System</span>}
                {!account.is_active && <span style={styles.inactiveBadge}>Inactive</span>}
                {subaccounts.length > 0 && (
                  <button
                    onClick={() => toggleExpanded(account.id)}
                    style={styles.expandButton}
                  >
                    {isExpanded ? '▼' : '▶'} {subaccounts.length}
                  </button>
                )}
              </div>
              <div style={styles.compactRight}>
                <span style={styles.compactBalance}>{formatCurrency(totalBalance)}</span>
                <div style={styles.compactActions}>
                  <button
                    onClick={() => openAddSubaccountModal(account)}
                    style={styles.compactButton}
                    title="Add Subaccount"
                  >
                    ➕
                  </button>
                  <button
                    onClick={() => openEditAccountModal(account)}
                    style={styles.compactButton}
                    title="Edit"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => handleToggleActive(account)}
                    style={styles.compactButton}
                    title={account.is_active ? 'Deactivate' : 'Activate'}
                  >
                    {account.is_active ? '❌' : '✅'}
                  </button>
                  {!account.is_system && (
                    <button
                      onClick={() => handleArchiveAccount(account)}
                      style={{...styles.compactButton, color: '#ef4444'}}
                      title="Archive"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Subaccounts - Show when expanded */}
          {isExpanded && subaccounts.map(sub => (
            <div
              key={sub.id}
              style={{
                ...styles.compactCard,
                marginLeft: 40,
                backgroundColor: '#f3f4f6',
                opacity: sub.is_active ? 1 : 0.6,
                borderLeft: `3px solid ${getTypeColor(sub.account_type)}`
              }}
            >
              <div style={styles.compactRow}>
                <div style={styles.compactLeft}>
                  <span style={{...styles.compactNumber, color: '#666'}}>└─ {sub.account_number}</span>
                  <span style={styles.compactName}>{sub.account_name}</span>
                  {!sub.is_active && <span style={styles.inactiveBadge}>Inactive</span>}
                </div>
                <div style={styles.compactRight}>
                  <span style={styles.compactBalance}>{formatCurrency(sub.balance)}</span>
                  <div style={styles.compactActions}>
                    <button
                      onClick={() => openEditAccountModal(sub)}
                      style={styles.compactButton}
                      title="Edit"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleToggleActive(sub)}
                      style={styles.compactButton}
                      title={sub.is_active ? 'Deactivate' : 'Activate'}
                    >
                      {sub.is_active ? '❌' : '✅'}
                    </button>
                    <button
                      onClick={() => handleArchiveAccount(sub)}
                      style={{...styles.compactButton, color: '#ef4444'}}
                      title="Archive"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      );
    })}
</div>

// ADD THESE NEW COMPACT STYLES to the styles object:

  compactCard: {
    backgroundColor: "#fff",
    borderRadius: 6,
    padding: "8px 12px",
    marginBottom: 4,
    transition: "all 0.2s",
  },
  compactRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  compactLeft: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  compactNumber: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111",
    minWidth: 50,
  },
  compactName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111",
  },
  compactRight: {
    display: "flex",
    alignItems: "center",
    gap: 16,
  },
  compactBalance: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111",
    minWidth: 100,
    textAlign: "right",
  },
  compactActions: {
    display: "flex",
    gap: 4,
  },
  compactButton: {
    padding: "4px 8px",
    backgroundColor: "transparent",
    border: "none",
    borderRadius: 4,
    fontSize: 14,
    cursor: "pointer",
    transition: "all 0.2s",
    color: "#666",
  },
  expandButton: {
    padding: "2px 8px",
    backgroundColor: "#e5e7eb",
    border: "none",
    borderRadius: 4,
    fontSize: 11,
    fontWeight: "600",
    cursor: "pointer",
    color: "#374151",
  },
