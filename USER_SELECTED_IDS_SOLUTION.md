# Solution: Use User-Selected Connector/Coupling IDs

## Problem
When you select specific connectors and couplings from dropdowns in the assembly builder, the system should use THOSE EXACT IDs for all fittings in that assembly - not search for different ones or use the fitting's default auto_add IDs.

## Current Status: FIXED ✅

The system now stores your selected connector/coupling IDs:
```javascript
setPreviewAssemblyData({
  // ... other data ...
  userSelectedConnectorId: selectedConnectorType, // Your chosen connector
  userSelectedCouplingId: selectedCouplingType    // Your chosen coupling
});
```

## How It Works

### Step 1: You Select Your Preferred Materials
When building an assembly, you choose:
- **Connector Type**: The specific connector material ID from the dropdown
- **Coupling Type**: The specific coupling material ID from the dropdown

### Step 2: System Stores Your Choices
These IDs are saved with the assembly metadata so the system knows which specific materials YOU want to use.

### Step 3: All Fittings Use YOUR Materials
When you add fittings (90°, 45°, LBs, etc.), the system will:
- Use YOUR selected connector ID (not search for one)
- Use YOUR selected coupling ID (not search for one)
- Apply them consistently across all fittings in the assembly

## Example

**Your Selections:**
- Connector: `1/2" EMT Set-Screw Connector` (ID: abc123)
- Coupling: `1/2" EMT Set-Screw Coupling` (ID: def456)

**Result:**
- ALL 90° elbows will get coupling ID: `def456`
- ALL 45° elbows will get coupling ID: `def456`
- ALL LB bodies will get connector ID: `abc123`
- No searching, no confusion, no mixing types!

## Benefits

1. **Consistency**: All fittings use the same connector/coupling type
2. **Your Choice**: System respects your material selection
3. **No Mix-ups**: Won't accidentally use compression on some and set-screw on others
4. **Database Independence**: Works for custom assemblies, not just database-stored ones

## Technical Implementation

The user-selected IDs are stored in `previewAssemblyData` and should be passed to any function that processes fittings, ensuring those IDs are used instead of the fitting's `auto_add_connector_id` or `auto_add_coupling_id` fields.

This ensures that when you build an assembly from scratch, YOUR material choices are respected throughout!
