# PVC Material ID Naming Convention

## New Standardized Pattern

### Base Conduit Pattern

#### Schedule 40 (Standard)
`pvc{size}_` (with trailing underscore)

**Examples:**
- `pvc12_` = 1/2" PVC Schedule 40 Conduit
- `pvc34_` = 3/4" PVC Schedule 40 Conduit
- `pvc1_` = 1" PVC Schedule 40 Conduit
- `pvc2_` = 2" PVC Schedule 40 Conduit

#### Schedule 80 (Heavy Duty)
`pvc{size}_80_` (with _80_ designation and trailing underscore)

**Examples:**
- `pvc12_80_` = 1/2" PVC Schedule 80 Conduit
- `pvc34_80_` = 3/4" PVC Schedule 80 Conduit
- `pvc1_80_` = 1" PVC Schedule 80 Conduit
- `pvc2_80_` = 2" PVC Schedule 80 Conduit

**Search Benefits:**
- Search `pvc12_` to find ALL 1/2" PVC materials (Sch 40 + Sch 80)
- Search `pvc12_80` to find ONLY 1/2" Schedule 80 materials
- Search `pvc1_` without matching `pvc112_` or `pvc114_`

### Fittings & Connectors Pattern

#### Schedule 40 Fittings
`pvc{size}_{component}_{type}`

**Components:**
- `conn` = Connector/Terminal Adapter
- `cpl` = Coupling
- `90` = 90° Elbow
- `45` = 45° Elbow
- `t` = T-Fitting
- `lb` = LB Conduit Body
- `ll` = LL Conduit Body
- `lr` = LR Conduit Body
- `c` = C Conduit Body

**Types:**
- `slip` = Slip Fitting (glued)
- `thread` = Threaded Fitting
- `male` = Male Adapter
- `female` = Female Adapter

**Examples:**
- `pvc12_conn_slip` = 1/2" Schedule 40 Slip Terminal Adapter
- `pvc12_conn_thread` = 1/2" Schedule 40 Threaded Terminal Adapter
- `pvc12_cpl_slip` = 1/2" Schedule 40 Slip Coupling
- `pvc12_90_slip` = 1/2" Schedule 40 90° Slip Elbow
- `pvc12_90_thread` = 1/2" Schedule 40 90° Threaded Elbow

#### Schedule 80 Fittings
`pvc{size}_80_{component}_{type}`

**Examples:**
- `pvc12_80_conn_slip` = 1/2" Schedule 80 Slip Terminal Adapter
- `pvc12_80_conn_thread` = 1/2" Schedule 80 Threaded Terminal Adapter
- `pvc12_80_cpl_slip` = 1/2" Schedule 80 Slip Coupling
- `pvc12_80_90_slip` = 1/2" Schedule 80 90° Slip Elbow

### Strap Components

#### Schedule 40 Straps
`pvc{size}_strap_{type}`

**Types:**
- `1h` = 1-Hole Strap
- `2h` = 2-Hole Strap
- `uni` = Unistrut Strap
- `std` = Standard Strap

**Examples:**
- `pvc12_strap_1h` = 1/2" PVC 1-Hole Strap
- `pvc12_strap_2h` = 1/2" PVC 2-Hole Strap
- `pvc12_strap_uni` = 1/2" PVC Unistrut Strap

#### Schedule 80 Straps
`pvc{size}_80_strap_{type}`

**Examples:**
- `pvc12_80_strap_1h` = 1/2" Schedule 80 PVC 1-Hole Strap
- `pvc12_80_strap_uni` = 1/2" Schedule 80 PVC Unistrut Strap

## Size Codes Reference

| Size | Code | Sch 40 Example | Sch 80 Example |
|------|------|----------------|----------------|
| 1/2" | pvc12 | pvc12_ | pvc12_80_ |
| 3/4" | pvc34 | pvc34_ | pvc34_80_ |
| 1" | pvc1 | pvc1_ | pvc1_80_ |
| 1-1/4" | pvc114 | pvc114_ | pvc114_80_ |
| 1-1/2" | pvc112 | pvc112_ | pvc112_80_ |
| 2" | pvc2 | pvc2_ | pvc2_80_ |
| 2-1/2" | pvc212 | pvc212_ | pvc212_80_ |
| 3" | pvc3 | pvc3_ | pvc3_80_ |
| 3-1/2" | pvc312 | pvc312_ | pvc312_80_ |
| 4" | pvc4 | pvc4_ | pvc4_80_ |
| 5" | pvc5 | pvc5_ | pvc5_80_ |
| 6" | pvc6 | pvc6_ | pvc6_80_ |

## Search Strategies

### Find ALL materials for a size
- `pvc12_` = ALL 1/2" PVC (Sch 40 + Sch 80)
- `pvc2_` = ALL 2" PVC (Sch 40 + Sch 80)

### Find Schedule 80 only
- `pvc12_80` = ALL 1/2" Schedule 80 materials
- `_80_` = ALL Schedule 80 materials across all sizes

### Find specific component types
- `pvc12_conn` = ALL 1/2" connectors (Sch 40 + Sch 80)
- `pvc12_cpl` = ALL 1/2" couplings
- `pvc12_90` = ALL 1/2" 90° elbows
- `pvc12_strap` = ALL 1/2" straps

### Find specific fitting types
- `_slip` = ALL slip fittings across all sizes
- `_thread` = ALL threaded fittings across all sizes

## Complete Examples by Size

### 1/2" PVC Schedule 40 (pvc12_)
- `pvc12_` - Conduit (10ft)
- `pvc12_90_slip` - 90° Slip Elbow
- `pvc12_90_thread` - 90° Threaded Elbow
- `pvc12_45_slip` - 45° Slip Elbow
- `pvc12_conn_slip` - Slip Terminal Adapter
- `pvc12_conn_thread` - Threaded Terminal Adapter
- `pvc12_cpl_slip` - Slip Coupling
- `pvc12_lb` - LB Conduit Body
- `pvc12_t_slip` - T-Fitting Slip
- `pvc12_strap_1h` - 1-Hole Strap
- `pvc12_strap_2h` - 2-Hole Strap
- `pvc12_strap_uni` - Unistrut Strap

### 1/2" PVC Schedule 80 (pvc12_80_)
- `pvc12_80_` - Conduit (10ft)
- `pvc12_80_90_slip` - 90° Slip Elbow
- `pvc12_80_90_thread` - 90° Threaded Elbow
- `pvc12_80_45_slip` - 45° Slip Elbow
- `pvc12_80_conn_slip` - Slip Terminal Adapter
- `pvc12_80_conn_thread` - Threaded Terminal Adapter
- `pvc12_80_cpl_slip` - Slip Coupling
- `pvc12_80_lb` - LB Conduit Body
- `pvc12_80_strap_uni` - Unistrut Strap

### 2" PVC Schedule 40 (pvc2_)
- `pvc2_` - Conduit (10ft)
- `pvc2_90_slip` - 90° Slip Elbow
- `pvc2_conn_slip` - Slip Terminal Adapter
- `pvc2_cpl_slip` - Slip Coupling
- `pvc2_t_slip` - T-Fitting Slip
- `pvc2_strap_uni` - Unistrut Strap

## Benefits of This System

1. **Clear Schedule Distinction**: Easy to identify Schedule 40 vs Schedule 80
2. **Prevents False Matches**: `pvc1_` won't match `pvc112_` or `pvc114_`
3. **Intuitive Searching**: Pattern-based searches work across all sizes
4. **Scalable**: Easy to add new sizes or fitting types
5. **Consistent with EMT**: Same logical structure as EMT naming convention
