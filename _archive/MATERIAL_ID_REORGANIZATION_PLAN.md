# Material ID Reorganization Plan

**Purpose:** Establish a consistent, hierarchical naming structure for all electrical materials to make assembly creation easier and more maintainable.

**Status:** ANALYSIS ONLY - No changes have been made yet

---

## 🎯 Core Problem

Currently, material IDs are inconsistent, making it difficult to:
- Filter materials by type/size when building assemblies
- Programmatically find related materials
- Understand material relationships at a glance
- Maintain consistency across the database

---

## 📋 Proposed ID Naming Convention

### Pattern Structure
```
{type}_{size}_{component}_{variant}
```

### Rules
1. **All lowercase** - no uppercase letters
2. **Underscores only** - no spaces or special characters
3. **Hierarchical** - most general to most specific (left to right)
4. **Filterable** - prefix matching enables easy lookups
5. **Concise** - keep IDs under 40 characters
6. **Consistent sizing** - use decimal notation (0_5, 0_75, 1_0, 1_25, etc.)

---

## 🔌 Conduit Material IDs

### EMT (Electrical Metallic Tubing)

#### Base Pattern: `emt_{size}_{component}_{variant}`

**Size Notation:**
- 1/2" → `0_5`
- 3/4" → `0_75`
- 1" → `1_0`
- 1-1/4" → `1_25`
- 1-1/2" → `1_5`
- 2" → `2_0`
- 2-1/2" → `2_5`
- 3" → `3_0`
- 3-1/2" → `3_5`
- 4" → `4_0`

**Component Types:**
```
conduit          - Base conduit pipe
connector        - Box/device connectors
coupling         - Coupling fittings
elbow_90         - 90° elbows
elbow_45         - 45° elbows
lb               - LB conduit bodies
ll               - LL conduit bodies
lr               - LR conduit bodies
t                - T conduit bodies
c                - C conduit bodies
strap            - Straps/clamps
bushing          - Insulating bushings
offset           - Offset connectors
```

**Variants (optional):**
```
setscrew         - Set screw type
compression      - Compression type
insulated        - Insulated type
steel            - Steel material
malleable        - Malleable iron
one_hole         - One hole strap
two_hole         - Two hole strap
```

**Examples:**
```
emt_0_5              → 1/2" EMT Conduit
emt_0_5_connector    → 1/2" EMT Connector
emt_0_5_coupling     → 1/2" EMT Coupling
emt_0_5_elbow_90     → 1/2" EMT 90° Elbow
emt_0_5_lb           → 1/2" EMT LB Fitting
emt_0_5_strap        → 1/2" EMT Strap (generic)
emt_0_5_strap_1hole  → 1/2" EMT One-Hole Strap
emt_0_75             → 3/4" EMT Conduit
emt_0_75_elbow_90    → 3/4" EMT 90° Elbow
emt_1_0              → 1" EMT Conduit
emt_2_0_elbow_90     → 2" EMT 90° Elbow
```

**Benefit:** Can filter all 1/2" EMT fittings with:
```javascript
materials.filter(m => m.id.startsWith('emt_0_5_'))
```

### Rigid Conduit

#### Base Pattern: `rigid_{size}_{component}_{variant}`

**Component Types:**
```
conduit          - Base rigid conduit
coupling         - Threaded couplings
elbow_90         - 90° elbows
elbow_45         - 45° elbows
lb               - LB conduit bodies
ll               - LL conduit bodies
lr               - LR conduit bodies
strap            - Straps/clamps
bushing          - Insulating/grounding bushings
locknut          - Locknuts
nipple           - Close/chase nipples
reducer          - Reducing fittings
union            - Unions
```

**Examples:**
```
rigid_0_5                → 1/2" Rigid Conduit
rigid_0_5_coupling       → 1/2" Rigid Coupling
rigid_0_5_elbow_90       → 1/2" Rigid 90° Elbow
rigid_0_5_bushing        → 1/2" Rigid Bushing
rigid_0_5_locknut        → 1/2" Rigid Locknut
rigid_0_75               → 3/4" Rigid Conduit
rigid_1_0                → 1" Rigid Conduit
rigid_2_0_elbow_90       → 2" Rigid 90° Elbow
```

