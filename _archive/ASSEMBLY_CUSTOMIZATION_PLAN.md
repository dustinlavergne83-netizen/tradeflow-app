# Assembly Customization Enhancement Plan

## Overview
Enhance the "Create Quick Assembly" modal to allow users to customize conduit assemblies with connectors, couplings, straps, and fittings.

## Step-by-Step Implementation

### Step 1: Add State Variables ✅
Add these new state variables to Takeoff.jsx:
```javascript
// Connector customization
const [selectedConnectorType, setSelectedConnectorType] = useState(null);
const [connectorQty, setConnectorQty] = useState('');

// Coupling customization  
const [selectedCouplingType, setSelectedCouplingType] = useState(null);
const [couplingQtyPer10ft, setCouplingQtyPer10ft] = useState('');

// Strap customization
const [selectedStrapType, setSelectedStrapType] = useState(null);
const [strapQtyPer10ft, setStrapQtyPer10ft] = useState('');

// Fitting quantities
const [fitting90Qty, setFitting90Qty] = useState('');
const [fitting45Qty, setFitting45Qty] = useState('');
const [fittingLBQty, setFittingLBQty] = useState('');
const [fittingLLQty, setFittingLLQty] = useState('');
const [fittingLRQty, setFittingLRQty] = useState('');

// Track selected base assembly
const [selectedBaseAssembly, setSelectedBaseAssembly] = useState(null);
```

### Step 2: Add UI Fields to Modal
In the Quick Assembly Modal, add conditional rendering:
- Show customization fields when a "Conduit & Wire" assembly is selected
- Add connector dropdown + qty input
- Add coupling dropdown + qty/10ft input
- Add strap dropdown + qty/10ft input
- Add fitting qty inputs (90, 45, LB, LL, LR)

### Step 3: Populate Dropdowns
Filter materials to populate:
- **Connectors**: Filter by category and conduit size
- **Couplings**: Filter by category and conduit size
- **Straps**: Filter by category and conduit size

### Step 4: Build Component List
When "Create & Add to Measurement" is clicked:
1. Start with base assembly components (conduit + wire)
2. Add selected connector with specified qty
3. Add selected coupling with qty per 10ft
4. Add selected strap with qty per 10ft
5. Add fittings with specified quantities

### Step 5: Calculate Quantities & Auto-Add Components
- Connectors: Use specified qty (e.g., "2" = 2 total)
- Couplings: per_10_feet type (e.g., "1" = 1 per 10ft)
- Straps: per_10_feet type (e.g., "3" = 3 per 10ft)
- Fittings: fixed type (e.g., "4" = 4 total 90's)

**Smart Auto-Calculation:**
- ✨ **90° or 45° fitting added** → Auto-add 1 coupling (same type as selected for run)
- ✨ **Body (LB/LL/LR) added** → Auto-add 2 connectors (same type as selected for run)

**Example:**
User selects:
- Base: 1-1/2" EMT with 4-#6 THHN
- Connector: Set Screw (qty 2)
- Coupling: Set Screw (1 per 10ft)
- Strap: 1-hole (3 per 10ft)
- Fittings: 3× 90° elbows, 1× LB body

**Result:**
1. 1-1/2" EMT conduit (1 per ft)
2. #6 THHN wire (4 per ft)
3. Set Screw Connector (2 + 2 from LB = 4 total)
4. Set Screw Coupling (1 per 10ft + 3 from elbows = 3 fixed + 0.1 per ft)
5. 1-hole Strap (3 per 10ft)
6. 90° Elbow (3 fixed)
7. LB Body (1 fixed)

## Current Status
- ✅ Base conduit+wire assemblies imported
- ⏳ Next: Add state variables and UI fields
