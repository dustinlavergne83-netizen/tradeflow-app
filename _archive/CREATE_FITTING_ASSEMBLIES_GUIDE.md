# Creating Fitting Assemblies for Takeoff

## Better Approach: Pre-Built Fitting Assemblies

Instead of auto-detecting fittings, create assemblies that include everything needed:

### Example Assemblies to Create:

#### 1. **2" EMT LB Body Assembly**
- Components:
  - 2" EMT LB Body (1 ea)
  - 2" EMT Set Screw Connector (2 ea)

#### 2. **2" EMT 90° Elbow Assembly**
- Components:
  - 2" EMT 90° Elbow (1 ea)
  - 2" EMT Set Screw Coupling (1 ea)

#### 3. **2" EMT T Body Assembly**
- Components:
  - 2" EMT T Body (1 ea)
  - 2" EMT Set Screw Connector (3 ea)

## How to Create These Assemblies:

1. **Navigate to Assembly Manager:**
   - Go to Admin → Assembly Manager in the sidebar

2. **Create New Assembly:**
   - Click "Create New Assembly"
   - Name: "2" EMT LB Body Assembly" (or similar)
   - Category: "Fittings" (or "Conduit Fittings")
   - Unit: "ea"

3. **Add Components:**
   - Click "Add Component"
   - Select the LB body material
   - Quantity: 1, Type: Fixed
   - Click "Add Component" again
   - Select the connector material
   - Quantity: 2, Type: Fixed
   - Save Assembly

4. **Repeat for Other Fittings:**
   - Create assemblies for all common fittings (90°, 45°, LB, LL, LR, T, C, etc.)
   - For each size you commonly use (3/4", 1", 1-1/4", 1-1/2", 2", etc.)

## Usage in Takeoff:

When you use the parametric assembly modal in takeoff:
- Instead of selecting individual elbows/bodies, select the complete assembly
- The quantity you enter will automatically include all components
- Example: Enter 3 for "2" EMT LB Body Assembly" → You get 3 LB bodies + 6 connectors

## Benefits:

✅ **Accurate:** Never forget connectors or couplings
✅ **Consistent:** Same materials every time
✅ **Fast:** Select one assembly instead of multiple materials
✅ **Flexible:** Can adjust component quantities if needed
✅ **Reusable:** Use across all projects

## Recommended Assemblies to Create:

For each conduit size (3/4", 1", 1-1/4", 1-1/2", 2", 2-1/2", 3", 4"):
- 90° Elbow Assembly (elbow + coupling)
- 45° Elbow Assembly (elbow + coupling)
- LB Body Assembly (body + 2 connectors)
- LL Body Assembly (body + 2 connectors)
- LR Body Assembly (body + 2 connectors)
- T Body Assembly (body + 3 connectors)
- C Body Assembly (body + 2 connectors)

You can also create more complex assemblies:
- "Home Run Assembly" (conduit + wire + fittings)
- "Typical Branch Circuit" (conduit + wire + box + device)
