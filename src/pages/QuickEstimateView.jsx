import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import logoImage from "../assets/LOGOD.jpg";
import { supabase } from "../lib/supabase";

const ACCENT = "#fc6b04";

// ─── View Choice Modal ────────────────────────────────────────────────────────
function ViewChoiceModal({ onChoose }) {
  return (
    <div style={{
      position:"fixed", inset:0, background:"rgba(0,0,0,0.6)",
      display:"flex", alignItems:"center", justifyContent:"center",
      zIndex:1000, padding:16
    }}>
      <div style={{
        background:"#fff", borderRadius:14, padding:"32px 28px",
        maxWidth:480, width:"100%", boxShadow:"0 8px 32px rgba(0,0,0,0.25)"
      }}>
        <h2 style={{margin:"0 0 6px", fontSize:20, color:"#111", textAlign:"center"}}>
          Choose View Format
        </h2>
        <p style={{margin:"0 0 24px", fontSize:13, color:"#555", textAlign:"center"}}>
          How would you like to display this estimate?
        </p>

        {/* Option 1 – Summary Only */}
        <button onClick={() => onChoose("summary")} style={optBtn}>
          <span style={optIcon}>📄</span>
          <div style={{textAlign:"left"}}>
            <div style={optTitle}>Summary Only</div>
            <div style={optDesc}>Scope of work description + Total Investment — no line items shown</div>
          </div>
        </button>

        {/* Option 2 – Itemized with Pricing */}
        <button onClick={() => onChoose("itemized")} style={optBtn}>
          <span style={optIcon}>💰</span>
          <div style={{textAlign:"left"}}>
            <div style={optTitle}>Itemized with Pricing</div>
            <div style={optDesc}>Every line item listed with individual prices + Total Investment</div>
          </div>
        </button>

        {/* Option 3 – Itemized No Pricing */}
        <button onClick={() => onChoose("itemized-no-price")} style={optBtn}>
          <span style={optIcon}>📋</span>
          <div style={{textAlign:"left"}}>
            <div style={optTitle}>Itemized (No Individual Prices)</div>
            <div style={optDesc}>All items listed so customer sees what's included — only Total Investment shown</div>
          </div>
        </button>
      </div>
    </div>
  );
}

const optBtn = {
  display:"flex", alignItems:"center", gap:14,
  width:"100%", background:"#f9fafb",
  border:"2px solid #e5e7eb", borderRadius:10,
  padding:"14px 16px", marginBottom:12,
  cursor:"pointer", textAlign:"left",
  transition:"border-color 0.15s",
};
const optIcon  = { fontSize:28, flexShrink:0 };
const optTitle = { fontSize:15, fontWeight:700, color:"#111", marginBottom:2 };
const optDesc  = { fontSize:12, color:"#555", lineHeight:1.4 };

