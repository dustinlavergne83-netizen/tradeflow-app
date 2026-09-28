import { useState, useEffect } from "react";
import Papa from "papaparse";
import { supabase } from "../lib/supabase";

// ============================================================================
// AccountDrillDown
// ----------------------------------------------------------------------------
// A reusable modal for accounting reports (Profit & Loss, Balance Sheet,
// Trial Balance, Cash Flow) that shows every journal entry line behind a
// clicked-on report amount, for a given account (or set of accounts) and
// date range. Queries the SAME source table/filters the reports themselves
// use (journal_entry_lines + journal_entries, is_posted = true, date range),
// so the drill-down total always reconciles with the number that was clicked.
//
// Props:
//   accountIds   - array of account UUIDs to include (single-account callers
//                  just pass a 1-element array)
//   accountType  - 'Income' | 'Expense' | 'Asset' | 'Liability' | 'Equity'
//                  (determines whether debit or credit increases the balance)
//   title        - heading shown in the modal, e.g. "5000 - Cost of Goods Sold"
//   startDate, endDate - the report's date range (YYYY-MM-DD)
//   onClose      - called when the modal should close
//
// NOTE: Level 2 (click a transaction to jump to its source record) is
// intentionally NOT included yet. Most historical entries (reference_type
// 'expense_import' / 'income_import') have reference_id = null, so there is
// no source record to jump to for them. Once that data gap is addressed,
// Level 2 can be added without changing this component's public shape.
// ============================================================================
export default function AccountDrillDown({ accountIds, accountType, title, startDate, endDate, onClose }) {
  const [loading, setLoading] = useState(true);
  const [lines, setLines] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadLines();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(accountIds), startDate, endDate]);

  async function loadLines() {
    if (!accountIds || accountIds.length === 0) {
      setLines([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);

      const { data, error: queryError } = await supabase
        .from("journal_entry_lines")
        .select(`
          id,
          debit,
          credit,
          description,
          account_id,
          journal_entries!inner(
            entry_date,
            entry_number,
            description,
            reference_type,
            reference_id,
            is_posted
          )
        `)
        .in("account_id", accountIds)
        .eq("journal_entries.is_posted", true)
        .gte("journal_entries.entry_date", startDate)
        .lte("journal_entries.entry_date", endDate);

      if (queryError) throw queryError;

      // ── Fetch real payee/vendor names for lines whose entry DOES have a
      // source record, rather than relying on parsed description text.
      // bank_transaction entries link via reference_id -> bank_transactions.id;
      // expense entries link via reference_id -> expenses.id. Entries from
      // bulk imports (expense_import/income_import) have reference_id = null,
      // so those fall back to parsing the entry description instead.
      const bankTxIds = [...new Set(
        (data || [])
          .filter(l => l.journal_entries.reference_type === 'bank_transaction' && l.journal_entries.reference_id)
          .map(l => l.journal_entries.reference_id)
      )];
      const expenseIds = [...new Set(
        (data || [])
          .filter(l => l.journal_entries.reference_type === 'expense' && l.journal_entries.reference_id)
          .map(l => l.journal_entries.reference_id)
      )];

      const [bankTxRes, expenseRes] = await Promise.all([
        bankTxIds.length
          ? supabase.from("bank_transactions").select("id, payee, description").in("id", bankTxIds)
          : Promise.resolve({ data: [] }),
        expenseIds.length
          ? supabase.from("expenses").select("id, vendor").in("id", expenseIds)
          : Promise.resolve({ data: [] }),
      ]);
      const payeeByBankTxId = {};
      (bankTxRes.data || []).forEach(bt => { payeeByBankTxId[bt.id] = bt.payee || bt.description || null; });
      const vendorByExpenseId = {};
      (expenseRes.data || []).forEach(e => { vendorByExpenseId[e.id] = e.vendor || null; });

      // Income increases on credit; every other type shown here (Expense,
      // Asset, Liability, Equity) increases on debit for this report's
      // purposes — matches the sign convention already used by ProfitLoss.jsx.
      const signedLines = (data || []).map(line => {
        const amount = accountType === 'Income'
          ? (line.credit || 0) - (line.debit || 0)
          : (line.debit || 0) - (line.credit || 0);
        const je = line.journal_entries;
        const payee = derivePayee(je, payeeByBankTxId, vendorByExpenseId);
        return {
          id: line.id,
          date: je.entry_date,
          entryNumber: je.entry_number,
          description: line.description || je.description || '(no description)',
          payee,
          source: sourceLabel(je.reference_type),
          amount,
        };
      }).sort((a, b) => new Date(a.date) - new Date(b.date));

      setLines(signedLines);
    } catch (err) {
      console.error("Error loading account drill-down:", err);
      setError(err.message);
      setLines([]);
    } finally {
      setLoading(false);
    }
  }

  // Determine the best available payee/vendor name for a journal entry.
  // Prefers a real linked record (bank_transactions.payee, expenses.vendor)
  // over parsing text, since those are authoritative. Falls back to parsing
  // the entry description for sources with no back-reference (bulk imports).
  function derivePayee(je, payeeByBankTxId, vendorByExpenseId) {
    if (je.reference_type === 'bank_transaction' && je.reference_id) {
      const p = payeeByBankTxId[je.reference_id];
      if (p) return p;
    }
    if (je.reference_type === 'expense' && je.reference_id) {
      const v = vendorByExpenseId[je.reference_id];
      if (v && v !== 'Bank Transaction') return v;
    }

    const desc = je.description || '';
    // expense_import format: "Vendor Name — Category" (em dash separator).
    // "Imported — Category" means no real vendor was captured on import.
    if (je.reference_type === 'expense_import') {
      const parts = desc.split('—');
      const name = parts[0]?.trim();
      if (name && name !== 'Imported') return name;
      return null;
    }
    // income_import format: "QB Import: Invoice from Vendor Name — Inv #...".
    if (je.reference_type === 'income_import') {
      const match = desc.match(/Invoice from (.+?)(\s+—|$)/);
      if (match) return match[1].trim();
      return null;
    }
    return null;
  }

  function sourceLabel(referenceType) {
    const labels = {
      bank_transaction: '🏦 Bank',
      expense: '✏️ Expense',
      expense_import: '📥 Imported',
      income_import: '📥 Imported',
      invoice: '🧾 Invoice',
      invoice_payment: '💳 Payment',
      bill: '📋 Bill',
      transfer: '🔄 Transfer',
      opening_balance: '🏁 Opening Bal.',
      manual: '📝 Manual',
      correction: '🔧 Correction',
      deposit: '💰 Deposit',
      project_deposit: '💰 Project Dep.',
    };
    return labels[referenceType] || referenceType || '—';
  }

  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return '$0.00';
    const sign = amount < 0 ? '-' : '';
    return `${sign}$${Math.abs(Number(amount)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString.includes('T') ? dateString : dateString + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  };

  const total = lines.reduce((sum, l) => sum + l.amount, 0);

  function handleExportCSV() {
    if (!lines.length) return;
    const rows = lines.map(l => ({
      Date: formatDate(l.date),
      Payee: l.payee || '',
      Description: l.description,
      Source: l.source,
      'Entry #': l.entryNumber,
      Amount: l.amount.toFixed(2),
    }));
    rows.push({ Date: '', Payee: '', Description: '', Source: '', 'Entry #': 'TOTAL', Amount: total.toFixed(2) });
    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const slug = (title || 'account').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    a.download = `${slug}-transactions.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <div>
            <h2 style={styles.title}>{title}</h2>
            <p style={styles.subtitle}>{formatDate(startDate)} – {formatDate(endDate)}</p>
          </div>
          <div style={{display: 'flex', gap: 10, alignItems: 'center'}}>
            <button onClick={handleExportCSV} style={styles.exportButton} title="Export this list as a CSV file">
              📥 Export CSV
            </button>
            <button onClick={onClose} style={styles.closeButton} title="Close">✕</button>
          </div>
        </div>

        <div style={styles.body}>
          {loading ? (
            <div style={styles.loading}>Loading transactions...</div>
          ) : error ? (
            <div style={styles.errorMsg}>Failed to load: {error}</div>
          ) : lines.length === 0 ? (
            <div style={styles.noData}>No transactions found for this account in this period.</div>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={{...styles.th, textAlign: 'left', width: '11%'}}>Date</th>
                  <th style={{...styles.th, textAlign: 'left', width: '20%'}}>Payee</th>
                  <th style={{...styles.th, textAlign: 'left', width: '31%'}}>Description</th>
                  <th style={{...styles.th, textAlign: 'left', width: '13%'}}>Source</th>
                  <th style={{...styles.th, textAlign: 'left', width: '10%'}}>Entry #</th>
                  <th style={{...styles.th, textAlign: 'right', width: '15%'}}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {lines.map(line => (
                  <tr key={line.id} style={styles.tr}>
                    <td style={styles.td}>{formatDate(line.date)}</td>
                    <td style={{...styles.td, ...styles.tdEllipsis, fontWeight: 600}}>{line.payee || '—'}</td>
                    <td style={{...styles.td, ...styles.tdEllipsis}}>{line.description}</td>
                    <td style={styles.td}>{line.source}</td>
                    <td style={{...styles.td, fontSize: 12, color: '#888'}}>{line.entryNumber}</td>
                    <td style={{...styles.td, textAlign: 'right', fontWeight: 600}}>{formatCurrency(line.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {!loading && !error && lines.length > 0 && (
          <div style={styles.footer}>
            <span style={styles.footerLabel}>{lines.length} transaction{lines.length !== 1 ? 's' : ''}</span>
            <span style={styles.footerTotal}>{formatCurrency(total)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: 20,
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: '100%',
    maxWidth: 1000,
    maxHeight: '85vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: '20px 24px',
    borderBottom: '2px solid #e5e7eb',
  },
  title: { fontSize: 20, fontWeight: 'bold', color: '#111', margin: 0 },
  subtitle: { fontSize: 13, color: '#666', margin: '4px 0 0 0' },
  exportButton: {
    padding: '8px 16px', backgroundColor: '#059669', color: '#fff',
    border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
  },
  closeButton: {
    padding: '8px 12px', backgroundColor: '#f3f4f6', color: '#333',
    border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 700, cursor: 'pointer',
  },
  body: { overflowY: 'auto', padding: '0 24px' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    padding: '12px 8px', fontSize: 12, fontWeight: 700, color: '#666',
    textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid #e5e7eb',
    position: 'sticky', top: 0, backgroundColor: '#fff',
  },
  tr: { borderBottom: '1px solid #f0f0f0' },
  td: { padding: '10px 8px', fontSize: 13, color: '#333' },
  tdEllipsis: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 1 },
  loading: { textAlign: 'center', padding: 40, color: '#666' },
  errorMsg: { textAlign: 'center', padding: 40, color: '#ef4444' },
  noData: { textAlign: 'center', padding: 40, color: '#999', fontStyle: 'italic' },
  footer: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '16px 24px', borderTop: '2px solid #e5e7eb', backgroundColor: '#f9fafb',
    borderBottomLeftRadius: 12, borderBottomRightRadius: 12,
  },
  footerLabel: { fontSize: 13, color: '#666', fontWeight: 600 },
  footerTotal: { fontSize: 18, fontWeight: 'bold', color: '#111' },
};
