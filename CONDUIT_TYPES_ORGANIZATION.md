# Conduit Assembly Organization - EMT, Rigid, & PVC

## Decision: Separate Assemblies for Each Conduit Type ✅

You'll create **separate assemblies** for EMT, Rigid, and PVC because:

### Why Separate Assemblies?

1. **Different Fittings:**
   - EMT → Set Screw or Compression fittings
   - Rigid → Threaded fittings
   - PVC → Solvent weld fittings (no threads)

2. **Different Costs:**
   - Rigid is more expensive than EMT
   - PVC is cheapest but has different installation labor

3. **Faster Workflow:**
   - Just select "3/4" Rigid with 3-#12 THHN" (done!)
   - vs. select size → select conduit type → select wires (extra steps)

4. **Clear Organization:**
   - Assemblies list shows: EMT group, Rigid group, PVC group
   - Easy to find what you need

## Assembly Naming Convention

Use this format: **`{Size} {Type} with {Wire Count}-#{Wire Size} {Wire Type}`**

### EMT Assemblies:
```
3/4" EMT with 2-#12 THHN
3/4" EMT with 3-#12 THHN
3/4" EMT with 4-#12 THHN
1" EMT with 3-#12 THHN
1" EMT with 4-#12 THHN
1" EMT with 6-#12 THHN
1-1/4" EMT with 6-#10 THHN
1-1/2" EMT with 8-#10 THHN
2" EMT with 12-#10 THHN
```

### Rigid Assemblies:
```
3/4" Rigid with 2-#12 THHN
3/4" Rigid with 3-#12 THHN
1" Rigid with 3-#12 THHN
1" Rigid with 4-#12 THHN
1-1/4" Rigid with 4-#10 THHN
1-1/2" Rigid with 6-#10 THHN
2" Rigid with 8-#10 THHN
2-1/2" Rigid with 12-#10 THHN
3" Rigid with 16-#10 THHN
```

### PVC Assemblies (Underground/Wet Locations):
```
3/4" PVC with 2-#12 THWN
3/4" PVC with 3-#12 THWN
1" PVC with 3-#12 THWN
1" PVC with 4-#12 THWN
1-1/4" PVC with 4-#10 THWN
1-1/2" PVC with 6-#10 THWN
2" PVC with 8-#10 THWN
2-1/2" PVC with 12-#10 THWN
3" PVC with 16-#10 THWN
```

*Note: PVC uses THWN (wet location rated) instead of THHN*

## Assembly Components Structure

Each assembly contains ONLY conduit + wire:

**Example: "3/4" EMT with 3-#12 THHN"**
- 3/4" EMT Conduit: 1 ft per foot
- #12 THHN Wire (Black): 1 ft per foot
- #12 THHN Wire (White): 1 ft per foot
- #12 THHN Wire (Green): 1 ft per foot

## Workflow When Measuring

1. **Draw 100-foot line** on plan
2. **Select assembly:** "3/4" EMT with 3-#12 THHN"
3. **Base components calculated automatically:**
   - ✓ 100 ft of 3/4" EMT Conduit
   - ✓ 100 ft each of Black, White, Green #12 THHN
4. **Add components in modal:**
   - Category: **EMT Fittings** ▼
   - Material: **3/4" EMT 90° Ell - Set Screw** ▼
   - Quantity: **4**
   - Type: **Fixed** ▼
   - [+ Add Component]

The component dropdown is **filtered by conduit type**:
- EMT assembly → Shows EMT fittings only
- Rigid assembly → Shows Rigid fittings only
- PVC assembly → Shows PVC fittings only

## Benefits of This Approach

✅ **Speed:** 2 clicks to select right assembly (size + type combined)
✅ **Accuracy:** Can't accidentally mix EMT fittings with Rigid conduit
✅ **Clarity:** Assembly list clearly shows what's available
✅ **Flexibility:** Still add any fittings/straps you need each time
✅ **Reusable:** Create once, use forever

## Category Organization in Materials

Your assemblies should be in categories:
- **CONDUIT/WIRE - EMT**
- **CONDUIT/WIRE - RIGID**
- **CONDUIT/WIRE - PVC**

This keeps them organized and easy to browse in the assembly selector.

## Start Small, Expand Later

**Phase 1 (Start Here):**
Create just the most common sizes you use:
- 3/4" EMT with 3-#12 THHN
- 1" EMT with 4-#12 THHN
- 1" Rigid with 4-#12 THHN
- 2" PVC with 8-#10 THWN

**Phase 2 (Add As Needed):**
Add more sizes/wire counts as you encounter them in projects.

## Next Steps

1. Use Assembly Manager or SQL to create your first few assemblies
2. Test in Digital Takeoff
3. Add more assemblies as you need them
4. Eventually you'll have a complete library for all your standard conduit runs!
