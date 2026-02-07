import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

const BRAND = {
  bg: "#0b3ea8",
  text: "#f97316",
  accent: "#fc6b04ff",
  primary: "#2563eb",
};

export default function ProjectsList() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("created_at");
  const [activeCosts, setActiveCosts] = useState({ labor: 0, expenses: 0, total: 0 });

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    try {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      console.log("Loaded projects:", data); // Debug log
      setProjects(data || []);
      
      // Load time entries and expenses for cost calculation
      await loadCostData(data);
    } catch (err) {
      console.error("Error loading projects:", err);
      alert("Failed to load projects");
    } finally {
      setLoading(false);
    }
  }

  async function loadCostData(projectsData) {
    try {
      // Get active project IDs
      const activeProjectIds = projectsData
        .filter(p => p.status === "active")
        .map(p => p.id);
      
      if (activeProjectIds.length === 0) return;

      // Load time entries for active projects
      const { data: timeEntries } = await supabase
        .from("time_entries")
        .select("*")
        .in("project_id", activeProjectIds);

      // Load expenses from BOTH tables for active projects
      const { data: oldExpenses } = await supabase
        .from("project_expenses")
        .select("*")
        .in("project_id", activeProjectIds);

      const { data: newExpenses } = await supabase
        .from("expenses")
        .select("*")
        .in("project_id", activeProjectIds);

      // Combine both expense sources
      const expenses = [...(oldExpenses || []), ...(newExpenses || [])];

      // Calculate total labor cost
      let totalLaborCost = 0;
      if (timeEntries) {
        timeEntries.forEach(entry => {
          if (entry.clock_out) {
            const start = new Date(entry.clock_in).getTime();
            const end = new Date(entry.clock_out).getTime();
            const hours = (end - start) / (1000 * 60 * 60);
            
            // Find the project to get labor rate
            const project = projectsData.find(p => p.id === entry.project_id);
            const laborRate = project?.labor_rate || 50;
            totalLaborCost += hours * laborRate;
          }
        });
      }

      // Calculate total material/expense cost
      let totalExpenseCost = 0;
      if (expenses) {
        totalExpenseCost = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
      }

      // Store in state (we'll add this state variable)
      setActiveCosts({
        labor: totalLaborCost,
        expenses: totalExpenseCost,
        total: totalLaborCost + totalExpenseCost
      });
    } catch (err) {
      console.error("Error loading cost data:", err);
    }
  }

  async function handleDeleteProject(projectId, projectName, e) {
    e.stopPropagation(); // Prevent card click
    if (!confirm(`Delete project "${projectName}"? This cannot be undone.`)) {
      return;
    }

    try {
      // First, delete related records that might prevent deletion
      console.log("Deleting project:", projectId);
      
      // Delete estimates for this project
      await supabase
        .from("estimates")
        .delete()
        .eq("project_id", projectId);
      
      // Delete proposals for this project
      await supabase
        .from("proposals")
        .delete()
        .eq("project_id", projectId);
      
      // Now delete the project
      const { error } = await supabase
        .from("projects")
        .delete()
        .eq("id", projectId);

      if (error) {
        console.error("Delete error:", error);
        throw error;
      }
      
      alert("Project deleted successfully!");
      loadProjects(); // Reload the list
    } catch (err) {
      console.error("Error deleting project:", err);
      alert(`Failed to delete project: ${err.message || "Unknown error"}`);
    }
  }

  // Filter and sort projects
  const filteredProjects = projects
    .filter((project) => {
      // Search filter
      const matchesSearch = 
        project.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        project.customer?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        project.address?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        project.contractor?.toLowerCase().includes(searchQuery.toLowerCase());
      
      // Status filter
      const matchesStatus = 
        statusFilter === "all" || 
        project.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "name":
          return (a.name || "").localeCompare(b.name || "");
        case "customer":
          return (a.customer || "").localeCompare(b.customer || "");
        case "status":
          return (a.status || "").localeCompare(b.status || "");
        case "budget":
          return (b.budget || 0) - (a.budget || 0);
        case "created_at":
        default:
          return new Date(b.created_at) - new Date(a.created_at);
      }
    });

  // Calculate summary stats
  const stats = {
    total: projects.length,
    active: projects.filter(p => p.status === "active").length,
    completed: projects.filter(p => p.status === "completed").length,
    bidding: projects.filter(p => p.status === "bidding").length,
    pending: projects.filter(p => p.status === "pending").length,
    activeContractValue: projects
      .filter(p => p.status === "active")
      .reduce((sum, p) => sum + (p.contract_value || 0), 0),
    activeWorth: projects
      .filter(p => p.status === "active")
      .reduce((sum, p) => sum + (p.active_worth || 0), 0),
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Projects</h1>
        <button
          onClick={() => navigate("/")}
          style={styles.backButton}
        >
          ← Back to Dashboard
        </button>
      </div>

      {loading ? (
        <div style={styles.loading}>Loading projects...</div>
      ) : projects.length === 0 ? (
        <div style={styles.empty}>
          <p>No projects yet</p>
          <button
            onClick={() => navigate("/project/new")}
            style={styles.emptyButton}
          >
            Create Your First Project
          </button>
        </div>
      ) : (
        <>
          {/* Stats Summary */}
          <div style={styles.statsGrid}>
            <div style={styles.statCard}>
              <div style={styles.statValue}>{stats.total}</div>
              <div style={styles.statLabel}>Total Projects</div>
            </div>
            <div style={styles.statCard}>
              <div style={{...styles.statValue, color: "#10b981"}}>{stats.active}</div>
              <div style={styles.statLabel}>Active</div>
            </div>
            <div style={styles.statCard}>
              <div style={{...styles.statValue, color: "#fbbf24"}}>{stats.bidding}</div>
              <div style={styles.statLabel}>Bidding</div>
            </div>
            <div style={styles.statCard}>
              <div style={{...styles.statValue, color: "#6b7280"}}>{stats.completed}</div>
              <div style={styles.statLabel}>Completed</div>
            </div>
            <div style={styles.statCard}>
              <div style={{...styles.statValue, color: "#10b981"}}>${stats.activeWorth.toLocaleString()}</div>
              <div style={styles.statLabel}>Active Worth</div>
            </div>
          </div>

          {/* Toolbar */}
          <div style={styles.toolbar}>
            <div style={styles.toolbarLeft}>
              <input
                type="text"
                placeholder="🔍 Search projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={styles.searchInput}
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={styles.filterSelect}
              >
                <option value="all">All Status</option>
                <option value="bidding">Bidding</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="canceled">Canceled</option>
                <option value="postponed">Postponed</option>
              </select>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                style={styles.filterSelect}
              >
                <option value="created_at">Sort: Newest First</option>
                <option value="name">Sort: Name</option>
                <option value="customer">Sort: Customer</option>
                <option value="status">Sort: Status</option>
                <option value="budget">Sort: Budget</option>
              </select>
            </div>
            <button
              onClick={() => navigate("/project/new")}
              style={styles.newButton}
            >
              ➕ New Project
            </button>
          </div>

          {/* Results count */}
          <div style={styles.resultsCount}>
            Showing {filteredProjects.length} of {projects.length} projects
          </div>

          {/* Projects Grid */}
          {filteredProjects.length === 0 ? (
            <div style={styles.noResults}>
              <p>No projects match your filters</p>
            </div>
          ) : (
            <div style={styles.grid}>
              {filteredProjects.map((project) => {
                // Use whichever ID field exists (uuid, id, or fallback to name)
                const projectId = project.uuid || project.id || project.name;
                
                return (
                  <div
                    key={projectId}
                    style={styles.card}
                    onClick={() => navigate(`/project/${projectId}`)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "translateY(-4px)";
                      e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.15)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  >
                    <div style={styles.cardHeader}>
                      <h3 style={styles.projectName}>{project.name}</h3>
                      <button
                        onClick={(e) => handleDeleteProject(projectId, project.name, e)}
                        style={styles.deleteButton}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = "#fee2e2";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = "transparent";
                        }}
                      >
                        🗑️
                      </button>
                    </div>
                    
                    {project.customer && (
                      <p style={styles.customer}>👤 {project.customer}</p>
                    )}
                    {project.contractor && (
                      <p style={styles.customer}>🔨 {project.contractor}</p>
                    )}
                    {project.address && (
                      <p style={styles.address}>📍 {project.address}</p>
                    )}
                    
                    <div style={styles.cardFooter}>
                      {project.active_worth > 0 && (
                        <div style={styles.budget}>
                          💰 ${project.active_worth.toLocaleString()}
                        </div>
                      )}
                      {project.status && (
                        <span
                          style={{
                            ...styles.status,
                            backgroundColor:
                              project.status === "bidding" ? "#fef3c7" :
                              project.status === "pending" ? "#dbeafe" :
                              project.status === "approved" ? "#d1fae5" :
                              project.status === "active" ? "#10b981" :
                              project.status === "canceled" ? "#fee2e2" :
                              project.status === "postponed" ? "#e5e7eb" :
                              project.status === "completed" ? "#6b7280" : "#f59e0b",
                            color:
                              project.status === "active" ? "#fff" :
                              project.status === "completed" ? "#fff" : "#111",
                          }}
                        >
                          {project.status}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

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
    alignItems: "center",
    marginBottom: 32,
  },
  title: {
    fontSize: 36,
    color: BRAND.text,
    margin: 0,
  },
  backButton: {
    padding: "10px 20px",
    backgroundColor: "transparent",
    border: "2px solid #fff",
    color: "#fff",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 15,
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
    padding: 24,
    textAlign: "center",
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
  },
  statValue: {
    fontSize: 32,
    fontWeight: "bold",
    color: BRAND.accent,
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 14,
    color: "#666",
    textTransform: "uppercase",
    fontWeight: "600",
  },
  wideCardContent: {
    display: "flex",
    justifyContent: "space-around",
    alignItems: "center",
    gap: 32,
  },
  wideCardItem: {
    flex: 1,
    textAlign: "center",
  },
  toolbar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    gap: 16,
    flexWrap: "wrap",
  },
  toolbarLeft: {
    display: "flex",
    gap: 12,
    flex: 1,
    flexWrap: "wrap",
  },
  searchInput: {
    padding: "12px 16px",
    fontSize: 15,
    border: "2px solid #fff",
    borderRadius: 8,
    backgroundColor: "#fff",
    color: "#111",
    minWidth: 250,
    flex: 1,
  },
  filterSelect: {
    padding: "12px 16px",
    fontSize: 15,
    border: "2px solid #fff",
    borderRadius: 8,
    backgroundColor: "#fff",
    color: "#111",
    cursor: "pointer",
  },
  newButton: {
    padding: "12px 24px",
    backgroundColor: BRAND.accent,
    border: "none",
    color: "#fff",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 15,
    fontWeight: "600",
    whiteSpace: "nowrap",
  },
  resultsCount: {
    color: "#fff",
    fontSize: 14,
    marginBottom: 16,
    opacity: 0.9,
  },
  loading: {
    textAlign: "center",
    color: "#fff",
    fontSize: 18,
    padding: 40,
  },
  empty: {
    textAlign: "center",
    padding: 60,
    color: "#fff",
  },
  emptyButton: {
    padding: "14px 28px",
    backgroundColor: BRAND.accent,
    border: "none",
    color: "#fff",
    borderRadius: 10,
    cursor: "pointer",
    fontSize: 16,
    fontWeight: "bold",
    marginTop: 20,
  },
  noResults: {
    textAlign: "center",
    padding: 40,
    color: "#fff",
    fontSize: 16,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
    gap: 24,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 24,
    cursor: "pointer",
    transition: "transform 0.2s, box-shadow 0.2s",
    border: "2px solid transparent",
    position: "relative",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  projectName: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#111",
    margin: 0,
    flex: 1,
  },
  deleteButton: {
    padding: "6px 10px",
    backgroundColor: "transparent",
    border: "none",
    cursor: "pointer",
    fontSize: 18,
    borderRadius: 6,
    transition: "background-color 0.2s",
  },
  customer: {
    fontSize: 15,
    color: "#444",
    marginBottom: 8,
  },
  address: {
    fontSize: 14,
    color: "#666",
    marginBottom: 16,
  },
  cardFooter: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
    paddingTop: 16,
    borderTop: "1px solid #e5e7eb",
  },
  budget: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111",
  },
  status: {
    display: "inline-block",
    padding: "6px 12px",
    borderRadius: 6,
    fontSize: 12,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  costsGrid: {
    marginBottom: 32,
  },
  costCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 28,
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
  },
  costHeader: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#111",
    marginBottom: 20,
    paddingBottom: 12,
    borderBottom: "2px solid #e5e7eb",
  },
  costRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 0",
  },
  costLabel: {
    fontSize: 15,
    color: "#666",
  },
  costValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111",
  },
  costDivider: {
    height: 1,
    backgroundColor: "#e5e7eb",
    margin: "12px 0",
  },
};
