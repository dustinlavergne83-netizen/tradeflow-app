# Master Conduit Material ID Naming Convention

This document provides a comprehensive overview of the naming conventions for all conduit types in the estimator system.

## Table of Contents
1. [EMT Naming Convention](#emt-naming-convention)
2. [PVC Naming Convention](#pvc-naming-convention)
3. [Search Strategies](#search-strategies)
4. [Quick Reference](#quick-reference)

---

## EMT Naming Convention

### Base Conduit
- **Pattern**: `emt{size}_` (with trailing underscore)
- **Examples**: `emt12_`, `emt34_`, `emt1_`, `emt2_`

### Fittings
- **Connectors**: `emt{size}_conn_{type}`
  - `emt12_conn_ss` = 1/2" Set-Screw Connector
  - `emt12_conn_comp` = 1/2" Compression Connector
  
- **Couplings**: `emt{size}_cpl_{type}`
  - `emt12_cpl_ss` = 1/2" Set-Screw Coupling
  - `emt12_cpl_comp` = 1/2" Compression Coupling

### Straps
- **Pattern**: `emt{size}_strap_{type}`
  - `emt12_strap_uni` = 1/2" Unistrut Strap
  - `emt12_strap_1h` = 1/2" 1-Hole Strap
  - `emt12_strap_2h` = 1/2" 2-Hole Strap
  - `emt12_strap_std` = 1/2" Standard Strap

### Other Components
- `emt12_90` = 90° Elbow
- `emt12_45` = 45° Elbow
- `emt12_lb` = LB Conduit Body
- `emt12_flexcpl` = Flex-to-EMT Coupling

---

## PVC Naming Convention

### Base Conduit

#### Schedule 40
- **Pattern**: `pvc{size}_` (with trailing underscore)
- **Examples**: `pvc12_`, `pvc34_`, `pvc1_`, `pvc2_`

#### Schedule 80
- **Pattern**: `pvc{size}_80_` (with _80_ designation)
- **Examples**: `pvc12_80_`, `pvc34_80_`, `pvc1_80_`, `pvc2_80_`

### Fittings

#### Schedule 40 Fittings
- **Connectors**: `pvc{size}_conn_{type}`
  - `pvc12_conn_slip` = 1/2" Slip Terminal Adapter
  - `pvc12_conn_thread` = 1/2" Threaded Terminal Adapter

- **Couplings**: `pvc{size}_cpl_{type}`
  - `pvc12_cpl_slip` = 1/2" Slip Coupling
  - `pvc12_cpl_thread` = 1/2" Threaded Coupling

- **Elbows**: `pvc{size}_{angle}_{type}`
  - `pvc12_90_slip` = 1/2" 90° Slip Elbow
  - `pvc12_90_thread` = 1/2" 90° Threaded Elbow
  - `pvc12_45_slip` = 1/2" 45° Slip Elbow

#### Schedule 80 Fittings
- **Pattern**: Insert `_80` after size code
  - `pvc12_80_conn_slip` = 1/2" Sch 80 Slip Terminal Adapter
  - `pvc12_80_cpl_slip` = 1/2" Sch 80 Slip Coupling
  - `pvc12_80_90_slip` = 1/2" Sch 80 90° Slip Elbow

### Straps

#### Schedule 40 Straps
- **Pattern**: `pvc{size}_strap_{type}`
  - `pvc12_strap_uni` = 1/2" Unistrut Strap
  - `pvc12_strap_1h` = 1/2" 1-Hole Strap
  - `pvc12_strap_2h` = 1/2" 2-Hole Strap

#### Schedule 80 Straps
- **Pattern**: `pvc{size}_80_strap_{type}`
  - `pvc12_80_strap_uni` = 1/2" Sch 80 Unistrut Strap

---

## Search Strategies

### By Size
| Search | Result |
|--------|--------|
| `emt12_` | ALL 1/2" EMT materials |
| `pvc12_` | ALL 1/2" PVC materials (Sch 40 + Sch 80) |
| `pvc12_80` | ONLY 1/2" PVC Schedule 80 materials |

### By Component Type
| Search | Result |
|--------|--------|
| `emt12_conn` | ALL 1/2" EMT connectors |
| `pvc12_conn` | ALL 1/2" PVC connectors (Sch 40 + Sch 80) |
| `emt12_cpl` | ALL 1/2" EMT couplings |
| `pvc12_cpl` | ALL 1/2" PVC couplings |
| `emt12_strap` | ALL 1/2" EMT straps |
| `pvc12_strap` | ALL 1/2" PVC straps (Sch 40 + Sch 80) |

### By Fitting/Connection Type
| Search | Result |
|--------|--------|
| `_ss` | ALL set-screw fittings (EMT) |
| `_comp` | ALL compression fittings (EMT) |
| `_slip` | ALL slip fittings (PVC) |
| `_thread` | ALL threaded fittings (PVC) |
| `_strap_uni` | ALL unistrut straps (EMT + PVC) |
| `_strap_1h` | ALL 1-hole straps (EMT + PVC) |
| `_80_` | ALL Schedule 80 PVC materials |

### Cross-Material Searches
| Search | Result |
|--------|--------|
| `12_` | ALL 1/2" conduit (EMT + PVC) |
| `_conn_` | ALL connectors (EMT + PVC) |
| `_cpl_` | ALL couplings (EMT + PVC) |

---

## Quick Reference

### Size Codes
- `12` = 1/2"
- `34` = 3/4"
- `1` = 1"
- `114` = 1-1/4"
- `112` = 1-1/2"
- `2` = 2"
- `212` = 2-1/2"
- `3` = 3"
- `4` = 4"

### EMT Component Codes
- `_conn_ss` = Set-Screw Connector
- `_conn_comp` = Compression Connector
- `_cpl_ss` = Set-Screw Coupling
- `_cpl_comp` = Compression Coupling
- `_strap_uni` = Unistrut Strap
- `_strap_1h` = 1-Hole Strap
- `_strap_2h` = 2-Hole Strap
- `_strap_std` = Standard Strap

### PVC Component Codes
- `_conn_slip` = Slip Connector/Terminal Adapter
- `_conn_thread` = Threaded Connector
- `_cpl_slip` = Slip Coupling
- `_90_slip` = 90° Slip Elbow
- `_90_thread` = 90° Threaded Elbow
- `_45_slip` = 45° Slip Elbow
- `_strap_uni` = Unistrut Strap
- `_strap_1h` = 1-Hole Strap

### Schedule Designations (PVC Only)
- No designation = Schedule 40
- `_80_` = Schedule 80

---

## Migration Scripts

### EMT Migration
- **Complete**: `REORGANIZE_ALL_EMT_IDS.sql`
- **Individual Scripts**:
  - `REORGANIZE_EMT_CONDUIT_IDS.sql` (base conduit)
  - `REORGANIZE_EMT_FITTING_IDS.sql` (connectors & couplings)
  - `REORGANIZE_EMT_STRAP_IDS.sql` (straps)

### PVC Migration
- PVC materials should be added using the new naming convention from the start

---

## Benefits

1. **Prevents False Matches**: `emt1_` won't match `emt112_` or `emt114_`
2. **Intuitive Searching**: Search by size, component type, or fitting type
3. **Clear Distinctions**: Easy to differentiate EMT vs PVC, Sch 40 vs Sch 80
4. **Scalable**: Easy to add new sizes or fitting types
5. **Consistent**: Same logical structure across all conduit types
6. **Cross-Material Searches**: Find all materials of a certain type across EMT and PVC
