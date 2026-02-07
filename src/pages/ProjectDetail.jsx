import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const BRAND = {
  bg: "#0b3ea8",
  text: "#f97316",
  accent: "#fc6b04ff",
};

const ProjectDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  
  // Related data
  const [estimates, setEstimates] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [changeOrders, setChangeOrders] = useState([]);
  const [timeEntries, setTimeEntries] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [activities, setActivities] = useState([]);
  const [excludedTimeEntries, setExcludedTimeEntries] = useState([]);
  const [editingEntryId, setEditingEntryId] = useState(null);
  const [editedHours, setEditedHours] = useState({});
  const [editedTimes, setEditedTimes] = useState({});
  const [editModalData, setEditModalData] = useState(null);

  // Calculated data
  const [costs, setCosts] = useState({ labor: 0, materials: 0, total: 0 });
  const [stats, setStats] = useState({
    estimatedValue: 0,
    invoicedValue: 0,
    paidValue: 0,
    percentComplete: 0,
  });

  useEffect(() => {
    if (id) loadProjectData();
  }, [id]);

  async function loadProjectData() {
    try {
      // Load project
      const { data: projectData, error: projectError } = await supabase
        .from("projects")
        .select("*")
        .eq("id", id)
        .single();

      if (projectError) throw projectError;
      setProject(projectData);

      // Load estimates
      const { data: estimatesData } = await supabase
        .from("estimates")
        .select("*")
        .eq("project_id", id)
        .order("created_at", { ascending: false });
      setEstimates(estimatesData || []);

      // Load invoices
      const { data: invoicesData } = await supabase
        .from("invoices")
        .select("*")
        .eq("project_id", id)
        .order("invoice_date", { ascending: false });
      setInvoices(invoicesData || []);

      // Load change orders
      const { data: coData } = await supabase
        .from("change_orders")
        .select("*")
        .eq("project_id", id)
        .order("created_at", { ascending: false });
      setChangeOrders(coData || []);

      // Load time entries - ONLY for this specific project, WITH employee names
      const { data: teData } = await supabase
        .from("time_entries")
        .select("*, employees(first_name, last_name)")
        .eq("project_id", id)
        .order("clock_in", { ascending: false });
      
      // Format employee names into the data
      const formattedTeData = (teData || []).map(te => ({
        ...te,
        employee_name: te.employees ? `${te.employees.first_name} ${te.employees.last_name}` : 'Unknown Employee'
      }));
      
      setTimeEntries(formattedTeData);

      // Load expenses (both old and new)
      const { data: expensesData } = await supabase
        .from("expenses")
        .select("*")
        .eq("project_id", id)
        .order("created_at", { ascending: false });
      setExpenses(expensesData || []);

      // Load photos
      const { data: photosData } = await supabase
        .from("project_photos")
        .select("*")
        .eq("project_id", id)
        .order("created_at", { ascending: false });
      setPhotos(photosData || []);

      // Calculate costs
      calculateCosts(teData || [], expensesData || []);

      // Calculate stats
      calculateStats(projectData, estimatesData || [], invoicesData || []);
    } catch (err) {
      console.error("Error loading project:", err);
    } finally {
      setLoading(false);
    }
  }

  function calculateCosts(timeEntries, expenses) {
    let laborCost = 0;
    let materialsCost = 0;

    // Calculate labor from time entries
    timeEntries.forEach(entry => {
      if (entry.clock_out) {
        const start = new Date(entry.clock_in).getTime();
        const end = new Date(entry.clock_out).getTime();
        const hours = (end - start) / (1000 * 60 * 60);
        const rate = project?.labor_rate || 50;
        laborCost += hours * rate;
      }
    });

    // Calculate materials from expenses
    materialsCost = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);

    setCosts({
      labor: laborCost,
      materials: materialsCost,
      total: laborCost + materialsCost,
    });
  }

  function calculateStats(proj, ests, invs) {
    const estimatedValue = ests.reduce((sum, e) => sum + (e.total || 0), 0);
    const invoicedValue = invs.reduce((sum, i) => sum + (i.subtotal || 0), 0);
    const paidValue = invs.reduce((sum, i) => sum + (i.amount_paid || 0), 0);

    setStats({
      estimatedValue,
      invoicedValue,
      paidValue,
      percentComplete: proj?.percent_complete || 0,
    });
  }

  if (loading) {
    return <div style={styles.container}><div style={styles.loading}>Loading project...</div></div>;
  }

  if (!project) {
    return (
      <div style={styles.container}>
        <div style={styles.error}>Project not found</div>
        <button onClick={() => navigate("/projects")} style={styles.button}>Back to Projects</button>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>{project.name}</h1>
          {project.customer && <p style={styles.subtitle}>👤 {project.customer}</p>}
          {project.address && <p style={styles.subtitle}>📍 {project.address}</p>}
        </div>
        <button onClick={() => navigate("/projects")} style={styles.backButton}>← Back to Projects</button>
      </div>

      {/* Quick Stats */}
      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>Estimated Value</div>
          <div style={styles.statValue}>${stats.estimatedValue.toFixed(2)}</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>Invoiced</div>
          <div style={styles.statValue}>${stats.invoicedValue.toFixed(2)}</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>Paid</div>
          <div style={{...styles.statValue, color: '#10b981'}}>${stats.paidValue.toFixed(2)}</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>% Complete</div>
          <div style={styles.statValue}>{stats.percentComplete}%</div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={styles.tabNav}>
        {['overview', 'timeline', 'budget', 'estimates', 'invoices', 'changeorders', 'timeentries', 'expenses', 'photos'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              ...styles.tabButton,
              backgroundColor: activeTab === tab ? BRAND.accent : 'transparent',
              color: activeTab === tab ? '#fff' : '#fff',
              borderBottom: activeTab === tab ? `3px solid ${BRAND.accent}` : '2px solid rgba(255,255,255,0.3)',
            }}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1).replace(/([a-z])([A-Z])/g, '$1 $2')}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={styles.content}>
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div>
            <div style={styles.card}>
              <h2 style={styles.cardTitle}>Project Information</h2>
              <div style={styles.infoGrid}>
                <div style={styles.infoItem}>
                  <span style={styles.label}>Status</span>
                  <span style={styles.value}>{project.status || 'Active'}</span>
                </div>
                <div style={styles.infoItem}>
                  <span style={styles.label}>Contractor</span>
                  <span style={styles.value}>{project.contractor || 'N/A'}</span>
                </div>
                <div style={styles.infoItem}>
                  <span style={styles.label}>Budget</span>
                  <span style={styles.value}>${(project.budget || 0).toFixed(2)}</span>
                </div>
                <div style={styles.infoItem}>
                  <span style={styles.label}>Active Worth</span>
                  <span style={styles.value}>${(project.active_worth || 0).toFixed(2)}</span>
                </div>
              </div>
              {project.description && (
                <div style={{marginTop: 20, padding: 12, backgroundColor: '#f0f9ff', borderRadius: 8}}>
                  <p style={{margin: 0}}>{project.description}</p>
                </div>
              )}
            </div>

            <div style={styles.card}>
              <h2 style={styles.cardTitle}>Quick Actions</h2>
              <div style={styles.actionButtons}>
                <button onClick={() => navigate(`/project/${id}/estimate`)} style={styles.actionButton}>📊 Create Estimate</button>
                <button onClick={() => navigate(`/invoice?projectId=${id}`)} style={styles.actionButton}>📄 Create Invoice</button>
                <button onClick={() => navigate(`/change-order?projectId=${id}`)} style={styles.actionButton}>✏️ Create Change Order</button>
                <button onClick={() => navigate(`/project/${id}/photos`)} style={styles.actionButton}>📷 Upload Photos</button>
              </div>
            </div>
          </div>
        )}

        {/* Timeline Tab */}
        {activeTab === 'timeline' && (
          <div style={styles.card}>
            <h2 style={styles.cardTitle}>Project Timeline</h2>
            <div style={styles.timeline}>
              {estimates.length > 0 && (
                <div style={styles.timelineItem}>
                  <span style={styles.timelineLabel}>📊 Estimates: {estimates.length}</span>
                </div>
              )}
              {invoices.length > 0 && (
                <div style={styles.timelineItem}>
                  <span style={styles.timelineLabel}>💰 Invoices: {invoices.length}</span>
                </div>
              )}
              {changeOrders.length > 0 && (
                <div style={styles.timelineItem}>
                  <span style={styles.timelineLabel}>✏️ Change Orders: {changeOrders.length}</span>
                </div>
              )}
              {timeEntries.length > 0 && (
                <div style={styles.timelineItem}>
                  <span style={styles.timelineLabel}>⏱️ Time Entries: {timeEntries.length}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Budget Tab */}
        {activeTab === 'budget' && (
          <div style={styles.card}>
            <h2 style={styles.cardTitle}>Budget & Costs</h2>
            <div style={styles.budgetGrid}>
              <div style={styles.budgetItem}>
                <span style={styles.budgetLabel}>Labor Costs</span>
                <span style={styles.budgetValue}>${costs.labor.toFixed(2)}</span>
              </div>
              <div style={styles.budgetItem}>
                <span style={styles.budgetLabel}>Material Costs</span>
                <span style={styles.budgetValue}>${costs.materials.toFixed(2)}</span>
              </div>
              <div style={styles.budgetItem}>
                <span style={styles.budgetLabel}>Total Costs</span>
                <span style={{...styles.budgetValue, fontWeight: 'bold', fontSize: 18}}>${costs.total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Estimates Tab */}
        {activeTab === 'estimates' && (
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <h2 style={styles.cardTitle}>Estimates ({estimates.length})</h2>
              <button onClick={() => navigate(`/project/${id}/estimate`)} style={styles.addButton}>+ New Estimate</button>
            </div>
            {estimates.length > 0 ? (
              <div style={styles.table}>
                {estimates.map((est) => (
                  <div key={est.id} style={styles.tableRow}>
                    <div style={{flex: 1}}>
                      <div style={styles.tableValue}>{est.estimate_number}</div>
                      <div style={styles.tableLabel}>{new Date(est.created_at).toLocaleDateString()}</div>
                    </div>
                    <div style={{flex: 1, textAlign: 'right'}}>
                      <div style={styles.tableValue}>${(est.total || 0).toFixed(2)}</div>
                      <div style={{...styles.tableLabel, color: est.status === 'approved' ? '#10b981' : '#666'}}>
                        {est.status}
                      </div>
                    </div>
                    <button onClick={() => navigate(`/estimate/${est.id}`)} style={styles.viewButton}>View</button>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{color: '#666'}}>No estimates yet</p>
            )}
          </div>
        )}

        {/* Invoices Tab */}
        {activeTab === 'invoices' && (
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <h2 style={styles.cardTitle}>Invoices ({invoices.length})</h2>
              <button onClick={() => navigate(`/invoice?projectId=${id}`)} style={styles.addButton}>+ New Invoice</button>
            </div>
            {invoices.length > 0 ? (
              <div style={styles.table}>
                {invoices.map((inv) => (
                  <div key={inv.id} style={styles.tableRow}>
                    <div style={{flex: 1}}>
                      <div style={styles.tableValue}>{inv.invoice_number}</div>
                      <div style={styles.tableLabel}>{new Date(inv.invoice_date).toLocaleDateString()}</div>
                    </div>
                    <div style={{flex: 1, textAlign: 'right'}}>
                      <div style={styles.tableValue}>${(inv.total || 0).toFixed(2)}</div>
                      <div style={{...styles.tableLabel, color: inv.status === 'paid' ? '#10b981' : '#666'}}>
                        {inv.status}
                      </div>
                    </div>
                    <button onClick={() => navigate(`/invoice?invoiceId=${inv.id}`)} style={styles.viewButton}>View</button>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{color: '#666'}}>No invoices yet</p>
            )}
          </div>
        )}

        {/* Change Orders Tab */}
        {activeTab === 'changeorders' && (
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <h2 style={styles.cardTitle}>Change Orders ({changeOrders.length})</h2>
              <button onClick={() => navigate(`/change-order?projectId=${id}`)} style={styles.addButton}>+ New Change Order</button>
            </div>
            {changeOrders.length > 0 ? (
              <div style={styles.table}>
                {changeOrders.map((co) => (
                  <div key={co.id} style={styles.tableRow}>
                    <div style={{flex: 1}}>
                      <div style={styles.tableValue}>{co.change_order_number}</div>
                      <div style={styles.tableLabel}>{co.title}</div>
                    </div>
                    <div style={{flex: 1, textAlign: 'right'}}>
                      <div style={styles.tableValue}>${(co.total || 0).toFixed(2)}</div>
                      <div style={styles.tableLabel}>{co.status}</div>
                    </div>
                    <button onClick={() => navigate(`/change-order/${co.id}`)} style={styles.viewButton}>View</button>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{color: '#666'}}>No change orders yet</p>
            )}
          </div>
        )}

        {/* Time Entries Tab */}
        {activeTab === 'timeentries' && (
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <h2 style={styles.cardTitle}>Time Entries - Total: {timeEntries.length}</h2>
            </div>
            {timeEntries.length > 0 ? (
              <div style={{display: 'flex', flexDirection: 'column', gap: 0}}>
                <div style={{marginBottom: 0}}>
                  <div style={styles.table}>
                    {timeEntries.filter(te => !excludedTimeEntries.includes(te.id)).map((te) => {
                      // Check if this entry has been edited
                      const editedTime = editedTimes[te.id];
                      const clockInStr = editedTime?.clockIn || te.clock_in;
                      const clockOutStr = editedTime?.clockOut || te.clock_out;
                      
                      const hoursOverride = editedHours[te.id];
                      let hours;
                      if (hoursOverride !== undefined) {
                        hours = hoursOverride;
                      } else if (clockOutStr) {
                        hours = (new Date(clockOutStr) - new Date(clockInStr)) / (1000 * 60 * 60);
                      } else {
                        hours = 0;
                      }
                      
                      const clockInDate = new Date(clockInStr);
                      const clockOutDate = clockOutStr ? new Date(clockOutStr) : null;
                      const dayOfWeek = clockInDate.toLocaleDateString('en-US', { weekday: 'short' });
                      const dateString = clockInDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                      const clockInTime = clockInDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                      const clockOutTime = clockOutDate ? clockOutDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Still clocked in';
                      
                      function handleExcludeTimeEntry() {
                        if (!window.confirm(`Exclude this time entry from project billing for ${te.employee_name}?\n\nNote: This only removes it from billing. The original time entry remains in the system for payroll.`)) return;
                        setExcludedTimeEntries([...excludedTimeEntries, te.id]);
                      }

                      return (
                        <div key={te.id} style={{...styles.tableRow, padding: '12px 16px', alignItems: 'center', justifyContent: 'space-between'}}>
                          <div style={{flex: 3, display: 'flex', alignItems: 'center', gap: 16}}>
                            <div style={{fontWeight: '600', color: '#111', fontSize: 14, minWidth: 120}}>{te.employee_name}</div>
                            <div style={{fontSize: 12, color: '#666'}}>
                              📅 {dayOfWeek} • {dateString}
                            </div>
                            <div style={{fontSize: 12, color: '#666'}}>
                              🕐 {clockInTime} → {clockOutTime}
                            </div>
                          </div>
                          <div style={{display: 'flex', alignItems: 'center', gap: 16}}>
                            <div style={{display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2}}>
                              <div style={{fontWeight: '600', color: '#10b981', fontSize: 14}}>{hours.toFixed(2)} hrs</div>
                              <div style={{fontWeight: '600', color: '#059669', fontSize: 12}}>${(hours * (project?.labor_rate || 50)).toFixed(2)}</div>
                            </div>
                            <div style={{display: 'flex', gap: 8}}>
                              <button 
                                onClick={() => setEditModalData({...te, hours, clockInDate, clockInTime, clockOutTime})}
                                style={{padding: '6px 10px', backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: '600'}}
                                title="Edit time entry"
                              >
                                ✏️
                              </button>
                              <button 
                                onClick={handleExcludeTimeEntry}
                                style={{padding: '6px 10px', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: '600'}}
                                title="Exclude from billing"
                              >
                                🗑️
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div style={{padding: '24px 20px', backgroundColor: '#dbeafe', borderRadius: '8px', border: '2px solid #0284c7', marginTop: '12px', marginLeft: 0, marginRight: 0}}>
                  <div style={{fontSize: 18, fontWeight: 'bold', color: '#0c4a6e', marginBottom: 16}}>📊 SUMMARY</div>
                  <div style={{fontSize: 16, color: '#0c4a6e', marginBottom: 12, padding: '8px 0', borderBottom: '1px solid #bae6fd', paddingBottom: 12}}>
                    <strong>Total Hours:</strong> <span style={{fontSize: 18, fontWeight: 'bold', color: '#0369a1'}}>{(timeEntries.filter(te => !excludedTimeEntries.includes(te.id)).reduce((sum, te) => {
                      const hoursOverride = editedHours[te.id];
                      const hours = hoursOverride !== undefined ? hoursOverride : (te.clock_out ? (new Date(te.clock_out) - new Date(te.clock_in)) / (1000 * 60 * 60) : 0);
                      return sum + hours;
                    }, 0)).toFixed(2)}</span> hrs
                  </div>
                  <div style={{fontSize: 16, color: '#0c4a6e', paddingTop: 8}}>
                    <strong>Total Labor Cost:</strong> <span style={{fontSize: 18, fontWeight: 'bold', color: '#0369a1'}}>${(timeEntries.filter(te => !excludedTimeEntries.includes(te.id)).reduce((sum, te) => {
                      const hoursOverride = editedHours[te.id];
                      const hours = hoursOverride !== undefined ? hoursOverride : (te.clock_out ? (new Date(te.clock_out) - new Date(te.clock_in)) / (1000 * 60 * 60) : 0);
                      return sum + (hours * (project?.labor_rate || 50));
                    }, 0)).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            ) : (
              <p style={{color: '#666'}}>No time entries yet</p>
            )}
          </div>
        )}

        {/* Expenses Tab */}
        {activeTab === 'expenses' && (
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <h2 style={styles.cardTitle}>Expenses ({expenses.length})</h2>
              <button onClick={() => navigate(`/expenses?projectId=${id}`)} style={styles.addButton}>+ Add Expense</button>
            </div>
            {expenses.length > 0 ? (
              <div style={styles.table}>
                {expenses.map((exp) => (
                  <div key={exp.id} style={styles.tableRow}>
                    <div style={{flex: 1}}>
                      <div style={styles.tableValue}>{exp.description}</div>
                      <div style={styles.tableLabel}>{new Date(exp.created_at).toLocaleDateString()}</div>
                    </div>
                    <div style={{flex: 1, textAlign: 'right'}}>
                      <div style={styles.tableValue}>${(exp.amount || 0).toFixed(2)}</div>
                      <div style={styles.tableLabel}>{exp.category}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{color: '#666'}}>No expenses yet</p>
            )}
          </div>
        )}

        {/* Photos Tab */}
        {activeTab === 'photos' && (
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <h2 style={styles.cardTitle}>Project Photos ({photos.length})</h2>
              <button onClick={() => navigate(`/project/${id}/photos`)} style={styles.addButton}>+ Upload Photos</button>
            </div>
            {photos.length > 0 ? (
              <div style={styles.photoGrid}>
                {photos.map((photo) => (
                  <div key={photo.id} style={styles.photoItem}>
                    <img src={photo.url} alt={photo.caption} style={styles.photoImg} />
                    {photo.caption && <p style={styles.photoCaption}>{photo.caption}</p>}
                  </div>
                ))}
              </div>
            ) : (
              <p style={{color: '#666'}}>No photos yet</p>
            )}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editModalData && (
        <div style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000}}>
          <div style={{backgroundColor: '#fff', borderRadius: 12, padding: 32, maxWidth: 500, width: '90%', boxShadow: '0 10px 40px rgba(0,0,0,0.3)'}}>
            <h2 style={{fontSize: 24, fontWeight: 'bold', color: '#111', marginBottom: 24, margin: '0 0 24px 0'}}>Edit Time Entry</h2>
            
            <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
              {/* Employee Name (read-only) */}
              <div>
                <label style={{fontSize: 12, fontWeight: '600', color: '#666', display: 'block', marginBottom: 6}}>Employee</label>
                <input 
                  type="text" 
                  value={editModalData.employee_name} 
                  disabled
                  style={{width: '100%', padding: 10, border: '1px solid #ddd', borderRadius: 6, fontSize: 14, backgroundColor: '#f9fafb', color: '#666'}}
                />
              </div>

              {/* Clock In */}
              <div>
                <label style={{fontSize: 12, fontWeight: '600', color: '#666', display: 'block', marginBottom: 6}}>Clock In</label>
                <input 
                  type="datetime-local" 
                  defaultValue={editModalData.clock_in ? (() => {
                    const d = new Date(editModalData.clock_in);
                    const year = d.getFullYear();
                    const month = String(d.getMonth() + 1).padStart(2, '0');
                    const date = String(d.getDate()).padStart(2, '0');
                    const hours = String(d.getHours()).padStart(2, '0');
                    const minutes = String(d.getMinutes()).padStart(2, '0');
                    return `${year}-${month}-${date}T${hours}:${minutes}`;
                  })() : ''}
                  style={{width: '100%', padding: 10, border: '1px solid #ddd', borderRadius: 6, fontSize: 14}}
                  id="clockInInput"
                />
              </div>

              {/* Clock Out */}
              <div>
                <label style={{fontSize: 12, fontWeight: '600', color: '#666', display: 'block', marginBottom: 6}}>Clock Out</label>
                <input 
                  type="datetime-local" 
                  defaultValue={editModalData.clock_out ? (() => {
                    const d = new Date(editModalData.clock_out);
                    const year = d.getFullYear();
                    const month = String(d.getMonth() + 1).padStart(2, '0');
                    const date = String(d.getDate()).padStart(2, '0');
                    const hours = String(d.getHours()).padStart(2, '0');
                    const minutes = String(d.getMinutes()).padStart(2, '0');
                    return `${year}-${month}-${date}T${hours}:${minutes}`;
                  })() : ''}
                  style={{width: '100%', padding: 10, border: '1px solid #ddd', borderRadius: 6, fontSize: 14}}
                  id="clockOutInput"
                />
              </div>

              {/* Hours Override */}
              <div>
                <label style={{fontSize: 12, fontWeight: '600', color: '#666', display: 'block', marginBottom: 6}}>Hours (for billing)</label>
                <input 
                  type="number" 
                  step="0.25"
                  defaultValue={editedHours[editModalData.id] || editModalData.hours.toFixed(2)}
                  style={{width: '100%', padding: 10, border: '1px solid #ddd', borderRadius: 6, fontSize: 14}}
                  id="hoursInput"
                />
              </div>

              {/* Button Group */}
              <div style={{display: 'flex', gap: 12, marginTop: 16, justifyContent: 'flex-end'}}>
                <button 
                  onClick={() => setEditModalData(null)}
                  style={{padding: '10px 20px', backgroundColor: '#e5e7eb', border: 'none', color: '#111', borderRadius: 6, cursor: 'pointer', fontSize: 14, fontWeight: '600'}}
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    const hoursVal = parseFloat(document.getElementById('hoursInput').value);
                    const clockInVal = document.getElementById('clockInInput').value;
                    const clockOutVal = document.getElementById('clockOutInput').value;
                    
                    if (!isNaN(hoursVal)) {
                      // Save hours override
                      setEditedHours({...editedHours, [editModalData.id]: hoursVal});
                      
                      // Save time overrides if changed
                      if (clockInVal || clockOutVal) {
                        const newTimes = {...editedTimes, [editModalData.id]: {clockIn: clockInVal, clockOut: clockOutVal}};
                        setEditedTimes(newTimes);
                      }
                      
                      setEditModalData(null);
                    }
                  }}
                  style={{padding: '10px 20px', backgroundColor: '#10b981', border: 'none', color: '#fff', borderRadius: 6, cursor: 'pointer', fontSize: 14, fontWeight: '600'}}
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    padding: "40px 24px",
    maxWidth: 1400,
    margin: "0 auto",
    minHeight: "100vh",
    backgroundColor: BRAND.bg,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 32,
  },
  title: {
    fontSize: 36,
    color: BRAND.text,
    margin: 0,
  },
  subtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
    margin: "6px 0",
  },
  backButton: {
    padding: "10px 20px",
    backgroundColor: "transparent",
    border: "2px solid #fff",
    color: "#fff",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 15,
    fontWeight: "600",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: 16,
    marginBottom: 32,
  },
  statCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    textAlign: "center",
  },
  statLabel: {
    fontSize: 12,
    color: "#666",
    fontWeight: "600",
    textTransform: "uppercase",
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: BRAND.accent,
  },
  tabNav: {
    display: "flex",
    gap: 8,
    marginBottom: 24,
    borderBottom: "2px solid rgba(255,255,255,0.2)",
    flexWrap: "wrap",
  },
  tabButton: {
    padding: "12px 16px",
    border: "none",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: "600",
    transition: "all 0.2s",
  },
  content: {
    display: "flex",
    flexDirection: "column",
    gap: 24,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 24,
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#111",
    margin: 0,
  },
  addButton: {
    padding: "8px 16px",
    backgroundColor: BRAND.accent,
    border: "none",
    color: "#fff",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 13,
    fontWeight: "600",
  },
  infoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: 20,
    marginBottom: 20,
  },
  infoItem: {
    display: "flex",
    flexDirection: "column",
  },
  label: {
    fontSize: 12,
    color: "#666",
    fontWeight: "600",
    marginBottom: 6,
  },
  value: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111",
  },
  actionButtons: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: 12,
  },
  actionButton: {
    padding: "12px 16px",
    backgroundColor: "#3b82f6",
    border: "none",
    color: "#fff",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 14,
    fontWeight: "600",
  },
  timeline: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  timelineItem: {
    padding: 12,
    backgroundColor: "#f0f9ff",
    borderRadius: 6,
    borderLeft: "3px solid #3b82f6",
  },
  timelineLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111",
  },
  budgetGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: 20,
  },
  budgetItem: {
    padding: 16,
    backgroundColor: "#f9fafb",
    borderRadius: 8,
    display: "flex",
    flexDirection: "column",
  },
  budgetLabel: {
    fontSize: 12,
    color: "#666",
    fontWeight: "600",
    marginBottom: 8,
  },
  budgetValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: BRAND.accent,
  },
  table: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  tableRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: "#f9fafb",
    borderRadius: 8,
    borderLeft: "3px solid #3b82f6",
  },
  tableValue: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111",
  },
  tableLabel: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
  },
  viewButton: {
    padding: "6px 12px",
    backgroundColor: "#3b82f6",
    border: "none",
    color: "#fff",
    borderRadius: 4,
    cursor: "pointer",
    fontSize: 12,
    fontWeight: "600",
  },
  photoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
    gap: 16,
  },
  photoItem: {
    borderRadius: 8,
    overflow: "hidden",
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
  },
  photoImg: {
    width: "100%",
    height: 200,
    objectFit: "cover",
  },
  photoCaption: {
    padding: 12,
    fontSize: 12,
    color: "#666",
    backgroundColor: "#f9fafb",
  },
  loading: {
    textAlign: "center",
    color: "#fff",
    fontSize: 18,
    padding: 40,
  },
  error: {
    textAlign: "center",
    color: "#ef4444",
    fontSize: 18,
    padding: 40,
  },
  button: {
    padding: "10px 20px",
    backgroundColor: "#3b82f6",
    border: "none",
    color: "#fff",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 15,
    fontWeight: "600",
  },
};

export default ProjectDetail;
