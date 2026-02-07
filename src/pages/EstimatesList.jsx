import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

export default function EstimatesList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [estimates, setEstimates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

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
      // Load all proposals (temporarily without user filter to debug)
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

      // Map proposals to display format
      const mappedProposals = (proposalsData || []).map(prop => ({ 
        ...prop, 
        type: 'proposal',
        estimate_number: prop.proposal_number,
        description: prop.contractor_name ? `Proposal to ${prop.contractor_name}` : 'Proposal',
        total: prop.total_amount
      }));

      // Try to load quick estimates (only those with estimate_number)
      try {
        const { data: estimatesData, error: estimatesError } = await supabase
          .from("estimates")
          .select("*")
          .eq("created_by", user.id)
          .not("estimate_number", "is", null)
          .order("created_at", { ascending: false });

        if (!estimatesError && estimatesData) {
          // Filter out project estimates (those with EST- prefix) - only keep Quick Estimates
          const quickEstimates = estimatesData.filter(est => 
            !est.estimate_number?.startsWith('EST-')
          );
          
          // Map estimates to display format (only Quick Estimates with numbers)
          const mappedEstimates = quickEstimates.map(est => ({
            ...est,
            type: 'quick_estimate',
            description: est.project_name || est.notes || 'Quick Estimate'
          }));

          // Combine and sort by date
          const combined = [...mappedEstimates, ...mappedProposals].sort((a, b) => {
            const dateA = new Date(a.created_at);
            const dateB = new Date(b.created_at);
            return dateB - dateA;
          });
          
          setEstimates(combined);
        } else {
          // If error loading estimates, just show proposals
          setEstimates(mappedProposals);
        }
      } catch (estErr) {
        console.log("Error loading quick estimates, showing proposals only:", estErr);
        setEstimates(mappedProposals);
      }
    } catch (err) {
      console.error("Error loading proposals:", err);
    } finally {
      setLoading(false);
    }
  }

  const filteredEstimates = estimates.filter(est => {
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
    const date = new Date(dateString);
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

      <div style={styles.searchBar}>
        <input
          type="text"
          placeholder="Search estimates by number, description, or project..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={styles.searchInput}
        />
      </div>

      {filteredEstimates.length === 0 ? (
        <div style={styles.empty}>
          <p style={styles.emptyText}>
            {searchTerm ? "No estimates found matching your search." : "No estimates yet. Create your first estimate!"}
          </p>
          {!searchTerm && (
            <button 
              onClick={() => navigate('/estimate/new')}
              style={styles.emptyButton}
            >
              Create Estimate
            </button>
          )}
        </div>
      ) : (
        <div style={styles.tableContainer}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.tableHeaderRow}>
                <th style={{...styles.th, textAlign: 'left', width: '18%'}}>Estimate #</th>
                <th style={{...styles.th, textAlign: 'center', width: '12%'}}>Customer</th>
                <th style={{...styles.th, textAlign: 'center', width: '22%'}}>Project</th>
                <th style={{...styles.th, textAlign: 'right', width: '12%'}}>Total</th>
                <th style={{...styles.th, textAlign: 'center', width: '12%'}}>Date</th>
                <th style={{...styles.th, textAlign: 'center', width: '14%'}}>Actions</th>
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
                      ) : estimate.project_id ? (
                        <>
                          <button
                            onClick={() => navigate(`/project/${estimate.project_id}/estimate?estimateId=${estimate.id}`)}
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
                      ) : (
                        <>
                          <button
                            onClick={() => navigate(`/estimate/quick?estimateId=${estimate.id}`)}
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
  searchBar: {
    marginBottom: 30,
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
    gap: 8,
    justifyContent: "center",
  },
  actionButton: {
    padding: "6px 12px",
    border: "none",
    borderRadius: 6,
    fontSize: 13,
    fontWeight: "600",
    cursor: "pointer",
  },
  viewButton: {
    backgroundColor: "#3b82f6",
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
    color: "#666",
    fontSize: 14,
  },
  loading: {
    textAlign: "center",
    padding: 60,
    fontSize: 18,
    color: "#666",
  },
};
