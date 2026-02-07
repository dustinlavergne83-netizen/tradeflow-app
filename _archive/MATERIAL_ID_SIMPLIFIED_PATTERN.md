# Simplified Material ID Pattern

**Goal:** Clean, concise IDs that are easy to type and filter

---

## ✅ New Pattern (Simplified)

### Format: `{type}{size}_{component}`

**Rules:**
- Type and size combined (no underscore between them)
- Single underscore before component
- No unnecessary words (e.g., just "90" not "elbow_90")

---

## EMT Conduit IDs

### Size Codes:
- 1/2" → `05`
- 3/4" → `075`
- 1" → `1`
- 1-1/4" → `125`
- 1-1/2" → `15`
- 2" → `2`
- 2-1/2" → `25`
- 3" → `3`
- 3-1/2" → `35`
- 4" → `4`

### 1/2" EMT Examples:
```
emt05              → 1/2" EMT Conduit
emt05_90           → 1/2" EMT 90° Elbow
emt05_45           → 1/2" EMT 45° Elbow
emt05_ssconn       → 1/2" EMT Set Screw Connector
emt05_cpconn       → 1/2" EMT Compression Connector
emt05_sscpl        → 1/2" EMT Set Screw Coupling
emt05_cpcpl        → 1/2" EMT Compression Coupling
emt05_lb           → 1/2" EMT LB Fitting
emt05_ll           → 1/2" EMT LL Fitting
emt05_lr           → 1/2" EMT LR Fitting
emt05_t            → 1/2" EMT T Body
emt05_c            → 1/2" EMT C Body
emt05_strap        → 1/2" EMT Strap
emt05_bushing      → 1/2" EMT Bushing
emt05_offset       → 1/2" EMT Offset Connector
```

### Component Type Codes:
```
ssconn             → Set Screw Connector
cpconn             → Compression Connector
sscpl              → Set Screw Coupling
cpcpl              → Compression Coupling
90                 → 90° Elbow
45                 → 45° Elbow
lb, ll, lr         → Conduit Bodies
t, c               → T and C Bodies
strap              → Strap/Clamp
bushing            → Insulating Bushing
offset             → Offset Connector
```

### 3/4" EMT Examples:
```
emt075             → 3/4" EMT Conduit
emt075_90          → 3/4" EMT 90° Elbow
emt075_ssconn      → 3/4" EMT Set Screw Connector
emt075_cpconn      → 3/4" EMT Compression Connector
emt075_sscpl       → 3/4" EMT Set Screw Coupling
emt075_cpcpl       → 3/4" EMT Compression Coupling
emt075_strap       → 3/4" EMT Strap
```

### 1" EMT Examples:
```
emt1               → 1" EMT Conduit
emt1_90            → 1" EMT 90° Elbow
emt1_ssconn        → 1" EMT Set Screw Connector
emt1_cpconn        → 1" EMT Compression Connector
emt1_sscpl         → 1" EMT Set Screw Coupling
```

### 2" EMT Examples:
```
emt2               → 2" EMT Conduit
emt2_90            → 2" EMT 90° Elbow
emt2_ssconn        → 2" EMT Set Screw Connector
emt2_cpconn        → 2" EMT Compression Connector
```

---

## Rigid Conduit IDs

### Format: `rigid{size}_{component}`

### Examples:
```
rigid05            → 1/2" Rigid Conduit
rigid05_90         → 1/2" Rigid 90° Elbow
rigid05_cpl        → 1/2" Rigid Coupling (threaded)
rigid05_bushing    → 1/2" Rigid Bushing
rigid05_locknut    → 1/2" Rigid Locknut
rigid05_strap      → 1/2" Rigid Strap

rigid075           → 3/4" Rigid Conduit
rigid075_90        → 3/4" Rigid 90° Elbow
rigid075_cpl       → 3/4" Rigid Coupling

rigid1             → 1" Rigid Conduit
rigid1_90          → 1" Rigid 90° Elbow
rigid1_cpl         → 1" Rigid Coupling

rigid2             → 2" Rigid Conduit
rigid2_90          → 2" Rigid 90° Elbow
```