### PVC Conduit

#### Base Pattern: `pvc_{schedule}_{size}_{component}_{variant}`

**Schedule Types:**
```
40               - Schedule 40 (standard)
80               - Schedule 80 (heavy duty)
```

**Component Types:**
```
conduit          - Base PVC conduit
coupling         - Slip couplings
adapter_male     - Male adapters
adapter_female   - Female adapters
elbow_90         - 90° elbows
elbow_45         - 45° elbows
sweep_90         - 90° sweeps (long radius)
lb               - LB conduit bodies
ll               - LL conduit bodies
lr               - LR conduit bodies
strap            - Straps/clamps
cap              - End caps
plug             - Plugs
cement           - PVC cement
primer           - PVC primer
```

**Examples:**
```
pvc_40_0_5               → 1/2" Schedule 40 PVC Conduit
pvc_40_0_5_coupling      → 1/2" Schedule 40 Coupling
pvc_40_0_5_elbow_90      → 1/2" Schedule 40 90° Elbow
pvc_40_0_75              → 3/4" Schedule 40 PVC Conduit
pvc_80_1_0               → 1" Schedule 80 PVC Conduit
pvc_40_2_0_sweep_90      → 2" Schedule 40 90° Sweep
pvc_cement               → PVC Cement
pvc_primer               → PVC Primer
```

---

## 🔌 Wire Material IDs

### Pattern: `wire_{type}_{size}_{color}`

**Wire Types:**
```
thhn             - THHN/THWN-2
thwn             - THWN (when different from THHN)
thhn_stranded    - Stranded THHN
thhn_solid       - Solid THHN
bare_cu          - Bare copper
grounding        - Green ground wire
romex            - NM-B Cable (separate pattern)
mc               - MC Cable (separate pattern)
```

**Size Notation:**
```
14, 12, 10, 8, 6, 4, 2, 1
1_0, 2_0, 3_0, 4_0       (for /0 sizes)
250, 300, 350, 400, 500, 600, 750  (kcmil)
```

**Color Codes:**
```
bk / black
wh / white
rd / red
gn / green
bl / blue
yl / yellow
gy / gray
or / orange
br / brown
bare
```

**Examples:**
```
wire_thhn_12_bk          → #12 THHN Black
wire_thhn_12_wh          → #12 THHN White
wire_thhn_12_gn          → #12 THHN Green (ground)
wire_thhn_10_bk          → #10 THHN Black
wire_thhn_1_0_bk         → 1/0 THHN Black
wire_thhn_250_bk         → 250 kcmil THHN Black
wire_bare_cu_6           → #6 Bare Copper Ground
wire_grounding_10_gn     → #10 Insulated Green Ground
```

**Romex Pattern:** `romex_{size}_{conductors}`
```
romex_14_2               → 14/2 Romex
romex_14_3               → 14/3 Romex
romex_12_2               → 12/2 Romex
romex_12_3               → 12/3 Romex
romex_10_2               → 10/2 Romex
```

**MC Cable Pattern:** `mc_{size}_{conductors}`
```
mc_12_2                  → 12/2 MC Cable
mc_12_3                  → 12/3 MC Cable
mc_10_2                  → 10/2 MC Cable
```

---

## 🔌 Boxes & Enclosures

### Pattern: `box_{type}_{size}_{variant}`

**Examples:**
```
box_1g_nw                → 1-Gang New Work Box
box_1g_ow                → 1-Gang Old Work Box
box_2g_nw                → 2-Gang New Work Box
box_4x4                  → 4"x4" Square Box
box_4x4_ext              → 4"x4" Extension Ring
box_octagon              → Octagon Box
box_ceil_fan             → Ceiling Fan Rated Box
box_weatherproof         → Weatherproof Box
jbox_pvc_6x6             → 6"x6" PVC Junction Box
jbox_metal_8x8           → 8"x8" Metal Junction Box
```

