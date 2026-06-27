import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { notify } from '../lib/notify';

export default function JournalEntry() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const entryId = searchParams.get('entryId');
  
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [entry, setEntry] = useState({
    entry_number: '',
    entry_date: new Date().toISOString().split('T')[0],
    description: '',
    is_posted: false
  });
  const [lines, setLines] = useState([
    { line_number: 1, account_id: '', debit: '', credit: '', description: '' }
  ]);

  useEffect(() => {
    loadData();
  }, [user, entryId]);

  async function loadData() {
    try {
      setLoading(true);
      
      // Load accounts
      const { data: accountsData, error: accountsError } = await supabase
        .from("accounts")
        .select("*")
        .eq("company_id", user.id)
        .eq("is_active", true)
        .order("account_number", { ascending: true });

      if (accountsError) throw accountsError;
      setAccounts(accountsData || []);

      // If editing existing entry, load it
      if (entryId) {
        const { data: entryData, error: entryError } = await supabase
          .from("journal_entries")
          .select("*")
          .eq("id", entryId)
          .eq("company_id", user.id)
          .single();

        if (entryError) {
          console.error("Error loading entry:", entryError);
          notify("Failed to load entry: " + entryError.message);
          navigate('/accounting/general-ledger');
          return;
        }

        const { data: linesData, error: linesError } = await supabase
          .from("journal_entry_lines")
          .select(`
            *,
            accounts(account_number, account_name)
          `)
          .eq("entry_id", entryId)
          .order("line_number", { ascending: true });

        if (linesError) {
          console.error("Error loading lines:", linesError);
          notify("Failed to load entry lines");
          return;
        }

        setEntry(entryData);
        if (linesData && linesData.length > 0) {
          setLines(linesData.map(line => ({
            ...line,
            debit: line.debit > 0 ? line.debit : '',
            credit: line.credit > 0 ? line.credit : ''
          })));
        }
      } else {
        // Generate new entry number
        const { data: numberData, error: numberError } = await supabase
          .rpc('get_next_journal_entry_number', { p_company_id: user.id });

        if (!numberError && numberData) {
          setEntry(prev => ({ ...prev, entry_number: numberData }));
        }
      }
    } catch (err) {
      console.error("Error loading data:", err);
      notify("Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  function addLine() {
    setLines([...lines, {
      line_number: lines.length + 1,
      account_id: '',
      debit: '',
      credit: '',
      description: ''
    }]);
  }

  function removeLine(index) {
    if (lines.length <= 2) {
      notify('Journal entry must have at least 2 lines (one debit and one credit)');
      return;
    }
    const newLines = lines.filter((_, i) => i !== index);
    // Renumber lines
    newLines.forEach((line, i) => line.line_number = i + 1);
    setLines(newLines);
  }

  function updateLine(index, field, value) {
    const newLines = [...lines];
    newLines[index][field] = value;
    
    // If setting debit, clear credit and vice versa
    if (field === 'debit' && value) {
      newLines[index].credit = '';
    } else if (field === 'credit' && value) {
      newLines[index].debit = '';
    }
    
    setLines(newLines);
  }

  function calculateTotals() {
    const totalDebits = lines.reduce((sum, line) => {
      return sum + (parseFloat(line.debit) || 0);
    }, 0);
    
    const totalCredits = lines.reduce((sum, line) => {
      return sum + (parseFloat(line.credit) || 0);
    }, 0);
    
    const difference = totalDebits - totalCredits;
    const isBalanced = Math.abs(difference) < 0.01; // Account for floating point
    
    return { totalDebits, totalCredits, difference, isBalanced };
  }

  async function handleSave(shouldPost = false) {
    const { isBalanced } = calculateTotals();
    
    if (!isBalanced && shouldPost) {
      notify('Cannot post an unbalanced entry. Debits must equal credits.');
      return;
    }

    if (!entry.entry_number || !entry.entry_date) {
      notify('Please enter entry number and date');
      return;
    }

    if (lines.length < 2) {
      notify('Journal entry must have at least 2 lines');
      return;
    }

    // Validate all lines have accounts selected
    for (const line of lines) {
      if (!line.account_id) {
        notify('Please select an account for all lines');
        return;
      }
      if (!line.debit && !line.credit) {
        notify('Each line must have either a debit or credit amount');
        return;
      }
    }

    try {
      const entryData = {
        company_id: user.id,
        entry_number: entry.entry_number,
        entry_date: entry.entry_date,
        description: entry.description || null,
        reference_type: 'manual',
        created_by: user.id
      };

      let savedEntryId = entryId;

      if (entryId) {
        // Update existing entry
        const { error: entryError } = await supabase
          .from('journal_entries')
          .update(entryData)
          .eq('id', entryId);

        if (entryError) throw entryError;

        // Delete existing lines
        const { error: deleteError } = await supabase
          .from('journal_entry_lines')
          .delete()
          .eq('entry_id', entryId);

        if (deleteError) throw deleteError;
      } else {
        // Create new entry
        const { data: newEntry, error: entryError } = await supabase
          .from('journal_entries')
          .insert([entryData])
          .select()
          .single();

        if (entryError) throw entryError;
        savedEntryId = newEntry.id;
      }

      // Insert lines
      const linesData = lines.map(line => ({
        entry_id: savedEntryId,
        line_number: line.line_number,
        account_id: line.account_id,
        debit: parseFloat(line.debit) || 0,
        credit: parseFloat(line.credit) || 0,
        description: line.description || null
      }));

      const { error: linesError } = await supabase
        .from('journal_entry_lines')
        .insert(linesData);

      if (linesError) throw linesError;

      // If should post, post the entry
      if (shouldPost && isBalanced) {
        const { error: postError } = await supabase
          .rpc('post_journal_entry', {
            p_entry_id: savedEntryId,
            p_user_id: user.id
          });

        if (postError) throw postError;
        notify('Journal entry posted successfully!');
        navigate('/accounting/general-ledger');
      } else {
        notify('Journal entry saved as draft!');
        navigate('/accounting/general-ledger');
      }
    } catch (err) {
      console.error('Error saving journal entry:', err);
      notify(`Failed to save: ${err.message}`);
    }
  }

  const { totalDebits, totalCredits, difference, isBalanced } = calculateTotals();
  const formatCurrency = (amount) => {
    return `$${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading...</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>✏️ Journal Entry</h1>
          <p style={styles.subtitle}>
            {entryId ? 'Edit journal entry' : 'Create new journal entry'}
          </p>
        </div>
        <button onClick={() => navigate('/accounting/general-ledger')} style={styles.backButton}>
          ← Back to General Ledger
        </button>
      </div>

      {/* Entry Header */}
      <div style={styles.card}>
        <div style={styles.formRow}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Entry Number</label>
            <input
              type="text"
              value={entry.entry_number}
              onChange={(e) => setEntry({...entry, entry_number: e.target.value})}
              style={styles.input}
              disabled={!!entryId}
            />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Date *</label>
            <input
              type="date"
              value={entry.entry_date}
              onChange={(e) => setEntry({...entry, entry_date: e.target.value})}
              style={styles.input}
            />
          </div>
        </div>
        <div style={styles.formGroup}>
          <label style={styles.label}>Description</label>
          <input
            type="text"
            value={entry.description}
            onChange={(e) => setEntry({...entry, description: e.target.value})}
            style={styles.input}
            placeholder="Optional description for this entry"
          />
        </div>
      </div>

      {/* Journal Entry Lines */}
      <div style={styles.card}>
        <div style={styles.linesHeader}>
          <h3 style={styles.linesTitle}>Journal Entry Lines</h3>
          <button onClick={addLine} style={styles.addLineButton}>
            + Add Line
          </button>
        </div>

        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.tableHeaderRow}>
                <th style={{...styles.th, width: '5%'}}>#</th>
                <th style={{...styles.th, width: '30%'}}>Account</th>
                <th style={{...styles.th, width: '25%'}}>Description</th>
                <th style={{...styles.th, width: '15%', textAlign: 'right'}}>Debit</th>
                <th style={{...styles.th, width: '15%', textAlign: 'right'}}>Credit</th>
                <th style={{...styles.th, width: '10%', textAlign: 'center'}}>Action</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => (
                <tr key={index} style={styles.tableRow}>
                  <td style={styles.td}>{line.line_number}</td>
                  <td style={styles.td}>
                    <select
                      value={line.account_id}
                      onChange={(e) => updateLine(index, 'account_id', e.target.value)}
                      style={styles.selectInput}
                    >
                      <option value="">Select Account...</option>
                      {accounts.map(acc => (
                        <option key={acc.id} value={acc.id}>
                          {acc.account_number} - {acc.account_name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={styles.td}>
                    <input
                      type="text"
                      value={line.description}
                      onChange={(e) => updateLine(index, 'description', e.target.value)}
                      style={styles.lineInput}
                      placeholder="Optional"
                    />
                  </td>
                  <td style={styles.td}>
                    <input
                      type="number"
                      value={line.debit}
                      onChange={(e) => updateLine(index, 'debit', e.target.value)}
                      style={{...styles.lineInput, textAlign: 'right'}}
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                    />
                  </td>
                  <td style={styles.td}>
                    <input
                      type="number"
                      value={line.credit}
                      onChange={(e) => updateLine(index, 'credit', e.target.value)}
                      style={{...styles.lineInput, textAlign: 'right'}}
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                    />
                  </td>
                  <td style={{...styles.td, textAlign: 'center'}}>
                    <button
                      onClick={() => removeLine(index)}
                      style={styles.removeButton}
                      disabled={lines.length <= 2}
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={styles.totalRow}>
                <td colSpan="3" style={{...styles.td, textAlign: 'right', fontWeight: 'bold'}}>
                  TOTALS:
                </td>
                <td style={{...styles.td, textAlign: 'right', fontWeight: 'bold', fontSize: 16}}>
                  {formatCurrency(totalDebits)}
                </td>
                <td style={{...styles.td, textAlign: 'right', fontWeight: 'bold', fontSize: 16}}>
                  {formatCurrency(totalCredits)}
                </td>
                <td style={styles.td}></td>
              </tr>
              <tr style={styles.balanceRow}>
                <td colSpan="3" style={{...styles.td, textAlign: 'right', fontWeight: 'bold'}}>
                  DIFFERENCE:
                </td>
                <td colSpan="2" style={{
                  ...styles.td,
                  textAlign: 'center',
                  fontWeight: 'bold',
                  fontSize: 18,
                  color: isBalanced ? '#10b981' : '#ef4444'
                }}>
                  {isBalanced ? '✅ BALANCED' : `${formatCurrency(Math.abs(difference))} ${difference > 0 ? 'MORE DEBITS' : 'MORE CREDITS'}`}
                </td>
                <td style={styles.td}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Action Buttons */}
      <div style={styles.actions}>
        <button onClick={() => navigate('/accounting/general-ledger')} style={styles.cancelButton}>
          Cancel
        </button>
        <button onClick={() => handleSave(false)} style={styles.saveButton}>
          💾 Save as Draft
        </button>
        <button
          onClick={() => handleSave(true)}
          style={{
            ...styles.postButton,
            opacity: isBalanced ? 1 : 0.5,
            cursor: isBalanced ? 'pointer' : 'not-allowed'
          }}
          disabled={!isBalanced}
        >
          ✅ Save & Post
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    maxWidth: 1200,
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
  loading: {
    textAlign: "center",
    padding: 60,
    fontSize: 18,
    color: "#fff",
  },
  postedWarning: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 40,
    textAlign: "center",
    boxShadow: "0 2px 12px rgba(0,0,0,0.1)",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 24,
    marginBottom: 24,
    boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
  },
  formRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    display: "block",
    marginBottom: 8,
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  input: {
    width: "100%",
    padding: "12px",
    fontSize: 15,
    border: "2px solid #e5e7eb",
    borderRadius: 6,
    outline: "none",
    boxSizing: "border-box",
  },
  linesHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  linesTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#111",
    margin: 0,
  },
  addLineButton: {
    padding: "10px 20px",
    backgroundColor: "#10b981",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    fontSize: 14,
    fontWeight: "600",
    cursor: "pointer",
  },
  tableWrapper: {
    overflowX: "auto",
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
    padding: "12px",
    fontSize: 13,
    fontWeight: "700",
    color: "#666",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    textAlign: "left",
  },
  tableRow: {
    borderBottom: "1px solid #e5e7eb",
  },
  td: {
    padding: "12px",
    fontSize: 14,
    color: "#333",
    verticalAlign: "middle",
  },
  selectInput: {
    width: "100%",
    padding: "8px",
    fontSize: 14,
    border: "1px solid #e5e7eb",
    borderRadius: 4,
    outline: "none",
  },
  lineInput: {
    width: "100%",
    padding: "8px",
    fontSize: 14,
    border: "1px solid #e5e7eb",
    borderRadius: 4,
    outline: "none",
  },
  removeButton: {
    padding: "6px 12px",
    backgroundColor: "transparent",
    border: "none",
    cursor: "pointer",
    fontSize: 16,
  },
  totalRow: {
    backgroundColor: "#f9fafb",
    borderTop: "2px solid #e5e7eb",
  },
  balanceRow: {
    backgroundColor: "#fef3c7",
    borderTop: "2px solid #f59e0b",
  },
  actions: {
    display: "flex",
    gap: 16,
    justifyContent: "flex-end",
  },
  cancelButton: {
    padding: "14px 28px",
    backgroundColor: "#fff",
    border: "2px solid #e5e7eb",
    borderRadius: 8,
    fontSize: 16,
    fontWeight: "600",
    color: "#666",
    cursor: "pointer",
  },
  saveButton: {
    padding: "14px 28px",
    backgroundColor: "#3b82f6",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 16,
    fontWeight: "600",
    cursor: "pointer",
    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
  },
  postButton: {
    padding: "14px 28px",
    backgroundColor: "#10b981",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 16,
    fontWeight: "600",
    cursor: "pointer",
    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
  },
};
