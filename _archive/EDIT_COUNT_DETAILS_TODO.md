# Edit Count Details Feature - Implementation Plan

## Current Status
✅ State variables added:
- `showEditDetailsModal` - boolean to show/hide modal
- `editingDetailsId` - string to track which measurement is being edited

## What Needs to be Done

### 1. Add "Edit Details" Button to Count Cards
**Location:** In the measurements list (right sidebar), for count measurements only

**Implementation:**
- Add a small "✏️ Edit" button next to count cards (not for length/area)
- Button should be positioned below the delete (✕) button
- On click, open the edit details modal
- Should NOT activate the count tool or allow adding/removing markers

### 2. Create Edit Details Modal
**Purpose:** Edit ONLY the label and material, not the markers

**Fields needed:**
- Label (text input) - pre-filled with current label
- Category dropdown - pre-filled with current material's category
- Material dropdown - pre-filled with current material_id
- Should look similar to the existing count save modal

**Behavior:**
- Load current measurement data when opening
- Allow changing label and material
- Save button updates the database
- Cancel button closes without changes

### 3. Wire Up Functions

**Function: `openEditDetailsModal(measurementId)`**
- Find measurement by ID
- Load current label into state
- Load current material_id into state  
- Determine category from material_id
- Set `editingDetailsId` to measurementId
- Set `showEditDetailsModal` to true

**Function: `saveEditedDetails()`**
- Update `plan_measurements` table:
  - `label` field
  - `material_id` field
- Close modal
- Reload measurements list
- Show success message

### 4. Add Modal JSX
**Location:** After the Count Tool Modal, before the closing div

**Structure:**
```jsx
{showEditDetailsModal && (
  <div style={styles.modalOverlay}>
    <div style={styles.modalContent}>
      <h2>Edit Count Details</h2>
      
      {/* Label input */}
      <input value={measurementLabel} ... />
      
      {/* Category dropdown */}
      <select value={selectedCategory} ... />
      
      {/* Material dropdown */}
      <select value={selectedMaterialId} ... />
      
      {/* Buttons */}
      <button onClick={cancelEdit}>Cancel</button>
      <button onClick={saveEditedDetails}>Save</button>
    </div>
  </div>
)}
```

## Key Points
1. This is SEPARATE from the existing "click to edit count" feature
2. Click to edit count = add/remove markers
3. Edit details button = change label/material only
4. Don't touch the markers or marker count
5. Update the measurement in place

## Files to Modify
- `src/pages/Takeoff.jsx` - add button, modal, and functions

## Testing
1. Create a count measurement
2. Click "Edit Details" button
3. Change label and material
4. Save
5. Verify card shows new label and material
6. Verify marker count unchanged
7. Verify markers still visible on PDF