---

## 🔌 Devices & Wiring Accessories

### Receptacles: `rec_{type}_{rating}_{color}`
```
rec_duplex_15a_wh        → 15A Duplex Receptacle White
rec_duplex_20a_wh        → 20A Duplex Receptacle White
rec_gfci_15a_wh          → 15A GFCI Receptacle White
rec_gfci_20a_wh          → 20A GFCI Receptacle White
rec_afci_15a             → 15A AFCI Receptacle
rec_usb_combo_wh         → USB Combo Receptacle White
rec_dryer_30a_4p         → 30A 4-Prong Dryer Receptacle
rec_range_50a_4p         → 50A 4-Prong Range Receptacle
```

### Switches: `sw_{type}_{rating}_{color}`
```
sw_single_15a_wh         → Single Pole Switch White
sw_3way_15a_wh           → 3-Way Switch White
sw_4way_15a_wh           → 4-Way Switch White
sw_dimmer_single_wh      → Single Pole Dimmer White
sw_dimmer_3way_wh        → 3-Way Dimmer White
sw_motion_wh             → Motion Sensor Switch White
sw_timer_wh              → Timer Switch White
```

### Breakers: `brk_{type}_{rating}_{poles}`
```
brk_standard_15a_1p      → 15A Single Pole Breaker
brk_standard_20a_1p      → 20A Single Pole Breaker
brk_standard_30a_2p      → 30A Double Pole Breaker
brk_gfci_20a_1p          → 20A GFCI Breaker
brk_afci_15a_1p          → 15A AFCI Breaker
brk_combo_20a_1p         → 20A AFCI/GFCI Combo Breaker
```

### Wall Plates: `plate_{gang}_{color}`
```
plate_1g_wh              → 1-Gang Wall Plate White
plate_2g_wh              → 2-Gang Wall Plate White
plate_3g_wh              → 3-Gang Wall Plate White
plate_1g_ss              → 1-Gang Stainless Steel
```

---

## 🔌 Fasteners & Hardware

### Pattern: `{type}_{size}_{variant}`

**Examples:**
```
strap_romex              → Romex Cable Staples
strap_conduit_0_5        → 1/2" Conduit Strap
cabletie_8_uv            → 8" UV Resistant Cable Ties
cabletie_12_uv           → 12" UV Resistant Cable Ties
rod_threaded_3_8         → 3/8" Threaded Rod
clamp_beam_3_8           → 3/8" Beam Clamp
anchor_wedge_3_8         → 3/8" Wedge Anchor
anchor_tapcon_1_4        → 1/4" Tapcon Anchor
wirenut_orange           → Orange Wire Nuts
wirenut_yellow           → Yellow Wire Nuts
```

---

## 🔌 Lighting

### Pattern: `light_{type}_{size}_{variant}`

**Examples:**
```
light_can_led_4          → 4" LED Recessed Can
light_can_led_6          → 6" LED Recessed Can
light_flush_led_12       → 12" LED Flush Mount
light_wrap_led_2ft       → 2ft LED Wraparound
light_wrap_led_4ft       → 4ft LED Wraparound
light_highbay_led_150w   → 150W LED High Bay
light_exit_led           → LED Exit Sign
light_emergency_led      → LED Emergency Light
```

---

## 🔌 Panels & Distribution

### Pattern: `panel_{type}_{rating}_{spaces}`

**Examples:**
```
panel_main_100a_20sp     → 100A Main Panel 20 Space
panel_main_200a_40sp     → 200A Main Panel 40 Space
panel_sub_100a_24sp      → 100A Sub Panel 24 Space
disco_nf_60a             → 60A Non-Fused Disconnect
disco_fused_60a          → 60A Fused Disconnect
meter_socket_200a        → 200A Meter Socket
surge_whole_house        → Whole House Surge Protector
```

---

## 📊 Migration Strategy

