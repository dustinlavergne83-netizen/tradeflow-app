import { useState } from "react";

/**
 * DepositPicker — reusable "Apply Deposits to Invoice" prompt.
 *
 * Shown whenever a project has un-applied ("received") deposits. Nothing
 * is pre-selected — the user always explicitly checks which deposit(s),
 * if any, should be applied to this invoice, then clicks Apply (or Skip).
 *
 * Props:
 *   deposits    — array of project_deposits rows (status === 'received')
 *   onApply(selectedDeposits, totalAmount) — called with the chosen deposits
 *   onSkip()    — called when the user dismisses without applying
 *   accent      — hex color for buttons/highlights (defaults to TradeFlow orange)
 */
export default function DepositPicker({ deposits, onApply, onSkip, accent = "#fc6b04" }) {
  const [selected, setSelected] = useState(new Set());

  if (!deposits || deposits.length === 0) return null;

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectedDeposits = deposits.filter((d) => selected.has(d.id));
  const total = selectedDeposits.reduce((sum, d) => sum + (Number(d.deposit_amount) || 0), 0);

  const fmtMoney = (n) => "$" + Number(n || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const fmtDate = (d) => {
    if (!d) return "";
    const dt = new Date(d + "T00:00:00");
    return `${String(dt.getMonth() + 1).padStart(2, "0")}/${String(dt.getDate()).padStart(2, "0")}/${dt.getFullYear()}`;
  };

  return (
    <div style={{
      backgroundColor: "#fff", borderRadius: 12, padding: 24,
      boxShadow: "0 1px 3px rgba(0,0,0,0.1)", marginBottom: 24,
      border: "2px solid #fde68a",
    }}>
      <h2 style={{ fontSize: 20, fontWeight: "bold", color: "#111", margin: "0 0 4px" }}>
        💰 Apply Deposits to This Invoice?
      </h2>
      <p style={{ fontSize: 14, color: "#666", margin: "0 0 20px" }}>
        This project has {deposits.length} deposit{deposits.length > 1 ? "s" : ""} on file that
        {deposits.length > 1 ? " haven't" : " hasn't"} been applied to an invoice yet. Select any
        you'd like to apply here, or skip to leave them available for a future invoice.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
        {deposits.map((deposit) => {
          const checked = selected.has(deposit.id);
          return (
            <div
              key={deposit.id}
              onClick={() => toggle(deposit.id)}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "12px 16px", borderRadius: 8, cursor: "pointer",
                backgroundColor: checked ? "#fff7ed" : "#f9fafb",
                border: checked ? `2px solid ${accent}` : "2px solid #e5e7eb",
                transition: "all 0.15s",
              }}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => {}}
                onClick={(e) => e.stopPropagation()}
                style={{ width: 20, height: 20, cursor: "pointer", accentColor: accent, flexShrink: 0 }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 15, color: "#111" }}>
                  {fmtMoney(deposit.deposit_amount)}
                </div>
                <div style={{ fontSize: 12, color: "#666" }}>
                  Received {fmtDate(deposit.deposit_date)}
                  {deposit.reference_notes ? ` — ${deposit.reference_notes}` : ""}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {selected.size > 0 && (
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "12px 16px", backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0",
          borderRadius: 8, marginBottom: 16,
        }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#166534" }}>
            {selected.size} deposit{selected.size > 1 ? "s" : ""} selected
          </span>
          <span style={{ fontSize: 18, fontWeight: "bold", color: "#166534" }}>
            {fmtMoney(total)}
          </span>
        </div>
      )}

      <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
        <button
          onClick={onSkip}
          style={{
            padding: "10px 20px", backgroundColor: "#e5e7eb", border: "none",
            color: "#111", borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 600,
          }}
        >
          Skip
        </button>
        <button
          onClick={() => onApply(selectedDeposits, total)}
          disabled={selected.size === 0}
          style={{
            padding: "10px 20px", border: "none", color: "#fff", borderRadius: 8,
            fontSize: 14, fontWeight: 600,
            backgroundColor: selected.size === 0 ? "#d1d5db" : accent,
            cursor: selected.size === 0 ? "not-allowed" : "pointer",
          }}
        >
          Apply {selected.size > 0 ? fmtMoney(total) : "Deposit(s)"}
        </button>
      </div>
    </div>
  );
}