**Note:** Rigid uses threaded couplings (no set screw vs compression variants)

---

## PVC Conduit IDs

### Format: `pvc{schedule}{size}_{component}`

### Examples:
```
pvc4005            → 1/2" Schedule 40 PVC Conduit
pvc4005_90         → 1/2" Schedule 40 90° Elbow
pvc4005_coupling   → 1/2" Schedule 40 Coupling
pvc4005_adapter    → 1/2" Schedule 40 Adapter
pvc4005_lb         → 1/2" Schedule 40 LB Fitting
pvc4005_strap      → 1/2" Schedule 40 Strap

pvc40075           → 3/4" Schedule 40 PVC Conduit
pvc401             → 1" Schedule 40 PVC Conduit
pvc402             → 2" Schedule 40 PVC Conduit

pvc8005            → 1/2" Schedule 80 PVC Conduit
pvc80075           → 3/4" Schedule 80 PVC Conduit
```

---

## Wire IDs

### Format: `wire{type}{size}_{color}`

### Examples:
```
wire12_bk          → #12 THHN Black
wire12_wh          → #12 THHN White
wire12_gn          → #12 THHN Green
wire10_bk          → #10 THHN Black
wire10_wh          → #10 THHN White
wire8_bk           → #8 THHN Black
wire1_0_bk         → 1/0 THHN Black
wire2_0_bk         → 2/0 THHN Black
wire250_bk         → 250 kcmil THHN Black
```

### Romex:
```
romex14_2          → 14/2 Romex
romex14_3          → 14/3 Romex
romex12_2          → 12/2 Romex
romex12_3          → 12/3 Romex
romex10_2          → 10/2 Romex
```

---

## Devices

### Receptacles: `rec{type}{rating}_{color}`
```
rec15a_wh          → 15A Duplex Receptacle White
rec20a_wh          → 20A Duplex Receptacle White
gfci15a_wh         → 15A GFCI Receptacle White
gfci20a_wh         → 20A GFCI Receptacle White
```

### Switches: `sw{type}_{color}`
```
sw1p_wh            → Single Pole Switch White
sw3w_wh            → 3-Way Switch White
sw4w_wh            → 4-Way Switch White
dimmer_wh          → Dimmer Switch White
```

### Breakers: `brk{rating}_{poles}`
```
brk15_1p           → 15A Single Pole Breaker
brk20_1p           → 20A Single Pole Breaker
brk30_2p           → 30A Double Pole Breaker
gfcibrk20_1p       → 20A GFCI Breaker
afcibrk15_1p       → 15A AFCI Breaker
```

---

## Boxes

### Format: `box{type}_{size}`
```
box1g_nw           → 1-Gang New Work Box
box1g_ow           → 1-Gang Old Work Box
box2g_nw           → 2-Gang New Work Box
box4x4             → 4"x4" Square Box
jbox6x6            → 6"x6" Junction Box
```

---

## Benefits

### 1. **Shorter IDs**
- `emt05_90` vs `emt_0_5_elbow_90`
- Easier to type
- Less prone to typos

### 2. **Still Filterable**
```javascript
// Get all 1/2" EMT materials
materials.filter(m => m.id.startsWith('emt05'))

// Get all 1/2" EMT fittings (not the conduit itself)
materials.filter(m => m.id.startsWith('emt05_'))

// Get all EMT materials
materials.filter(m => m.id.startsWith('emt'))
```

### 3. **Consistent Pattern**
- Type + Size (no underscore)
- Underscore before component
- Short, memorable component names

### 4. **Clean & Professional**
- No redundant words
- Industry-standard abbreviations
- Easy to read in code and database

---

## Migration Order

1. ✅ **1/2" EMT** (emt05_)
2. 3/4" EMT (emt075_)
3. 1" EMT (emt1_)
4. 1-1/4" EMT (emt125_)
5. 1-1/2" EMT (emt15_)
6. 2" EMT (emt2_)
7. Then move to Rigid
8. Then PVC
9. Then Wire
10. Then Devices & other materials

One size at a time, verify each before proceeding!
