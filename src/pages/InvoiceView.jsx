import React, { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";

// Logo served from /public so it's always available at a stable URL in production
const logoImage = "/LOGOD.jpg";

const ACCENT = "#fc6b04";
const GREEN  = "#16a34a";

// ─── Clover public (publishable) key ────────────────────────────────────────
// Set VITE_CLOVER_PUBLIC_KEY in your .env file
// e.g.  VITE_CLOVER_PUBLIC_KEY=pk_live_xxxxxxxxxxxxx
const CLOVER_PUBLIC_KEY = import.meta.env.VITE_CLOVER_PUBLIC_KEY || "";

export default function InvoiceView() {
  const [searchParams] = useSearchParams();
  const invoiceId = searchParams.get("invoiceId");

  const [invoice, setInvoice] = useState(null);
  const [items,   setItems]   = useState([]);
  const [loading, setLoading] = useState(true);

  // ── Payment UI state ─────────────────────────────────────────────────────
  const [showPayForm, setShowPayForm]   = useState(false);
  const [sdkReady,    setSdkReady]      = useState(false);
  const [cloverObj,   setCloverObj]     = useState(null); // { instance, card }
  const [paying,      setPaying]        = useState(false);
  const [paySuccess,  setPaySuccess]    = useState(false);
  const [payError,    setPayError]      = useState("");
  const cardMountRef = useRef(null);

  useEffect(() => { if (invoiceId) loadInvoice(); }, [invoiceId]);

  async function loadInvoice() {
    try {
      const { data, error } = await supabase
        .from("invoices").select("*").eq("id", invoiceId).single();
      if (error) throw error;
      setInvoice(data);

      const { data: itemsData } = await supabase
        .from("invoice_items").select("*").eq("invoice_id", invoiceId).order("created_at");
      setItems(itemsData || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // ── Step 1: load Clover SDK script when the form becomes visible ─────────
  useEffect(() => {
    if (!showPayForm) return;

    // Already loaded
    if (window.Clover) {
      setSdkReady(true);
      return;
    }

    const existing = document.getElementById("clover-sdk");
    if (existing) return; // script tag already in DOM, wait for onload

    const script = document.createElement("script");
    script.id    = "clover-sdk";
    script.src   = "https://checkout.clover.com/sdk.js";
    script.async = true;
    script.onload  = () => setSdkReady(true);
    script.onerror = () => setPayError("Failed to load Clover checkout SDK. Please refresh and try again.");
    document.head.appendChild(script);
  }, [showPayForm]);

  // ── Step 2: once SDK is ready AND the card div is in DOM, mount the element
  useEffect(() => {
    if (!sdkReady || !showPayForm) return;
    if (!CLOVER_PUBLIC_KEY) {
      setPayError("Clover public key is not configured. Contact support.");
      return;
    }

    // Small tick to ensure React has rendered cardMountRef
    const tid = setTimeout(() => {
      if (!cardMountRef.current) return;
      try {
        const cloverInstance = new window.Clover(CLOVER_PUBLIC_KEY);
        const elements       = cloverInstance.elements();
        const cardElement    = elements.create("CARD", {
          styles: {
            body: {
              fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
              fontSize: "15px",
              color: "#111",
            },
          },
        });
        cardElement.mount("#clover-card-element");
        setCloverObj({ instance: cloverInstance, card: cardElement });
      } catch (e) {
        console.error("Clover SDK init error:", e);
        setPayError("Could not initialize payment form. Please refresh and try again.");
      }
    }, 80);

    return () => clearTimeout(tid);
  }, [sdkReady, showPayForm]);

  // ── Pay handler ──────────────────────────────────────────────────────────
  async function handlePay() {
    if (!cloverObj) return;
    setPaying(true);
    setPayError("");

    try {
      // Tokenize card data (stays on Clover's servers — PCI safe)
      const result = await cloverObj.instance.createToken();

      if (result.errors) {
        const msgs = Object.values(result.errors).filter(Boolean).join(". ");
        throw new Error(msgs || "Card validation failed. Please check your details.");
      }
      if (!result.token) throw new Error("No card token returned. Please try again.");

      // Call our backend to charge
      const { data, error } = await supabase.functions.invoke("create-clover-charge", {
        body: { invoiceId, token: result.token },
      });

      if (error) {
        let msg = error.message;
        try { const b = await error.context?.json(); if (b?.error) msg = b.error; } catch (_) {}
        throw new Error(msg);
      }
      if (data?.error) throw new Error(data.error);

      // Success — update local state so page reflects paid status immediately
      setPaySuccess(true);
      setInvoice(prev => ({ ...prev, status: "paid", balance_due: 0 }));
      setShowPayForm(false);
    } catch (err) {
      console.error("Clover pay error:", err);
      setPayError(err.message || "Payment failed. Please try again or contact us.");
    } finally {
      setPaying(false);
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  const fmtDate = (d) => {
    if (!d) return "";
    const dt = new Date(d);
    return `${String(dt.getMonth()+1).padStart(2,"0")}/${String(dt.getDate()).padStart(2,"0")}/${dt.getFullYear()}`;
  };

  const fmtMoney = (n) => "$" + Number(n||0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  if (loading) return (
    <div style={pg}><p style={{textAlign:"center",padding:"60px",color:"#666",fontSize:16}}>Loading invoice...</p></div>
  );
  if (!invoice) return (
    <div style={pg}><p style={{textAlign:"center",padding:"60px",color:"#ef4444",fontSize:16}}>Invoice not found</p></div>
  );

  // Compute totals
  const itemTotal = (item) => (item.total || 0) * (1 + (item.markup_percentage || 0) / 100);
  const subtotal  = items.length > 0
    ? items.reduce((s, i) => s + itemTotal(i), 0)
    : (invoice.subtotal || invoice.total || 0);

  const depositReceived = invoice.deposit_received || 0;
  const amountPaid      = invoice.amount_paid || 0;
  const dbBalanceDue    = invoice.balance_due ?? null;
  const calcBalanceDue  = subtotal - depositReceived - amountPaid;
  const balanceDue      = dbBalanceDue !== null ? Number(dbBalanceDue) : calcBalanceDue;
  const payableAmount   = balanceDue > 0 ? balanceDue : calcBalanceDue;

  const isPaid    = invoice?.status === "paid" || paySuccess;
  const isPending = invoice?.status === "payment_pending";

  return (
    <div style={pg} data-invoice-page>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; padding: 0; background: #fff !important; }
          /* page wrapper: remove grey bg, padding, centering */
          body > #root > * { background: #fff !important; padding: 0 !important; }
          /* invoice card: stretch to full page width */
          [data-invoice-card] {
            max-width: 100% !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 24px 32px !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            background: #fff !important;
          }
          /* outer page wrapper */
          [data-invoice-page] {
            background: #fff !important;
            padding: 0 !important;
            min-height: unset !important;
          }
        }
        #clover-card-element iframe { border-radius: 8px; }
      `}</style>
      <div style={card} data-invoice-card>

        {/* Header: Date (left) | Logo (center) | Invoice # (right) */}
        <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16}}>

          {/* Left — Date / Due */}
          <div style={{minWidth:110}}>
            <p style={{fontSize:12, color:"#888", margin:0}}>Date</p>
            <p style={{fontSize:14, fontWeight:600, color:"#111", margin:0}}>{fmtDate(invoice.invoice_date)}</p>
            {invoice.due_date && (
              <>
                <p style={{fontSize:12, color:"#888", margin:"6px 0 0"}}>Due</p>
                <p style={{fontSize:14, fontWeight:600, color:"#111", margin:0}}>{fmtDate(invoice.due_date)}</p>
              </>
            )}
          </div>

          {/* Center — Logo */}
          <div style={{textAlign:"center", flex:1, padding:"0 12px"}}>
            <img src={logoImage} alt="DML Electrical" style={{maxWidth:200, width:"100%", height:"auto"}} />
            <p style={{fontSize:11, color:"#888", margin:"4px 0 0"}}>
              (337)288-0395 · info@dmlelectrical.com · Lic# 63147
            </p>
          </div>

          {/* Right — Invoice # */}
          <div style={{textAlign:"right", minWidth:110}}>
            <p style={{fontSize:12, color:"#888", margin:0}}>Invoice #</p>
            <p style={{fontSize:18, fontWeight:"bold", color:"#111", margin:0}}>{invoice.invoice_number}</p>
          </div>

        </div>

        <div style={{borderTop:`3px solid ${ACCENT}`, margin:"12px 0"}} />

        {/* Bill To */}
        <div style={{marginBottom:16}}>
          <p style={{fontSize:12, color:"#888", margin:"0 0 2px"}}>Bill To:</p>
          <p style={{fontSize:16, fontWeight:"bold", color:"#111", margin:0}}>{invoice.customer_name}</p>
          {invoice.project_name && (
            <>
              <p style={{fontSize:12, color:"#888", margin:"8px 0 2px"}}>Project:</p>
              <p style={{fontSize:14, fontWeight:600, color:"#111", margin:0}}>{invoice.project_name}</p>
            </>
          )}
        </div>

        {/* Line Items Header */}
        <div style={{
          display:"flex", justifyContent:"space-between",
          padding:"6px 0", borderBottom:`2px solid ${ACCENT}`,
          marginBottom:4
        }}>
          <span style={{fontSize:11, fontWeight:"bold", color:"#888", textTransform:"uppercase"}}>Description</span>
          <span style={{fontSize:11, fontWeight:"bold", color:"#888", textTransform:"uppercase"}}>Amount</span>
        </div>

        {/* Line Items */}
        {items.map((item, i) => (
          <div key={item.id} style={{
            display:"flex", justifyContent:"space-between", alignItems:"flex-start",
            padding:"10px 0",
            borderBottom:"1px solid #f0f0f0",
            backgroundColor: i % 2 === 0 ? "#fff" : "#fafafa"
          }}>
            <span style={{fontSize:14, color:"#222", flex:1, paddingRight:12, lineHeight:"1.4", wordBreak:"break-word"}}>
              {item.description}
            </span>
            <span style={{fontSize:14, fontWeight:"bold", color:"#111", whiteSpace:"nowrap", flexShrink:0}}>
              {fmtMoney(itemTotal(item))}
            </span>
          </div>
        ))}

        {/* Subtotal / Deposits / Balance */}
        <div style={{marginTop:16, paddingTop:12, borderTop:"2px solid #e5e7eb"}}>
          <div style={{display:"flex", justifyContent:"space-between", padding:"5px 0"}}>
            <span style={{fontSize:14, color:"#666"}}>Subtotal</span>
            <span style={{fontSize:14, fontWeight:600, color:"#111"}}>{fmtMoney(subtotal)}</span>
          </div>
          {depositReceived > 0 && (
            <div style={{display:"flex", justifyContent:"space-between", padding:"5px 0"}}>
              <span style={{fontSize:14, color:"#666"}}>Deposit Received</span>
              <span style={{fontSize:14, fontWeight:600, color:"#10b981"}}>-{fmtMoney(depositReceived)}</span>
            </div>
          )}
          {amountPaid > 0 && (
            <div style={{display:"flex", justifyContent:"space-between", padding:"5px 0"}}>
              <span style={{fontSize:14, color:"#666"}}>Amount Paid</span>
              <span style={{fontSize:14, fontWeight:600, color:"#10b981"}}>-{fmtMoney(amountPaid)}</span>
            </div>
          )}
        </div>

        {/* Balance Due */}
        <div style={{
          display:"flex", justifyContent:"space-between", alignItems:"center",
          marginTop:12, padding:"14px 0",
          borderTop:`3px solid ${ACCENT}`
        }}>
          <span style={{fontSize:16, fontWeight:"bold", color:"#111"}}>Balance Due</span>
          <span style={{fontSize:22, fontWeight:"bold", color: balanceDue > 0 ? ACCENT : GREEN}}>
            {fmtMoney(balanceDue)}
          </span>
        </div>

        {/* ── CLOVER PAYMENT SECTION ─────────────────────────────────────── */}
        {payableAmount > 0 && !isPaid && !isPending && (
          <div className="no-print" style={{marginTop:16, marginBottom:8}}>

            {/* Pay by Card button (collapses into form) */}
            {!showPayForm && (
              <>
                <button
                  onClick={() => { setShowPayForm(true); setPayError(""); }}
                  style={{
                    width:"100%",
                    padding:"16px",
                    background: ACCENT,
                    color:"#fff",
                    border:"none",
                    borderRadius:10,
                    fontSize:17,
                    fontWeight:"bold",
                    cursor:"pointer",
                    boxShadow:"0 2px 8px rgba(252,107,4,0.3)",
                  }}
                >
                  💳 Pay {fmtMoney(payableAmount)} by Card
                </button>
                <p style={{fontSize:11, color:"#9ca3af", textAlign:"center", margin:"8px 0 0"}}>
                  🔒 Secure payment powered by Clover
                </p>
                <p style={{fontSize:11, color:"#9ca3af", textAlign:"center", margin:"4px 0 0"}}>
                  Or mail a check to: P.O. Box 363, Jennings, LA 70546
                </p>
              </>
            )}

            {/* Inline Clover payment form */}
            {showPayForm && (
              <div style={{
                background:"#f9fafb",
                border:"1px solid #e5e7eb",
                borderRadius:12,
                padding:"20px 16px",
              }}>
                <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14}}>
                  <p style={{fontSize:15, fontWeight:"bold", color:"#111", margin:0}}>
                    Enter Card Details
                  </p>
                  <button
                    onClick={() => { setShowPayForm(false); setPayError(""); }}
                    style={{background:"none", border:"none", fontSize:18, cursor:"pointer", color:"#9ca3af"}}
                  >
                    ✕
                  </button>
                </div>

                {/* Amount chip */}
                <div style={{
                  background:"#fff7ed", border:`1px solid ${ACCENT}`, borderRadius:8,
                  padding:"8px 12px", marginBottom:14, textAlign:"center"
                }}>
                  <span style={{fontSize:14, color:"#555"}}>Charging: </span>
                  <span style={{fontSize:16, fontWeight:"bold", color: ACCENT}}>{fmtMoney(payableAmount)}</span>
                </div>

                {/* Clover iframe card element mounts here */}
                {!sdkReady && (
                  <p style={{fontSize:13, color:"#666", textAlign:"center", padding:"20px 0"}}>
                    ⏳ Loading secure card form…
                  </p>
                )}
                <div
                  id="clover-card-element"
                  ref={cardMountRef}
                  style={{
                    minHeight: sdkReady ? 56 : 0,
                    marginBottom: sdkReady ? 14 : 0,
                    borderRadius: 8,
                    overflow: "hidden",
                  }}
                />

                {/* Error */}
                {payError && (
                  <p style={{fontSize:13, color:"#ef4444", textAlign:"center", margin:"0 0 12px", fontWeight:600}}>
                    ⚠️ {payError}
                  </p>
                )}

                {/* Pay button */}
                <button
                  onClick={handlePay}
                  disabled={paying || !cloverObj}
                  style={{
                    width:"100%",
                    padding:"14px",
                    background: (paying || !cloverObj) ? "#9ca3af" : GREEN,
                    color:"#fff",
                    border:"none",
                    borderRadius:10,
                    fontSize:16,
                    fontWeight:"bold",
                    cursor: (paying || !cloverObj) ? "not-allowed" : "pointer",
                    boxShadow: cloverObj ? "0 2px 8px rgba(22,163,74,0.25)" : "none",
                  }}
                >
                  {paying ? "⏳ Processing…" : `✅ Pay ${fmtMoney(payableAmount)}`}
                </button>

                <p style={{fontSize:11, color:"#9ca3af", textAlign:"center", margin:"10px 0 0"}}>
                  🔒 Card info is encrypted and processed securely by Clover
                </p>
              </div>
            )}
          </div>
        )}

        {/* Paid badge */}
        {(isPaid) && (
          <div style={{
            background:"#dcfce7", border:"1px solid #86efac", borderRadius:10,
            padding:"12px 16px", marginTop:12, textAlign:"center"
          }}>
            <span style={{fontSize:15, fontWeight:"bold", color:GREEN}}>✅ Paid in Full — Thank you!</span>
          </div>
        )}

        {/* Payment pending badge */}
        {isPending && !isPaid && (
          <div style={{
            background:"#fef9c3", border:"1px solid #fde68a", borderRadius:10,
            padding:"12px 16px", marginTop:12, textAlign:"center"
          }}>
            <span style={{fontSize:15, fontWeight:"bold", color:"#92400e"}}>
              ⏳ Payment Processing — thank you!
            </span>
          </div>
        )}

        {/* Notes */}
        {invoice.notes && (
          <div style={{
            background:"#f9fafb", borderRadius:8, padding:12,
            marginTop:12, marginBottom:12
          }}>
            <p style={{fontSize:12, fontWeight:"bold", color:"#111", margin:"0 0 4px"}}>Notes:</p>
            <p style={{fontSize:13, color:"#555", margin:0, whiteSpace:"pre-wrap", lineHeight:1.5}}>
              {invoice.notes}
            </p>
          </div>
        )}

        {/* Footer */}
        <div style={{textAlign:"center", borderTop:"1px solid #eee", paddingTop:12, marginTop:12}}>
          <p style={{fontSize:12, color:"#bbb", margin:"2px 0"}}>Thank you for your business!</p>
          <p style={{fontSize:12, color:"#bbb", margin:"2px 0"}}>Please make payment within 30 days.</p>
          <p style={{fontSize:12, fontWeight:600, color:"#555", margin:"8px 0 2px"}}>
            Remit To: P.O. Box 363, Jennings, LA 70546
          </p>
        </div>

      </div>
    </div>
  );
}

const pg = {
  minHeight:"100vh",
  background:"#f3f4f6",
  padding:"12px",
  fontFamily:"-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

const card = {
  maxWidth:620,
  margin:"0 auto",
  background:"#fff",
  borderRadius:10,
  padding:"20px 16px",
  boxShadow:"0 2px 10px rgba(0,0,0,0.1)",
};