### Phase 1: Analysis (Current)
- ✅ Document all existing materials
- ✅ Identify pattern inconsistencies
- ✅ Propose new naming convention
- ⏸️ Get stakeholder approval

### Phase 2: Prepare Migration Scripts
- Create UPDATE statements for each material category
- Map old IDs to new IDs
- Create validation queries
- Test on backup database

### Phase 3: Update Assembly References
- Update assembly_components table to use new material IDs
- Verify all assembly references are maintained
- Create views/functions for backward compatibility if needed

### Phase 4: Execute Migration
- Backup database
- Run migration scripts
- Verify data integrity
- Update any application code that references specific IDs

### Phase 5: Documentation
- Update all documentation with new ID patterns
- Create material ID lookup guide
- Train users on new system

---

## 🎯 Benefits of This System

### 1. **Easy Filtering**
```javascript
// Get all 3/4" EMT fittings
const fittings = materials.filter(m => m.id.startsWith('emt_0_75_'));

// Get all EMT materials
const emtMaterials = materials.filter(m => m.id.startsWith('emt_'));

// Get all #12 wire
const wire12 = materials.filter(m => m.id.includes('_12_'));
```

### 2. **Predictable IDs**
- Know what the ID should be before looking it up
- Reduce errors when manually creating assemblies
- Easier to write import scripts

### 3. **Self-Documenting**
- ID tells you what the material is
- No need to read full name for basic info
- Easier to debug issues

### 4. **Assembly Creation**
```javascript
// Building a 3/4" EMT assembly - easy to find all components
const baseConduit = 'emt_0_75';
const components = [
  'emt_0_75',              // Conduit
  'emt_0_75_connector',    // Connector
  'emt_0_75_coupling',     // Coupling
  'emt_0_75_strap',        // Strap
  'emt_0_75_elbow_90'      // Elbow
];
```

### 5. **Scalability**
- Easy to add new sizes
- Easy to add new variants
- Pattern is extensible to new product categories

---

## 📝 Implementation Notes

### Important Considerations

1. **Backward Compatibility**
   - Old IDs may be referenced in historical estimates/projects
   - Consider creating ID aliases or mapping table
   - May need to maintain both old and new IDs during transition

2. **Assembly Components Table**
   - Must update all material_id references
   - Use transaction to ensure atomicity
   - Verify foreign key constraints

3. **Application Code**
   - Search codebase for hardcoded material IDs
   - Update any filters or queries that assume specific ID formats
   - Test thoroughly after migration

4. **Data Validation**
   - Run comprehensive queries before/after
   - Verify material counts match
   - Check that no assemblies are broken
   - Ensure all categories are covered

---

## 🔍 SQL Queries for Analysis

Use `MATERIAL_ID_ANALYSIS_COMPREHENSIVE.sql` to:
- View all current ID patterns
- Identify materials that don't follow conventions
- See which materials are used in assemblies
- Find duplicate or problematic IDs
- Generate migration scripts

---

## 📋 Next Steps

1. **Review this plan** with team/stakeholders
2. **Run analysis queries** on production database
3. **Generate complete migration script** for all materials
4. **Test migration** on copy of production database
5. **Document** any edge cases or special handling
6. **Schedule migration** during maintenance window
7. **Execute and verify** migration
8. **Update documentation** and training materials

---

## 💡 Example Migration Query Template

```sql
-- Example: Migrate 1/2" EMT materials
UPDATE base_materials SET id = 'emt_0_5' 
WHERE name ILIKE '1/2" EMT Conduit' AND id != 'emt_0_5';

UPDATE base_materials SET id = 'emt_0_5_connector' 
WHERE name ILIKE '1/2" EMT%Connector%' AND id != 'emt_0_5_connector';

UPDATE base_materials SET id = 'emt_0_5_coupling' 
WHERE name ILIKE '1/2" EMT%Coupling%' AND id != 'emt_0_5_coupling';

-- Continue for all components...
```

---

**Document Version:** 1.0  
**Date:** 2026-01-16  
**Status:** PROPOSAL - No changes made to database yet
