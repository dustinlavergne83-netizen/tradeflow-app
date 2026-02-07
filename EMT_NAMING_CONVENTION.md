# EMT Material ID Naming Convention

## New Standardized Pattern

### Base Conduit Pattern
`emt{size}_` (with trailing underscore)

**Old Pattern → New Pattern:**
- `emt12` → `emt12_` (1/2" Conduit)
- `emt34` → `emt34_` (3/4" Conduit)
- `emt1` → `emt1_` (1" Conduit)
- `emt2` → `emt2_` (2" Conduit)

**Search Benefit:**
- Search `emt12_` to find ALL 1/2" materials without matching `emt112` or `emt212`
- Search `emt1_` to find ALL 1" materials without matching `emt114` or `emt112`

### Fittings & Straps Pattern
`emt{size}_{component}_{type}`

### Components
- **conn** = Connector
- **cpl** = Coupling

### Types
- **ss** = Set-Screw
- **comp** = Compression

### Examples

#### Old Pattern → New Pattern

**Connectors:**
- `emt12_ssconn` → `emt12_conn_ss` (1/2" Set-Screw Connector)
- `emt12_cpconn` → `emt12_conn_comp` (1/2" Compression Connector)
- `emt34_ssconn` → `emt34_conn_ss` (3/4" Set-Screw Connector)
- `emt1_cpconn` → `emt1_conn_comp` (1" Compression Connector)

**Couplings:**
- `emt12_sscpl` → `emt12_cpl_ss` (1/2" Set-Screw Coupling)
- `emt12_cpcpl` → `emt12_cpl_comp` (1/2" Compression Coupling)
- `emt34_sscpl` → `emt34_cpl_ss` (3/4" Set-Screw Coupling)
- `emt2_cpcpl` → `emt2_cpl_comp` (2" Compression Coupling)

### Benefits of New Pattern

1. **Search by Component Type:**
   - Search `emt12_conn` to find ALL 1/2" connectors (both set-screw and compression)
   - Search `emt34_cpl` to find ALL 3/4" couplings

2. **Search by Fitting Type:**
   - Search `_ss` to find ALL set-screw fittings across all sizes
   - Search `_comp` to find ALL compression fittings across all sizes

3. **More Intuitive:**
   - Component comes first (what it is)
   - Type comes second (how it works)

4. **Consistent Pattern:**
   - All fittings follow the same structure
   - Easy to predict IDs for new materials

### Size Codes Reference

| Size | Code | Example IDs |
|------|------|-------------|
| 1/2" | emt12 | emt12_conn_ss, emt12_cpl_comp |
| 3/4" | emt34 | emt34_conn_ss, emt34_cpl_ss |
| 1" | emt1 | emt1_conn_comp, emt1_cpl_ss |
| 1-1/4" | emt114 | emt114_conn_ss, emt114_cpl_comp |
| 1-1/2" | emt112 | emt112_conn_ss, emt112_cpl_ss |
| 2" | emt2 | emt2_conn_comp, emt2_cpl_ss |
| 2-1/2" | emt212 | emt212_conn_ss, emt212_cpl_comp |
| 3" | emt3 | emt3_conn_ss, emt3_cpl_ss |
| 4" | emt4 | emt4_conn_ss, emt4_cpl_ss |

### Strap Components (New Pattern)

**Old Pattern → New Pattern:**
- `emt12_usclamp` → `emt12_strap_uni` (Unistrut Strap)
- `emt12_1hole` → `emt12_strap_1h` (1-Hole Strap)
- `emt12_2hole` → `emt12_strap_2h` (2-Hole Strap)
- `emt12_strap` → `emt12_strap_std` (Standard Strap)

**Strap Type Codes:**
- **uni** = Unistrut Strap
- **1h** = 1-Hole Strap
- **2h** = 2-Hole Strap
- **std** = Standard/Generic Strap

**Search Benefits:**
- Search `emt12_strap` to find ALL straps for 1/2" conduit
- Search `_strap_uni` to find ALL unistrut straps across all sizes
- Search `_strap_1h` to find ALL 1-hole straps
- Search `_strap_2h` to find ALL 2-hole straps

### Other EMT Components

These follow the existing pattern:
- `emt12_` = 1/2" Conduit (10ft) ⭐ NEW - with trailing underscore
- `emt12_90` = 1/2" 90° Elbow
- `emt12_45` = 1/2" 45° Elbow
- `emt12_lb` = 1/2" LB Conduit Body
- `emt12_ll` = 1/2" LL Conduit Body
- `emt12_lr` = 1/2" LR Conduit Body
- `emt12_t` = 1/2" T Conduit Body
- `emt12_c` = 1/2" C Conduit Body
- `emt12_bushing` = 1/2" Bushing
- `emt12_offset` = 1/2" Offset
- `emt12_standoff` = 1/2" Standoff Strap
- `emt12_flexcpl` = 1/2" Flex-to-EMT Coupling

## Migration Scripts

### Complete Migration (RECOMMENDED)
Use `REORGANIZE_ALL_EMT_IDS.sql` to run ALL migrations at once.

This single script includes:
1. Base conduit reorganization (adds trailing underscore)
2. Fittings reorganization (connectors and couplings)
3. Straps reorganization
4. Complete verification and validation

### Individual Migration Scripts

#### Base Conduit Migration
Use `REORGANIZE_EMT_CONDUIT_IDS.sql` to migrate base conduit only.

The script includes:
1. Preview of changes (Step 1)
2. Migration updates (Step 2)
3. Verification queries (Step 3)
4. Check for stragglers (Step 4)

#### Fittings Migration
Use `REORGANIZE_EMT_FITTING_IDS.sql` to migrate connectors and couplings from old pattern to new pattern.

The script includes:
1. Preview of changes (Step 1)
2. Migration updates (Step 2)
3. Verification queries (Step 3)
4. Check for stragglers (Step 4)

### Straps Migration
Use `REORGANIZE_EMT_STRAP_IDS.sql` to migrate straps from old pattern to new pattern.

The script includes:
1. Preview of changes (Step 1)
2. Migration updates (Step 2)
3. Verification queries (Step 3)
4. Check for stragglers (Step 4)

## Complete Examples by Size

### 1/2" EMT (emt12_)
- `emt12_` - Conduit ⭐ NEW - with trailing underscore
- `emt12_90` - 90° Elbow
- `emt12_45` - 45° Elbow
- `emt12_conn_ss` - Set-Screw Connector
- `emt12_conn_comp` - Compression Connector
- `emt12_cpl_ss` - Set-Screw Coupling
- `emt12_cpl_comp` - Compression Coupling
- `emt12_strap_uni` - Unistrut Strap
- `emt12_strap_1h` - 1-Hole Strap
- `emt12_strap_2h` - 2-Hole Strap
- `emt12_strap_std` - Standard Strap
- `emt12_lb` - LB Conduit Body
- `emt12_flexcpl` - Flex-to-EMT Coupling

### 3/4" EMT (emt34_)
- `emt34_` - Conduit ⭐ NEW - with trailing underscore
- `emt34_90` - 90° Elbow
- `emt34_45` - 45° Elbow
- `emt34_conn_ss` - Set-Screw Connector
- `emt34_conn_comp` - Compression Connector
- `emt34_cpl_ss` - Set-Screw Coupling
- `emt34_cpl_comp` - Compression Coupling
- `emt34_strap_uni` - Unistrut Strap
- `emt34_strap_1h` - 1-Hole Strap
- `emt34_strap_2h` - 2-Hole Strap
- `emt34_strap_std` - Standard Strap
