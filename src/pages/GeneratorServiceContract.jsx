import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { notify } from "../lib/notify";

const ANNUAL_FEE = 375.00;
const SERVICES = [
  "Oil Change",
  "Oil Filter Change",
  "Air Filter Change",
  "Spark Plug Change",
  "Load Test",
  "Battery Test",
];

const TODAY_STR = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
const TODAY_ISO = new Date().toISOString().slice(0, 10);

export default function GeneratorServiceContract() {
  const navigate = useNavigate();
  const location = useLocation();
  const canvasRef = useRef(null);
  const isDrawing = useRef(false);
  const lastPos = useRef(null);

  // ── Generator / Customer data ─────────────────────────────
  const [generatorId, setGeneratorId] = useState(null);
  const [customerName, setCustomerName] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [genBrand, setGenBrand] = useState("");
  const [genModel, setGenModel] = useState("");
  const [genSerial, setGenSerial] = useState("");
  const [genKw, setGenKw] = useState("");
  const [contractDate, setContractDate] = useState(TODAY_ISO);
  const [hasSig, setHasSig] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // ── Load from URL params ───────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const gId = params.get("generatorId");
    if (gId) {
      setGeneratorId(gId);
      loadGenerator(gId);
    }
  }, [location.search]);

  async function loadGenerator(id) {
    const { data } = await supabase.from("generators").select("*").eq("id", id).single();
    if (!data) return;
    setCustomerName(data.customer_name ?? "");
    setCustomerAddress(data.customer_address ?? "");
    setGenBrand(data.brand ?? "");
    setGenModel(data.model ?? "");
    setGenSerial(data.serial_number ?? "");
    setGenKw(data.kw_size ?? "");
  }

  // ── Canvas setup ──────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  function getPos(e, canvas) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if (e.touches) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  const startDraw = useCallback((e) => {
    e.preventDefault();
    isDrawing.current = true;
    lastPos.current = getPos(e, canvasRef.current);
  }, []);

  const draw = useCallback((e) => {
    e.preventDefault();
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
    setHasSig(true);
  }, []);

  const stopDraw = useCallback(() => {
    isDrawing.current = false;
    lastPos.current = null;
  }, []);

  function clearSig() {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasSig(false);
  }

  // ── Save ──────────────────────────────────────────────────
  async function handleSave() {
    if (!hasSig) return notify("Please have the customer sign the contract before saving");
    if (!generatorId) return notify("No generator linked to this contract");

    setIsSaving(true);
    try {
      const sigDataUrl = canvasRef.current.toDataURL("image/png");
      await supabase.from("generators").update({
        service_contract_date: contractDate,
        service_contract_signed: true,
        service_contract_signature: sigDataUrl,
      }).eq("id", generatorId);

      setSaved(true);
      notify("✅ Service contract saved to generator record!");
    } catch (err) {
      notify("Save failed: " + err.message);
    } finally {
      setIsSaving(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  const genLine = [genBrand, genModel].filter(Boolean).join(" ") || "—";
  const kwLine = genKw ? ` | ${genKw} kW` : "";
  const snLine = genSerial ? ` | SN: ${genSerial}` : "";

  return (
    <>
      {/* ── Print CSS ── */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-page { box-shadow: none !important; border: none !important; margin: 0 !important; padding: 0 !important; }
          body { background: #fff !important; }
          .sig-canvas { border: 1px solid #333 !important; }
        }
        @media screen {
          .print-page { max-width: 720px; margin: 0 auto; }
        }
      `}</style>

      {/* ── Screen controls (hidden on print) ── */}
      <div className="no-print" style={{ maxWidth: 720, margin: "0 auto", padding: "16px 16px 0", display: "flex", gap: 10, justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
        <button onClick={() => navigate("/generators")} style={btnGray}>← Back to Generators</button>
        <div style={{ display: "flex", gap: 10 }}>
          {hasSig && <button onClick={clearSig} style={{ ...btnGray, color: "#dc2626" }}>🗑 Clear Signature</button>}
          <button onClick={handlePrint} style={btnBlue}>🖨️ Print Contract</button>
          <button onClick={handleSave} disabled={isSaving || saved} style={saved ? { ...btnOrange, background: "#16a34a" } : btnOrange}>
            {saved ? "✅ Saved!" : isSaving ? "Saving…" : "💾 Save Signed Contract"}
          </button>
        </div>
      </div>

      {/* ── Contract Document ── */}
      <div className="print-page" style={{ background: "#fff", padding: "40px 48px", boxShadow: "0 2px 20px rgba(0,0,0,0.08)", marginTop: 16, fontFamily: "Georgia, serif" }}>

        {/* Header */}
        <div style={{ textAlign: "center", borderBottom: "3px solid #111", paddingBottom: 20, marginBottom: 24 }}>
          <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: 1, color: "#111", fontFamily: "Arial, sans-serif" }}>
            DML ELECTRICAL SERVICE
          </div>
          <div style={{ fontSize: 14, color: "#444", marginTop: 4, fontFamily: "Arial, sans-serif" }}>
            Annual Generator Service Agreement
          </div>
        </div>

        {/* Customer & Date */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 20, marginBottom: 20 }}>
          <div>
            <Row label="Customer" value={customerName || "________________________"} />
            <Row label="Address" value={customerAddress || "________________________"} />
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Contract Date</div>
            <input
              type="date"
              value={contractDate}
              onChange={(e) => setContractDate(e.target.value)}
              className="no-print"
              style={{ border: "1px solid #d1d5db", borderRadius: 6, padding: "4px 8px", fontSize: 14, fontFamily: "inherit" }}
            />
            <div className="print-only" style={{ fontSize: 14, fontWeight: 700, display: "none" }}>
              {new Date(contractDate + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </div>
          </div>
        </div>

        {/* Generator */}
        <div style={{ background: "#f9f9f9", border: "1px solid #ddd", borderRadius: 8, padding: "12px 16px", marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#666", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Generator</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#111" }}>
            {genLine}{kwLine}{snLine}
          </div>
        </div>

        {/* Agreement Body */}
        <div style={{ fontSize: 13, lineHeight: 1.75, color: "#222", marginBottom: 24 }}>
          <p style={{ margin: "0 0 16px" }}>
            This Agreement is entered into between <strong>DML Electrical Service</strong> and the above-named Customer for the annual maintenance service of the above-referenced standby generator.
          </p>

          {/* Fee Box */}
          <div style={{ border: "2px solid #111", borderRadius: 8, padding: "14px 20px", marginBottom: 20, background: "#fffbf0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 900, color: "#111" }}>Annual Service Fee</div>
                <div style={{ fontSize: 12, color: "#555", marginTop: 2 }}>Billed once per year upon completion of service</div>
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, color: "#111" }}>$375.00</div>
            </div>
          </div>

          {/* Services Included */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 14 }}>Services Included:</div>
            <div style={{ columns: 2, columnGap: 24 }}>
              {SERVICES.map((s) => (
                <div key={s} style={{ marginBottom: 6, breakInside: "avoid" }}>
                  ✓ &nbsp;{s}
                </div>
              ))}
            </div>
          </div>

          {/* Additional Charges Notice */}
          <div style={{ borderLeft: "4px solid #fc6b04", paddingLeft: 14, margin: "20px 0", color: "#333" }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Additional Charges</div>
            <div style={{ fontSize: 12.5 }}>
              This agreement covers only the services listed above. Any repairs, replacement parts, or additional labor required beyond routine maintenance are <strong>not included</strong> in the annual fee. The customer will be contacted for approval before any additional work is performed, and additional charges will be invoiced separately.
            </div>
          </div>

          {/* Terms */}
          <div style={{ fontSize: 12, color: "#555", borderTop: "1px solid #e5e7eb", paddingTop: 14, marginTop: 14 }}>
            By signing below, the Customer acknowledges having read and agreed to the terms of this Annual Generator Service Agreement with DML Electrical Service.
          </div>
        </div>

        {/* Signature Section */}
        <div style={{ marginTop: 28 }}>
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#333", marginBottom: 4 }}>Customer Signature:</div>
            {/* Signature canvas (hidden on print, replaced by image) */}
            <div className="no-print">
              <canvas
                ref={canvasRef}
                width={600}
                height={120}
                className="sig-canvas"
                style={{ border: "1.5px solid #d1d5db", borderRadius: 8, cursor: "crosshair", width: "100%", height: 120, touchAction: "none", background: "#fff" }}
                onMouseDown={startDraw}
                onMouseMove={draw}
                onMouseUp={stopDraw}
                onMouseLeave={stopDraw}
                onTouchStart={startDraw}
                onTouchMove={draw}
                onTouchEnd={stopDraw}
              />
              {!hasSig && (
                <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4, fontStyle: "italic" }}>
                  Sign above with mouse or touch
                </div>
              )}
            </div>
            {/* Print signature line */}
            <div style={{ borderBottom: "1.5px solid #111", width: "100%", height: 80, marginBottom: 4 }} />
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#444", marginTop: 4 }}>
            <div>Print Name: <span style={{ borderBottom: "1px solid #999", display: "inline-block", minWidth: 200 }}>&nbsp;</span></div>
            <div>
              Date:&nbsp;
              <span style={{ borderBottom: "1px solid #999", display: "inline-block", minWidth: 120 }}>
                {new Date(contractDate + "T12:00:00").toLocaleDateString("en-US")}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: "center", marginTop: 36, fontSize: 11, color: "#888", borderTop: "1px solid #e5e7eb", paddingTop: 14 }}>
          DML Electrical Service &nbsp;•&nbsp; Annual Generator Service Agreement
        </div>
      </div>

      <div style={{ height: 40 }} />
    </>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <span style={{ fontSize: 11, color: "#666", textTransform: "uppercase", letterSpacing: 0.5, fontFamily: "Arial, sans-serif" }}>{label}: </span>
      <span style={{ fontSize: 14, fontWeight: 700, color: "#111" }}>{value}</span>
    </div>
  );
}

const btnOrange = { background: "#fc6b04", color: "#fff", border: "none", borderRadius: 10, padding: "10px 20px", fontWeight: 800, fontSize: 14, cursor: "pointer" };
const btnGray = { background: "#f3f4f6", color: "#374151", border: "none", borderRadius: 10, padding: "10px 18px", fontWeight: 700, fontSize: 14, cursor: "pointer" };
const btnBlue = { background: "#0b3ea8", color: "#fff", border: "none", borderRadius: 10, padding: "10px 20px", fontWeight: 800, fontSize: 14, cursor: "pointer" };
