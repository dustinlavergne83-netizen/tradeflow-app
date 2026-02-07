import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import './OwnerDraws.css';

export default function OwnerDraws() {
  const [summary, setSummary] = useState([]);
  const [pendingDraws, setPendingDraws] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [settleLoading, setSettleLoading] = useState(false);
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [message, setMessage] = useState('');
  const [ytdTotal, setYtdTotal] = useState(0);

  useEffect(() => {
    loadOwnerDrawsData();
  }, []);

  async function loadOwnerDrawsData() {
    try {
      setLoading(true);

      // Get current user's company
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: company } = await supabase
        .from('companies')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!company) return;

      // Load owner draws summary
      const { data: summaryData } = await supabase
        .from('vw_owner_draws_summary')
        .select('*')
        .eq('company_id', company.id)
        .order('month', { ascending: false });

      setSummary(summaryData || []);

      // Calculate YTD total
      const currentYear = new Date().getFullYear();
      const ytd = (summaryData || [])
        .filter(s => new Date(s.month).getFullYear() === currentYear)
        .reduce((sum, s) => sum + (s.total_draws || 0), 0);
      setYtdTotal(ytd);

      // Load pending draws
      const { data: pendingData } = await supabase
        .from('vw_pending_owner_draws')
        .select('*')
        .eq('company_id', company.id);

      setPendingDraws(pendingData || []);

      // Load settlement history
      const { data: settlementsData } = await supabase
        .from('owner_draw_settlements')
        .select('*')
        .eq('company_id', company.id)
        .order('settlement_date', { ascending: false });

      setSettlements(settlementsData || []);
    } catch (err) {
      console.error('Error loading owner draws:', err);
      setMessage('Error loading owner draws data');
    } finally {
      setLoading(false);
    }
  }

  async function handleSettlementStatusChange(drawId, newStatus) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: company } = await supabase
        .from('companies')
        .select('id')
        .eq('user_id', user.id)
        .single();

      await supabase
        .from('bank_transactions')
        .update({ draw_status: newStatus, updated_at: new Date() })
        .eq('id', drawId)
        .eq('company_id', company.id);

      // Reload data
      loadOwnerDrawsData();
      setMessage(`Draw status updated to ${newStatus}`);
    } catch (err) {
      console.error('Error updating draw status:', err);
      setMessage('Error updating draw status');
    }
  }

  async function handleSettleDraws() {
    if (!periodStart || !periodEnd) {
      setMessage('Please select both start and end dates');
      return;
    }

    if (new Date(periodStart) > new Date(periodEnd)) {
      setMessage('Start date must be before end date');
      return;
    }

    try {
      setSettleLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      const { data: company } = await supabase
        .from('companies')
        .select('id')
        .eq('user_id', user.id)
        .single();

      // Call the settle_owner_draws function
      const { data, error } = await supabase.rpc('settle_owner_draws', {
        p_company_id: company.id,
        p_period_start: periodStart,
        p_period_end: periodEnd
      });

      if (error) {
        setMessage(`Settlement Error: ${error.message}`);
        return;
      }

      if (data && data.length > 0) {
        const result = data[0];
        setMessage(`✓ ${result.message}`);
        
        // Clear form and reload
        setPeriodStart('');
        setPeriodEnd('');
        setShowSettleModal(false);
        
        // Reload data after a short delay
        setTimeout(() => loadOwnerDrawsData(), 500);
      }
    } catch (err) {
      console.error('Error settling draws:', err);
      setMessage('Error settling owner draws');
    } finally {
      setSettleLoading(false);
    }
  }

  if (loading) return <div className="owner-draws"><p>Loading...</p></div>;

  return (
    <div className="owner-draws">
      <h1>Owner Draws Management</h1>

      {message && (
        <div className={`message ${message.includes('Error') ? 'error' : 'success'}`}>
          {message}
          <button onClick={() => setMessage('')}>×</button>
        </div>
      )}

      {/* YTD Summary */}
      <div className="summary-card">
        <div className="summary-item">
          <h3>YTD Total Draws</h3>
          <p className="amount">${ytdTotal.toFixed(2)}</p>
        </div>
        <div className="summary-item">
          <h3>Pending Settlement</h3>
          <p className="count">{pendingDraws.length} draws</p>
        </div>
      </div>

      {/* Pending Draws Table */}
      <div className="section">
        <div className="section-header">
          <h2>Pending Draws</h2>
          <button 
            className="btn btn-primary"
            onClick={() => setShowSettleModal(true)}
          >
            Settle Draws
          </button>
        </div>

        {pendingDraws.length === 0 ? (
          <p className="no-data">No pending draws</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pendingDraws.map(draw => (
                <tr key={draw.id}>
                  <td>{new Date(draw.transaction_date).toLocaleDateString()}</td>
                  <td>{draw.description || 'Owner Draw'}</td>
                  <td>${Math.abs(draw.amount).toFixed(2)}</td>
                  <td>
                    <span className={`status ${draw.draw_status}`}>
                      {draw.status_label}
                    </span>
                  </td>
                  <td>
                    <select
                      value={draw.draw_status}
                      onChange={(e) => handleSettlementStatusChange(draw.id, e.target.value)}
                      className="status-select"
                    >
                      <option value="pending">Pending</option>
                      <option value="reviewed">Reviewed</option>
                      <option value="approved">Approved</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Monthly Summary */}
      <div className="section">
        <h2>Monthly Summary</h2>
        {summary.length === 0 ? (
          <p className="no-data">No draws recorded</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Month</th>
                <th>Count</th>
                <th>Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((item, idx) => (
                <tr key={idx}>
                  <td>{new Date(item.month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</td>
                  <td>{item.draw_count}</td>
                  <td>${item.total_draws.toFixed(2)}</td>
                  <td>
                    <span className={`status ${item.draw_status}`}>
                      {item.draw_status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Settlement History */}
      <div className="section">
        <h2>Settlement History</h2>
        {settlements.length === 0 ? (
          <p className="no-data">No settlements recorded</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Settlement Date</th>
                <th>Period</th>
                <th>Total Settled</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {settlements.map(settlement => (
                <tr key={settlement.id}>
                  <td>{new Date(settlement.settlement_date).toLocaleDateString()}</td>
                  <td>
                    {new Date(settlement.period_start).toLocaleDateString()} - {new Date(settlement.period_end).toLocaleDateString()}
                  </td>
                  <td className="amount">${settlement.total_draws.toFixed(2)}</td>
                  <td>{settlement.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Settlement Modal */}
      {showSettleModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>Settle Owner Draws</h2>
              <button className="close" onClick={() => setShowSettleModal(false)}>×</button>
            </div>
            
            <div className="modal-body">
              <p className="info">
                This will create a journal entry closing owner draws to capital for the selected period.
              </p>
              
              <div className="form-group">
                <label>Period Start Date:</label>
                <input
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Period End Date:</label>
                <input
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                />
              </div>

              <div className="form-group info-box">
                <h3>What this does:</h3>
                <ul>
                  <li>Sums all owner draws for the period</li>
                  <li>Creates journal entry: DB Owner Draws, CR Owner Capital</li>
                  <li>Marks all draws as "settled"</li>
                  <li>Records settlement in history</li>
                </ul>
              </div>
            </div>

            <div className="modal-footer">
              <button 
                className="btn btn-secondary"
                onClick={() => setShowSettleModal(false)}
                disabled={settleLoading}
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary"
                onClick={handleSettleDraws}
                disabled={settleLoading || !periodStart || !periodEnd}
              >
                {settleLoading ? 'Settling...' : 'Settle Draws'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
