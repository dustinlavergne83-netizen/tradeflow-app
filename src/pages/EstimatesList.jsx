import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { notify, confirmDialog } from '../lib/notify';

// ── EstimateRows: renders one proposal row ───────────────────────────────────
// (2026-10 redesign: this list is proposals-only now — cost sheets and change
// orders are only reachable from within a project or customer file. Each row
// still carries an "Open Cost Sheet" action, via estimate.costSheetPath, so
// the underlying pricing/cost data is one click away.)
function EstimateRows({
  estimate, navigate, handleDelete, loadEstimates, formatDate, formatCurrency, styles,
}) {
  const [openMenu, setOpenMenu] = React.useState(null); // null | 'main'

  // Close dropdown when clicking outside
  React.useEffect(() => {
    function handler(e) {
      if (!e.target.closest('[data-action-menu]')) setOpenMenu(null);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const mainMenuItems = [
    { label: '📄 View Proposal', color: '#3b82f6', action: () => navigate(`/proposal/commercial-public?proposalId=${estimate.id}`) },
    estimate.costSheetPath
      ? { label: '📊 Open Cost Sheet', color: '#f59e0b', action: () => navigate(estimate.costSheetPath) }
      : { label: '📊 Open Cost Sheet', color: '#9ca3af', action: () => notify('No cost sheet is linked to this proposal.') },
    { label: '📈 Progress Invoice', color: '#8b5cf6', action: () => {
      if (estimate.project_id) {
        navigate(`/project/${estimate.project_id}/progress-billing?proposalId=${estimate.id}`);
      } else {
        notify('This proposal is not linked to a project. Open the project to create a progress invoice.');
      }
    }},
    { label: '🗑️ Delete', color: '#ef4444', action: () => handleDelete(estimate) },
  ];

  const dropdownStyle = {
    position: 'absolute', top: 'calc(100% + 2px)', right: 0,
    backgroundColor: '#fff', border: '2px solid #e5e7eb',
    borderRadius: 8, boxShadow: '0 6px 20px rgba(0,0,0,0.15)',
    zIndex: 300, minWidth: 170, overflow: 'hidden',
  };
  const menuItemStyle = (color) => ({
    display: 'block', width: '100%', padding: '9px 14px',
    backgroundColor: 'transparent', border: 'none',
    borderBottom: '1px solid #f3f4f6',
    color, cursor: 'pointer', fontSize: 13, fontWeight: 600, textAlign: 'left',
  });
  const triggerBtn = (label, bg) => ({
    padding: '5px 12px', backgroundColor: bg, border: 'none', color: '#fff',
    borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 700,
    display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap',
  });

  return (
    <tr
      style={styles.tableRow}
      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f9fafb'; }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
    >
      <td style={styles.td}>
        <div style={{display: 'flex', alignItems: 'center', gap: 7}}>
          <span style={{...styles.badge, backgroundColor: '#10b981'}}>PROPOSAL</span>
          <span style={styles.estimateNumber}>
            {estimate.estimate_number
              ? estimate.estimate_number.replace('EST-', '').replace('PROP-', '').replace(/^26-/, '')
              : 'N/A'}
          </span>
        </div>
      </td>
      <td style={styles.td}>
        <div style={{...styles.singleLineText, textAlign: 'center'}}>
          {estimate.contractor_name || 'N/A'}
        </div>
      </td>
      <td style={styles.td}>
        <div style={{...styles.singleLineText, textAlign: 'center'}}>
          {estimate.project_name || estimate.description || 'N/A'}
        </div>
      </td>
      <td style={{...styles.td, textAlign: 'right'}}>
        <span style={styles.total}>{formatCurrency(estimate.total)}</span>
      </td>
      <td style={{...styles.td, textAlign: 'center'}}>
        <span style={styles.date}>{formatDate(estimate.proposal_date || estimate.created_at)}</span>
      </td>
      <td style={{...styles.td, textAlign: 'center'}}>
        <div style={{position: 'relative', display: 'inline-block'}} data-action-menu="true">
          <button
            onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === 'main' ? null : 'main'); }}
            style={triggerBtn('⚡ Actions ▾', '#0b3ea8')}
          >
            ⚡ Actions <span style={{fontSize: 10, opacity: 0.75}}>▾</span>
          </button>
          {openMenu === 'main' && (
            <div style={dropdownStyle}>
              {mainMenuItems.map((item, idx) => (
                <button key={idx}
                  onClick={() => { setOpenMenu(null); item.action(); }}
                  style={menuItemStyle(item.color)}
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = item.color === '#ef4444' ? '#fef2f2' : '#f8fafc'; }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >{item.label}</button>
              ))}
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

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

  // Every row loaded by this list is a proposal now (see loadEstimates) —
  // this deliberately only ever deletes from "proposals", never "estimates".
  // Deleting a proposal must NEVER delete its underlying cost sheet; the
  // cost sheet can only be deleted from within its project/customer file.
  async function handleDelete(estimate) {
    if (!await confirmDialog(`Are you sure you want to delete proposal #${estimate.estimate_number}?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('proposals')
        .delete()
        .eq('id', estimate.id);

      if (error) throw error;

      notify('Deleted successfully!');
      loadEstimates(); // Reload the list
    } catch (err) {
      console.error('Error deleting:', err);
      notify(`Failed to delete: ${err.message}`);
    }
  }

  // Proposals-only list (2026-10 redesign). Cost sheets (estimates) and
  // change orders are deliberately NOT loaded here anymore — they're only
  // reachable from within a project or customer file. Each proposal row
  // still carries a link back to its underlying cost sheet (base_estimate_id)
  // so it can be opened via the row's "Open Cost Sheet" action.
  async function loadEstimates() {
    try {
      const { data: proposalsData, error: proposalsError } = await supabase
        .from("proposals")
        .select("*")
        .order("created_at", { ascending: false });

      if (proposalsError) {
        console.error("❌ Error loading proposals:", proposalsError);
        throw proposalsError;
      }

      // Batch-fetch project names (for proposals with project_id) and the
      // parent cost sheet's estimate_type + project_id (for proposals with
      // base_estimate_id) in two queries instead of one round-trip per row.
      const projectIds = [...new Set((proposalsData || []).map(p => p.project_id).filter(Boolean))];
      const estimateIds = [...new Set((proposalsData || []).map(p => p.base_estimate_id).filter(Boolean))];

      const [{ data: projectsData }, { data: estimatesData }] = await Promise.all([
        projectIds.length
          ? supabase.from('projects').select('id, name').in('id', projectIds)
          : Promise.resolve({ data: [] }),
        estimateIds.length
          ? supabase.from('estimates').select('id, estimate_type, project_id').in('id', estimateIds)
          : Promise.resolve({ data: [] }),
      ]);

      const projectNameById = Object.fromEntries((projectsData || []).map(p => [p.id, p.name]));
      const costSheetById = Object.fromEntries((estimatesData || []).map(e => [e.id, e]));

      const mappedProposals = (proposalsData || []).map(prop => {
        const costSheet = prop.base_estimate_id ? costSheetById[prop.base_estimate_id] : null;
        return {
          ...prop,
          type: 'proposal',
          estimate_number: prop.proposal_number,
          description: prop.contractor_name ? `Proposal to ${prop.contractor_name}` : 'Proposal',
          total: prop.total_amount,
          project_name: prop.project_id ? (projectNameById[prop.project_id] || 'Project Name Not Set') : 'Project Name Not Set',
          // Where "Open Cost Sheet" should navigate — null if this proposal
          // has no linked cost sheet (shouldn't normally happen; AUDIT found 0).
          costSheetPath: costSheet
            ? (costSheet.estimate_type === 'full'
                ? `/project/${costSheet.project_id}/estimate?estimateId=${prop.base_estimate_id}`
                : `/estimate/quick?estimateId=${prop.base_estimate_id}`)
            : null,
        };
      });

      setEstimates(mappedProposals);
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

  // ── Stats from date-filtered proposals ───────────────────────────────────────
  // Everything in `estimates` state is now type 'proposal' (see loadEstimates),
  // so there's no longer an estimates/change-orders breakdown to show here.
  const stats = {
    total: dateFilteredEstimates.length,
    totalValue: dateFilteredEstimates.reduce((sum, e) => sum + (Number(e.total) || 0), 0),
  };

  // ── Final filtered list (search + date only — no type filter needed) ────────
  const filteredEstimates = dateFilteredEstimates.filter(est => {
    const searchLower = searchTerm.toLowerCase();
    return (
      est.estimate_number?.toLowerCase().includes(searchLower) ||
      est.description?.toLowerCase().includes(searchLower) ||
      est.project_name?.toLowerCase().includes(searchLower) ||
      est.contractor_name?.toLowerCase().includes(searchLower)
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
        <h1 style={styles.title}>Proposals</h1>
        <div style={styles.headerButtons}>
          {/*
            "Quick Estimate" shortcut removed (2026-10) — cost sheets are no
            longer created from this list. They're created from within a
            project or customer file, then a proposal is generated from the
            cost sheet. Use the "Open Cost Sheet" row action to reach one.
          */}
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
          <div style={styles.statLabel}>Proposals · {periodLabel}</div>
        </div>
        <div style={styles.statCard}>
          <div style={{...styles.statValue, color: '#fc6b04'}}>{formatCurrency(stats.totalValue)}</div>
          <div style={styles.statLabel}>Total Value · {periodLabel}</div>
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

      {/*
        Type filter buttons removed (2026-10) — this list only ever shows
        proposals now, so an Estimates/Proposals/All toggle no longer
        means anything. filterType/setFilterType state is left in place
        (harmless, unused) rather than ripped out, in case a future filter
        (e.g. by proposal status) wants to reuse the same state shape.
      */}

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
              {/*
                Every row is a proposal now (see loadEstimates) — no more
                parent-estimate/nested-proposal grouping needed. Each row's
                "Open Cost Sheet" action (in EstimateRows) uses costSheetPath,
                computed once in loadEstimates, to jump to the underlying
                cost sheet when one exists.
              */}
              {filteredEstimates.map(proposal => (
                <EstimateRows
                  key={proposal.id}
                  estimate={proposal}
                  navigate={navigate}
                  handleDelete={handleDelete}
                  loadEstimates={loadEstimates}
                  formatDate={formatDate}
                  formatCurrency={formatCurrency}
                  styles={styles}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={styles.footer}>
        <p style={styles.footerText}>
          Showing {filteredEstimates.length} of {estimates.length} proposal{estimates.length !== 1 ? 's' : ''}
          {datePreset !== 'all' && ` · ${periodLabel}`}
        </p>
      </div>

      {/*
        "Choose View Format" modal removed (2026-10) — it was the Quick
        Estimate "Preview" action's picker, which no longer exists on this
        list (cost sheets/quick estimates aren't shown here anymore).
        viewModalEstimate/setViewModalEstimate state above is dead but left
        in place; harmless, and avoids an extra diff on top of an already
        large change.
      */}
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
    padding: "9px 14px",
    fontSize: 12,
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
    padding: "9px 14px",
    fontSize: 14,
    color: "#333",
  },
  estimateNumber: {
    fontWeight: "600",
    color: "#0b3ea8",
    fontSize: 14,
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
