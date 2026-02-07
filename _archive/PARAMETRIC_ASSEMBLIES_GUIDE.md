# Parametric Assemblies Guide

## Overview
Parametric assemblies allow you to create assemblies where component quantities are automatically calculated based on the measurement length. Perfect for electrical conduit runs where you need couplings, supports, and other materials that scale with the run length.

## Quick Start

### Step 1: Run the Database Migration
```sql
-- Copy and paste this into your Supabase SQL Editor:
-- Located in: supabase/migrations/064_add_parametric_assemblies.sql
```

Go to your Supabase dashboard → SQL Editor → Paste the migration → Run

### Step 2: Create a Parametric Assembly in Takeoff

When making a length measurement, click **"🔧 Create Assembly"** and you'll see:

**Component Quantity Types:**
- **Fixed**: Static quantity (e.g., "2" junction boxes regardless of length)
- **Per Foot**: Quantity multiplied by measured feet (e.g., 1 wire × 150 ft = 150 ft of wire)
- **Per 10 Feet**: One unit per 10 feet (e.g., 1 coupling per 10-foot stick = 15 couplings for 150 ft)
- **Per 100 Feet**: One unit per 100 feet (e.g., 1 pull box every 100 feet)
- **Per Unit**: Multiplied by base assembly quantity

## Real-World Example: 3/4" EMT Conduit Run

### Assembly: "3/4″ EMT with 3-#12 THHN"

| Component | Qty Type | Base Qty | Description |
|-----------|----------|----------|-------------|
| 3/4" EMT Conduit | Per Foot | 1.0 | Conduit runs the full length |
| 3/4" EMT Coupling | Per 10 Feet | 1.0 | 1 coupling needed per 10-foot stick |
| #12 THHN Wire (Black) | Per Foot | 1.0 | Hot wire runs full length |
| #12 THHN Wire (White) | Per Foot | 1.0 | Neutral runs full length |
| #12 THHN Wire (Green) | Per Foot | 1.0 | Ground runs full length |
| 3/4" Beam Clamp | Per 10 Feet | 1.0 | Support every 10 feet |
| 3/4" One-Hole Strap | Per 10 Feet | 2.0 | 2 straps per 10 feet |

### What Happens When You Measure 147 Feet?

The system automatically calculates:
- **147 ft** of 3/4" EMT Conduit
- **15** couplings (147 ÷ 10 = 14.7, rounded up to 15)
- **147 ft** of each wire color (Black, White, Green)
- **15** beam clamps
- **30** one-hole straps (15 × 2)

## Benefits

✅ **Save Time**: Set up once, use forever
✅ **Consistency**: No more forgetting couplings or supports  
✅ **Accuracy**: Automatic calculation prevents errors
✅ **Reusable**: Assembly saved permanently in your database

## Tips

- Start with common runs you do frequently (1/2" EMT, 3/4" EMT, 1" EMT, etc.)
- Include ALL materials: conduit, wire, fittings, supports, connectors
- Use descriptive names: "3/4″ EMT - 3 wire" vs "1″ EMT - 6 wire"
- Set the description field to remind yourself: "1 coupling per 10-foot stick"

## Advanced: Custom Formulas (Future)

The `quantity_formula` field is reserved for future custom calculations like:
- `CEIL(length/10)` - Round up to nearest 10
- `FLOOR(length/6) * 2` - 2 supports every 6 feet
- `IF(length > 100, 2, 1)` - Conditional quantities

*This feature will be added in a future update.*
