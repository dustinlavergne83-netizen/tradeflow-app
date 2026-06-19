import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";

export default function EstimatesList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [estimates, setEstimates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all"); // "all", "estimates", "proposals"
  const [viewModalEstimate, setViewModalEstimate] = useState(null); // estimate to view

  // ── Date range filter state ──────────────────────────────────────────────────
  const [datePreset, setDatePreset] = useState('ytd');
  const [dateYear, setDateYear] = useState(new Date().getFullYear());
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  useEffect(() => {
    loadEstimates();
  }, [user]);

  async function handleDelete(estimate) {
    if (!confirm(`Are you sure you want to delete ${estimate.type === 'proposal' ? 'proposal' : 'estimate'} #${estimate.estimate_number}?`)) {
      return;
    }

    try {
      if (estimate.type === 'proposal') {
        const { error } = await supabase
          .from('proposals')
          .delete()
          .eq('id', estimate.id);
        
        if (error) throw error;
      } else {
        // Delete estimate items first
        await supabase
          .from('estimate_items')
          .delete()
          .eq('estimate_id', estimate.id);
        
        // Then delete the estimate
        const { error } = await supabase
          .from('estimates')
          .delete()
          .eq('id', estimate.id);
        
        if (error) throw error;
      }
      
      alert('Deleted successfully!');
      loadEstimates(); // Reload the list
    } catch (err) {
      console.error('Error deleting:', err);
      alert(`Failed to delete: ${err.message}`);
    }
  }

  async function loadEstimates() {
    try {
      // Load all proposals first
      const { data: proposalsData, error: proposalsError } = await supabase
        .from("proposals")
        .select("*")
        .order("created_at", { ascending: false });

      if (proposalsError) {
        console.error("❌ Error loading proposals:", proposalsError);
        throw proposalsError;
      }

      console.log("✅ Loaded proposals:", proposalsData?.length || 0, "proposals");
      console.log("📋 Proposal data:", proposalsData);

      // Get project names for proposals that have project_id
      const mappedProposals = await Promise.all(
        (proposalsData || []).map(async (prop) => {
          let projectName = 'Project Name Not Set';
          
          if (prop.project_id) {
            try {
              const { data: projectData } = await supabase
                .from('projects')
                .select('name')
                .eq('id', prop.project_id)
                .single();
                
              if (projectData?.name) {
                projectName = projectData.name;
              }
            } catch (err) {
              console.log('Error fetching project name for proposal:', prop.id);
            }
          }
          
          return { 
            ...prop, 
            type: 'proposal',
            estimate_number: prop.proposal_number,
            description: prop.contractor_name ? `Proposal to ${prop.contractor_name}` : 'Proposal',
            total: prop.total_amount,
            project_name: projectName
          };
        })
      );

      // Load change orders
      let mappedChangeOrders = [];
      try {
        const { data: changeOrdersData, error: changeOrdersError } = await supabase
          .from("change_orders")
          .select("*")
          .eq("created_by", user.id)
          .order("created_at", { ascending: false });

        if (!changeOrdersError && changeOrdersData) {
          // Map change orders to display format
          mappedChangeOrders = changeOrdersData.map(co => ({
            ...co,
            type: 'change_order',
            estimate_number: co.change_order_number,
            customer_name: co.project_name, // Use project name as customer for display
            project_name: co.project_name,
            description: co.title || 'Change Order',
            estimate_date: co.change_order_date,
            total: co.total
          }));
          console.log("✅ Loaded change orders:", mappedChangeOrders.length, "change orders");
        }
      } catch (coErr) {
        console.log("Error loading change orders:", coErr);
      }

      // Try to load quick estimates (only those with estimate_number)
      // NOTE: No explicit company_id filter here — RLS handles company scoping.
      // This ensures estimates created from the mobile app (by admins or supervisors)
      // also appear here, since they may be saved with created_by = admin UID.
      try {
        const { data: estimatesData, error: estimatesError } = await supabase
          .from("estimates")
          .select("*")
          .not("estimate_number", "is", null)
          .order("created_at", { ascending: false });

        if (!estimatesError && estimatesData) {
          // Show ALL quick estimates — including those tied to a project
          const mappedEstimates = estimatesData.map(est => ({
            ...est,
            type: 'quick_estimate',
            description: est.project_name || est.notes || 'Quick Estimate'
          }));

          // Combine and sort by date
          const combined = [...mappedEstimates, ...mappedProposals, ...mappedChangeOrders].sort((a, b) => {
            const dateA = new Date(a.created_at);
            const dateB = new Date(b.created_at);
            return dateB - dateA;
          });
          
          setEstimates(combined);
        } else {
          // If error loading estimates, show proposals and change orders
          const combined = [...mappedProposals, ...mappedChangeOrders].sort((a, b) => {
            const dateA = new Date(a.created_at);
            const dateB = new Date(b.created_at);
            return dateB - dateA;
          });
          setEstimates(combined);
        }
      } catch (estErr) {
        console.log("Error loading quick estimates, showing proposals and change orders:", estErr);
        const combined = [...mappedProposals, ...mappedChangeOrders].sort((a, b) => {
          const dateA = new Date(a.created_at);
          const dateB = new Date(b.created_at);
          return dateB - dateA;
        });
        setEstimates(combined);
      }
    } catch (err) {
      console.error("Error loading proposals:", err);
    } finally {
      setLoading(false);
    }
  }

  // ── Date range helper ────────────────────────────────────────────────────────
  const getDateRange = () => {
    const now = new Date();
    const y = now.getFullYear();
    const pad = (n) => String(n).padStart(2, '0');
    if (datePreset === 'ytd') return { from: `${y}-01-01`, to: null };
    if (datePreset === 'thisMonth') {
      const m = pad(now.getMonth() + 1);
      return { from: `${y}-${m}-01`, to: null };
    }
    if (datePreset === 'lastMonth') {
      const last = new Date(y, now.getMonth(), 0);
      const lm = pad(last.getMonth() + 1);
      const ly = last.getFullYear();
      return { from: `${ly}-${lm}-01`, to: `${ly}-${lm}-${pad(last.getDate())}` };
    }
    if (datePreset === 'year') return { from: `${dateYear}-01-01`, to: `${dateYear}-12-31` };
    if (datePreset === 'all') return { from: null, to: null };
    return { from: customFrom || null, to: customTo || null };
  };

  const dateRange = getDateRange();

  // ── Period label for stat cards ──────────────────────────────────────────────
  const periodLabel = (() => {
    const now = new Date();
    if (datePreset === 'ytd') return `YTD ${now.getFullYear()}`;
    if (datePreset === 'thisMonth') return now.toLocaleString('default', { month: 'long', year: 'numeric' });
    if (datePreset === 'lastMonth') {
      const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return d.toLocaleString('default', { month: 'long', year: 'numeric' });
    }
    if (datePreset === 'year') return String(dateYear);
    if (datePreset === 'all') return 'All Time';
    return (customFrom || customTo) ? `${customFrom || '...'} → ${customTo || '...'}` : 'Custom';
  })();

  // ── Get the effective date for an estimate record ────────────────────────────
  const getRecordDate = (est) => {
    const d = est.estimate_date || est.created_at;
    return d ? d.split('T')[0] : null;
  };

  // ── Date-filtered estimates ──────────────────────────────────────────────────
  const dateFilteredEstimates = estimates.filter(est => {
    const d = getRecordDate(est);
    if (!d) return true;
    if (dateRange.from && d < dateRange.from) return false;
    if (dateRange.to && d > dateRange.to) return false;
    return true;
  });

  // ── Stats from date-filtered estimates ───────────────────────────────────────
  const stats = {
    total: dateFilteredEstimates.length,
    totalValue: dateFilteredEstimates.reduce((sum, e) => sum + (Number(e.total) || 0), 0),
    estimates: dateFilteredEstimates.filter(e => e.type === 'quick_estimate').length,
    proposals: dateFilteredEstimates.filter(e => e.type === 'proposal').length,
    changeOrders: dateFilteredEstimates.filter(e => e.type === 'change_order').length,
  };

  // ── Final filtered list (type + search + date) ───────────────────────────────
  const filteredEstimates = dateFilteredEstimates.filter(est => {
    // Filter by type first
    if (filterType === "estimates" && est.type === "proposal") return false;
    if (filterType === "proposals" && est.type !== "proposal") return false;
    
    // Then filter by search term
    const searchLower = searchTerm.toLowerCase();
    return (
      est.estimate_number?.toLowerCase().includes(searchLower) ||
      est.description?.toLowerCase().includes(searchLower) ||
      est.project_description?.toLowerCase().includes(searchLower) ||
      est.projects?.name?.toLowerCase().includes(searchLower)
    );
  });

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString.includes('T') ? dateString : dateString + 'T00:00:00');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
  };

  const formatCurrency = (amount) => {
    if (!amount) return '$0.00';
    return `$${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading estimates...</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Estimates & Proposals</h1>
        <div style={styles.headerButtons}>
          <button 
            onClick={() => navigate('/estimate/quick')}
            style={styles.quickButton}
          >
            ⚡ Quick Estimate
          </button>
          <button 
            onClick={() => navigate('/projects')}
            style={styles.newButton}
          >
            + New Proposal
          </button>
        </div>
      </div>

      {/* ── Date Range Filter Bar ─────────────────────────────────────────────── */}
      {(() => {
        const curYear = new Date().getFullYear();
        const years = [curYear - 2, curYear - 1, curYear, curYear + 1].filter(y => y >= 2023);
        const btnStyle = (active) => ({
          padding: '7px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
          fontWeight: 700, fontSize: 13,
          backgroundColor: active ? '#f97316' : 'rgba(255,255,255,0.15)',
          color: '#fff', transition: 'background 0.15s',
        });
        return (
          <div style={{
            display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16,
            flexWrap: 'wrap', padding: '12px 16px',
            backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 10
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.7)', marginRight: 4 }}>Period:</span>
            {[
              { v: 'ytd', l: '📅 YTD' },
              { v: 'thisMonth', l: 'This Month' },
              { v: 'lastMonth', l: 'Last Month' },
              { v: 'all', l: 'All Time' },
            ].map(o => (
              <button key={o.v} onClick={() => setDatePreset(o.v)} style={btnStyle(datePreset === o.v)}>{o.l}</button>
            ))}
            <select
              value={datePreset === 'year' ? dateYear : ''}
              onChange={e => { if (e.target.value) { setDateYear(parseInt(e.target.value)); setDatePreset('year'); } }}
              style={{ ...btnStyle(datePreset === 'year'), paddingRight: 6 }}
            >
              <option value="">Year ▼</option>
              {years.map(y => <option key={y} value={y} style={{ color: '#111' }}>{y}</option>)}
            </select>
            <span style={{ color: 'rgba(255,255,255,0.4)', margin: '0 4px' }}>|</span>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>Custom:</span>
            <input type="date" value={customFrom}
              onChange={e => { setCustomFrom(e.target.value); setDatePreset('custom'); }}
              style={{ padding: '6px 8px', borderRadius: 6, border: 'none', fontSize: 13, backgroundColor: 'rgba(255,255,255,0.15)', color: '#fff' }} />
            <span style={{ color: '#fff' }}>—</span>
            <input type="date" value={customTo}
              onChange={e => { setCustomTo(e.target.value); setDatePreset('custom'); }}
              style={{ padding: '6px 8px', borderRadius: 6, border: 'none', fontSize: 13, backgroundColor: 'rgba(255,255,255,0.15)', color: '#fff' }} />
            <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.55)' }}>
              Showing: {periodLabel}
            </span>
          </div>
        );
      })()}

      {/* ── Stats Cards ──────────────────────────────────────────────────────── */}
      <div style={styles.statsContainer}>
        <div style={styles.statCard}>
          <div style={styles.statValue}>{stats.total}</div>
          <div style={styles.statLabel}>Total · {periodLabel}</div>
        </div>
        <div style={styles.statCard}>
          <div style={{...styles.statValue, color: '#fc6b04'}}>{formatCurrency(stats.totalValue)}</div>
          <div style={styles.statLabel}>Total Value · {periodLabel}</div>
        </div>
        <div style={styles.statCard}>
          <div style={{...styles.statValue, color: '#3b82f6'}}>{stats.estimates}</div>
          <div style={styles.statLabel}>Estimates · {periodLabel}</div>
        </div>
        <div style={styles.statCard}>
          <div style={{...styles.statValue, color: '#10b981'}}>{stats.proposals}</div>
          <div style={styles.statLabel}>Proposals · {periodLabel}</div>
        </div>
        <div style={styles.statCard}>
          <div style={{...styles.statValue, color: '#f59e0b'}}>{stats.changeOrders}</div>
          <div style={styles.statLabel}>Change Orders · {periodLabel}</div>
        </div>
      </div>

      <div style={styles.searchBar}>
        <input
          type="text"
          placeholder="Search estimates by number, description, or project..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={styles.searchInput}
        />
      </div>

      {/* Filter Buttons */}
      <div style={styles.filterContainer}>
        <div style={styles.filterButtons}>
          <button
            onClick={() => setFilterType("all")}
            style={{
              ...styles.filterButton,
              ...(filterType === "all" ? styles.activeFilterButton : {})
            }}
          >
            All ({dateFilteredEstimates.length})
          </button>
          <button
            onClick={() => setFilterType("estimates")}
            style={{
              ...styles.filterButton,
              ...(filterType === "estimates" ? styles.activeFilterButton : {})
            }}
          >
            📋 Estimates ({dateFilteredEstimates.filter(e => e.type !== "proposal" && e.type !== "change_order").length})
          </button>
          <button
            onClick={() => setFilterType("proposals")}
            style={{
              ...styles.filterButton,
              ...(filterType === "proposals" ? styles.activeFilterButton : {})
            }}
          >
            📄 Proposals ({dateFilteredEstimates.filter(e => e.type === "proposal").length})
          </button>
        </div>
      </div>

      {filteredEstimates.length === 0 ? (
        <div style={styles.empty}>
          <p style={styles.emptyText}>
            {searchTerm ? "No estimates found matching your search." : "No estimates found for the selected period."}
          </p>
          {!searchTerm && (
            <button 
              onClick={() => setDatePreset('all')}
              style={styles.emptyButton}
            >
              Show All Time
            </button>
          )}
        </div>
      ) : (
        <div style={styles.tableContainer}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.tableHeaderRow}>
                <th style={{...styles.th, textAlign: 'left', width: '16%'}}>Estimate #</th>
                <th style={{...styles.th, textAlign: 'center', width: '10%'}}>Customer</th>
                <th style={{...styles.th, textAlign: 'center', width: '18%'}}>Project</th>
                <th style={{...styles.th, textAlign: 'right', width: '10%'}}>Total</th>
                <th style={{...styles.th, textAlign: 'center', width: '10%'}}>Date</th>
                <th style={{...styles.th, textAlign: 'center', width: '20%'}}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredEstimates.map(estimate => (
                <tr 
                  key={estimate.id} 
                  style={styles.tableRow}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <td style={styles.td}>
                    <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
                      {estimate.type === 'proposal' ? (
                        <span style={{...styles.badge, backgroundColor: '#10b981'}}>PROPOSAL</span>
                      ) : estimate.type === 'change_order' ? (
                        <span style={{...styles.badge, backgroundColor: '#f59e0b'}}>CHANGE ORDER</span>
                      ) : estimate.type === 'bid' ? (
                        <span style={{...styles.badge, backgroundColor: '#6366f1'}}>BID</span>
                      ) : (
                        <span style={{...styles.badge, backgroundColor: '#fc6b04'}}>ESTIMATE</span>
                      )}
                      <span style={styles.estimateNumber}>
                        {estimate.estimate_number ? 
                          estimate.estimate_number.replace('EST-', '').replace('PROP-', '').replace(/^26-/, '') 
                          : 'N/A'}
                      </span>
                    </div>
                  </td>
                  <td style={styles.td}>
                    <div style={{...styles.singleLineText, textAlign: 'center'}}>
                      {estimate.type === 'proposal' ? (estimate.contractor_name || 'N/A') : (estimate.customer_name || 'N/A')}
                    </div>
                  </td>
                  <td style={styles.td}>
                    <div style={{...styles.singleLineText, textAlign: 'center'}}>
                      {estimate.projects ? estimate.projects.name : (estimate.project_name || estimate.description || 'N/A')}
                    </div>
                  </td>
                  <td style={{...styles.td, textAlign: 'right'}}>
                    <span style={styles.total}>{formatCurrency(estimate.total)}</span>
                  </td>
                  <td style={{...styles.td, textAlign: 'center'}}>
                    <span style={styles.date}>{formatDate(estimate.estimate_date || estimate.created_at)}</span>
                  </td>
                  <td style={{...styles.td, textAlign: 'center'}}>
                    <div style={styles.actions}>
                      {estimate.type === 'proposal' ? (
                        <>
                          <button
                            onClick={() => navigate(`/proposal/commercial-public?proposalId=${estimate.id}`)}
                            style={{...styles.actionButton, ...styles.viewButton}}
                          >
                            View
                          </button>
                          <button
                            onClick={() => handleDelete(estimate)}
                            style={{...styles.actionButton, ...styles.deleteButton}}
                          >
                            Delete
                          </button>
                        </>
                      ) : estimate.type === 'change_order' ? (
                        <>
                          <button
                            onClick={() => navigate(`/estimate/quick?coId=${estimate.id}&type=changeorder`)}
                            style={{...styles.actionButton, ...styles.editButton}}
                            title="Edit change order"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={async () => {
                              if (confirm(`Delete change order ${estimate.estimate_number}? This cannot be undone.`)) {
                                try {
                                  // Delete change order items first
                                  await supabase
                                    .from("estimate_items")
                                    .delete()
                                    .eq("change_order_id", estimate.id);
                                  
                                  // Then delete the change order
                                  const { error } = await supabase
                                    .from("change_orders")
                                    .delete()
                                    .eq("id", estimate.id);
                                  
                                  if (error) throw error;
                                  
                                  alert('Change order deleted successfully!');
                                  loadEstimates(); // Reload the list
                                } catch (err) {
                                  console.error("Error deleting change order:", err);
                                  alert("Failed to delete change order: " + err.message);
                                }
                              }
                            }}
                            style={{...styles.actionButton, ...styles.deleteButton}}
                          >
                            🗑️
                          </button>
                        </>
                      ) : (
                        // All quick estimates (with or without project) — same actions
                        <>
                          <button
                            onClick={() => navigate(`/estimate/quick?estimateId=${estimate.id}`)}
                            style={{...styles.actionButton, ...styles.editButton}}
                            title="Edit estimate"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => setViewModalEstimate(estimate)}
                            style={{...styles.actionButton, ...styles.viewButton}}
                            title="Preview estimate"
                          >
                            👁️
                          </button>
                          <button
                            onClick={() => window.open(`/estimate/quick/view?estimateId=${estimate.id}&print=true`, '_blank')}
                            style={{...styles.actionButton, ...styles.printActionButton}}
                            title="Print estimate"
                          >
                            🖨️
                          </button>
                          <button
                            onClick={() => handleDelete(estimate)}
                            style={{...styles.actionButton, ...styles.deleteButton}}
                          >
                            🗑️
                          </button>
                        </>
                      )}
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
          Showing {filteredEstimates.length} of {estimates.length} estimate{estimates.length !== 1 ? 's' : ''}
          {datePreset !== 'all' && ` · ${periodLabel}`}
        </p>
      </div>

      {/* ── View Format Modal ── */}
      {viewModalEstimate && (
        <div style={{
          position:"fixed", inset:0, background:"rgba(0,0,0,0.6)",
          display:"flex", alignItems:"center", justifyContent:"center",
          zIndex:1000, padding:16
        }}>
          <div style={{
            background:"#fff", borderRadius:14, padding:"32px 28px",
            maxWidth:480, width:"100%", boxShadow:"0 8px 32px rgba(0,0,0,0.25)"
          }}>
            <h2 style={{margin:"0 0 4px", fontSize:20, color:"#111", textAlign:"center"}}>
              Choose View Format
            </h2>
            <p style={{margin:"0 0 20px", fontSize:13, color:"#888", textAlign:"center"}}>
              Estimate #{viewModalEstimate.estimate_number?.replace("EST-","")}
            </p>

            {[
              { key:"summary",           icon:"📄", title:"Summary Only",                    desc:"Scope of work description + Total Investment — no line items" },
              { key:"itemized",          icon:"💰", title:"Itemized with Pricing",            desc:"Every line item listed with individual prices + Total Investment" },
              { key:"itemized-no-price", icon:"📋", title:"Itemized (No Individual Prices)",  desc:"All items listed so customer sees what's included — only Total Investment shown" },
            ].map(opt => (
              <button
                key={opt.key}
                onClick={() => {
                  window.open(`/estimate/quick/view?estimateId=${viewModalEstimate.id}&view=${opt.key}`, "_blank");
                  setViewModalEstimate(null);
                }}
                style={{
                  display:"flex", alignItems:"center", gap:14,
                  width:"100%", background:"#f9fafb",
                  border:"2px solid #e5e7eb", borderRadius:10,
                  padding:"14px 16px", marginBottom:10,
                  cursor:"pointer", textAlign:"left",
                }}
              >
                <span style={{fontSize:26, flexShrink:0}}>{opt.icon}</span>
                <div>
                  <div style={{fontSize:15, fontWeight:700, color:"#111", marginBottom:2}}>{opt.title}</div>
                  <div style={{fontSize:12, color:"#888", lineHeight:1.4}}>{opt.desc}</div>
                </div>
              </button>
            ))}

            <button
              onClick={() => setViewModalEstimate(null)}
              style={{
                width:"100%", padding:"10px", marginTop:4,
                background:"transparent", border:"1px solid #ddd",
                borderRadius:8, cursor:"pointer", color:"#888", fontSize:14
              }}
            >
              Cancel
            </button>
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
  headerButtons: {
    display: "flex",
    gap: 12,
  },
  quickButton: {
    padding: "12px 24px",
    backgroundColor: "#10b981",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 16,
    fontWeight: "600",
    cursor: "pointer",
    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
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
  // ── Stats ──────────────────────────────────────────────────────────────────
  statsContainer: {
    display: "grid",
    gridTemplateColumns: "repeat(5, 1fr)",
    gap: 16,
    marginBottom: 24,
  },
  statCard: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 12,
    padding: "18px 16px",
    textAlign: "center",
    backdropFilter: "blur(4px)",
    border: "1px solid rgba(255,255,255,0.15)",
  },
  statValue: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.6)",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  // ──────────────────────────────────────────────────────────────────────────
  searchBar: {
    marginBottom: 20,
  },
  searchInput: {
    width: "100%",
    padding: "14px 20px",
    fontSize: 16,
    border: "2px solid #e5e7eb",
    borderRadius: 8,
    outline: "none",
    backgroundColor: "#fff",
    color: "#111",
    boxSizing: "border-box",
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
  estimateNumber: {
    fontWeight: "600",
    color: "#0b3ea8",
    fontSize: 16,
  },
  projectName: {
    fontWeight: "600",
    color: "#111",
    marginBottom: 4,
  },
  projectAddress: {
    fontSize: 13,
    color: "#666",
  },
  description: {
    color: "#666",
    maxWidth: 300,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  total: {
    fontWeight: "700",
    color: "#fc6b04",
    fontSize: 17,
  },
  date: {
    color: "#666",
    fontSize: 14,
  },
  actions: {
    display: "flex",
    gap: 4,
    justifyContent: "center",
    flexWrap: "wrap",
  },
  actionButton: {
    padding: "4px 8px",
    border: "none",
    borderRadius: 4,
    fontSize: 11,
    fontWeight: "600",
    cursor: "pointer",
  },
  editButton: {
    backgroundColor: "#6366f1",
    color: "#fff",
  },
  viewButton: {
    backgroundColor: "#3b82f6",
    color: "#fff",
  },
  printActionButton: {
    backgroundColor: "#8b5cf6",
    color: "#fff",
  },
  deleteButton: {
    backgroundColor: "#ef4444",
    color: "#fff",
  },
  singleLineText: {
    overflow: "hidden",
    whiteSpace: "nowrap",
    fontWeight: "600",
    color: "#111",
  },
  badge: {
    padding: "4px 8px",
    borderRadius: 4,
    fontSize: 11,
    fontWeight: "bold",
    color: "#fff",
    textTransform: "uppercase",
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
    marginBottom: 20,
  },
  emptyButton: {
    padding: "12px 32px",
    backgroundColor: "#0b3ea8",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 16,
    fontWeight: "600",
    cursor: "pointer",
  },
  footer: {
    marginTop: 20,
    textAlign: "center",
  },
  footerText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 14,
  },
  loading: {
    textAlign: "center",
    padding: 60,
    fontSize: 18,
    color: "#666",
  },
  filterContainer: {
    marginBottom: 20,
    display: "flex",
    justifyContent: "center",
  },
  filterButtons: {
    display: "flex",
    gap: 8,
    backgroundColor: "#fff",
    padding: "8px",
    borderRadius: 12,
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
  },
  filterButton: {
    padding: "10px 20px",
    border: "none",
    borderRadius: 8,
    fontSize: 15,
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.2s",
    backgroundColor: "#f9fafb",
    color: "#666",
  },
  activeFilterButton: {
    backgroundColor: "#0b3ea8",
    color: "#fff",
    boxShadow: "0 2px 4px rgba(11, 62, 168, 0.3)",
  },
};
