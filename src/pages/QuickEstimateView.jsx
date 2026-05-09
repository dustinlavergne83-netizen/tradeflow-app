import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import logoImage from "../assets/LOGOD.jpg";

const ACCENT = "#fc6b04";

export default function QuickEstimateView() {
  const [searchParams, setSearchParams] = useSearchParams();
  const estimateId = searchParams.get("estimateId");
  const initialMode = searchParams.get("mode") || "itemized"; // "summary" or "itemized"

  const [estimate, setEstimate] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState(initialMode);

  useEffect(() => {
    if (estimateId) loadEstimate();
  }, [estimateId]);

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
    <div style={pg}><p style={{textAlign:"center",padding:"60px",color:"#666",fontSize:16}}>Loading estimate...</p></div>
  );
  if (!estimate) return (
    <div style={pg}><p style={{textAlign:"center",padding:"60px",color:"#ef4444",fontSize:16}}>Estimate not found</p></div>
  );

  const subtotal = items.reduce((s,i) => s + (i.line_total||0), 0);
  const total = estimate.total || subtotal;

  return (
    <div style={pg}>
      {/* Print CSS to hide toggle buttons */}
      <style>{`@media print { .no-print { display: none !important; } }`}</style>
      <div style={card}>

        {/* Logo */}
        <div style={{textAlign:"center", marginBottom:16}}>
          <img src={logoImage} alt="DML Electrical" style={{maxWidth:200, width:"100%", height:"auto"}} />
          <p style={{fontSize:11, color:"#888", margin:"4px 0 0"}}>
            (337)288-0395 · info@dmlelectrical.com · Lic# 63147
          </p>
        </div>

        {/* Estimate # and Date row */}
        <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6}}>
          <div>
            <p style={{fontSize:12, color:"#888", margin:0}}>Date</p>
            <p style={{fontSize:14, fontWeight:600, color:"#111", margin:0}}>{fmtDate(estimate.estimate_date)}</p>
          </div>
          <div style={{textAlign:"right"}}>
            <p style={{fontSize:12, color:"#888", margin:0}}>Estimate #</p>
            <p style={{fontSize:18, fontWeight:"bold", color:"#111", margin:0}}>{estimate.estimate_number}</p>
            <span style={{
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
          <p style={{fontSize:12, color:"#888", margin:"0 0 2px"}}>Prepared For:</p>
          <p style={{fontSize:16, fontWeight:"bold", color:"#111", margin:0}}>{estimate.customer_name}</p>
          {estimate.project_name && estimate.project_name !== "Quick Estimate" && (
            <>
              <p style={{fontSize:12, color:"#888", margin:"8px 0 2px"}}>Project:</p>
              <p style={{fontSize:14, fontWeight:600, color:"#111", margin:0}}>{estimate.project_name}</p>
            </>
          )}
        </div>

        {/* View Mode Toggle - hidden when printing */}
        <div className="no-print" style={{
          display:"flex", justifyContent:"center", gap:8, marginBottom:16,
          padding:"8px", backgroundColor:"#f3f4f6", borderRadius:8
        }}>
          <button
            onClick={() => setViewMode("summary")}
            style={{
              padding:"8px 20px", fontSize:13, fontWeight:"700", cursor:"pointer",
              border: viewMode === "summary" ? `2px solid ${ACCENT}` : "2px solid transparent",
              backgroundColor: viewMode === "summary" ? "#fff" : "transparent",
              color: viewMode === "summary" ? ACCENT : "#666",
              borderRadius:6, transition:"all 0.2s"
            }}
          >
            📋 Summary Only
          </button>
          <button
            onClick={() => setViewMode("itemized")}
            style={{
              padding:"8px 20px", fontSize:13, fontWeight:"700", cursor:"pointer",
              border: viewMode === "itemized" ? `2px solid ${ACCENT}` : "2px solid transparent",
              backgroundColor: viewMode === "itemized" ? "#fff" : "transparent",
              color: viewMode === "itemized" ? ACCENT : "#666",
              borderRadius:6, transition:"all 0.2s"
            }}
          >
            📝 Itemized
          </button>
        </div>

        {viewMode === "itemized" ? (
          <>
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
                  {fmtMoney(item.line_total || item.material_total)}
                </span>
              </div>
            ))}
          </>
        ) : (
          <>
            {/* Summary Mode - just scope of work description and total */}
            <div style={{borderBottom:`2px solid ${ACCENT}`, paddingBottom:4, marginBottom:12}}>
              <span style={{fontSize:11, fontWeight:"bold", color:"#888", textTransform:"uppercase"}}>Scope of Work</span>
            </div>
            
            {/* Show notes/description as scope */}
            {estimate.notes ? (
              <div style={{padding:"12px 0", lineHeight:1.6, fontSize:14, color:"#222"}}>
                <p style={{margin:0, whiteSpace:"pre-wrap"}}>{estimate.notes}</p>
              </div>
            ) : (
              <div style={{padding:"12px 0", lineHeight:1.6, fontSize:14, color:"#222"}}>
                <p style={{margin:"0 0 8px", fontWeight:"600"}}>
                  {estimate.project_name && estimate.project_name !== "Quick Estimate"
                    ? estimate.project_name
                    : "Electrical Work"
                  }
                </p>
                <p style={{margin:0, color:"#555"}}>
                  Includes all labor, materials, and equipment necessary to complete the scope of work as discussed.
                  {items.length > 0 && ` (${items.length} item${items.length !== 1 ? 's' : ''})`}
                </p>
              </div>
            )}
          </>
        )}

        {/* Total */}
        <div style={{
          display:"flex", justifyContent:"space-between", alignItems:"center",
          marginTop:16, padding:"14px 0",
          borderTop:`3px solid ${ACCENT}`
        }}>
          <span style={{fontSize:16, fontWeight:"bold", color:"#111"}}>Total Estimate</span>
          <span style={{fontSize:22, fontWeight:"bold", color: ACCENT}}>{fmtMoney(total)}</span>
        </div>

        {/* Notes - hide in summary mode since notes already shown as scope */}
        {estimate.notes && viewMode === "itemized" && (
          <div style={{
            background:"#f9fafb", borderRadius:8, padding:12,
            marginTop:12, marginBottom:12
          }}>
            <p style={{fontSize:12, fontWeight:"bold", color:"#111", margin:"0 0 4px"}}>Notes:</p>
            <p style={{fontSize:13, color:"#555", margin:0, whiteSpace:"pre-wrap", lineHeight:1.5}}>
              {estimate.notes}
            </p>
          </div>
        )}

        {/* Terms */}
        <p style={{fontSize:11, color:"#aaa", lineHeight:1.5, margin:"12px 0"}}>
          This estimate is valid for 30 days from the date shown above. Pricing is subject to change
          after that period. Changes to scope may result in additional charges. Does not include
          permits or inspections unless noted.
        </p>

        {/* Signature Lines */}
        <div style={{display:"flex", gap:20, marginTop:16, marginBottom:20}}>
          <div style={{flex:1}}>
            <div style={{borderBottom:"2px solid #333", height:36, marginBottom:4}} />
            <p style={{fontSize:10, color:"#999", textTransform:"uppercase", margin:0}}>Customer Signature</p>
          </div>
          <div style={{flex:1}}>
            <div style={{borderBottom:"2px solid #333", height:36, marginBottom:4}} />
            <p style={{fontSize:10, color:"#999", textTransform:"uppercase", margin:0}}>Date</p>
          </div>
        </div>

        {/* Footer */}
        <div style={{textAlign:"center", borderTop:"1px solid #eee", paddingTop:12}}>
          <p style={{fontSize:12, color:"#bbb", margin:"2px 0"}}>Thank you for the opportunity!</p>
          <p style={{fontSize:11, color:"#bbb", margin:"2px 0"}}>DML Electrical Service, LLC · P.O. Box 363, Jennings, LA 70546</p>
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
