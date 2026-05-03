import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

export default function GeneralLedger() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    loadEntries();
  }, [user]);

  async function loadEntries() {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from("journal_entries")
        .select(`
          *,
          journal_entry_lines(debit, credit)
        `)
        .eq("company_id", user.id)
        .order("entry_date", { ascending: false });

      if (error) throw error;
      
      // Calculate totals for each entry
      const entriesWithTotals = data.map(entry => {
        const totalDebits = entry.journal_entry_lines.reduce((sum, line) => sum + (line.debit || 0), 0);
        const totalCredits = entry.journal_entry_lines.reduce((sum, line) => sum + (line.credit || 0), 0);
        return {
          ...entry,
          totalDebits,
          totalCredits
        };
      });
      
      setEntries(entriesWithTotals || []);
    } catch (err) {
      console.error("Error loading entries:", err);
      alert("Failed to load journal entries");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(entry) {
    // Allow deletion of posted bank transaction entries (even if posted, they should be deletable as orphans)
    // Block deletion of posted entries ONLY if they're NOT orphaned bank transactions
    if (entry.is_posted && entry.reference_type !== 'bank_transaction') {
      alert('Cannot delete a posted entry. Use a reversing entry to correct it.');
      return;
    }

    const message = entry.is_posted 
      ? `Delete POSTED journal entry ${entry.entry_number}? This appears to be an orphaned bank transaction.`
      : `Delete journal entry ${entry.entry_number}?`;

    if (!confirm(message)) {
      return;
    }

    try {
      console.log('Starting deletion of entry ID:', entry.id);
      console.log('User ID:', user.id);
      console.log('Entry object:', JSON.stringify(entry));
      
      // FIRST: Check if entry lines exist
      console.log('Checking if journal entry lines exist...');
      const { data: existingLines, error: checkLinesError } = await supabase
        .from('journal_entry_lines')
        .select('id')
        .eq('entry_id', entry.id);
      
      if (checkLinesError) {
        console.error('Error checking for lines:', checkLinesError);
      } else {
        console.log('Found lines:', existingLines?.length || 0);
      }
      
      // SECOND: Delete all journal entry lines
      console.log('Step 1: Deleting all journal entry lines for entry:', entry.id);
      const { error: linesError, count: linesCount } = await supabase
        .from('journal_entry_lines')
        .delete()
        .eq('entry_id', entry.id);

      if (linesError) {
        console.error('❌ Error deleting lines:', linesError);
        throw linesError;
      }
      console.log('✅ Deleted lines. Count:', linesCount);

      // THIRD: Delete the journal entry
      console.log('Step 2: Deleting journal entry with ID:', entry.id);
      const { error: entryError } = await supabase
        .from('journal_entries')
        .delete()
        .eq('id', entry.id);

      if (entryError) {
        console.error('❌ Error deleting entry:', entryError);
        console.error('Full error object:', JSON.stringify(entryError));
        throw entryError;
      }
      console.log('✅ Deletion query executed successfully');
      
      // Verify the entry is actually gone before showing success
      const { data: verifyData, error: verifyError } = await supabase
        .from('journal_entries')
        .select('id')
        .eq('id', entry.id)
        .eq('company_id', user.id)
        .maybeSingle();
      
      if (verifyError) {
        console.error('⚠️ Error verifying deletion:', verifyError);
      }
      
      if (verifyData) {
        console.error('❌ CRITICAL: Entry still exists after delete operation!');
        alert('❌ Delete operation failed - entry still exists in database. This may be a database constraint issue.');
        loadEntries();
        return;
      }
      
      console.log('✅ Verified: Entry successfully deleted from database');
      alert('✅ Journal entry deleted successfully!');
      // Wait a moment then reload to ensure database has processed the deletion
      setTimeout(() => {
        loadEntries();
      }, 500);
    } catch (err) {
      console.error('❌ Error deleting entry:', err);
      alert(`❌ Failed to delete: ${err.message}`);
    }
  }

  const filteredEntries = entries.filter(entry => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = (
      entry.entry_number?.toLowerCase().includes(searchLower) ||
      entry.description?.toLowerCase().includes(searchLower)
    );

    const matchesStatus = 
      statusFilter === "all" ||
      (statusFilter === "posted" && entry.is_posted) ||
      (statusFilter === "draft" && !entry.is_posted);

    return matchesSearch && matchesStatus;
  });

  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return '$0.00';
    return `$${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString.includes('T') ? dateString : dateString + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading journal entries...</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>📖 General Ledger</h1>
          <p style={styles.subtitle}>View all journal entries</p>
        </div>
        <div style={styles.headerButtons}>
          <button onClick={() => navigate('/accounting')} style={styles.backButton}>
            ← Dashboard
          </button>
          <button onClick={() => navigate('/accounting/journal-entry')} style={styles.newButton}>
            + New Entry
          </button>
        </div>
      </div>

      {/* Search and Filter */}
      <div style={styles.filterBar}>
        <input
          type="text"
          placeholder="Search by entry number or description..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={styles.searchInput}
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={styles.filterSelect}
        >
          <option value="all">All Status</option>
          <option value="draft">Draft</option>
          <option value="posted">Posted</option>
        </select>
      </div>

      {/* Entries List */}
      {filteredEntries.length === 0 ? (
        <div style={styles.empty}>
          <p style={styles.emptyText}>
            {searchTerm || statusFilter !== "all"
              ? "No entries found matching your filters."
              : "No journal entries yet. Click 'New Entry' to create your first entry!"}
          </p>
        </div>
      ) : (
        <div style={styles.tableContainer}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.tableHeaderRow}>
                <th style={{...styles.th, textAlign: 'left'}}>Entry #</th>
                <th style={{...styles.th, textAlign: 'left'}}>Date</th>
                <th style={{...styles.th, textAlign: 'left'}}>Description</th>
                <th style={{...styles.th, textAlign: 'right'}}>Debits</th>
                <th style={{...styles.th, textAlign: 'right'}}>Credits</th>
                <th style={{...styles.th, textAlign: 'center'}}>Status</th>
                <th style={{...styles.th, textAlign: 'center'}}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.map(entry => (
                <tr key={entry.id} style={styles.tableRow}>
                  <td style={styles.td}>
                    <span style={styles.entryNumber}>{entry.entry_number}</span>
                  </td>
                  <td style={styles.td}>{formatDate(entry.entry_date)}</td>
                  <td style={styles.td}>
                    <div style={styles.description}>
                      {entry.description || '—'}
                    </div>
                  </td>
                  <td style={{...styles.td, textAlign: 'right'}}>
                    <span style={styles.amount}>{formatCurrency(entry.totalDebits)}</span>
                  </td>
                  <td style={{...styles.td, textAlign: 'right'}}>
                    <span style={styles.amount}>{formatCurrency(entry.totalCredits)}</span>
                  </td>
                  <td style={{...styles.td, textAlign: 'center'}}>
                    <span style={{
                      ...styles.statusBadge,
                      backgroundColor: entry.is_posted ? '#10b981' : '#f59e0b'
                    }}>
                      {entry.is_posted ? '✅ Posted' : '📝 Draft'}
                    </span>
                  </td>
                  <td style={{...styles.td, textAlign: 'center'}}>
                    <div style={styles.actions}>
                      <button
                        onClick={() => navigate(`/accounting/journal-entry?entryId=${entry.id}`)}
                        style={{...styles.actionButton, ...styles.viewButton}}
                        title={entry.is_posted ? "View" : "Edit"}
                      >
                        {entry.is_posted ? '👁️' : '✏️'}
                      </button>
                      {!entry.is_posted ? (
                        <button
                          onClick={() => handleDelete(entry)}
                          style={{...styles.actionButton, ...styles.deleteButton}}
                          title="Delete"
                        >
                          🗑️
                        </button>
                      ) : entry.reference_type === 'bank_transaction' ? (
                        <button
                          onClick={() => handleDelete(entry)}
                          style={{...styles.actionButton, ...styles.deleteButton}}
                          title="Delete orphaned bank transaction"
                        >
                          🗑️
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={styles.footer}>
        <p style={styles.footerText}>
          Showing {filteredEntries.length} of {entries.length} entries
        </p>
      </div>
    </div>
  );
}

const styles = {
  container: {
    maxWidth: 1400,
    margin: "0 auto",
    padding: "40px 20px",
    backgroundColor: "#0b3ea8",
    minHeight: "100vh",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 30,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#fff",
    margin: 0,
  },
  subtitle: {
    fontSize: 16,
    color: "#fff",
    marginTop: 8,
  },
  headerButtons: {
    display: "flex",
    gap: 12,
  },
  backButton: {
    padding: "12px 20px",
    backgroundColor: "#fff",
    border: "2px solid #e5e7eb",
    borderRadius: 8,
    fontSize: 15,
    fontWeight: "600",
    color: "#666",
    cursor: "pointer",
  },
  newButton: {
    padding: "12px 24px",
    backgroundColor: "#fc6b04",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 16,
    fontWeight: "600",
    cursor: "pointer",
    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
  },
  loading: {
    textAlign: "center",
    padding: 60,
    fontSize: 18,
    color: "#fff",
  },
  filterBar: {
    display: "flex",
    gap: 12,
    marginBottom: 30,
  },
  searchInput: {
    flex: 1,
    padding: "14px 20px",
    fontSize: 16,
    border: "2px solid #e5e7eb",
    borderRadius: 8,
    outline: "none",
    backgroundColor: "#fff",
    color: "#111",
  },
  filterSelect: {
    padding: "14px 20px",
    fontSize: 16,
    border: "2px solid #e5e7eb",
    borderRadius: 8,
    outline: "none",
    backgroundColor: "#fff",
    color: "#111",
    cursor: "pointer",
    minWidth: 160,
  },
  tableContainer: {
    backgroundColor: "#fff",
    borderRadius: 12,
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
    overflow: "hidden",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  tableHeaderRow: {
    backgroundColor: "#f9fafb",
    borderBottom: "2px solid #e5e7eb",
  },
  th: {
    padding: "16px 20px",
    fontSize: 13,
    fontWeight: "700",
    color: "#666",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  tableRow: {
    borderBottom: "1px solid #f0f0f0",
    transition: "background-color 0.2s",
  },
  td: {
    padding: "16px 20px",
    fontSize: 15,
    color: "#333",
  },
  entryNumber: {
    fontWeight: "700",
    color: "#0b3ea8",
    fontSize: 16,
  },
  description: {
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
    maxWidth: 300,
  },
  amount: {
    fontWeight: "600",
    color: "#111",
    fontSize: 15,
  },
  statusBadge: {
    display: "inline-block",
    padding: "6px 12px",
    borderRadius: 6,
    fontSize: 12,
    fontWeight: "bold",
    color: "#fff",
  },
  actions: {
    display: "flex",
    gap: 8,
    justifyContent: "center",
  },
  actionButton: {
    padding: "8px 12px",
    border: "none",
    borderRadius: 6,
    fontSize: 16,
    cursor: "pointer",
    transition: "opacity 0.2s",
  },
  viewButton: {
    backgroundColor: "#3b82f6",
    color: "#fff",
  },
  deleteButton: {
    backgroundColor: "#ef4444",
    color: "#fff",
  },
  empty: {
    textAlign: "center",
    padding: "80px 20px",
    backgroundColor: "#fff",
    borderRadius: 12,
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
  },
  emptyText: {
    fontSize: 18,
    color: "#666",
  },
  footer: {
    marginTop: 20,
    textAlign: "center",
  },
  footerText: {
    color: "#666",
    fontSize: 14,
  },
};
