# Alternates Feature - Implementation Guide

## Overview
Implement a system where each project can have multiple estimates, and each estimate can have alternates (sub-estimates) attached to it.

## Database Schema (ALREADY COMPLETED ✅)
Migration `009_add_alternates_support.sql` has been created and applied:
- `alternate_number` INTEGER (0 = Base estimate, 1+ = alternates)
- `alternate_title` TEXT (e.g., "Base Bid", "Alt 1 - Exterior Lighting")
- `parent_estimate_id` UUID (NULL for base, links to parent for alternates)

## Current Issues to Fix

### Issue 1: "New Estimate" Auto-Loads Existing Estimate
**Current Behavior:** When clicking "Estimate Project", it loads existing estimate if one exists.

**Fix Required:** In `src/pages/Estimate.jsx`, modify `loadProjectAndEstimateData()`:
```javascript
// CURRENT CODE (around line 520):
if (!estimateError && existingEstimates && existingEstimates.length > 0) {
  await loadExistingEstimate(existingEstimates[0].id);
} else {
  const newEstimateNumber = await generateEstimateNumber();
  setEstimateNumber(newEstimateNumber);
}

// CHANGE TO:
// Check if there's an estimateId in URL - if so, load it
if (urlEstimateId) {
  await loadExistingEstimate(urlEstimateId);
} else {
  // Always create fresh estimate (don't auto-load)
  const newEstimateNumber = await generateEstimateNumber();
  setEstimateNumber(newEstimateNumber);
}
```
   // Done upto here 
### Issue 2: Add "Add Alt" Button to Project Detail Page
**Location:** `src/pages/ProjectDetail.jsx`

**Current Structure:**
```javascript
{estimates.map((estimate) => (
  <div key={estimate.id} style={styles.estimateRow}>
    {/* ... estimate data ... */}
    <div style={styles.td}>
      <div style={{ display: "flex", gap: 8 }}>
        <button>Edit</button>
        <button>Delete</button>
      </div>
    </div>
  </div>
))}
```

**Required Changes:**
1. Filter estimates to show only base estimates (alternate_number = 0 or NULL)
2. For each base estimate, fetch its alternates
3. Add "Add Alt" button
4. Display alternates indented under parent

**New Structure:**
```javascript
{estimates.filter(e => !e.parent_estimate_id).map((estimate) => (
  <React.Fragment key={estimate.id}>
    {/* BASE ESTIMATE ROW */}
    <div style={styles.estimateRow}>
      {/* ... estimate data ... */}
      <div style={styles.td}>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => navigate(...)}>Edit</button>
          <button onClick={() => deleteEstimate(estimate.id)}>Delete</button>
          <button 
            onClick={() => handleCreateAlternate(estimate.id)}
            style={{...styles.estimateButton, backgroundColor: "#8b5cf6"}}
          >
            + Add Alt
          </button>
        </div>
      </div>
    </div>
    
    {/* ALTERNATES ROWS (indented) */}
    {estimates
      .filter(alt => alt.parent_estimate_id === estimate.id)
      .map((alternate, index) => (
        <div key={alternate.id} style={{
          ...styles.estimateRow,
          backgroundColor: "#1a1a1a",
          paddingLeft: 40
        }}>
          <div style={styles.td}>
            └─ {alternate.alternate_title || `Alt ${alternate.alternate_number}`}
          </div>
          <div style={styles.td}>
            {new Date(alternate.estimate_date).toLocaleDateString()}
          </div>
          <div style={styles.td}>
            <span style={{...styles.badge, ...}}>
              {alternate.status}
            </span>
          </div>
          <div style={styles.td}>${(alternate.subtotal || 0).toFixed(2)}</div>
          <div style={styles.td}>
            <strong>${(alternate.total || 0).toFixed(2)}</strong>
          </div>
          <div style={styles.td}>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => navigate(...)}>Edit</button>
              <button onClick={() => deleteEstimate(alternate.id)}>Delete</button>
            </div>
          </div>
        </div>
      ))
    }
  </React.Fragment>
))}
```

## Implementation Steps

### Step 1: Update ProjectDetail.jsx
1. Add state for creating alternates:
```javascript
const [creatingAlternate, setCreatingAlternate] = useState(false);
const [alternateParentId, setAlternateParentId] = useState(null);
const [alternateTitle, setAlternateTitle] = useState("");
```

2. Add `handleCreateAlternate` function:
```javascript
async function handleCreateAlternate(parentEstimateId) {
  const title = prompt("Enter alternate title (e.g., 'Exterior Lighting Package'):");
  if (!title) return;
  
  try {
    // Get parent estimate to copy settings
    const { data: parent, error: parentError } = await supabase
      .from("estimates")
      .select("*")
      .eq("id", parentEstimateId)
      .single();
    
    if (parentError) throw parentError;
    
    // Get next alternate number
    const { data: existingAlts } = await supabase
      .from("estimates")
      .select("alternate_number")
      .eq("parent_estimate_id", parentEstimateId)
      .order("alternate_number", { ascending: false })
      .limit(1);
    
    const nextAltNumber = existingAlts && existingAlts.length > 0 
      ? existingAlts[0].alternate_number + 1 
      : 1;
    
    // Create alternate estimate
    const { data: newAlt, error: createError } = await supabase
      .from("estimates")
      .insert([{
        company_id: user.id,
        project_name: parent.project_name,
        customer_name: parent.customer_name,
        project_location: parent.project_location,
        estimate_date: new Date().toISOString().split('T')[0],
        estimate_number: `${parent.estimate_number}-ALT${nextAltNumber}`,
        parent_estimate_id: parentEstimateId,
        alternate_number: nextAltNumber,
        alternate_title: title,
        default_labor_rate: parent.default_labor_rate,
        overhead_percent: parent.overhead_percent,
        profit_percent: parent.profit_percent,
        status: 'draft'
      }])
      .select()
      .single();
    
    if (createError) throw createError;
    
    // Navigate to edit the new alternate
    navigate(`/project/${id}/estimate?estimateId=${newAlt.id}`);
  } catch (err) {
    console.error("Error creating alternate:", err);
    alert("Failed to create alternate");
  }
}
```

