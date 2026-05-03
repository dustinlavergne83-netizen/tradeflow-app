import React, { useState, useRef, useEffect } from "react";
import Papa from "papaparse";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

import { formatDate } from "../utils/dateUtils";

export default function Vendors() {
  const { user } = useAuth();
  const [vendors, setVendors] = useState([]);
  const [selected, setSelected] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [showModal, setShowModal] = useState(false);
  const [newVendor, setNewVendor] = useState({ 
    vendor_name: "", 
    contact_person: "", 
    address: "", 
    email: "", 
    phone: "", 
    website: "",
    account_number: "",
    payment_terms: "30",
    notes: "",
    balance: "" 
  });
  const [showArchived, setShowArchived] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [recentExpenses, setRecentExpenses] = useState([]);
  const fileRef = useRef(null);
  const [vendorContacts, setVendorContacts] = useState([]);
  const [showAddContact, setShowAddContact] = useState(false);
  const [contactForm, setContactForm] = useState({ name: '', title: '', email: '', phone: '' });
  const [savingContact, setSavingContact] = useState(false);

  // Load vendors from Supabase
  useEffect(() => {
    loadVendors();
  }, []);

  // Load recent expenses and contacts when vendor is selected
  useEffect(() => {
    if (selectedVendor) {
      loadRecentExpenses(selectedVendor.id);
      loadVendorContacts(selectedVendor.id);
      setShowAddContact(false);
      setContactForm({ name: '', title: '', email: '', phone: '' });
    } else {
      setVendorContacts([]);
    }
  }, [selectedVendor]);

  async function loadVendorContacts(vendorId) {
    const { data, error } = await supabase
      .from('vendor_contacts')
      .select('*')
      .eq('vendor_id', vendorId)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: true });
    if (!error) setVendorContacts(data || []);
  }

  async function addContact() {
    if (!contactForm.name.trim()) { alert('Contact name is required'); return; }
    setSavingContact(true);
    try {
      const { data, error } = await supabase
        .from('vendor_contacts')
        .insert([{ vendor_id: selectedVendor.id, ...contactForm }])
        .select()
        .single();
      if (error) throw error;
      setVendorContacts(prev => [...prev, data]);
      setContactForm({ name: '', title: '', email: '', phone: '' });
      setShowAddContact(false);
    } catch (err) {
      alert('Failed to add contact: ' + err.message);
    } finally {
      setSavingContact(false);
    }
  }

  async function deleteContact(contactId) {
    if (!confirm('Delete this contact?')) return;
    const { error } = await supabase.from('vendor_contacts').delete().eq('id', contactId);
    if (!error) setVendorContacts(prev => prev.filter(c => c.id !== contactId));
    else alert('Failed to delete contact: ' + error.message);
  }

  const loadVendors = async () => {
    const { data, error } = await supabase
      .from('vendors')
      .select('*')
      .order('vendor_name');
    
    if (error) {
      console.error("Failed to load vendors", error);
    } else {
      setVendors(data || []);
    }
  };

  const loadRecentExpenses = async (vendorId) => {
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('vendor', selectedVendor?.vendor_name)
        .eq('created_by', user.id)
        .order('expense_date', { ascending: false })
        .limit(10);
      
      if (error) {
        console.error("Failed to load recent expenses:", error);
        setRecentExpenses([]);
      } else {
        setRecentExpenses(data || []);
      }
    } catch (err) {
      console.error("Error loading recent expenses:", err);
      setRecentExpenses([]);
    }
  };

  // Filter vendors by search term
  const filteredVendors = vendors.filter(v => {
    const search = searchTerm.toLowerCase();
    return (
      v.vendor_name?.toLowerCase().includes(search) ||
      v.contact_person?.toLowerCase().includes(search) ||
      v.email?.toLowerCase().includes(search) ||
      v.phone?.toLowerCase().includes(search) ||
      v.address?.toLowerCase().includes(search)
    );
  });

  // Show all or archived vendors
  const displayedVendors = showArchived 
    ? filteredVendors.filter(v => v.archived === true)
    : filteredVendors.filter(v => !v.archived);

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        console.log("CSV columns found:", results.data[0] ? Object.keys(results.data[0]) : []);
        console.log("First row sample:", results.data[0]);
        
        const imported = results.data.map(row => ({
          vendor_name: row["Vendor Name"] || row.Name || row.Vendor || "",
          contact_person: row["Contact Person"] || row.Contact || "",
          address: row.Address || "",
          email: row.Email || "",
          phone: row.Phone || "",
          website: row.Website || "",
          account_number: row["Account Number"] || row["Account #"] || "",
          payment_terms: row["Payment Terms"] || "30",
          notes: row.Notes || "",
          balance: parseFloat(row.Balance || row["Open Balance"] || 0)
        })).filter(v => v.vendor_name.trim());
        
        console.log("Mapped data sample:", imported[0]);
        
        if (imported.length === 0) {
          alert("No valid vendors found in CSV");
          e.target.value = null;
          return;
        }

        // Add company_id (current user's ID) to each vendor
        const vendorsWithCompanyId = imported.map(vendor => ({
          ...vendor,
          company_id: user.id
        }));

        const { data, error } = await supabase
          .from('vendors')
          .insert(vendorsWithCompanyId)
          .select();
        
        if (error) {
          console.error("Import error:", error);
          alert("Failed to import vendors: " + error.message);
        } else {
          await loadVendors();
          alert(`Successfully imported ${imported.length} vendors!`);
        }
        e.target.value = null;
      },
      error: (err) => alert("Failed to parse CSV: " + err.message)
    });
  };

  const handleExport = () => {
    if (!vendors.length) return alert("No vendors to export");
    const csv = Papa.unparse(vendors);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vendors.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleAdd = async () => {
    if (!newVendor.vendor_name.trim()) return alert("Vendor name is required");
    
    // Convert numeric fields from strings to numbers
    const vendorData = {
      ...newVendor,
      company_id: user.id,
      payment_terms: parseInt(newVendor.payment_terms) || 30,
      balance: parseFloat(newVendor.balance) || 0
    };
    
    const { data, error } = await supabase
      .from('vendors')
      .insert([vendorData])
      .select();
    
    if (error) {
      console.error("Add error:", error);
      alert("Failed to add vendor: " + error.message);
    } else {
      await loadVendors();
      setNewVendor({ 
        vendor_name: "", 
        contact_person: "", 
        address: "", 
        email: "", 
        phone: "", 
        website: "",
        account_number: "",
        payment_terms: "30",
        notes: "",
        balance: "" 
      });
      setShowModal(false);
    }
  };

  const handleEdit = (vendor) => {
    setEditingId(vendor.id);
    setEditForm({ ...vendor });
  };

  const handleSaveEdit = async () => {
    // Convert numeric fields from strings to numbers for editing
    const editData = {
      ...editForm,
      payment_terms: typeof editForm.payment_terms === 'string' ? parseInt(editForm.payment_terms) || 30 : editForm.payment_terms,
      balance: typeof editForm.balance === 'string' ? parseFloat(editForm.balance) || 0 : editForm.balance
    };
    
    const { error } = await supabase
      .from('vendors')
      .update(editData)
      .eq('id', editingId);
    
    if (error) {
      console.error("Update error:", error);
      alert("Failed to update vendor: " + error.message);
    } else {
      await loadVendors();
      setEditingId(null);
      setEditForm({});
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this vendor?")) return;
    
    const { error } = await supabase
      .from('vendors')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error("Delete error:", error);
      alert("Failed to delete vendor: " + error.message);
    } else {
      await loadVendors();
      setSelected(prev => prev.filter(sid => sid !== id));
    }
  };

  const handleArchive = async (id) => {
    const vendor = vendors.find(v => v.id === id);
    if (!vendor) return;
    
    const { error } = await supabase
      .from('vendors')
      .update({ archived: !vendor.archived })
      .eq('id', id);
    
    if (error) {
      console.error("Archive error:", error);
      alert("Failed to archive vendor: " + error.message);
    } else {
      await loadVendors();
    }
  };

  const handleSelectAll = () => {
    if (selected.length === displayedVendors.length) {
      setSelected([]);
    } else {
      setSelected(displayedVendors.map(v => v.id));
    }
  };

  const handleDeleteSelected = async () => {
    if (!confirm(`Delete ${selected.length} vendors?`)) return;
    
    const { error } = await supabase
      .from('vendors')
      .delete()
      .in('id', selected);
    
    if (error) {
      console.error("Delete error:", error);
      alert("Failed to delete vendors: " + error.message);
    } else {
      await loadVendors();
      setSelected([]);
    }
  };

  return (
    <div style={styles.page}>
      {/* Add Vendor Button - Top Right */}
      <div style={styles.addButtonContainer}>
        <button onClick={() => setShowModal(true)} style={styles.addButton}>
          + Add Vendor
        </button>
      </div>

      {/* Selected Vendor Card */}
      {selectedVendor && (
        <div style={styles.vendorCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 style={{ margin: 0, color: '#fff' }}>{selectedVendor.vendor_name}</h2>
            <div style={{ display: 'flex', gap: 8 }}>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  handleArchive(selectedVendor.id);
                  setSelectedVendor(null);
                }} 
                style={{ ...styles.addButton, background: '#666' }}
              >
                {selectedVendor.archived ? 'Unarchive' : 'Archive'}
              </button>
              <button onClick={() => setSelectedVendor(null)} style={{ ...styles.addButton, background: '#666' }}>
                Close
              </button>
            </div>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, marginBottom: 30 }}>
            <div>
              <h3 style={{ color: '#fc6b04', marginBottom: 10 }}>Contact Info</h3>
              <p style={{ color: '#fff', margin: '5px 0' }}><strong>Contact Person:</strong> {selectedVendor.contact_person || 'N/A'}</p>
              <p style={{ color: '#fff', margin: '5px 0' }}><strong>Email:</strong> {selectedVendor.email || 'N/A'}</p>
              <p style={{ color: '#fff', margin: '5px 0' }}><strong>Phone:</strong> {selectedVendor.phone || 'N/A'}</p>
              <p style={{ color: '#fff', margin: '5px 0' }}><strong>Website:</strong> {selectedVendor.website || 'N/A'}</p>
              <p style={{ color: '#fff', margin: '5px 0' }}><strong>Address:</strong> {selectedVendor.address || 'N/A'}</p>
            </div>
            
            <div>
              <h3 style={{ color: '#fc6b04', marginBottom: 10 }}>Account Details</h3>
              <p style={{ color: '#fff', margin: '5px 0' }}><strong>Account #:</strong> {selectedVendor.account_number || 'N/A'}</p>
              <p style={{ color: '#fff', margin: '5px 0' }}><strong>Payment Terms:</strong> Net {selectedVendor.payment_terms || '30'} days</p>
              <p style={{ color: '#fff', margin: '5px 0' }}><strong>Balance Owed:</strong> ${selectedVendor.balance || 0}</p>
              {selectedVendor.notes && <p style={{ color: '#fff', margin: '5px 0' }}><strong>Notes:</strong> {selectedVendor.notes}</p>}
            </div>
            
            <div>
              <h3 style={{ color: '#fc6b04', marginBottom: 10 }}>Quick Actions</h3>
              <button style={{ ...styles.addButton, marginBottom: 10, width: '100%' }}>New Bill</button>
              <button style={{ ...styles.addButton, width: '100%' }}>New Expense</button>
            </div>
          </div>
          
          {/* Contacts Section */}
          <div style={{ ...styles.section, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ color: '#fc6b04', margin: 0 }}>👥 Contacts ({vendorContacts.length})</h3>
              <button
                onClick={() => setShowAddContact(!showAddContact)}
                style={{ padding: '6px 14px', background: '#fc6b04', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}
              >
                {showAddContact ? '✕ Cancel' : '+ Add Contact'}
              </button>
            </div>

            {/* Add Contact Form */}
            {showAddContact && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: 8, marginBottom: 12, padding: 12, background: '#1a1a1a', borderRadius: 8 }}>
                <input
                  placeholder="Name *"
                  value={contactForm.name}
                  onChange={e => setContactForm({ ...contactForm, name: e.target.value })}
                  style={{ ...styles.input, marginBottom: 0 }}
                />
                <input
                  placeholder="Title / Role"
                  value={contactForm.title}
                  onChange={e => setContactForm({ ...contactForm, title: e.target.value })}
                  style={{ ...styles.input, marginBottom: 0 }}
                />
                <input
                  placeholder="Email"
                  value={contactForm.email}
                  onChange={e => setContactForm({ ...contactForm, email: e.target.value })}
                  style={{ ...styles.input, marginBottom: 0 }}
                />
                <input
                  placeholder="Phone"
                  value={contactForm.phone}
                  onChange={e => setContactForm({ ...contactForm, phone: e.target.value })}
                  style={{ ...styles.input, marginBottom: 0 }}
                />
                <button
                  onClick={addContact}
                  disabled={savingContact}
                  style={{ padding: '8px 16px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap' }}
                >
                  {savingContact ? '⏳' : '✅ Save'}
                </button>
              </div>
            )}

            {/* Contacts List */}
            {vendorContacts.length === 0 ? (
              <p style={{ color: '#999', margin: 0, fontSize: 13 }}>No contacts added yet. Click "+ Add Contact" to add.</p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {vendorContacts.map(contact => (
                  <div key={contact.id} style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 8, padding: '10px 14px', minWidth: 200, flex: '0 1 auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>{contact.name}</div>
                        {contact.title && <div style={{ color: '#fc6b04', fontSize: 12, marginBottom: 4 }}>{contact.title}</div>}
                        {contact.email && <div style={{ color: '#9ca3af', fontSize: 12 }}>✉ {contact.email}</div>}
                        {contact.phone && <div style={{ color: '#9ca3af', fontSize: 12 }}>📱 {contact.phone}</div>}
                      </div>
                      <button
                        onClick={() => deleteContact(contact.id)}
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 16, lineHeight: 1, marginLeft: 8 }}
                        title="Delete contact"
                      >×</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <div style={styles.section}>
              <h3 style={{ color: '#fc6b04', marginBottom: 10 }}>Recent Bills</h3>
              <p style={{ color: '#999' }}>No bills yet</p>
            </div>
            
            <div style={styles.section}>
              <h3 style={{ color: '#fc6b04', marginBottom: 10 }}>Recent Expenses</h3>
              {recentExpenses.length > 0 ? (
                <div>
                  {recentExpenses.map((expense, idx) => (
                    <div key={idx} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid #444' }}>
                      <p style={{ color: '#fff', margin: '3px 0', fontSize: 12 }}>
                        <strong>${expense.amount}</strong> - {formatDate(expense.expense_date)}
                      </p>
                      <p style={{ color: '#999', margin: '3px 0', fontSize: 11 }}>
                        {expense.category}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: '#999' }}>No expenses yet</p>
              )}
            </div>
            
            <div style={styles.section}>
              <h3 style={{ color: '#fc6b04', marginBottom: 10 }}>Purchase History</h3>
              <p style={{ color: '#999' }}>No purchases yet</p>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div style={styles.toolbar}>
        <input 
          type="text"
          placeholder="Search vendors..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={styles.searchInput}
        />
        <button onClick={() => fileRef.current?.click()}>Import CSV</button>
        <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleImport} />
        <button onClick={handleExport}>Export CSV</button>
        <button onClick={() => setShowArchived(!showArchived)}>
          {showArchived ? 'Show Active' : 'Show Archived'}
        </button>
        <button onClick={handleSelectAll}>
          {selected.length === displayedVendors.length ? 'Deselect All' : 'Select All'}
        </button>
        <button onClick={handleDeleteSelected} disabled={!selected.length}>
          Delete Selected ({selected.length})
        </button>
      </div>

      {/* Table */}
      <div style={styles.tableContainer}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={{ width: '40px', padding: '12px 8px' }}></th>          
              <th style={{ width: '200px', padding: '12px 8px' }}>Vendor Name</th>     
              <th style={{ width: '150px', padding: '12px 8px' }}>Contact Person</th>   
              <th style={{ width: '200px', padding: '12px 8px' }}>Email</th>    
              <th style={{ width: '120px', padding: '12px 8px' }}>Phone</th>
              <th style={{ width: '120px', padding: '12px 8px' }}>Payment Terms</th>
              <th style={{ width: '100px', padding: '12px 8px' }}>Balance</th>
              <th style={{ width: '80px', padding: '12px 8px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {displayedVendors.map(vendor => (
              <tr 
                key={vendor.id} 
                style={{ 
                  borderTop: '1px solid #444', 
                  borderBottom: '1px solid #444',
                  cursor: 'pointer',
                  background: selectedVendor?.id === vendor.id ? '#1a4d8f' : 'transparent'
                }}
                onClick={() => {
                  setSelectedVendor(vendor);
                  setSearchTerm("");
                }}
              >
                <td style={{ padding: '12px 8px' }}>
                  <input
                    type="checkbox"
                    checked={selected.includes(vendor.id)}
                    onChange={() => setSelected(prev => 
                      prev.includes(vendor.id) 
                        ? prev.filter(id => id !== vendor.id)
                        : [...prev, vendor.id]
                    )}
                    onClick={(e) => e.stopPropagation()}
                  />
                </td>
                {editingId === vendor.id ? (
                  <>
                    <td style={{ padding: '12px 8px' }}><input value={editForm.vendor_name} onChange={e => setEditForm({...editForm, vendor_name: e.target.value})} style={{width: '95%'}} /></td>
                    <td style={{ padding: '12px 8px' }}><input value={editForm.contact_person} onChange={e => setEditForm({...editForm, contact_person: e.target.value})} style={{width: '95%'}} /></td>
                    <td style={{ padding: '12px 8px' }}><input value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} style={{width: '95%'}} /></td>
                    <td style={{ padding: '12px 8px' }}><input value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} style={{width: '95%'}} /></td>
                    <td style={{ padding: '12px 8px' }}><input value={editForm.payment_terms} onChange={e => setEditForm({...editForm, payment_terms: e.target.value})} style={{width: '95%'}} /></td>
                    <td style={{ padding: '12px 8px' }}><input value={editForm.balance} onChange={e => setEditForm({...editForm, balance: e.target.value})} style={{width: '95%'}} /></td>
                    <td style={{ padding: '12px 8px' }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button 
                          onClick={handleSaveEdit}
                          style={{ 
                            padding: '4px 8px', 
                            fontSize: 12, 
                            background: '#4CAF50',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 4,
                            cursor: 'pointer'
                          }}
                        >
                          ✓
                        </button>
                        <button 
                          onClick={() => {
                            setEditingId(null);
                            setEditForm({});
                          }}
                          style={{ 
                            padding: '4px 8px', 
                            fontSize: 12, 
                            background: '#f44336',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 4,
                            cursor: 'pointer'
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td style={{ padding: '12px 8px' }}>{vendor.vendor_name}</td>
                    <td style={{ padding: '12px 8px' }}>{vendor.contact_person || "-"}</td>
                    <td style={{ padding: '12px 8px' }}>{vendor.email || "-"}</td>
                    <td style={{ padding: '12px 8px' }}>{vendor.phone || "-"}</td>
                    <td style={{ padding: '12px 8px' }}>Net {vendor.payment_terms || "30"}</td>
                    <td style={{ padding: '12px 8px' }}>${vendor.balance || 0}</td>
                    <td style={{ padding: '12px 8px' }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button 
                          onClick={() => handleEdit(vendor)}
                          style={{ 
                            padding: '4px 8px', 
                            fontSize: 12, 
                            background: '#fc6b04',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 4,
                            cursor: 'pointer'
                          }}
                        >
                          ✏️
                        </button>
                        <button 
                          onClick={() => handleArchive(vendor.id)}
                          style={{ 
                            padding: '4px 8px', 
                            fontSize: 12, 
                            background: vendor.archived ? '#4CAF50' : '#666',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 4,
                            cursor: 'pointer'
                          }}
                        >
                          {vendor.archived ? '↩' : '📦'}
                        </button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {displayedVendors.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>
            {showArchived ? 'No archived vendors' : 'No vendors yet. Click "Add Vendor" or import a CSV file.'}
          </div>
        )}
      </div>

      {/* Add Vendor Modal */}
      {showModal && (
        <div style={styles.overlay} onClick={() => setShowModal(false)}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 style={{color: '#fff', marginBottom: 20}}>New Vendor</h3>
            <input placeholder="Vendor Name *" value={newVendor.vendor_name} onChange={e => setNewVendor({...newVendor, vendor_name: e.target.value})} style={styles.input} />
            <input placeholder="Contact Person" value={newVendor.contact_person} onChange={e => setNewVendor({...newVendor, contact_person: e.target.value})} style={styles.input} />
            <input placeholder="Email" value={newVendor.email} onChange={e => setNewVendor({...newVendor, email: e.target.value})} style={styles.input} />
            <input placeholder="Phone" value={newVendor.phone} onChange={e => setNewVendor({...newVendor, phone: e.target.value})} style={styles.input} />
            <input placeholder="Address" value={newVendor.address} onChange={e => setNewVendor({...newVendor, address: e.target.value})} style={styles.input} />
            <input placeholder="Website" value={newVendor.website} onChange={e => setNewVendor({...newVendor, website: e.target.value})} style={styles.input} />
            <input placeholder="Account Number" value={newVendor.account_number} onChange={e => setNewVendor({...newVendor, account_number: e.target.value})} style={styles.input} />
            <input placeholder="Payment Terms (days)" value={newVendor.payment_terms} onChange={e => setNewVendor({...newVendor, payment_terms: e.target.value})} style={styles.input} />
            <textarea placeholder="Notes" value={newVendor.notes} onChange={e => setNewVendor({...newVendor, notes: e.target.value})} style={{...styles.input, minHeight: 60}} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
              <button onClick={() => setShowModal(false)} style={{padding: '8px 16px'}}>Cancel</button>
              <button onClick={handleAdd} style={{padding: '8px 16px', background: '#fc6b04', color: '#fff', border: 'none', borderRadius: 4}}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  page: {
    padding: "40px 24px",
    paddingTop: "40px",
    paddingLeft: "70px",
    minHeight: "100vh",
    backgroundColor: "#0b3ea8",
  },
  addButtonContainer: {
    position: 'absolute',
    top: '80px',
    right: '24px',
    zIndex: 100,
  },
  addButton: {
    padding: '12px 20px',
    background: '#fc6b04',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontWeight: 700,
    cursor: 'pointer',
    fontSize: 15,
    whiteSpace: 'nowrap',
  },
  toolbar: {
    display: 'flex',
    gap: 8,
    marginBottom: 10,
    flexWrap: 'wrap',
    width: '1090px',
    alignItems: 'center',
  },
  searchInput: {
    padding: '8px 12px',
    borderRadius: 6,
    background: '#fff',
    color: '#000',
    border: '1px solid #ccc',
    fontSize: 14,
    width: '250px',
  },
  tableContainer: {
    width: '1170px',
    height: 'calc(100vh - 100px)',
    overflow: 'auto',
    background: '#1e1e1e',
    borderRadius: 8,
    boxSizing: 'border-box',
    WebkitOverflowScrolling: 'touch',
  },
  table: {
    width: '1150px',
    minWidth: '1090px',
    borderCollapse: 'collapse',
    color: '#fff',
    tableLayout: 'fixed',
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    background: '#1e1e1e',
    padding: 24,
    borderRadius: 8,
    width: 500,
    maxWidth: '90%',
    maxHeight: '90vh',
    overflow: 'auto',
  },
  input: {
    width: '100%',
    padding: 10,
    marginBottom: 10,
    borderRadius: 6,
    background: '#111',
    color: 'white',
    border: '1px solid #333',
    boxSizing: 'border-box',
  },
  vendorCard: {
    background: '#1e1e1e',
    borderRadius: 8,
    padding: 15,
    marginBottom: 20,
    border: '2px solid #fc6b04',
    width: '1170px',
    maxHeight: '400px',
    overflow: 'auto',
  },
  section: {
    background: '#252525',
    padding: 15,
    borderRadius: 6,
  },
};
