import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { useBrand } from "../lib/useBrand";
import { notify, confirmDialog } from "../lib/notify";
import { getTodayLocalDate } from "../utils/dateUtils";
import { numberToWords, formatCheckAmount, validateCheckSequence } from "../utils/checkUtils";
import { buildCheckPrintHtml, buildCalibrationHtml } from "../utils/checkPrintTemplate";
import { createCheckJournalEntry } from "../utils/accountingJournals";

export default function PrintChecks() {
  const navigate = useNavigate();
  const { user, employee } = useAuth();
  const BRAND = useBrand();

  const [loading, setLoading] = useState(true);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [selectedAccount, setSelectedAccount] = useState(null);

  const [vendors, setVendors] = useState([]);
  const [unpaidBills, setUnpaidBills] = useState([]);
  const [expenseAccounts, setExpenseAccounts] = useState([]);
  const [recentChecks, setRecentChecks] = useState([]);

  const [payMode, setPayMode] = useState("manual"); // 'manual' | 'bills'
  const [selectedBillIds, setSelectedBillIds] = useState(new Set());

  const [checkForm, setCheckForm] = useState({
    check_number: "",
    check_date: getTodayLocalDate(),
    payee_name: "",
    amount: "",
    memo: "",
    category_account_id: "",
  });

  const [showCalibration, setShowCalibration] = useState(false);
  const [calForm, setCalForm] = useState({ offset_x: "0", offset_y: "0" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadBankAccounts();
  }, [user]);

  useEffect(() => {
    if (selectedAccountId) {
      const acct = bankAccounts.find((a) => a.id === selectedAccountId);
      setSelectedAccount(acct || null);
      if (acct) {
        setCheckForm((f) => ({
          ...f,
          check_number: acct.last_check_number_used ? String(acct.last_check_number_used + 1) : "",
        }));
        setCalForm({
          offset_x: String(acct.check_offset_x ?? 0),
          offset_y: String(acct.check_offset_y ?? 0),
        });
      }
      loadUnpaidBills();
      loadRecentChecks(selectedAccountId);
    }
  }, [selectedAccountId, bankAccounts]);

  async function loadBankAccounts() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("bank_accounts")
        .select("*")
        .eq("company_id", employee?.company_id)
        .eq("is_active", true)
        .order("account_name");
      if (error) throw error;
      setBankAccounts(data || []);
      if ((data || []).length === 1) setSelectedAccountId(data[0].id);

      const { data: vendorData } = await supabase
        .from("vendors")
        .select("id, vendor_name, address")
        .eq("company_id", employee?.company_id)
        .eq("archived", false)
        .order("vendor_name");
      setVendors(vendorData || []);

      const { data: expAccounts } = await supabase
        .from("accounts")
        .select("id, account_number, account_name")
        .eq("company_id", employee?.company_id)
        .eq("account_type", "Expense")
        .eq("is_active", true)
        .order("account_number");
      setExpenseAccounts(expAccounts || []);
    } catch (err) {
      console.error("Error loading bank accounts:", err);
      notify("Failed to load bank accounts: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadUnpaidBills() {
    try {
      const { data, error } = await supabase
        .from("bills")
        .select("*")
        .in("status", ["unpaid", "partial", "overdue"])
        .order("due_date", { ascending: true });
      if (error) throw error;
      setUnpaidBills(data || []);
    } catch (err) {
      console.error("Error loading unpaid bills:", err);
    }
  }

  async function loadRecentChecks(accountId) {
    try {
      const { data, error } = await supabase
        .from("checks")
        .select("*")
        .eq("bank_account_id", accountId)
        .order("check_number", { ascending: false })
        .limit(15);
      if (error) throw error;
      setRecentChecks(data || []);
    } catch (err) {
      console.error("Error loading recent checks:", err);
    }
  }

  function selectVendorAsPayee(vendorName) {
    setCheckForm((f) => ({ ...f, payee_name: vendorName }));
  }

  function toggleBillSelection(billId) {
    setSelectedBillIds((prev) => {
      const next = new Set(prev);
      if (next.has(billId)) next.delete(billId);
      else next.add(billId);
      return next;
    });
  }

  const billsForSelectedPayee = unpaidBills.filter(
    (b) => selectedBillIds.has(b.id)
  );
  const selectedBillsTotal = billsForSelectedPayee.reduce(
    (s, b) => s + (Number(b.amount_due ?? b.amount) || 0),
    0
  );

  function currentAmount() {
    return payMode === "bills" ? selectedBillsTotal : parseFloat(checkForm.amount) || 0;
  }

  function currentStubLines() {
    if (payMode === "bills") {
      return billsForSelectedPayee.map((b) => ({
        description: b.description || b.category || "Bill payment",
        reference: b.bill_number || "",
        amount: Number(b.amount_due ?? b.amount) || 0,
      }));
    }
    return [
      {
        description: checkForm.memo || "Payment",
        reference: "",
        amount: parseFloat(checkForm.amount) || 0,
      },
    ];
  }

  function resetForm() {
    setCheckForm({
      check_number: "",
      check_date: getTodayLocalDate(),
      payee_name: "",
      amount: "",
      memo: "",
      category_account_id: "",
    });
    setSelectedBillIds(new Set());
    setPayMode("manual");
  }

  async function handleWriteAndPrint() {
    if (!selectedAccount) {
      notify("Please select a bank account first");
      return;
    }
    if (!checkForm.payee_name.trim()) {
      notify("Please enter a payee name");
      return;
    }
    const amount = currentAmount();
    if (!amount || amount <= 0) {
      notify("Please enter a valid amount greater than zero");
      return;
    }
    if (payMode === "manual" && !checkForm.category_account_id) {
      notify("Please select an expense category for this check");
      return;
    }

    const seq = validateCheckSequence(checkForm.check_number, selectedAccount.last_check_number_used);
    if (!seq.ok) {
      notify(seq.warning);
      return;
    }
    if (seq.warning) {
      const proceed = await confirmDialog(seq.warning + " Continue anyway?");
      if (!proceed) return;
    }

    if (payMode === "bills" && billsForSelectedPayee.length === 0) {
      notify("Please select at least one bill to pay");
      return;
    }

    try {
      setSaving(true);
      const checkNumber = parseInt(checkForm.check_number, 10);
      const amountWords = numberToWords(amount);

      const { data: newCheck, error: checkError } = await supabase
        .from("checks")
        .insert({
          company_id: employee?.company_id,
          bank_account_id: selectedAccount.id,
          check_number: checkNumber,
          check_date: checkForm.check_date,
          payee_name: checkForm.payee_name.trim(),
          payee_type: payMode === "bills" ? "vendor" : "manual",
          amount,
          amount_words: amountWords,
          memo: checkForm.memo || null,
          category_account_id: payMode === "manual" ? checkForm.category_account_id : null,
          source_type: payMode === "bills" ? "bill" : "manual",
          status: "draft",
          created_by: user.id,
        })
        .select()
        .single();

      if (checkError) throw checkError;

      const stubLines = currentStubLines().map((l, i) => ({
        check_id: newCheck.id,
        bill_id: payMode === "bills" ? billsForSelectedPayee[i]?.id || null : null,
        description: l.description,
        reference: l.reference,
        amount: l.amount,
        line_number: i + 1,
      }));

      const { error: stubError } = await supabase.from("check_stub_lines").insert(stubLines);
      if (stubError) throw stubError;

      const html = buildCheckPrintHtml(
        { ...newCheck },
        currentStubLines(),
        { x: selectedAccount.check_offset_x, y: selectedAccount.check_offset_y },
        BRAND
      );
      const w = window.open("", "_blank", "width=900,height=700");
      w.document.write(html);
      w.document.close();
      w.focus();

      const printedOk = await confirmDialog(
        `Check #${checkNumber} sent to print. Did it print correctly on the check stock?`
      );

      if (!printedOk) {
        notify("Check saved as draft. Adjust calibration and reprint from Recent Checks.");
        loadRecentChecks(selectedAccount.id);
        resetForm();
        setSaving(false);
        return;
      }

      const nowIso = new Date().toISOString();
      await supabase
        .from("checks")
        .update({ status: "printed", printed_at: nowIso })
        .eq("id", newCheck.id);

      await supabase
        .from("bank_accounts")
        .update({ last_check_number_used: checkNumber })
        .eq("id", selectedAccount.id);

      const { data: bankTx } = await supabase
        .from("bank_transactions")
        .insert({
          bank_account_id: selectedAccount.id,
          transaction_date: checkForm.check_date,
          description: `Check #${checkNumber} - ${checkForm.payee_name.trim()}`,
          reference_number: String(checkNumber),
          amount: -Math.abs(amount),
          transaction_type: "withdrawal",
          payee: checkForm.payee_name.trim(),
          notes: checkForm.memo || null,
          created_by: user.id,
        })
        .select()
        .single();

      if (bankTx) {
        await supabase.from("checks").update({ bank_transaction_id: bankTx.id }).eq("id", newCheck.id);
      }

      const journalResult = await createCheckJournalEntry(
        { ...newCheck, check_number: checkNumber },
        selectedAccount,
        user.id,
        user.id
      );
      if (journalResult.success) {
        await supabase.from("checks").update({ journal_entry_id: journalResult.entryId }).eq("id", newCheck.id);
      }

      if (payMode === "bills") {
        for (const bill of billsForSelectedPayee) {
          await supabase
            .from("bills")
            .update({ status: "paid", amount_paid: bill.total_amount ?? bill.amount, paid_date: checkForm.check_date })
            .eq("id", bill.id);
        }
      }

      notify(
        journalResult.success
          ? `Check #${checkNumber} printed and recorded! Journal entry created automatically.`
          : `Check #${checkNumber} printed and recorded, but journal entry failed: ${journalResult.error}`
      );

      resetForm();
      loadBankAccounts();
      loadUnpaidBills();
      loadRecentChecks(selectedAccount.id);
    } catch (err) {
      console.error("Error writing check:", err);
      notify("Failed to write check: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleVoidCheck(check) {
    const ok = await confirmDialog(`Void check #${check.check_number} to ${check.payee_name}? This cannot be undone.`);
    if (!ok) return;
    try {
      await supabase
        .from("checks")
        .update({ status: "voided", voided_at: new Date().toISOString(), void_reason: "Voided by user" })
        .eq("id", check.id);
      notify(`Check #${check.check_number} voided.`);
      loadRecentChecks(selectedAccount.id);
    } catch (err) {
      notify("Failed to void check: " + err.message);
    }
  }

  function handlePrintCalibration() {
    const html = buildCalibrationHtml();
    const w = window.open("", "_blank", "width=900,height=700");
    w.document.write(html);
    w.document.close();
    w.focus();
  }

  async function handleSaveCalibration() {
    if (!selectedAccount) return;
    try {
      const ox = parseFloat(calForm.offset_x) || 0;
      const oy = parseFloat(calForm.offset_y) || 0;
      await supabase
        .from("bank_accounts")
        .update({ check_offset_x: ox, check_offset_y: oy })
        .eq("id", selectedAccount.id);
      notify("Calibration saved for this bank account.");
      setShowCalibration(false);
      loadBankAccounts();
    } catch (err) {
      notify("Failed to save calibration: " + err.message);
    }
  }

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading...</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <button onClick={() => navigate("/accounting")} style={styles.backButton}>
            ← Back to Accounting
          </button>
          <h1 style={styles.title}>🖨️ Print Checks</h1>
          <p style={styles.subtitle}>Write and print checks on your pre-printed voucher stock</p>
        </div>
      </div>

      {bankAccounts.length === 0 ? (
        <div style={styles.emptyState}>
          <p>No bank accounts found. Add one in Bank Accounts first, and make sure it's linked to a Chart of Accounts cash account.</p>
          <button onClick={() => navigate("/accounting/bank-accounts")} style={styles.newButton}>
            Go to Bank Accounts
          </button>
        </div>
      ) : (
        <>
          <div style={styles.card}>
            <label style={styles.label}>Bank Account</label>
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              style={styles.select}
            >
              <option value="">-- Select bank account --</option>
              {bankAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.account_name} {a.bank_name ? `(${a.bank_name})` : ""}
                </option>
              ))}
            </select>
            {selectedAccount && !selectedAccount.chart_account_id && (
              <p style={styles.warningText}>
                ⚠️ This account isn't linked to a Chart of Accounts cash account — the automatic journal entry will fail until you link one in Bank Accounts.
              </p>
            )}
            {selectedAccount && (
              <button onClick={() => setShowCalibration((v) => !v)} style={styles.calButton}>
                {showCalibration ? "Hide" : "⚙️ Printer Calibration"}
              </button>
            )}
          </div>

          {showCalibration && selectedAccount && (
            <div style={styles.card}>
              <h3 style={styles.cardTitle}>Printer Calibration — {selectedAccount.account_name}</h3>
              <p style={styles.helpText}>
                1. Print the alignment grid on plain paper. 2. Hold it up to a real check from this stock against a bright window/light.
                3. Measure how far off the red boxes are from the actual printed fields (in inches). 4. Enter the offsets below and save.
              </p>
              <button onClick={handlePrintCalibration} style={styles.secondaryButton}>
                🖨️ Print Alignment Grid
              </button>
              <div style={styles.row}>
                <div style={styles.field}>
                  <label style={styles.label}>Horizontal offset (inches, + = right)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={calForm.offset_x}
                    onChange={(e) => setCalForm((f) => ({ ...f, offset_x: e.target.value }))}
                    style={styles.input}
                  />
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>Vertical offset (inches, + = down)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={calForm.offset_y}
                    onChange={(e) => setCalForm((f) => ({ ...f, offset_y: e.target.value }))}
                    style={styles.input}
                  />
                </div>
              </div>
              <button onClick={handleSaveCalibration} style={styles.newButton}>
                Save Calibration
              </button>
            </div>
          )}

          {selectedAccount && (
            <div style={styles.card}>
              <h3 style={styles.cardTitle}>Write a Check</h3>

              <div style={styles.tabRow}>
                <button
                  onClick={() => setPayMode("manual")}
                  style={payMode === "manual" ? styles.tabActive : styles.tab}
                >
                  Manual Check
                </button>
                <button
                  onClick={() => setPayMode("bills")}
                  style={payMode === "bills" ? styles.tabActive : styles.tab}
                >
                  Pay Unpaid Bills
                </button>
              </div>

              <div style={styles.row}>
                <div style={styles.field}>
                  <label style={styles.label}>Check Number</label>
                  <input
                    type="number"
                    value={checkForm.check_number}
                    onChange={(e) => setCheckForm((f) => ({ ...f, check_number: e.target.value }))}
                    style={styles.input}
                    placeholder={selectedAccount.last_check_number_used ? String(selectedAccount.last_check_number_used + 1) : "1001"}
                  />
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>Date</label>
                  <input
                    type="date"
                    value={checkForm.check_date}
                    onChange={(e) => setCheckForm((f) => ({ ...f, check_date: e.target.value }))}
                    style={styles.input}
                  />
                </div>
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Payee</label>
                <input
                  type="text"
                  value={checkForm.payee_name}
                  onChange={(e) => setCheckForm((f) => ({ ...f, payee_name: e.target.value }))}
                  style={styles.input}
                  placeholder="Vendor or person name"
                  list="vendor-list"
                />
                <datalist id="vendor-list">
                  {vendors.map((v) => (
                    <option key={v.id} value={v.vendor_name} />
                  ))}
                </datalist>
              </div>

              {payMode === "manual" ? (
                <>
                  <div style={styles.row}>
                    <div style={styles.field}>
                      <label style={styles.label}>Amount</label>
                      <input
                        type="number"
                        step="0.01"
                        value={checkForm.amount}
                        onChange={(e) => setCheckForm((f) => ({ ...f, amount: e.target.value }))}
                        style={styles.input}
                        placeholder="0.00"
                      />
                    </div>
                    <div style={styles.field}>
                      <label style={styles.label}>Expense Category</label>
                      <select
                        value={checkForm.category_account_id}
                        onChange={(e) => setCheckForm((f) => ({ ...f, category_account_id: e.target.value }))}
                        style={styles.select}
                      >
                        <option value="">-- Select category --</option>
                        {expenseAccounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.account_number ? `${a.account_number} - ` : ""}{a.account_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div style={styles.field}>
                    <label style={styles.label}>Memo</label>
                    <input
                      type="text"
                      value={checkForm.memo}
                      onChange={(e) => setCheckForm((f) => ({ ...f, memo: e.target.value }))}
                      style={styles.input}
                      placeholder="Optional memo line"
                    />
                  </div>
                </>
              ) : (
                <div style={styles.billsList}>
                  {unpaidBills.length === 0 ? (
                    <p style={styles.helpText}>No unpaid bills found.</p>
                  ) : (
                    unpaidBills.map((b) => (
                      <label key={b.id} style={styles.billRow}>
                        <input
                          type="checkbox"
                          checked={selectedBillIds.has(b.id)}
                          onChange={() => {
                            toggleBillSelection(b.id);
                            if (!checkForm.payee_name) selectVendorAsPayee(b.vendor_name);
                          }}
                        />
                        <span style={styles.billVendor}>{b.vendor_name}</span>
                        <span style={styles.billNum}>{b.bill_number || ""}</span>
                        <span style={styles.billAmt}>${formatCheckAmount(b.amount_due ?? b.amount)}</span>
                      </label>
                    ))
                  )}
                </div>
              )}

              <div style={styles.amountPreview}>
                <strong>Amount:</strong> ${formatCheckAmount(currentAmount())}
                {currentAmount() > 0 && (
                  <div style={styles.amountWords}>{numberToWords(currentAmount())}</div>
                )}
              </div>

              <button onClick={handleWriteAndPrint} disabled={saving} style={styles.newButton}>
                {saving ? "Working..." : "🖨️ Write & Print Check"}
              </button>
            </div>
          )}

          {selectedAccount && (
            <div style={styles.card}>
              <h3 style={styles.cardTitle}>Recent Checks — {selectedAccount.account_name}</h3>
              {recentChecks.length === 0 ? (
                <p style={styles.helpText}>No checks printed yet from this account.</p>
              ) : (
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>#</th>
                      <th style={styles.th}>Date</th>
                      <th style={styles.th}>Payee</th>
                      <th style={styles.th}>Amount</th>
                      <th style={styles.th}>Status</th>
                      <th style={styles.th}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentChecks.map((c) => (
                      <tr key={c.id}>
                        <td style={styles.td}>{c.check_number}</td>
                        <td style={styles.td}>{c.check_date}</td>
                        <td style={styles.td}>{c.payee_name}</td>
                        <td style={styles.td}>${formatCheckAmount(c.amount)}</td>
                        <td style={styles.td}>
                          {c.status === "printed" && <span style={styles.paidBadge}>✓ Printed</span>}
                          {c.status === "draft" && <span style={styles.unpaidBadge}>○ Draft</span>}
                          {c.status === "voided" && <span style={styles.overdueBadge}>✕ Voided</span>}
                        </td>
                        <td style={styles.td}>
                          {c.status !== "voided" && (
                            <button onClick={() => handleVoidCheck(c)} style={styles.voidButton}>
                              Void
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const styles = {
  container: { maxWidth: 900, margin: "0 auto", paddingBottom: 60 },
  header: { marginBottom: 20 },
  backButton: {
    background: "none", border: "none", color: "#0b3ea8", fontSize: 14,
    cursor: "pointer", padding: 0, marginBottom: 8, fontWeight: 600,
  },
  title: { fontSize: 26, fontWeight: 800, margin: "4px 0", color: "#111" },
  subtitle: { fontSize: 14, color: "#666", margin: 0 },
  loading: { padding: 40, textAlign: "center", color: "#666" },
  emptyState: {
    background: "#fff", borderRadius: 12, padding: 32, textAlign: "center",
    boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
  },
  card: {
    background: "#fff", borderRadius: 12, padding: 20, marginBottom: 20,
    boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
  },
  cardTitle: { fontSize: 18, fontWeight: 700, marginTop: 0, marginBottom: 12, color: "#111" },
  label: { display: "block", fontSize: 13, fontWeight: 600, color: "#444", marginBottom: 4 },
  select: {
    width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db",
    fontSize: 14, marginBottom: 8,
  },
  input: {
    width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db",
    fontSize: 14, marginBottom: 8, boxSizing: "border-box",
  },
  row: { display: "flex", gap: 16 },
  field: { flex: 1 },
  warningText: { color: "#b45309", fontSize: 13, fontWeight: 600 },
  helpText: { color: "#666", fontSize: 13, lineHeight: 1.5 },
  calButton: {
    padding: "8px 16px", background: "#f3f4f6", border: "1px solid #d1d5db",
    borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#333",
  },
  secondaryButton: {
    padding: "10px 18px", background: "#e5e7eb", border: "none", borderRadius: 8,
    fontSize: 14, fontWeight: 700, cursor: "pointer", color: "#333", marginBottom: 12,
  },
  newButton: {
    padding: "12px 24px", background: "#0b3ea8", color: "#fff", border: "none",
    borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: "pointer",
  },
  tabRow: { display: "flex", gap: 8, marginBottom: 16 },
  tab: {
    padding: "8px 18px", background: "#f3f4f6", border: "1px solid #d1d5db",
    borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#666",
  },
  tabActive: {
    padding: "8px 18px", background: "#0b3ea8", border: "1px solid #0b3ea8",
    borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#fff",
  },
  billsList: { maxHeight: 260, overflowY: "auto", marginBottom: 12 },
  billRow: {
    display: "flex", alignItems: "center", gap: 12, padding: "8px 4px",
    borderBottom: "1px solid #f0f0f0", fontSize: 14, cursor: "pointer",
  },
  billVendor: { flex: 2, fontWeight: 600 },
  billNum: { flex: 1, color: "#666", fontSize: 13 },
  billAmt: { flex: "0 0 90px", textAlign: "right", fontWeight: 700 },
  amountPreview: {
    background: "#f0f9ff", borderRadius: 8, padding: "12px 16px", marginBottom: 16, fontSize: 15,
  },
  amountWords: { marginTop: 4, fontStyle: "italic", color: "#333", fontSize: 13 },
  table: { width: "100%", borderCollapse: "collapse" },
  th: {
    textAlign: "left", padding: "8px 10px", fontSize: 12, fontWeight: 700,
    color: "#666", borderBottom: "2px solid #e5e7eb",
  },
  td: { padding: "8px 10px", fontSize: 14, borderBottom: "1px solid #f0f0f0" },
  paidBadge: { color: "#059669", fontWeight: 700, fontSize: 13 },
  unpaidBadge: { color: "#6b7280", fontWeight: 700, fontSize: 13 },
  overdueBadge: { color: "#dc2626", fontWeight: 700, fontSize: 13 },
  voidButton: {
    padding: "4px 10px", background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca",
    borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer",
  },
};

