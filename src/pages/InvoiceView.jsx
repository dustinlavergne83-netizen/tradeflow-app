import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { getSiteUrl } from "../lib/siteUrl";
import logoImage from "../assets/LOGOD.jpg";

const ACCENT = "#fc6b04";
const GREEN = "#16a34a";

export default function InvoiceView() {
  const [searchParams] = useSearchParams();
  const invoiceId = searchParams.get("invoiceId");
  const autoPrint = searchParams.get("print") === "1";

  const [invoice, setInvoice] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [payLoading, setPayLoading] = useState(false);
  const [payError, setPayError] = useState("");
  const [paymentMethod, setPaymentMethod] = useState(null); // null | 'card' | 'ach'

  useEffect(() => {
    if (invoiceId) loadInvoice();
  }, [invoiceId]);

  // Auto-trigger print dialog if ?print=1 is in URL
  useEffect(() => {
    if (autoPrint && !loading && invoice) {
      setTimeout(() => window.print(), 600);
    }
  }, [autoPrint, loading, invoice]);

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

  async function handlePayNow() {
    if (!invoiceId || !paymentMethod) return;
    setPayLoading(true);
    setPayError("");
    const ccFee = paymentMethod === 'card'
      ? Math.round(payableAmount * 0.03 * 100) / 100
      : 0;
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout-session", {
        body: {
          invoiceId,
          siteUrl: window.location.origin,
          ccFee,
          paymentType: paymentMethod,
        },
      });

      // Extract real error from function response body if it's a non-2xx error
      if (error) {
        let realMsg = error.message;
        try {
          const errBody = await error.context?.json();
          if (errBody?.error) realMsg = errBody.error;
        } catch (_) {}
        throw new Error(realMsg);
      }

      if (data?.error) throw new Error(data.error);
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No checkout URL returned from server");
      }
    } catch (err) {
      console.error("Pay now error:", err);
      setPayError(err.message || "Unable to start checkout. Please try again.");
      setPayLoading(false);
    }
  }

  const fmtDate = (d) => {
    if (!d) return "";
    const dt = new Date(d);
    return `${String(dt.getMonth()+1).padStart(2,"0")}/${String(dt.getDate()).padStart(2,"0")}/${dt.getFullYear()}`;
  };

  const fmtMoney = (n) => "$" + Number(n||0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,",");

  if (loading) return (
    <div style={pg}><p style={{textAlign:"center",padding:"60px",color:"#666",fontSize:16}}>Loading invoice...</p></div>
  );
  if (!invoice) return (
    <div style={pg}><p style={{textAlign:"center",padding:"60px",color:"#ef4444",fontSize:16}}>Invoice not found</p></div>
  );

  // Compute item total (with markup)
  const itemTotal = (item) => {
    const mp = item.markup_percentage || 0;
    return (item.total || 0) * (1 + mp / 100);
  };

  const subtotal = items.length > 0
    ? items.reduce((s, i) => s + itemTotal(i), 0)
    : (invoice.subtotal || invoice.total || 0);

  const depositReceived = invoice.deposit_received || 0;
  const amountPaid = invoice.amount_paid || 0;

  // Use the stored balance_due from the DB as source of truth.
  // Fall back to calculated subtotal if DB value isn't stored.
  const dbBalanceDue = invoice.balance_due ?? null;
  const calcBalanceDue = subtotal - depositReceived - amountPaid;
  const balanceDue = dbBalanceDue !== null ? Number(dbBalanceDue) : calcBalanceDue;

  // The amount the customer owes right now — used for Pay Now button
  const payableAmount = balanceDue > 0 ? balanceDue : calcBalanceDue;

  return (
    <div style={pg}>

      {/* Print CSS - hides UI chrome when printing */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; margin: 0; padding: 0; }
          .print-page {
            box-shadow: none !important;
            border-radius: 0 !important;
            margin: 0 !important;
            max-width: 100% !important;
            padding: 16px !important;
          }
          .print-wrapper {
            background: white !important;
            padding: 0 !important;
            min-height: auto !important;
          }
        }
      `}</style>

      {/* Print / Download PDF button - hidden when printing */}
      <div className="no-print" style={{
        maxWidth: 620,
        margin: "0 auto 10px",
        display: "flex",
        gap: 10,
        justifyContent: "flex-end",
        padding: "0 4px",
      }}>
        <button
          onClick={() => window.print()}
          style={{
            padding: "10px 22px",
            background: "#0b3ea8",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            fontSize: 15,
            fontWeight: "bold",
            cursor: "pointer",
            boxShadow: "0 2px 6px rgba(11,62,168,0.3)",
          }}
        >
          🖨️ Print / Save as PDF
        </button>
      </div>

      <div style={card} className="print-page">

        {/* Logo */}
        <div style={{textAlign:"center", marginBottom:16}}>
          <img src={logoImage} alt="DML Electrical" style={{maxWidth:200, width:"100%", height:"auto"}} />
          <p style={{fontSize:11, color:"#888", margin:"4px 0 0"}}>
            (337)288-0395 · info@dmlelectrical.com · Lic# 63147
          </p>
        </div>

        {/* Invoice # and Date row */}
        <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6}}>
          <div>
            <p style={{fontSize:12, color:"#888", margin:0}}>Date</p>
            <p style={{fontSize:14, fontWeight:600, color:"#111", margin:0}}>{fmtDate(invoice.invoice_date)}</p>
            {invoice.due_date && (
              <>
                <p style={{fontSize:12, color:"#888", margin:"6px 0 0"}}>Due</p>
                <p style={{fontSize:14, fontWeight:600, color:"#111", margin:0}}>{fmtDate(invoice.due_date)}</p>
              </>
            )}
          </div>
          <div style={{textAlign:"right"}}>
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
            <span style={{
              fontSize:14, color:"#222", flex:1, paddingRight:12,
              lineHeight:"1.4", wordBreak:"break-word"
            }}>
              {item.description}
            </span>
            <span style={{
              fontSize:14, fontWeight:"bold", color:"#111",
              whiteSpace:"nowrap", flexShrink:0
            }}>
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

        {/* Pay Now — payment method selector (hidden when printing) */}
        {payableAmount > 0 && invoice?.status !== "paid" && (() => {
          const ccFee = Math.round(payableAmount * 0.03 * 100) / 100;
          const totalWithFee = payableAmount + ccFee;
          return (
            <div className="no-print" style={{marginTop:16, marginBottom:8}}>
              {!paymentMethod ? (
                <>
                  <p style={{fontSize:14, fontWeight:"bold", color:"#111", textAlign:"center", marginBottom:12}}>
                    How would you like to pay?
                  </p>
                  <div style={{display:"flex", gap:10, marginBottom:10}}>
                    <button
                      onClick={() => setPaymentMethod("card")}
                      style={{
                        flex:1, padding:"14px 10px",
                        background:"#fff",
                        border:"2px solid #e5e7eb", borderRadius:10,
                        cursor:"pointer", textAlign:"center",
                      }}
                    >
                      <div style={{fontSize:22}}>💳</div>
                      <div style={{fontSize:13, fontWeight:"bold", color:"#111", marginTop:4}}>Credit / Debit Card</div>
                      <div style={{fontSize:11, color:"#ef4444", marginTop:2}}>+3% processing fee</div>
                    </button>
                    <button
                      onClick={() => setPaymentMethod("ach")}
                      style={{
                        flex:1, padding:"14px 10px",
                        background:"#f0fdf4",
                        border:"2px solid #10b981", borderRadius:10,
                        cursor:"pointer", textAlign:"center",
                      }}
                    >
                      <div style={{fontSize:22}}>🏦</div>
                      <div style={{fontSize:13, fontWeight:"bold", color:"#111", marginTop:4}}>Bank Transfer (ACH)</div>
                      <div style={{fontSize:11, color:"#10b981", marginTop:2}}>No processing fee · Save {fmtMoney(ccFee)}</div>
                    </button>
                  </div>
                  <p style={{fontSize:11, color:"#9ca3af", textAlign:"center", margin:0}}>
                    Or mail a check to: P.O. Box 363, Jennings, LA 70546
                  </p>
                </>
              ) : (
                <>
                  {/* Card breakdown */}
                  {paymentMethod === "card" && (
                    <div style={{background:"#fef9c3", border:"1px solid #fde68a", borderRadius:8, padding:12, marginBottom:12}}>
                      <div style={{display:"flex", justifyContent:"space-between", fontSize:13, color:"#666", marginBottom:4}}>
                        <span>Invoice Balance</span>
                        <span>{fmtMoney(payableAmount)}</span>
                      </div>
                      <div style={{display:"flex", justifyContent:"space-between", fontSize:13, color:"#ef4444", marginBottom:4}}>
                        <span>Credit Card Processing Fee (3%)</span>
                        <span>+{fmtMoney(ccFee)}</span>
                      </div>
                      <div style={{display:"flex", justifyContent:"space-between", fontSize:15, fontWeight:"bold", color:"#111", borderTop:"1px solid #fde68a", paddingTop:8}}>
                        <span>Total Charged to Card</span>
                        <span>{fmtMoney(totalWithFee)}</span>
                      </div>
                    </div>
                  )}
                  {/* ACH breakdown */}
                  {paymentMethod === "ach" && (
                    <div style={{background:"#f0fdf4", border:"1px solid #86efac", borderRadius:8, padding:12, marginBottom:12}}>
                      <div style={{display:"flex", justifyContent:"space-between", fontSize:15, fontWeight:"bold", color:"#111"}}>
                        <span>Total (No Fee)</span>
                        <span style={{color:"#10b981"}}>{fmtMoney(payableAmount)}</span>
                      </div>
                      <div style={{fontSize:11, color:"#059669", marginTop:4}}>
                        🎉 You save {fmtMoney(ccFee)} compared to paying by card!
                      </div>
                    </div>
                  )}

                  <button
                    onClick={handlePayNow}
                    disabled={payLoading}
                    style={{
                      width:"100%",
                      padding:"16px",
                      background: payLoading ? "#9ca3af" : paymentMethod === "ach" ? GREEN : ACCENT,
                      color:"#fff",
                      border:"none",
                      borderRadius:10,
                      fontSize:17,
                      fontWeight:"bold",
                      cursor: payLoading ? "not-allowed" : "pointer",
                      boxShadow: paymentMethod === "ach"
                        ? "0 2px 8px rgba(22,163,74,0.3)"
                        : "0 2px 8px rgba(252,107,4,0.3)",
                    }}
                  >
                    {payLoading
                      ? "⏳ Redirecting to Checkout..."
                      : paymentMethod === "card"
                        ? `💳 Pay ${fmtMoney(totalWithFee)} by Card`
                        : `🏦 Pay ${fmtMoney(payableAmount)} via ACH`}
                  </button>

                  <button
                    onClick={() => { setPaymentMethod(null); setPayError(""); }}
                    style={{
                      width:"100%", padding:"8px",
                      background:"transparent", border:"none",
                      color:"#9ca3af", cursor:"pointer", fontSize:13, marginTop:6,
                    }}
                  >
                    ← Change payment method
                  </button>

                  {payError && (
                    <p style={{fontSize:13, color:"#ef4444", textAlign:"center", marginTop:6, fontWeight:600}}>
                      ⚠️ {payError}
                    </p>
                  )}
                </>
              )}
              <p style={{fontSize:11, color:"#9ca3af", textAlign:"center", margin:"8px 0 0"}}>
                🔒 Secure checkout powered by Stripe
              </p>
            </div>
          );
        })()}

        {/* Already paid badge */}
        {(invoice?.status === "paid") && (
          <div style={{
            background:"#dcfce7", border:"1px solid #86efac", borderRadius:10,
            padding:"12px 16px", marginTop:12, textAlign:"center"
          }}>
            <span style={{fontSize:15, fontWeight:"bold", color:GREEN}}>✅ Paid in Full — Thank you!</span>
          </div>
        )}

        {/* ACH pending badge */}
        {invoice?.status === "payment_pending" && (
          <div style={{
            background:"#fef9c3", border:"1px solid #fde68a", borderRadius:10,
            padding:"12px 16px", marginTop:12, textAlign:"center"
          }}>
            <span style={{fontSize:15, fontWeight:"bold", color:"#92400e"}}>
              ⏳ ACH Payment Initiated — processing in 2–5 business days
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
