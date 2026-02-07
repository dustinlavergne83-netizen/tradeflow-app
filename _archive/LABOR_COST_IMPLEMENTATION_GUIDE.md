# Labor Cost & Markup Implementation Guide

## Step 1: Run SQL Migration ✅
**File: `ADD_LABOR_COST_FIELDS.sql`**
- Go to Supabase Dashboard → SQL Editor
- Run the migration
- This adds: labor_cost_rate, labor_markup_percent, labor_budget_total

---

## Step 2: Update EstimateSummary Component

### A. Add State Variables
**Location:** After line with `const [profitPercent, setProfitPercent] = useState(15);`

```javascript
const [laborCostRate, setLaborCostRate] = useState(25); // What you PAY per hour
const [laborMarkupPercent, setLaborMarkupPercent] = useState(50); // Markup %
```

### B. Update loadSummaryData Function
**Location:** Inside `loadSummaryData()`, after loading overheadPercent and profitPercent

```javascript
setLaborCostRate(estimateData.labor_cost_rate || 25);
setLaborMarkupPercent(estimateData.labor_markup_percent || 50);
```

### C. Update autoSaveSummary Function
**Location:** Inside the update object, after profit_percent

```javascript
labor_cost_rate: laborCostRate,
labor_markup_percent: laborMarkupPercent,
labor_budget_total: laborBudgetTotal,
```

### D. Add Calculations (before the return statement)
```javascript
// Calculate labor budget (internal cost)
const totalLaborHours = sections.reduce((sum, section) => {
  return sum + section.items.reduce((itemSum, item) => {
    const qty = Number(item.qty || 0);
    const hours = Number(item.labor_hours || 0);
    const multiplier = Number(item.labor_multiplier || 1);
    return itemSum + (qty * hours * multiplier);
  }, 0);
}, 0);

const laborBudgetTotal = totalLaborHours * laborCostRate;
const laborSellPrice = laborBudgetTotal * (1 + laborMarkupPercent / 100);
const laborProfit = laborSellPrice - laborBudgetTotal;
```

---

## Step 3: Add UI Input Fields

### Location: In the summary section, after Material Markup input

```javascript
{/* Labor Cost Rate */}
<div style={{ marginBottom: 16 }}>
  <label style={{ display: "block", marginBottom: 4, fontSize: 14, color: "#666" }}>
    Labor Cost Rate ($/hr) - What you PAY:
  </label>
  <input
    type="number"
    value={laborCostRate}
    onChange={(e) => setLaborCostRate(Number(e.target.value))}
    style={{
      width: "100%",
      padding: "8px 12px",
      border: "1px solid #ddd",
      borderRadius: 6,
      fontSize: 15,
    }}
    step="0.01"
    min="0"
  />
</div>

{/* Labor Markup Percent */}
<div style={{ marginBottom: 16 }}>
  <label style={{ display: "block", marginBottom: 4, fontSize: 14, color: "#666" }}>
    Labor Markup %:
  </label>
  <input
    type="number"
    value={laborMarkupPercent}
    onChange={(e) => setLaborMarkupPercent(Number(e.target.value))}
    style={{
      width: "100%",
      padding: "8px 12px",
      border: "1px solid #ddd",
      borderRadius: 6,
      fontSize: 15,
    }}
    step="0.01"
    min="0"
  />
</div>
```

---

## Step 4: Update Display Section

### Add Labor Breakdown (after Material Subtotal display)

```javascript
{/* Labor Breakdown */}
<div style={{ padding: "12px 16px", backgroundColor: "#f0f9ff", borderRadius: 8, marginBottom: 12 }}>
  <div style={{ fontWeight: "bold", marginBottom: 8, color: "#0369a1" }}>
    Labor Breakdown:
  </div>
  
  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: 4 }}>
    <span>Total Labor Hours:</span>
    <span style={{ fontWeight: "600" }}>{totalLaborHours.toFixed(2)} hrs</span>
  </div>
  
  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: 4 }}>
    <span>Cost Rate:</span>
    <span style={{ fontWeight: "600" }}>${laborCostRate.toFixed(2)}/hr</span>
  </div>
  
  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: 8, paddingBottom: 8, borderBottom: "1px solid #bae6fd" }}>
    <span style={{ fontWeight: "bold", color: "#ef4444" }}>Labor Budget (Cost):</span>
    <span style={{ fontWeight: "bold", color: "#ef4444" }}>${laborBudgetTotal.toFixed(2)}</span>
  </div>
  
  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: 4 }}>
    <span>Markup:</span>
    <span style={{ fontWeight: "600" }}>{laborMarkupPercent.toFixed(0)}%</span>
  </div>
  
  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: 8, paddingBottom: 8, borderBottom: "1px solid #bae6fd" }}>
    <span style={{ fontWeight: "bold", color: "#10b981" }}>Labor Sell Price:</span>
    <span style={{ fontWeight: "bold", color: "#10b981" }}>${laborSellPrice.toFixed(2)}</span>
  </div>
  
  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
    <span style={{ fontWeight: "bold" }}>Labor Profit:</span>
    <span style={{ fontWeight: "bold", color: "#8b5cf6" }}>${laborProfit.toFixed(2)}</span>
  </div>
</div>
```

---

## Step 5: Update Final Totals

### Change the subtotal calculation to use laborSellPrice instead of old labor calculation

Find where subtotal is calculated and update:

```javascript
const subtotal = materialSubtotal + laborSellPrice; // Use sell price, not budget
```

---

## What This Gives You:

### Example with 100 hours:
- **Labor Hours:** 100 hrs
- **Cost Rate:** $25/hr
- **Labor Budget (Cost):** $2,500 ← YOUR internal cost
- **Markup:** 50%
- **Labor Sell Price:** $3,750 ← Customer pays
- **Labor Profit:** $1,250

### Then Materials + Overhead + Profit applied to create final estimate

---

## Benefits:

✅ **Accurate Budget** - Know your real labor costs  
✅ **Flexible Pricing** - Adjust markup per estimate  
✅ **Profit Tracking** - See labor profit separately  
✅ **Professional** - Sell price to customer, cost tracked internally  

---

## Testing:

1. Run SQL migration
2. Make changes to Estimate.jsx
3. Open an estimate
4. Go to Summary tab
5. Enter Labor Cost Rate: $25
6. Enter Labor Markup: 50%
7. Verify calculations show correctly
8. Save and reload - verify fields persist

---

## Need Help?

The changes are in EstimateSummary component in src/pages/Estimate.jsx. Look for:
- State variables section
- loadSummaryData function
- autoSaveSummary function
- Calculation section
- UI input section
- Display section

All changes follow the same pattern as overheadPercent and profitPercent!
