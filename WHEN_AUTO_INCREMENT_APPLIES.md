# When Does Auto-Increment Apply?

## ✅ YES - Auto-Increment Applies When:

### Building Assemblies in the UI
When you're creating a new conduit/wire assembly and you:
1. Add a 90° elbow → System auto-adds 1 coupling
2. Add a 45° elbow → System auto-adds 1 coupling  
3. Add an LB/LL/LR body → System auto-adds 2 connectors

### Using Assemblies in Takeoff
When you use an assembly on a takeoff measurement:
- The assembly calculates quantities based on length
- Auto-added items scale with the measurement

## ❌ NO - Auto-Increment Does NOT Apply To:

### Individual Material Orders
- Buying materials directly (not part of an assembly)
- Single-line items in estimates
- Stand-alone purchases

### Existing Data
- Assemblies already created
- Completed estimates
- Historical data

### Manual Entries
- When you manually add materials to a measurement
- When you override the assembly and customize it

## 🎯 The Flow:

1. **You build an assembly** → Select conduit, wires, fittings
2. **System checks:** "Does this fitting need couplings/connectors?"
3. **System uses:**
   - Your dropdown selection (if you chose one), OR
   - The database default (from auto_add fields)
4. **Result:** Fittings automatically get their connectors/couplings

## Example:

**Building "1/2" EMT with 3-#12 THHN":**
- Add 3/4" EMT conduit ✓
- Add 3x #12 THHN wire ✓
- Add 3x 90° elbows → **Auto-adds 3 couplings**
- Add 1x LB body → **Auto-adds 2 connectors**

**Result:** Assembly has all materials, properly calculated!

**Using that assembly on a 50-foot run:**
- Conduit: 50 ft (rounded to 50)
- Wire: 150 ft (3 wires × 50 ft)
- 90° elbows: 3 ea
- **Couplings: 3 ea** (auto-added)
- LB body: 1 ea
- **Connectors: 2 ea** (auto-added)

This makes creating assemblies faster and ensures nothing is forgotten!