3. Update `loadProjectData` to include parent_estimate_id:
```javascript
const { data: estimatesData, error: estimatesError } = await supabase
  .from("estimates")
  .select("*")
  .eq("project_name", projectData.name)
  .order("created_at", { ascending: false });
```

4. Update the estimates display section (as shown above)

### Step 2: Update Estimate.jsx

1. Remove auto-load logic:
```javascript
// In loadProjectAndEstimateData(), REMOVE this block:
// Check if an estimate already exists for this project
const { data: existingEstimates, error: estimateError } = await supabase
  .from("estimates")
  .select("*")
  .eq("company_id", user.id)
  .eq("project_name", projectData.name)
  .order("created_at", { ascending: false })
  .limit(1);

if (!estimateError && existingEstimates && existingEstimates.length > 0) {
  await loadExistingEstimate(existingEstimates[0].id);
} else {
  const newEstimateNumber = await generateEstimateNumber();
  setEstimateNumber(newEstimateNumber);
}
```

2. Replace with:
```javascript
// Only load if estimateId is in URL
if (urlEstimateId) {
  await loadExistingEstimate(urlEstimateId);
} else {
  // Fresh estimate every time
  const newEstimateNumber = await generateEstimateNumber();
  setEstimateNumber(newEstimateNumber);
}
```

3. Update auto-save to include alternate fields:
```javascript
const estimateData = {
  // ... existing fields ...
  alternate_number: 0, // Base estimate
  alternate_title: "Base Bid",
  parent_estimate_id: null
};
```

### Step 3: Update Estimate Display Title
In Estimate.jsx, show alternate title if it exists:
```javascript
<h2 style={{ margin: 0, color: "#f97316", fontSize: 24 }}>
  {projectName || "Loading..."} 
  {currentEstimateId && alternateTitle && (
    <span style={{ color: "#8b5cf6", marginLeft: 10 }}>
      - {alternateTitle}
    </span>
  )}
</h2>
```

### Step 4: Load Alternate Info
Add to `loadExistingEstimate`:
```javascript
if (estimateData) {
  setCurrentEstimateId(estimateData.id);
  setEstimateNumber(estimateData.estimate_number);
  setEstimateDate(estimateData.estimate_date);
  setOverheadPercent(estimateData.overhead_percent || 10);
  setProfitPercent(estimateData.profit_percent || 15);
  
  // NEW: Load alternate info
  setCurrentAlternate(estimateData.alternate_number || 0);
  setNewAlternateTitle(estimateData.alternate_title || "Base Bid");
}
```

## Testing Checklist

1. ✅ Can create new estimate from project page (doesn't auto-load)
2. ✅ Can see "Add Alt" button on base estimates
3. ✅ Clicking "Add Alt" prompts for title
4. ✅ New alternate appears indented under parent
5. ✅ Can edit alternate (loads alternate's data)
6. ✅ Can delete alternate
7. ✅ Deleting parent estimate also deletes alternates (CASCADE)
8. ✅ Alternates have proper numbering (EST-1001-ALT1, EST-1001-ALT2)
9. ✅ Summary page shows alternate title
10. ✅ All existing functionality still works

## Files to Modify

1. **src/pages/ProjectDetail.jsx**
   - Add handleCreateAlternate function
   - Update estimates display to show hierarchy
   - Add "Add Alt" button

2. **src/pages/Estimate.jsx**
   - Remove auto-load logic
   - Add alternate title display
   - Add alternate state loading

3. **Migration already done** ✅
   - supabase/migrations/009_add_alternates_support.sql

## Estimated Time: 2-3 hours

## Notes
- Preserve ALL existing functionality
- Alternates inherit settings from parent (labor rate, markups)
- Alternates are independent estimates (own items, own summary)
- Database CASCADE delete handles cleanup
- No UI changes to estimate entry screens (same workflow)

## Completed Features ✅

### Description/Scope of Work (COMPLETED)
- ✅ Migration 010: Added `description` field to estimates table
- ✅ EstimateSummary: Added textarea for scope of work
- ✅ Auto-saves with other summary fields
- ✅ Proposal: Displays custom descriptions for base bid and alternates
- ✅ Professional scope statement on proposal

### Contractor Selection (IN PROGRESS)
- ✅ Migration 011: Created `project_contractors` table
- 🔄 ProjectSetup: Add contractor management UI
- 🔄 Proposal: Select contractor from project's contractor list
- 🔄 Display selected contractor name on proposal

## Future Enhancements (Post-Implementation)
- Combined proposal view showing Base + all alternates
- Checkbox selection to see combined totals
- Export all alternates to single PDF
- Copy items from one alternate to another
- Email proposals directly to contractors
