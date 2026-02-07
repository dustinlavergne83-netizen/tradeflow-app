# Conduit Assembly System - Correct Design

## User's Workflow Requirements

### What the User Wants:
1. Draw a conduit line (e.g., 100 feet of 3/4" EMT)
2. Select a **BASE ASSEMBLY** containing only:
   - Conduit (calculated per foot)
   - Wire (calculated per foot)
3. In ONE modal, build the complete run by adding:
   - **Fittings** (90° Ells, 45° Ells, etc.) - choose type, enter quantity, select calculation method
   - **Connectors** (Set Screw, Compression, etc.) - choose type, enter quantity, select calculation method
   - **Couplings** (Set Screw, Compression, etc.) - choose type, enter quantity, select calculation method
   - **Straps** (1-Hole, 2-Hole, etc.) - choose type, enter quantity, select calculation method
4. Save everything as one measurement with all components

### Example: 100-foot run of 3/4" EMT with 3-#12 THHN

**Step 1:** Draw 100-foot line

**Step 2:** Select assembly: "3/4" EMT with 3-#12 THHN"
- This assembly contains ONLY:
  - 3/4" EMT Conduit: 1 ft per foot
  - #12 THHN Wire (Black): 1 ft per foot
  - #12 THHN Wire (White): 1 ft per foot
  - #12 THHN Wire (Green): 1 ft per foot

**Step 3:** ONE modal opens showing:

```
┌─────────────────────────────────────────────────────────┐
│  Save Length Measurement - 100.0 feet                   │
├─────────────────────────────────────────────────────────┤
│  Base Assembly: 3/4" EMT with 3-#12 THHN                │
│                                                          │
│  ✓ 3/4" EMT Conduit: 100 ft                             │
│  ✓ #12 THHN Wire (Black): 100 ft                        │
│  ✓ #12 THHN Wire (White): 100 ft                        │
│  ✓ #12 THHN Wire (Green): 100 ft                        │
├─────────────────────────────────────────────────────────┤
│  Add Components:                                         │
│                                                          │
│  Category: [Fittings ▼]                                 │
│  Material: [3/4" EMT 90° Ell - Set Screw ▼]            │
│  Quantity: [4]   Type: [Fixed ▼]                        │
│  [+ Add Component]                                       │
│                                                          │
│  Added Components:                                       │
│  • 3/4" EMT 90° Ell - Set Screw: 4 ea (Fixed)          │
│  • 3/4" Set Screw Coupling: 10 ea (Fixed)               │
│  • 3/4" Set Screw Connector: 2 ea (Fixed)               │
│  • 1-Hole Strap: 1 ea (Per 10 Feet) = 10 ea total      │
│                                                          │
│  [Cancel]  [Save Measurement]                            │
└─────────────────────────────────────────────────────────┘
```

**Step 4:** All components export to estimate with correct quantities

## Implementation Plan

### 1. Assembly Structure (Minimal - Just Conduit + Wire)

Create simple assemblies in Assembly Manager:
- "3/4" EMT with 1-#12 THHN"
- "3/4" EMT with 2-#12 THHN"
- "3/4" EMT with 3-#12 THHN"
- "1" EMT with 3-#12 THHN"
- "1" EMT with 4-#12 THHN"
- etc.

Each assembly contains ONLY:
- EMT Conduit (1 ft per foot)
- Wire(s) (1 ft per foot each)

### 2. Custom Length Measurement Modal

Replace the current measurement modal with a new design:

**Top Section** (Read-only - shows base assembly):
- Display measurement distance
- Show selected base assembly name
- List base components with calculated quantities

**Middle Section** (Component Builder):
- Category dropdown (filtered to: Fittings, Connectors, Couplings, Straps, Boxes, etc.)
- Material dropdown (filtered by selected category, filtered by conduit size)
- Quantity input field
- Quantity Type dropdown (Fixed, Per Foot, Per 10 Feet, Per 100 Feet)
- "Add Component" button

**Bottom Section** (Added Components List):
- Show list of added components
- Each row shows: Material name, quantity, calculation type, calculated total
- Remove button for each component
- Total material and labor cost preview

### 3. Smart Component Filtering

When user selects base assembly "3/4" EMT with 3-#12 THHN":
- Extract conduit size: "3/4""
- Filter available fittings/connectors/couplings/straps to only show 3/4" size
- This prevents selecting 1" fittings for a 3/4" conduit run

### 4. Database Schema (Already Correct!)

Current schema is perfect - no changes needed:
- `assemblies` table for base assemblies
- `assembly_components` table for conduit + wire
- `plan_measurements.materials` JSONB stores the complete run with all components

### 5. Benefits of This Approach

✅ **Flexible**: User can choose any fitting/connector type each time
✅ **Fast**: One modal, all components added at once
✅ **Smart**: Size filtering prevents mistakes
✅ **Reusable**: Base assemblies are simple and reusable
✅ **No Parametric Complexity**: No qty=0 components or complex auto-increment logic

## Next Steps

1. ✅ Document the correct design (this file)
2. Create minimal EMT assemblies (just conduit + wire)
3. Modify the length measurement modal to match new design
4. Add component builder UI with category/material/quantity/type selectors
5. Add smart filtering by conduit size
6. Test the complete workflow

## CSV Template for Base Assemblies

```csv
assembly_name,category,description,component_material_name,quantity,quantity_type,unit
3/4" EMT with 1-#12 THHN,CONDUIT/WIRE,3/4" EMT conduit with 1 #12 THHN wire,3/4" EMT Conduit,1,per_foot,ft
3/4" EMT with 1-#12 THHN,CONDUIT/WIRE,3/4" EMT conduit with 1 #12 THHN wire,#12 THHN Wire (Black),1,per_foot,ft
3/4" EMT with 2-#12 THHN,CONDUIT/WIRE,3/4" EMT conduit with 2 #12 THHN wires,3/4" EMT Conduit,1,per_foot,ft
3/4" EMT with 2-#12 THHN,CONDUIT/WIRE,3/4" EMT conduit with 2 #12 THHN wires,#12 THHN Wire (Black),1,per_foot,ft
3/4" EMT with 2-#12 THHN,CONDUIT/WIRE,3/4" EMT conduit with 2 #12 THHN wires,#12 THHN Wire (White),1,per_foot,ft
```

This design eliminates the complexity of parametric components while giving the user complete control!