// ─── Main Component ───────────────────────────────────────────────────────────
export default function QuickEstimateView() {
  const [searchParams] = useSearchParams();
  const estimateId = searchParams.get("estimateId");
  const viewParam  = searchParams.get("view"); // "summary" | "itemized" | "itemized-no-price"

  const [estimate, setEstimate]   = useState(null);
  const [items, setItems]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [chosenView, setChosenView] = useState(viewParam || null);

  useEffect(() => {
    if (estimateId) loadEstimate();
  }, [estimateId]);

  useEffect(() => {
    if (viewParam) setChosenView(viewParam);
  }, [viewParam]);

  async function loadEstimate() {
    try {
      const { data, error } = await supabase
        .from("estimates").select("*").eq("id", estimateId).single();
      if (error) throw error;
      setEstimate(data);

      const { data: itemsData } = await supabase
        .from("estimate_items").select("*").eq("estimate_id", estimateId).order("sequence");
      setItems(itemsData || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const fmtDate = (d) => {
    if (!d) return "";
    const dt = new Date(d);
    return `${String(dt.getMonth()+1).padStart(2,"0")}/${String(dt.getDate()).padStart(2,"0")}/${dt.getFullYear()}`;
  };

  const fmtMoney = (n) => "$" + Number(n||0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,",");

  if (loading) return (
    <div style={pg}><p style={{textAlign:"center",padding:"60px",color:"#444",fontSize:16}}>Loading estimate...</p></div>
  );
  if (!estimate) return (
    <div style={pg}><p style={{textAlign:"center",padding:"60px",color:"#ef4444",fontSize:16}}>Estimate not found</p></div>
  );

  const materialMarkup = Number(estimate.material_markup || 0);
  const laborMarkup    = Number(estimate.labor_markup    || 0);

  // Apply markup to each item's displayed amount
  const itemDisplayAmount = (item) => {
    const matPart = (item.material_total || 0) * (1 + materialMarkup / 100);
    const lbrPart = (item.labor_total    || 0) * (1 + laborMarkup    / 100);
    return matPart + lbrPart;
  };

  const subtotal = items.reduce((s,i) => s + (i.line_total||0), 0);
  const total = estimate.total || subtotal;

  return (
    <div id="qev-pg" style={pg}>
      {/* Print CSS */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; }
          #qev-pg {
            background: #fff !important;
            padding: 0 !important;
            min-height: auto !important;
          }
          #qev-card {
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            padding: 24px !important;
            margin: 0 !important;
            max-width: 100% !important;
          }
        }
      `}</style>

      {/* Show view choice modal if not yet chosen */}
      {!chosenView && (
        <ViewChoiceModal onChoose={setChosenView} />
      )}

      <div id="qev-card" style={card}>

        {/* Header: Date | Logo | Estimate # */}
        <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8}}>
          {/* Date - left */}
          <div style={{minWidth:90}}>
            <p style={{fontSize:11, color:"#555", margin:0}}>Date</p>
            <p style={{fontSize:13, fontWeight:600, color:"#111", margin:0}}>{fmtDate(estimate.estimate_date)}</p>
          </div>

          {/* Logo - center */}
          <div style={{textAlign:"center", flex:1, padding:"0 12px"}}>
            <img src={logoImage} alt="DML Electrical" style={{maxWidth:180, width:"100%", height:"auto"}} />
            <p style={{fontSize:11, color:"#555", margin:"4px 0 0"}}>
              (337)288-0395 · info@dmlelectrical.com · Lic# 63147
            </p>
          </div>

          {/* Estimate # - right */}
          <div style={{textAlign:"right", minWidth:90}}>
            <p style={{fontSize:11, color:"#555", margin:0}}>Estimate #</p>
            <p style={{fontSize:18, fontWeight:"bold", color:"#111", margin:0}}>{estimate.estimate_number}</p>
            <span className="no-print" style={{
              display:"inline-block", marginTop:4,
              padding:"2px 8px", background:"#6b7280",
              color:"#fff", borderRadius:4, fontSize:10, fontWeight:"bold"
            }}>
              {(estimate.status||"DRAFT").toUpperCase()}
            </span>
          </div>
        </div>

        <div style={{borderTop:`3px solid ${ACCENT}`, margin:"12px 0"}} />

        {/* Prepared For */}
        <div style={{marginBottom:16}}>
          <p style={{fontSize:12, color:"#555", margin:"0 0 2px"}}>Prepared For:</p>
          <p style={{fontSize:16, fontWeight:"bold", color:"#111", margin:0}}>{estimate.customer_name}</p>
          {estimate.project_name && estimate.project_name !== "Quick Estimate" && (
            <>
              <p style={{fontSize:12, color:"#555", margin:"8px 0 2px"}}>Project:</p>
              <p style={{fontSize:14, fontWeight:600, color:"#111", margin:0}}>{estimate.project_name}</p>
            </>
          )}
        </div>

        {/* ── SUMMARY ONLY view ── */}
        {chosenView === "summary" && (
          <>
            <div style={{
              borderTop:`2px solid ${ACCENT}`, borderBottom:`2px solid ${ACCENT}`,
              padding:"8px 0", marginBottom:12
            }}>
              <span style={{fontSize:11, fontWeight:"bold", color:"#444", textTransform:"uppercase"}}>
                Scope of Work
              </span>
            </div>
            {(estimate.description || estimate.notes) ? (
              <p style={{fontSize:14, color:"#333", lineHeight:1.7, margin:"0 0 16px", textAlign:"center"}}>
                {estimate.description || estimate.notes}
              </p>
            ) : (
              <p style={{fontSize:13, color:"#555", margin:"0 0 16px", textAlign:"center", fontStyle:"italic"}}>
                No scope description provided.
              </p>
            )}
          </>
        )}

        {/* ── ITEMIZED views (with or without price) ── */}
        {(chosenView === "itemized" || chosenView === "itemized-no-price") && (
          <>
            <div style={{
              display:"flex", justifyContent:"space-between",
              padding:"6px 0", borderBottom:`2px solid ${ACCENT}`,
              marginBottom:4
            }}>
              <span style={{fontSize:11, fontWeight:"bold", color:"#444", textTransform:"uppercase"}}>Description</span>
              {chosenView === "itemized" && (
                <span style={{fontSize:11, fontWeight:"bold", color:"#444", textTransform:"uppercase"}}>Amount</span>
              )}
            </div>

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
                {chosenView === "itemized" && (
                  <span style={{
                    fontSize:14, fontWeight:"bold", color:"#111",
                    whiteSpace:"nowrap", flexShrink:0
                  }}>
                    {fmtMoney(itemDisplayAmount(item))}
                  </span>
                )}
              </div>
            ))}
          </>
        )}

        {/* Total */}
        <div style={{
          display:"flex", justifyContent:"space-between", alignItems:"center",
          marginTop:16, padding:"14px 0",
          borderTop:`3px solid ${ACCENT}`
        }}>
          <span style={{fontSize:16, fontWeight:"bold", color:"#111"}}>Total Investment</span>
          <span style={{fontSize:22, fontWeight:"bold", color: ACCENT}}>{fmtMoney(total)}</span>
        </div>

        {/* Notes - hide in summary view if notes is already shown as scope */}
        {estimate.notes && (chosenView !== "summary" || estimate.description) && (
          <div style={{
            background:"#f9fafb", borderRadius:8, padding:12,
            marginTop:12, marginBottom:12
          }}>
            <p style={{fontSize:12, fontWeight:"bold", color:"#111", margin:"0 0 4px"}}>Notes:</p>
            <p style={{fontSize:13, color:"#444", margin:0, whiteSpace:"pre-wrap", lineHeight:1.5}}>
              {estimate.notes}
            </p>
          </div>
        )}

        {/* Terms */}
        <p style={{fontSize:11, color:"#444", lineHeight:1.5, margin:"12px 0"}}>
          This estimate is valid for 30 days from the date shown above. Pricing is subject to change
          after that period. Changes to scope may result in additional charges. Does not include
          permits or inspections unless noted.
        </p>

        {/* Signature Lines */}
        <div style={{display:"flex", gap:20, marginTop:16, marginBottom:20}}>
          <div style={{flex:1}}>
            <div style={{borderBottom:"2px solid #333", height:36, marginBottom:4}} />
            <p style={{fontSize:10, color:"#444", textTransform:"uppercase", margin:0}}>Customer Signature</p>
          </div>
          <div style={{flex:1}}>
            <div style={{borderBottom:"2px solid #333", height:36, marginBottom:4}} />
            <p style={{fontSize:10, color:"#444", textTransform:"uppercase", margin:0}}>Date</p>
          </div>
        </div>

        {/* Footer */}
        <div style={{textAlign:"center", borderTop:"1px solid #eee", paddingTop:12}}>
          <p style={{fontSize:12, color:"#555", margin:"2px 0"}}>Thank you for the opportunity!</p>
          <p style={{fontSize:11, color:"#555", margin:"2px 0"}}>DML Electrical Service, LLC · P.O. Box 363, Jennings, LA 70546</p>
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
