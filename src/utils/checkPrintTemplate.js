/**
 * checkPrintTemplate — builds the HTML string printed into the popup
 * window, following the same window.open()/window.print() convention
 * used by Estimate.jsx, ProjectMaterialList.jsx, and Communications.jsx.
 *
 * Layout targets standard QuickBooks-voucher check stock (check on top,
 * two 3.5" remittance stubs below, 8.5x11 letter page):
 *   Check:  0"    - 3.5"
 *   Stub 1: 3.5"  - 7.0"
 *   Stub 2: 7.0"  - 10.5" (unused space on 11" letter, safe margin)
 *
 * Stock is PRE-PRINTED (company name, bank name/address, MICR line,
 * check number). TradeFlow only prints: date, payee, amount, amount in
 * words, memo, and the remittance stub detail — positioned with
 * per-bank-account calibration offsets (inches) to absorb printer feed
 * variance.
 */
import { formatCheckDate, formatCheckAmount } from "./checkUtils";

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function stubTable(lines, title) {
  const rows = (lines || [])
    .map(
      (l) => `<tr>
        <td class="stub-desc">${escapeHtml(l.description)}</td>
        <td class="stub-ref">${escapeHtml(l.reference || "")}</td>
        <td class="stub-amt">$${formatCheckAmount(l.amount)}</td>
      </tr>`
    )
    .join("");
  const total = (lines || []).reduce((s, l) => s + (Number(l.amount) || 0), 0);
  return `
    <div class="stub">
      <div class="stub-title">${escapeHtml(title)}</div>
      <table class="stub-table">
        <tr><th class="stub-desc">Description</th><th class="stub-ref">Reference</th><th class="stub-amt">Amount</th></tr>
        ${rows}
        <tr class="stub-total-row"><td colspan="2">Total</td><td class="stub-amt">$${formatCheckAmount(total)}</td></tr>
      </table>
    </div>`;
}

/**
 * @param {object} check - { check_number, check_date, payee_name, amount, amount_words, memo }
 * @param {object[]} stubLines - [{ description, reference, amount }]
 * @param {object} offsets - { x, y } inches, from bank_accounts.check_offset_x/y
 * @param {object} brand - { name } company name for the print-preview toolbar only
 */
export function buildCheckPrintHtml(check, stubLines, offsets, brand) {
  const ox = Number(offsets?.x || 0);
  const oy = Number(offsets?.y || 0);

  return `<!DOCTYPE html>
<html>
<head>
<title>Check #${escapeHtml(check.check_number)} - ${escapeHtml(check.payee_name)}</title>
<style>
  @page { size: letter; margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: 'Courier New', Courier, monospace; color: #000; }
  .toolbar { padding: 12px 20px; background: #0b3ea8; }
  .toolbar button { padding: 10px 24px; border: none; border-radius: 6px; font-size: 15px; font-weight: 700; cursor: pointer; margin-right: 12px; }
  .toolbar .print-btn { background: #f97316; color: #fff; }
  .toolbar .close-btn { background: #666; color: #fff; }
  @media print { .toolbar { display: none; } }

  .page {
    position: relative;
    width: 8.5in;
    height: 11in;
    transform: translate(${ox}in, ${oy}in);
  }

  .check {
    position: absolute;
    top: 0; left: 0; width: 8.5in; height: 3.5in;
  }
  .field { position: absolute; font-size: 12pt; white-space: nowrap; }
  .date-field { top: 0.55in; left: 6.3in; }
  .payee-field { top: 1.15in; left: 1.0in; width: 5in; }
  .amount-num-field { top: 1.15in; left: 6.9in; font-weight: bold; }
  .amount-words-field { top: 1.5in; left: 0.6in; width: 7.3in; }
  .memo-field { top: 2.75in; left: 0.6in; font-size: 10pt; }

  .stubs { position: absolute; top: 3.5in; left: 0; width: 8.5in; }
  .stub { padding: 0.25in 0.5in; height: 3.5in; }
  .stub-title { font-weight: bold; font-size: 11pt; margin-bottom: 6px; }
  .stub-table { width: 100%; border-collapse: collapse; font-size: 10pt; }
  .stub-table th { text-align: left; border-bottom: 1px solid #000; padding: 3px 6px; }
  .stub-table td { padding: 3px 6px; }
  .stub-desc { width: 60%; }
  .stub-ref { width: 20%; }
  .stub-amt { width: 20%; text-align: right; }
  .stub-total-row td { border-top: 1px solid #000; font-weight: bold; }
</style>
</head>
<body>
  <div class="toolbar no-print">
    <button class="print-btn" onclick="window.print()">🖨️ Print Check</button>
    <button class="close-btn" onclick="window.close()">Close</button>
  </div>

  <div class="page">
    <div class="check">
      <div class="field date-field">${escapeHtml(formatCheckDate(check.check_date))}</div>
      <div class="field payee-field">${escapeHtml(check.payee_name)}</div>
      <div class="field amount-num-field">$${formatCheckAmount(check.amount)}</div>
      <div class="field amount-words-field">${escapeHtml(check.amount_words)}</div>
      ${check.memo ? `<div class="field memo-field">${escapeHtml(check.memo)}</div>` : ""}
    </div>
    <div class="stubs">
      ${stubTable(stubLines, `Check #${check.check_number} — ${brand?.name || "TradeFlow"}`)}
    </div>
  </div>
</body>
</html>`;
}

/** Calibration grid — printed on plain paper, held against a real check to measure offsets. */
export function buildCalibrationHtml() {
  const hLines = [];
  for (let i = 0.5; i < 11; i += 0.5) {
    hLines.push(`<div style="position:absolute; top:${i}in; left:0; width:8.5in; border-top:1px solid #999; font-size:8pt; color:#666;">${i.toFixed(1)}"</div>`);
  }
  const vLines = [];
  for (let i = 0.5; i < 8.5; i += 0.5) {
    vLines.push(`<div style="position:absolute; top:0; left:${i}in; height:11in; border-left:1px solid #999; font-size:8pt; color:#666;">${i.toFixed(1)}"</div>`);
  }
  return `<!DOCTYPE html>
<html><head><title>Check Alignment Calibration</title>
<style>
  @page { size: letter; margin: 0; }
  body { margin: 0; font-family: Arial, sans-serif; }
  .toolbar { padding: 12px 20px; background: #0b3ea8; }
  .toolbar button { padding: 10px 24px; border: none; border-radius: 6px; font-size: 15px; font-weight: 700; cursor: pointer; margin-right: 12px; background: #f97316; color: #fff; }
  @media print { .toolbar { display: none; } }
  .page { position: relative; width: 8.5in; height: 11in; }
  .marker { position: absolute; border: 2px dashed red; }
</style></head>
<body>
  <div class="toolbar no-print"><button onclick="window.print()">🖨️ Print Calibration Grid</button></div>
  <div class="page">
    ${hLines.join("")}
    ${vLines.join("")}
    <div class="marker" style="top:0.55in; left:6.3in; width:1.8in; height:0.25in;"></div>
    <div class="marker" style="top:1.15in; left:1.0in; width:4in; height:0.25in;"></div>
    <div class="marker" style="top:1.15in; left:6.9in; width:1.4in; height:0.25in;"></div>
    <div class="marker" style="top:1.5in; left:0.6in; width:7in; height:0.25in;"></div>
  </div>
</body></html>`;
}
