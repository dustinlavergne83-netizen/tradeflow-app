import { useState } from "react";

export default function PriceAdjustment({ 
  originalTotal, 
  onAdjustmentApplied, 
  onClose, 
  show = false 
}) {
  const [adjustmentType, setAdjustmentType] = useState("percentage"); // "percentage" or "fixed"
  const [adjustmentValue, setAdjustmentValue] = useState(0);
  const [roundingOption, setRoundingOption] = useState("none"); // "none", "dollar", "ten", "hundred"
  const [showPreview, setShowPreview] = useState(false);

  if (!show) return null;

  // Calculate adjusted total
  const calculateAdjustedTotal = () => {
    let adjusted = originalTotal;
    
    // Apply adjustment
    if (adjustmentType === "percentage") {
      adjusted = originalTotal * (1 + adjustmentValue / 100);
    } else if (adjustmentType === "fixed") {
      adjusted = originalTotal + adjustmentValue;
    }
    
    // Apply rounding
    switch (roundingOption) {
      case "dollar":
        adjusted = Math.round(adjusted);
        break;
      case "ten":
        adjusted = Math.round(adjusted / 10) * 10;
        break;
      case "hundred":
        adjusted = Math.round(adjusted / 100) * 100;
        break;
      case "five":
        adjusted = Math.round(adjusted / 5) * 5;
        break;
      default:
        // No rounding
        break;
    }
    
    return adjusted;
  };

  const adjustedTotal = calculateAdjustedTotal();
  const difference = adjustedTotal - originalTotal;

  const handleApply = () => {
    if (onAdjustmentApplied) {
      onAdjustmentApplied(adjustedTotal, {
        type: adjustmentType,
        value: adjustmentValue,
        rounding: roundingOption,
        originalTotal,
        adjustedTotal,
        difference
      });
    }
    onClose();
  };

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: "rgba(0,0,0,0.8)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 10000
    }}>
      <div style={{
        background: "#2a2a2a",
        border: "2px solid #fc6b04ff",
        borderRadius: 12,
        padding: 30,
        width: 600,
        maxWidth: "95%",
        maxHeight: "90vh",
        overflowY: "auto"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h3 style={{ margin: 0, color: "#fc6b04ff", fontSize: 24, fontWeight: "bold" }}>
            💰 Price Adjustment
          </h3>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "#999",
              fontSize: 24,
              cursor: "pointer",
              padding: "0 8px"
            }}
          >
            ✕
          </button>
        </div>

        {/* Original Total Display */}
        <div style={{
          background: "#1a1a1a",
          border: "1px solid #444",
          borderRadius: 8,
          padding: 16,
          marginBottom: 20
        }}>
          <div style={{ color: "#999", fontSize: 14, marginBottom: 8 }}>Original Total:</div>
          <div style={{ color: "#10b981", fontSize: 28, fontWeight: "bold" }}>
            ${originalTotal.toFixed(2)}
          </div>
        </div>

        {/* Adjustment Type */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", marginBottom: 8, color: "#fff", fontSize: 16, fontWeight: "bold" }}>
            📊 Adjustment Type
          </label>
          <div style={{ display: "flex", gap: 12 }}>
            <button
              onClick={() => setAdjustmentType("percentage")}
              style={{
                flex: 1,
                padding: "12px 16px",
                background: adjustmentType === "percentage" ? "#fc6b04ff" : "transparent",
                border: "2px solid #fc6b04ff",
                borderRadius: 8,
                color: adjustmentType === "percentage" ? "#fff" : "#fc6b04ff",
                fontSize: 14,
                fontWeight: "bold",
                cursor: "pointer",
                transition: "all 0.2s"
              }}
            >
              % Percentage
            </button>
            <button
              onClick={() => setAdjustmentType("fixed")}
              style={{
                flex: 1,
                padding: "12px 16px",
                background: adjustmentType === "fixed" ? "#fc6b04ff" : "transparent",
                border: "2px solid #fc6b04ff",
                borderRadius: 8,
                color: adjustmentType === "fixed" ? "#fff" : "#fc6b04ff",
                fontSize: 14,
                fontWeight: "bold",
                cursor: "pointer",
                transition: "all 0.2s"
              }}
            >
              $ Fixed Amount
            </button>
          </div>
        </div>

        {/* Adjustment Value */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", marginBottom: 8, color: "#fff", fontSize: 16, fontWeight: "bold" }}>
            {adjustmentType === "percentage" ? "📈 Percentage Adjustment" : "💵 Fixed Dollar Adjustment"}
          </label>
          <div style={{ position: "relative" }}>
            {adjustmentType === "fixed" && (
              <span style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                color: "#999",
                fontSize: 16,
                zIndex: 1
              }}>
                $
              </span>
            )}
            <input
              type="number"
              value={adjustmentValue}
              onChange={(e) => {
                setAdjustmentValue(Number(e.target.value));
                setShowPreview(true);
              }}
              placeholder={adjustmentType === "percentage" ? "Enter percentage (e.g., 10 for 10%)" : "Enter dollar amount"}
              style={{
                width: "100%",
                padding: "12px 16px",
                paddingLeft: adjustmentType === "fixed" ? "28px" : "16px",
                background: "#1a1a1a",
                border: "2px solid #555",
                borderRadius: 8,
                color: "#fff",
                fontSize: 16,
                boxSizing: "border-box"
              }}
              step={adjustmentType === "percentage" ? "0.1" : "0.01"}
            />
            {adjustmentType === "percentage" && (
              <span style={{
                position: "absolute",
                right: 12,
                top: "50%",
                transform: "translateY(-50%)",
                color: "#999",
                fontSize: 16
              }}>
                %
              </span>
            )}
          </div>
          
          {/* Quick Buttons for Common Adjustments */}
          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            {adjustmentType === "percentage" ? (
              <>
                <button onClick={() => { setAdjustmentValue(5); setShowPreview(true); }} style={quickButtonStyle}>+5%</button>
                <button onClick={() => { setAdjustmentValue(10); setShowPreview(true); }} style={quickButtonStyle}>+10%</button>
                <button onClick={() => { setAdjustmentValue(15); setShowPreview(true); }} style={quickButtonStyle}>+15%</button>
                <button onClick={() => { setAdjustmentValue(20); setShowPreview(true); }} style={quickButtonStyle}>+20%</button>
                <button onClick={() => { setAdjustmentValue(-5); setShowPreview(true); }} style={quickButtonStyle}>-5%</button>
                <button onClick={() => { setAdjustmentValue(-10); setShowPreview(true); }} style={quickButtonStyle}>-10%</button>
              </>
            ) : (
              <>
                <button onClick={() => { setAdjustmentValue(100); setShowPreview(true); }} style={quickButtonStyle}>+$100</button>
                <button onClick={() => { setAdjustmentValue(250); setShowPreview(true); }} style={quickButtonStyle}>+$250</button>
                <button onClick={() => { setAdjustmentValue(500); setShowPreview(true); }} style={quickButtonStyle}>+$500</button>
                <button onClick={() => { setAdjustmentValue(-100); setShowPreview(true); }} style={quickButtonStyle}>-$100</button>
                <button onClick={() => { setAdjustmentValue(-250); setShowPreview(true); }} style={quickButtonStyle}>-$250</button>
              </>
            )}
          </div>
        </div>

        {/* Rounding Options */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", marginBottom: 8, color: "#fff", fontSize: 16, fontWeight: "bold" }}>
            🎯 Rounding Options
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8 }}>
            <button
              onClick={() => { setRoundingOption("none"); setShowPreview(true); }}
              style={{
                ...roundingButtonStyle,
                background: roundingOption === "none" ? "#8b5cf6" : "transparent",
                color: roundingOption === "none" ? "#fff" : "#8b5cf6"
              }}
            >
              No Rounding
            </button>
            <button
              onClick={() => { setRoundingOption("dollar"); setShowPreview(true); }}
              style={{
                ...roundingButtonStyle,
                background: roundingOption === "dollar" ? "#8b5cf6" : "transparent",
                color: roundingOption === "dollar" ? "#fff" : "#8b5cf6"
              }}
            >
              Round to $1
            </button>
            <button
              onClick={() => { setRoundingOption("five"); setShowPreview(true); }}
              style={{
                ...roundingButtonStyle,
                background: roundingOption === "five" ? "#8b5cf6" : "transparent",
                color: roundingOption === "five" ? "#fff" : "#8b5cf6"
              }}
            >
              Round to $5
            </button>
            <button
              onClick={() => { setRoundingOption("ten"); setShowPreview(true); }}
              style={{
                ...roundingButtonStyle,
                background: roundingOption === "ten" ? "#8b5cf6" : "transparent",
                color: roundingOption === "ten" ? "#fff" : "#8b5cf6"
              }}
            >
              Round to $10
            </button>
            <button
              onClick={() => { setRoundingOption("hundred"); setShowPreview(true); }}
              style={{
                ...roundingButtonStyle,
                background: roundingOption === "hundred" ? "#8b5cf6" : "transparent",
                color: roundingOption === "hundred" ? "#fff" : "#8b5cf6"
              }}
            >
              Round to $100
            </button>
          </div>
        </div>

        {/* Preview Results */}
        {showPreview && (
          <div style={{
            background: "#1a1a1a",
            border: "1px solid #444",
            borderRadius: 8,
            padding: 20,
            marginBottom: 20
          }}>
            <h4 style={{ margin: "0 0 16px 0", color: "#f97316", fontSize: 18 }}>📊 Preview</h4>
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ color: "#999", fontSize: 13, marginBottom: 4 }}>Original</div>
                <div style={{ color: "#10b981", fontSize: 20, fontWeight: "bold" }}>
                  ${originalTotal.toFixed(2)}
                </div>
              </div>
              
              <div style={{ textAlign: "center" }}>
                <div style={{ color: "#999", fontSize: 13, marginBottom: 4 }}>
                  {difference >= 0 ? "Increase" : "Decrease"}
                </div>
                <div style={{ 
                  color: difference >= 0 ? "#3b82f6" : "#ef4444", 
                  fontSize: 16, 
                  fontWeight: "bold" 
                }}>
                  {difference >= 0 ? "+" : ""}${difference.toFixed(2)}
                </div>
              </div>
              
              <div style={{ textAlign: "center" }}>
                <div style={{ color: "#999", fontSize: 13, marginBottom: 4 }}>New Total</div>
                <div style={{ color: "#fff", fontSize: 24, fontWeight: "bold" }}>
                  ${adjustedTotal.toFixed(2)}
                </div>
              </div>
            </div>

            {/* Calculation Details */}
            <div style={{ 
              marginTop: 16, 
              paddingTop: 16, 
              borderTop: "1px solid #444",
              fontSize: 13,
              color: "#999"
            }}>
              <div>
                ${originalTotal.toFixed(2)} 
                {adjustmentType === "percentage" && adjustmentValue !== 0 && 
                  ` ${adjustmentValue >= 0 ? "+" : ""}${adjustmentValue}% = $${(originalTotal * (1 + adjustmentValue / 100)).toFixed(2)}`
                }
                {adjustmentType === "fixed" && adjustmentValue !== 0 && 
                  ` ${adjustmentValue >= 0 ? "+" : ""}$${adjustmentValue} = $${(originalTotal + adjustmentValue).toFixed(2)}`
                }
                {roundingOption !== "none" && 
                  ` → rounded to ${adjustedTotal.toFixed(2)}`
                }
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{
              padding: "12px 24px",
              background: "transparent",
              border: "2px solid #666",
              borderRadius: 8,
              color: "#999",
              fontSize: 16,
              fontWeight: "bold",
              cursor: "pointer"
            }}
          >
            Cancel
          </button>
          
          <button
            onClick={() => {
              setAdjustmentValue(0);
              setRoundingOption("none");
              setShowPreview(false);
            }}
            style={{
              padding: "12px 24px",
              background: "transparent",
              border: "2px solid #f59e0b",
              borderRadius: 8,
              color: "#f59e0b",
              fontSize: 16,
              fontWeight: "bold",
              cursor: "pointer"
            }}
          >
            Reset
          </button>
          
          <button
            onClick={handleApply}
            disabled={!showPreview}
            style={{
              padding: "12px 24px",
              background: showPreview ? "#10b981" : "#555",
              border: "none",
              borderRadius: 8,
              color: "#fff",
              fontSize: 16,
              fontWeight: "bold",
              cursor: showPreview ? "pointer" : "not-allowed",
              opacity: showPreview ? 1 : 0.5
            }}
          >
            Apply Adjustment
          </button>
        </div>
      </div>
    </div>
  );
}

const quickButtonStyle = {
  padding: "6px 12px",
  background: "transparent",
  border: "1px solid #555",
  borderRadius: 4,
  color: "#999",
  fontSize: 12,
  cursor: "pointer",
  transition: "all 0.2s"
};

const roundingButtonStyle = {
  padding: "8px 12px",
  border: "2px solid #8b5cf6",
  borderRadius: 6,
  fontSize: 13,
  fontWeight: "bold",
  cursor: "pointer",
  transition: "all 0.2s"
};