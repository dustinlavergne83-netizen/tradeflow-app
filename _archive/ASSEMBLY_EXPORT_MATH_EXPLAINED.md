# Assembly Export Math - How It Works

## The Fix Applied

We now calculate **per-foot values** for the parent assembly row, so when you change the quantity in the Estimate, everything calculates correctly.

## Example: 180 ft Feeder Run

### From Takeoff:
- **Measurement Length**: 180 ft
- **Total Material Cost** (sum of all children): $5,320.00
- **Total Labor Hours** (sum of all children): 84.88 hrs

### What Gets Stored in Database:

#### Parent Row:
```javascript
description: "f (180 ft Feeder) (180 ft)"  // Shows length in description
quantity: 180                               // Measurement length
unit: "ft"                                  // Per foot
material_unit_cost: $29.56                  // $5320 ÷ 180 = $29.56/ft
material_total: $5,320.00                   // Total (pre-calculated)
labor_hours: 0.471                          // 84.88 ÷ 180 = 0.471 hrs/ft
labor_rate: $85                             // Standard rate
labor_total: NOT SET (calculated dynamically)
line_total: $5,320.00                       // Material total only
```

## How Estimate Page Calculates Totals

### When qty = 1 ft:
```
Material Total = 1 × $29.56 = $29.56
Labor Hours = 1 × 0.471 = 0.471 hrs
Labor Cost = 0.471 × $85 = $40.04
Line Total = $29.56 + $40.04 = $69.60
```

### When qty = 180 ft (actual measurement):
```
Material Total = 180 × $29.56 = $5,320.00 ✓
Labor Hours = 180 × 0.471 = 84.78 hrs ≈ 84.88 hrs ✓
Labor Cost = 84.78 × $85 = $7,206.30
Line Total = $5,320.00 + $7,206.30 = $12,526.30
```

### When you change qty to ANY value:
```
Material Total = qty × $29.56
Labor Hours = qty × 0.471
Labor Cost = (qty × 0.471) × $85
Line Total = Material Total + Labor Cost
```

## What Numbers to Put Where

### In the Parent Assembly Row (Estimate Page):

1. **Qty** = Your measurement length (180 ft)
   - Change this to adjust the total
   - Everything else multiplies from here

2. **Material $** = Cost per foot ($29.56/ft)
   - Already set by export
   - This is: Total Material Cost ÷ Length

3. **Lab Hrs** = Hours per foot (0.471 hrs/ft)
   - Already set by export
   - This is: Total Labor Hours ÷ Length

4. **Lab Mult** = Labor multiplier (1.0)
   - Leave at 1.0 unless you want to adjust difficulty
   - Use for conditions (tight space, high ceilings, etc.)

## Testing the Math

Try changing the qty to these values to verify:

- **qty = 1**: Should show $29.56 material, 0.471 hrs labor
- **qty = 100**: Should show $2,956 material, 47.1 hrs labor  
- **qty = 180**: Should show $5,320 material, 84.88 hrs labor ✓
- **qty = 200**: Should show $5,912 material, 94.2 hrs labor

## Why This Works

The per-foot approach allows you to:
1. ✓ See the cost per foot (useful for pricing)
2. ✓ Adjust the quantity up/down
3. ✓ Apply labor multipliers (difficulty adjustment)
4. ✓ Keep accurate totals that match your takeoff

## Summary

**Material Unit Cost** = Total Material ÷ Length  
**Labor Hours** = Total Labor Hours ÷ Length  
**Quantity** = Measurement Length

Everything else multiplies from these three values automatically!
