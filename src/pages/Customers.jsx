import React, { useState, useRef, useEffect } from "react";
import Papa from "papaparse";
import { supabase } from "../lib/supabase";

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [selected, setSelected] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [showModal, setShowModal] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ 
    name: "", contact: "", address: "", email: "", phone: "", balance: "" 
  });
  const [showArchived, setShowArchived] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [cardHeight, setCardHeight] = useState(300);
  const fileRef = useRef(null);

  // Load customers from Supabase
  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('customer');
    
    if (error) {
      console.error("Failed to load customers", error);
    } else {
      setCustomers(data || []);
    }
  };

  // Filter customers by search term
  const filteredCustomers = customers.filter(c => {
    const search = searchTerm.toLowerCase();
    return (
      c.customer?.toLowerCase().includes(search) ||
      c.contact?.toLowerCase().includes(search) ||
      c.email?.toLowerCase().includes(search) ||
      c.phone?.toLowerCase().includes(search) ||
      c.address?.toLowerCase().includes(search)
    );
  });

  // Show all or archived customers
  const displayedCustomers = showArchived 
    ? filteredCustomers.filter(c => c.archived === true)
    : filteredCustomers.filter(c => !c.archived);

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Get current user ID for company_id
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert("You must be logged in to import customers");
      e.target.value = null;
      return;
    }
    
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        console.log("CSV columns found:", results.data[0] ? Object.keys(results.data[0]) : []);
        console.log("First row sample:", results.data[0]);
        
        const imported = results.data.map(row => {
          // Combine Street Address, City, State, Zip into one address field
          const street = row["Street Address"] || "";
          const city = row.City || "";
          const state = row.State || "";
          const zip = row.Zip || "";
          const fullAddress = [street, city, state, zip].filter(x => x).join(", ");
          
          return {
            customer: row.Customer || "",
            contact: row.Contact || "",
            address: fullAddress,
            email: row.Email || "",
            phone: row.Phone || "",
            balance: parseFloat(row["Open balance"] || 0),
            company_id: user.id
          };
        }).filter(c => c.customer.trim());
        
        console.log("Mapped data sample:", imported[0]);
        
        if (imported.length === 0) {
          alert("No valid customers found in CSV");
          e.target.value = null;
          return;
        }

        const { data, error } = await supabase
          .from('customers')
          .insert(imported)
          .select();
        
        if (error) {
          console.error("Import error:", error);
          alert("Failed to import customers: " + error.message);
        } else {
          await loadCustomers();
          alert(`Successfully imported ${imported.length} customers!`);
        }
        e.target.value = null;
      },
      error: (err) => alert("Failed to parse CSV: " + err.message)
    });
  };

  const handleExport = () => {
    if (!customers.length) return alert("No customers to export");
    const csv = Papa.unparse(customers);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'customers.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleAdd = async () => {
    if (!newCustomer.name.trim()) return alert("Name is required");
    
    // Get current user ID for company_id
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert("You must be logged in to add a customer");
      return;
    }
    
    const { error } = await supabase
      .from('customers')
      .insert([{
        customer: newCustomer.name,
        contact: newCustomer.contact,
        address: newCustomer.address,
        email: newCustomer.email,
        phone: newCustomer.phone,
        company_id: user.id
      }])
      .select();
    
    if (error) {
      console.error("Add error:", error);
      alert("Failed to add customer: " + error.message);
    } else {
      await loadCustomers();
      setNewCustomer({ name: "", contact: "", address: "", email: "", phone: "", balance: "" });
      setShowModal(false);
    }
  };

  const handleEdit = (customer) => {
    setEditingId(customer.id);
    setEditForm({ ...customer });
  };

  const handleSaveEdit = async () => {
    const { error } = await supabase
      .from('customers')
      .update(editForm)
      .eq('id', editingId);
    
    if (error) {
      console.error("Update error:", error);
      alert("Failed to update customer: " + error.message);
    } else {
      await loadCustomers();
      setEditingId(null);
      setEditForm({});
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this customer?")) return;
    
    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error("Delete error:", error);
      alert("Failed to delete customer: " + error.message);
    } else {
      await loadCustomers();
      setSelected(prev => prev.filter(sid => sid !== id));
    }
  };

  const handleArchive = async (id) => {
    const customer = customers.find(c => c.id === id);
    if (!customer) return;
    
    const { error } = await supabase
      .from('customers')
      .update({ archived: !customer.archived })
      .eq('id', id);
    
    if (error) {
      console.error("Archive error:", error);
      alert("Failed to archive customer: " + error.message);
    } else {
      await loadCustomers();
    }
  };

  const handleSelectAll = () => {
    if (selected.length === displayedCustomers.length) {
      setSelected([]);
    } else {
      setSelected(displayedCustomers.map(c => c.id));
    }
  };

  const handleDeleteSelected = async () => {
    if (!confirm(`Delete ${selected.length} customers?`)) return;
    
    const { error } = await supabase
      .from('customers')
      .delete()
      .in('id', selected);
    
    if (error) {
      console.error("Delete error:", error);
      alert("Failed to delete customers: " + error.message);
    } else {
      await loadCustomers();
      setSelected([]);
    }
  };

  return (
    <div style={styles.page}>
      {/* Add Customer Button - Top Right */}
      <div style={styles.addButtonContainer}>
        <button onClick={() => setShowModal(true)} style={styles.addButton}>
          + Add Customer
        </button>
      </div>

      {/* Selected Customer Card */}
      {selectedCustomer && (
        <div style={styles.customerCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 style={{ margin: 0, color: '#fff' }}>{selectedCustomer.customer}</h2>
            <div style={{ display: 'flex', gap: 8 }}>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  handleArchive(selectedCustomer.id);
                  setSelectedCustomer(null);
                }} 
                style={{ ...styles.addButton, background: '#666' }}
              >
                {selectedCustomer.archived ? 'Unarchive' : 'Archive'}
              </button>
              <button onClick={() => setSelectedCustomer(null)} style={{ ...styles.addButton, background: '#666' }}>
                Close
              </button>
            </div>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, marginBottom: 30 }}>
            <div>
              <h3 style={{ color: '#fc6b04', marginBottom: 10 }}>Contact Info</h3>
              <p style={{ color: '#fff', margin: '5px 0' }}><strong>Contact:</strong> {selectedCustomer.contact || 'N/A'}</p>
              <p style={{ color: '#fff', margin: '5px 0' }}><strong>Email:</strong> {selectedCustomer.email || 'N/A'}</p>
              <p style={{ color: '#fff', margin: '5px 0' }}><strong>Phone:</strong> {selectedCustomer.phone || 'N/A'}</p>
              <p style={{ color: '#fff', margin: '5px 0' }}><strong>Address:</strong> {selectedCustomer.address || 'N/A'}</p>
            </div>
            
            <div>
              <h3 style={{ color: '#fc6b04', marginBottom: 10 }}>Financial</h3>
              <p style={{ color: '#fff', margin: '5px 0' }}><strong>Balance:</strong> ${selectedCustomer.balance || 0}</p>
            </div>
            
            <div>
              <h3 style={{ color: '#fc6b04', marginBottom: 10 }}>Quick Actions</h3>
              <button style={{ ...styles.addButton, marginBottom: 10, width: '50%' }}>New Estimate</button>
              <button style={{ ...styles.addButton, width: '50%' }}>New Invoice</button>
            </div>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <div style={styles.section}>
              <h3 style={{ color: '#fc6b04', marginBottom: 10 }}>Jobs</h3>
              <p style={{ color: '#999' }}>No jobs yet</p>
            </div>
            
            <div style={styles.section}>
              <h3 style={{ color: '#fc6b04', marginBottom: 10 }}>Estimates</h3>
              <p style={{ color: '#999' }}>No estimates yet</p>
            </div>
            
            <div style={styles.section}>
              <h3 style={{ color: '#fc6b04', marginBottom: 10 }}>Invoices</h3>
              <p style={{ color: '#999' }}>No invoices yet</p>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div style={styles.toolbar}>
        <input 
          type="text"
          placeholder="Search customers..."
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
          {selected.length === displayedCustomers.length ? 'Deselect All' : 'Select All'}
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
              <th style={{ width: '220px', padding: '12px 8px' }}>Name</th>     
              <th style={{ width: '180px', padding: '12px 8px' }}>Contact</th>   
              <th style={{ width: '250px', padding: '12px 8px' }}>Address</th>  
              <th style={{ width: '200px', padding: '12px 8px' }}>Email</th>    
              <th style={{ width: '120px', padding: '12px 8px' }}>Phone</th>
              <th style={{ width: '100px', padding: '12px 8px' }}>Balance</th>
              <th style={{ width: '80px', padding: '12px 8px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {displayedCustomers.map(customer => (
              <tr 
                key={customer.id} 
                style={{ 
                  borderTop: '1px solid #444', 
                  borderBottom: '1px solid #444',
                  cursor: 'pointer',
                  background: selectedCustomer?.id === customer.id ? '#1a4d8f' : 'transparent'
                }}
                onClick={() => {
                  setSelectedCustomer(customer);
                  setSearchTerm("");
                }}
              >
                <td style={{ padding: '12px 8px' }}>
                  <input
                    type="checkbox"
                    checked={selected.includes(customer.id)}
                    onChange={() => setSelected(prev => 
                      prev.includes(customer.id) 
                        ? prev.filter(id => id !== customer.id)
                        : [...prev, customer.id]
                    )}
                  />
                </td>
                {editingId === customer.id ? (
                  <>
                    <td style={{ padding: '12px 8px' }}><input value={editForm.customer} onChange={e => setEditForm({...editForm, customer: e.target.value})} style={{width: '95%'}} /></td>
                    <td style={{ padding: '12px 8px' }}><input value={editForm.contact} onChange={e => setEditForm({...editForm, contact: e.target.value})} style={{width: '95%'}} /></td>
                    <td style={{ padding: '12px 8px' }}><input value={editForm.address} onChange={e => setEditForm({...editForm, address: e.target.value})} style={{width: '95%'}} /></td>
                    <td style={{ padding: '12px 8px' }}><input value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} style={{width: '95%'}} /></td>
                    <td style={{ padding: '12px 8px' }}><input value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} style={{width: '95%'}} /></td>
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
                    <td style={{ padding: '12px 8px' }}>{customer.customer}</td>
                    <td style={{ padding: '12px 8px' }}>{customer.contact || "-"}</td>
                    <td style={{ padding: '12px 8px' }}>{customer.address}</td>
                    <td style={{ padding: '12px 8px' }}>{customer.email}</td>
                    <td style={{ padding: '12px 8px' }}>{customer.phone}</td>
                    <td style={{ padding: '12px 8px' }}>${customer.balance}</td>
                    <td style={{ padding: '12px 8px' }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button 
                          onClick={() => handleEdit(customer)}
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
                          onClick={() => handleArchive(customer.id)}
                          style={{ 
                            padding: '4px 8px', 
                            fontSize: 12, 
                            background: customer.archived ? '#4CAF50' : '#666',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 4,
                            cursor: 'pointer'
                          }}
                        >
                          {customer.archived ? '↩' : '📦'}
                        </button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {displayedCustomers.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>
            {showArchived ? 'No archived customers' : 'No customers yet. Click "Add Customer" or import a CSV file.'}
          </div>
        )}
      </div>

      {/* Add Customer Modal */}
      {showModal && (
        <div style={styles.overlay} onClick={() => setShowModal(false)}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <h3>New Customer</h3>
            <input placeholder="Name *" value={newCustomer.name} onChange={e => setNewCustomer({...newCustomer, name: e.target.value})} style={styles.input} />
            <input placeholder="Contact" value={newCustomer.contact} onChange={e => setNewCustomer({...newCustomer, contact: e.target.value})} style={styles.input} />
            <input placeholder="Address" value={newCustomer.address} onChange={e => setNewCustomer({...newCustomer, address: e.target.value})} style={styles.input} />
            <input placeholder="Email" value={newCustomer.email} onChange={e => setNewCustomer({...newCustomer, email: e.target.value})} style={styles.input} />
            <input placeholder="Phone" value={newCustomer.phone} onChange={e => setNewCustomer({...newCustomer, phone: e.target.value})} style={styles.input} />
            <input placeholder="Balance" value={newCustomer.balance} onChange={e => setNewCustomer({...newCustomer, balance: e.target.value})} style={styles.input} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
              <button onClick={() => setShowModal(false)}>Cancel</button>
              <button onClick={handleAdd}>Save</button>
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
    width: '1250px',
    height: 'calc(100vh - 100px)',
    overflow: 'auto',
    background: '#1e1e1e',
    borderRadius: 8,
    boxSizing: 'border-box',
    WebkitOverflowScrolling: 'touch',
  },
  table: {
    width: '1230px',
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
    width: 400,
    maxWidth: '90%',
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
  customerCard: {
    background: '#1e1e1e',
    borderRadius: 8,
    padding: 15,
    marginBottom: 20,
    border: '2px solid #fc6b04',
    width: '1250px',
    maxHeight: '400px',
    overflow: 'auto',
  },
  sizeButton: {
    padding: '4px 12px',
    background: '#333',
    color: '#fff',
    border: '1px solid #555',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 'bold',
  },
  section: {
    background: '#252525',
    padding: 0,
    borderRadius: 6,
  },
};
