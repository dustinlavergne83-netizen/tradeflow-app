import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { createBillJournalEntry, createBillPaymentJournalEntry } from "../utils/accountingJournals";
import { getTodayLocalDate } from "../utils/dateUtils";
import { notify, confirmDialog } from '../lib/notify';

export default function Bills() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [bills, setBills] = useState([]);
  const [filteredBills, setFilteredBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingBill, setEditingBill] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  
  const [billForm, setBillForm] = useState({
    vendor_name: '',
    bill_number: '',
    bill_date: getTodayLocalDate(),
    due_date: '',
    amount: '',
    description: '',
    category: '',
    notes: ''
  });

  useEffect(() => {
    loadBills();
  }, [user]);

  useEffect(() => {
    applyFilters();
  }, [bills, searchTerm, filterStatus]);

  async function loadBills() {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from("bills")
        .select("*")
        .order("bill_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      setBills(data || []);
    } catch (err) {
      console.error("Error loading bills:", err);
      notify("Failed to load bills: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  function applyFilters() {
    let filtered = [...bills];

    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(b => 
        b.vendor_name?.toLowerCase().includes(search) ||
        b.bill_number?.toLowerCase().includes(search) ||
        b.description?.toLowerCase().includes(search) ||
        b.category?.toLowerCase().includes(search)
      );
    }

    // Status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(b => b.payment_status === filterStatus);
    }

    setFilteredBills(filtered);
  }

  function openAddModal() {
    setEditingBill(null);
    setBillForm({
      vendor_name: '',
      bill_number: '',
      bill_date: getTodayLocalDate(),
      due_date: '',
      amount: '',
      description: '',
      category: '',
      notes: ''
    });
    setShowModal(true);
  }

  function openEditModal(bill) {
    setEditingBill(bill);
    setBillForm({
      vendor_name: bill.vendor_name || '',
      bill_number: bill.bill_number || '',
      bill_date: bill.bill_date || getTodayLocalDate(),
      due_date: bill.due_date || '',
      amount: bill.amount?.toString() || '',
      description: bill.description || '',
      category: bill.category || '',
      notes: bill.notes || ''
    });
    setShowModal(true);
  }

  async function handleSave() {
    if (!billForm.vendor_name || !billForm.amount) {
      notify('Please enter vendor name and amount');
      return;
    }

    try {
      const amount = parseFloat(billForm.amount);
      if (isNaN(amount) || amount <= 0) {
        notify('Please enter a valid positive amount');
        return;
      }

      const billData = {
        vendor_name: billForm.vendor_name,
        bill_number: billForm.bill_number || null,
        bill_date: billForm.bill_date,
        due_date: billForm.due_date || null,
        amount: amount,
        description: billForm.description || null,
        category: billForm.category || null,
        notes: billForm.notes || null,
        created_by: user.id
      };

      if (editingBill) {
        const { error } = await supabase
          .from('bills')
          .update(billData)
          .eq('id', editingBill.id);

        if (error) throw error;
        notify('Bill updated successfully!');
      } else {
        // Insert the bill and get the ID back
        const { data: newBill, error } = await supabase
          .from('bills')
          .insert([billData])
          .select()
          .single();

        if (error) throw error;
        
        // Auto-create journal entry for the new bill
        // Debit: Expense Account, Credit: Accounts Payable
        const journalResult = await createBillJournalEntry(
          newBill,
          user.id,
          user.id // Using user.id as company_id for now
        );
        
        if (journalResult.success) {
          notify('Bill added successfully! Journal entry created automatically.');
        } else {
          notify('Bill added, but journal entry failed: ' + journalResult.error);
        }
      }

      setShowModal(false);
      setEditingBill(null);
      loadBills();
    } catch (err) {
      console.error('Error saving bill:', err);
      notify(`Failed to save: ${err.message}`);
    }
  }

  async function handleMarkAsPaid(bill) {
    if (!await confirmDialog(`Mark bill from ${bill.vendor_name} as paid?`)) {
      return;
    }

    try {
      const paidDate = new Date().toISOString().split('T')[0];
      
      const { error } = await supabase
        .from('bills')
        .update({ 
          payment_status: 'paid',
          paid_date: paidDate
        })
        .eq('id', bill.id);

      if (error) throw error;
      
      // Auto-create journal entry for bill payment
      // Debit: Accounts Payable, Credit: Cash
      const updatedBill = { ...bill, paid_date: paidDate, payment_status: 'paid' };
      const journalResult = await createBillPaymentJournalEntry(
        updatedBill,
        user.id,
        user.id // Using user.id as company_id for now
      );
      
      if (journalResult.success) {
        notify('Bill marked as paid! Payment journal entry created automatically.');
      } else {
        notify('Bill marked as paid, but journal entry failed: ' + journalResult.error);
      }
      
      loadBills();
    } catch (err) {
      console.error('Error marking bill as paid:', err);
      notify(`Failed to update: ${err.message}`);
    }
  }

  async function handleMarkAsUnpaid(bill) {
    if (!await confirmDialog(`Mark bill from ${bill.vendor_name} as unpaid?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('bills')
        .update({ 
          payment_status: 'unpaid',
          paid_date: null
        })
        .eq('id', bill.id);

      if (error) throw error;
      notify('Bill marked as unpaid!');
      loadBills();
    } catch (err) {
      console.error('Error marking bill as unpaid:', err);
      notify(`Failed to update: ${err.message}`);
    }
  }

  async function handleDelete(bill) {
    if (!await confirmDialog(`Delete bill from ${bill.vendor_name}?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('bills')
        .delete()
        .eq('id', bill.id);

      if (error) throw error;
      notify('Bill deleted successfully!');
      loadBills();
    } catch (err) {
      console.error('Error deleting bill:', err);
      notify(`Failed to delete: ${err.message}`);
    }
  }

  function isOverdue(bill) {
    if (bill.payment_status === 'paid') return false;
    if (!bill.due_date) return false;
    return new Date(bill.due_date) < new Date();
  }

  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return '$0.00';
    return `$${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString.includes('T') ? dateString : dateString + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getStatusBadge = (bill) => {
    if (bill.payment_status === 'paid') {
      return <span style={styles.paidBadge}>✓ Paid</span>;
    } else if (isOverdue(bill)) {
      return <span style={styles.overdueBadge}>⚠ Overdue</span>;
    } else {
      return <span style={styles.unpaidBadge}>○ Unpaid</span>;
    }
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading bills...</div>
      </div>
    );
  }

  const totalBills = bills.length;
  const unpaidBills = bills.filter(b => b.payment_status === 'unpaid').length;
  const overdueBills = bills.filter(b => isOverdue(b)).length;
  const totalUnpaidAmount = bills
    .filter(b => b.payment_status === 'unpaid')
    .reduce((sum, b) => sum + (b.amount || 0), 0);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <button onClick={() => navigate('/accounting')} style={styles.backButton}>
            ← Back to Accounting
          </button>
          <h1 style={styles.title}>📄 Bills</h1>
          <p style={styles.subtitle}>Track and manage vendor bills</p>
        </div>
        <button onClick={openAddModal} style={styles.newButton}>
          + Add Bill
        </button>
      </div>

      {/* Summary Cards */}
      <div style={styles.summaryGrid}>
        <div style={styles.summaryCard}>
          <div style={styles.summaryLabel}>Total Bills</div>
          <div style={styles.summaryValue}>{totalBills}</div>
        </div>
        <div style={styles.summaryCard}>
          <div style={styles.summaryLabel}>Unpaid Bills</div>
          <div style={{...styles.summaryValue, color: '#f59e0b'}}>{unpaidBills}</div>
        </div>
        <div style={styles.summaryCard}>
          <div style={styles.summaryLabel}>Overdue Bills</div>
          <div style={{...styles.summaryValue, color: '#ef4444'}}>{overdueBills}</div>
        </div>
        <div style={styles.summaryCard}>
          <div style={styles.summaryLabel}>Amount Due</div>
          <div style={{...styles.summaryValue, color: '#ef4444'}}>
            {formatCurrency(totalUnpaidAmount)}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={styles.filtersSection}>
        <div style={styles.searchBox}>
          <span style={styles.searchIcon}>🔍</span>
          <input
            type="text"
            placeholder="Search bills..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={styles.searchInput}
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={styles.filterSelect}
        >
          <option value="all">All Status</option>
          <option value="unpaid">Unpaid</option>
          <option value="paid">Paid</option>
        </select>
      </div>

      {/* Bills Table */}
      {filteredBills.length === 0 ? (
        <div style={styles.empty}>
          <p style={styles.emptyText}>
            {searchTerm || filterStatus !== 'all' 
              ? 'No bills match your filters'
              : 'No bills yet. Click "Add Bill" to get started!'}
          </p>
        </div>
      ) : (
        <div style={styles.tableContainer}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.tableHeader}>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Vendor</th>
                <th style={styles.th}>Bill #</th>
                <th style={styles.th}>Bill Date</th>
                <th style={styles.th}>Due Date</th>
                <th style={styles.th}>Amount</th>
                <th style={styles.th}>Description</th>
                <th style={styles.th}>Category</th>
                <th style={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBills.map(bill => (
                <tr 
                  key={bill.id} 
                  style={{
                    ...styles.tableRow,
                    backgroundColor: isOverdue(bill) ? '#fee2e2' : 
                                   bill.payment_status === 'paid' ? '#f0fdf4' : '#fff',
                  }}
                >
                  <td style={styles.td}>{getStatusBadge(bill)}</td>
                  <td style={styles.td}>
                    <strong>{bill.vendor_name}</strong>
                  </td>
                  <td style={styles.td}>{bill.bill_number || '-'}</td>
                  <td style={styles.td}>{formatDate(bill.bill_date)}</td>
                  <td style={styles.td}>
                    {bill.due_date ? formatDate(bill.due_date) : '-'}
                  </td>
                  <td style={{...styles.td, fontWeight: 'bold'}}>
                    {formatCurrency(bill.amount)}
                  </td>
                  <td style={styles.td}>{bill.description || '-'}</td>
                  <td style={styles.td}>{bill.category || '-'}</td>
                  <td style={styles.td}>
                    <div style={styles.actionButtons}>
                      {bill.payment_status === 'unpaid' ? (
                        <button
                          onClick={() => handleMarkAsPaid(bill)}
                          style={styles.paidBtn}
                          title="Mark as Paid"
                        >
                          ✓
                        </button>
                      ) : (
                        <button
                          onClick={() => handleMarkAsUnpaid(bill)}
                          style={styles.unpaidBtn}
                          title="Mark as Unpaid"
                        >
                          ↺
                        </button>
                      )}
                      <button
                        onClick={() => openEditModal(bill)}
                        style={styles.actionBtn}
                        title="Edit"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDelete(bill)}
                        style={{...styles.actionBtn, ...styles.deleteBtn}}
                        title="Delete"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Bill Modal */}
      {showModal && (
        <div style={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>
                {editingBill ? 'Edit Bill' : 'Add New Bill'}
              </h2>
              <button onClick={() => setShowModal(false)} style={styles.closeButton}>
                ×
              </button>
            </div>

            <div style={styles.modalBody}>
              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Vendor Name *</label>
                  <input
                    type="text"
                    value={billForm.vendor_name}
                    onChange={(e) => setBillForm({...billForm, vendor_name: e.target.value})}
                    style={styles.input}
                    placeholder="e.g., ABC Supplies Inc."
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Bill Number</label>
                  <input
                    type="text"
                    value={billForm.bill_number}
                    onChange={(e) => setBillForm({...billForm, bill_number: e.target.value})}
                    style={styles.input}
                    placeholder="Invoice/Bill number"
                  />
                </div>
              </div>

              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Bill Date *</label>
                  <input
                    type="date"
                    value={billForm.bill_date}
                    onChange={(e) => setBillForm({...billForm, bill_date: e.target.value})}
                    style={styles.input}
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Due Date</label>
                  <input
                    type="date"
                    value={billForm.due_date}
                    onChange={(e) => setBillForm({...billForm, due_date: e.target.value})}
                    style={styles.input}
                  />
                </div>
              </div>

              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Amount *</label>
                  <input
                    type="number"
                    value={billForm.amount}
                    onChange={(e) => setBillForm({...billForm, amount: e.target.value})}
                    style={styles.input}
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Category</label>
                  <input
                    type="text"
                    value={billForm.category}
                    onChange={(e) => setBillForm({...billForm, category: e.target.value})}
                    style={styles.input}
                    placeholder="e.g., Office Supplies, Utilities"
                  />
                </div>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Description</label>
                <input
                  type="text"
                  value={billForm.description}
                  onChange={(e) => setBillForm({...billForm, description: e.target.value})}
                  style={styles.input}
                  placeholder="Brief description of the bill"
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Notes</label>
                <textarea
                  value={billForm.notes}
                  onChange={(e) => setBillForm({...billForm, notes: e.target.value})}
                  style={{...styles.input, minHeight: 80, resize: 'vertical'}}
                  placeholder="Optional notes..."
                />
              </div>
            </div>

            <div style={styles.modalFooter}>
              <button onClick={() => setShowModal(false)} style={styles.cancelButton}>
                Cancel
              </button>
              <button onClick={handleSave} style={styles.saveButton}>
                {editingBill ? '💾 Update Bill' : '➕ Add Bill'}
              </button>
            </div>
          </div>
        </div>
      )}
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
    alignItems: "flex-start",
    marginBottom: 30,
  },
  backButton: {
    padding: "8px 16px",
    backgroundColor: "#fff",
    border: "2px solid #e5e7eb",
    borderRadius: 6,
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    cursor: "pointer",
    marginBottom: 12,
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
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
    gap: 20,
    marginBottom: 30,
  },
  summaryCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 24,
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  },
  summaryLabel: {
    fontSize: 14,
    color: "#666",
    marginBottom: 8,
    fontWeight: "600",
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#111",
  },
  filtersSection: {
    display: "flex",
    gap: 12,
    marginBottom: 24,
    flexWrap: "wrap",
  },
  searchBox: {
    flex: 1,
    minWidth: 300,
    position: "relative",
    display: "flex",
    alignItems: "center",
  },
  searchIcon: {
    position: "absolute",
    left: 12,
    fontSize: 18,
  },
  searchInput: {
    width: "100%",
    padding: "12px 12px 12px 40px",
    fontSize: 15,
    border: "2px solid #e5e7eb",
    borderRadius: 8,
    outline: "none",
    backgroundColor: "#fff",
  },
  filterSelect: {
    padding: "12px 16px",
    fontSize: 15,
    border: "2px solid #e5e7eb",
    borderRadius: 8,
    outline: "none",
    backgroundColor: "#fff",
    cursor: "pointer",
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
  tableContainer: {
    backgroundColor: "#fff",
    borderRadius: 12,
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
    overflow: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 14,
  },
  tableHeader: {
    backgroundColor: "#f9fafb",
    borderBottom: "2px solid #e5e7eb",
  },
  th: {
    padding: "16px 12px",
    textAlign: "left",
    fontWeight: "700",
    color: "#374151",
    whiteSpace: "nowrap",
  },
  tableRow: {
    borderBottom: "1px solid #e5e7eb",
    transition: "background-color 0.15s",
  },
  td: {
    padding: "12px",
    color: "#111",
  },
  paidBadge: {
    display: "inline-block",
    padding: "4px 12px",
    backgroundColor: "#d1fae5",
    color: "#065f46",
    borderRadius: 12,
    fontSize: 13,
    fontWeight: "600",
  },
  unpaidBadge: {
    display: "inline-block",
    padding: "4px 12px",
    backgroundColor: "#fef3c7",
    color: "#92400e",
    borderRadius: 12,
    fontSize: 13,
    fontWeight: "600",
  },
  overdueBadge: {
    display: "inline-block",
    padding: "4px 12px",
    backgroundColor: "#fee2e2",
    color: "#991b1b",
    borderRadius: 12,
    fontSize: 13,
    fontWeight: "600",
  },
  actionButtons: {
    display: "flex",
    gap: 8,
  },
  actionBtn: {
    background: "none",
    border: "1px solid #e5e7eb",
    borderRadius: 4,
    padding: "4px 8px",
    fontSize: 14,
    cursor: "pointer",
  },
  paidBtn: {
    background: "#10b981",
    color: "#fff",
    border: "none",
    borderRadius: 4,
    padding: "4px 10px",
    fontSize: 14,
    fontWeight: "bold",
    cursor: "pointer",
  },
  unpaidBtn: {
    background: "#f59e0b",
    color: "#fff",
    border: "none",
    borderRadius: 4,
    padding: "4px 10px",
    fontSize: 14,
    fontWeight: "bold",
    cursor: "pointer",
  },
  deleteBtn: {
    borderColor: "#ef4444",
  },
  // Modal styles
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.7)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 12,
    maxWidth: 800,
    width: "90%",
    maxHeight: "90vh",
    overflow: "auto",
    boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "24px",
    borderBottom: "2px solid #e5e7eb",
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#111",
    margin: 0,
  },
  closeButton: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#666",
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: 0,
    width: 32,
    height: 32,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  modalBody: {
    padding: "24px",
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
  modalFooter: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 12,
    padding: "24px",
    borderTop: "2px solid #e5e7eb",
  },
  cancelButton: {
    padding: "12px 24px",
    backgroundColor: "#fff",
    color: "#666",
    border: "2px solid #ddd",
    borderRadius: 8,
    fontSize: 16,
    fontWeight: "600",
    cursor: "pointer",
  },
  saveButton: {
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
};
