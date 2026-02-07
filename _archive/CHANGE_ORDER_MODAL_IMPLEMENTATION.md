# Change Order Modal Implementation Guide

## Overview
This guide shows how to add a modal for creating change orders with automatic numbering (CO-01, CO-02, etc.).

## Implementation Steps

### 1. State Already Added ✅
```javascript
const [showChangeOrderModal, setShowChangeOrderModal] = useState(false);
const [changeOrderForm, setChangeOrderForm] = useState({
  title: '',
  description: '',
  change_order_number: ''
});
```

### 2. Add Function to Generate CO Number

Add this function after `handleCreateInvoice()`:

```javascript
async function generateChangeOrderNumber() {
  try {
    const { data, error } = await supabase
      .from("change_orders")
      .select("change_order_number")
      .eq("project_name", project.name)
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) throw error;

    if (data && data.length > 0 && data[0].change_order_number) {
      // Extract number from format like "CO-01" or "CO-02"
      const match = data[0].change_order_number.match(/CO-(\d+)$/);
      if (match) {
        const lastNumber = parseInt(match[1]);
        return `CO-${String(lastNumber + 1).padStart(2, '0')}`;
      }
    }

    // Default starting number
    return "CO-01";
  } catch (err) {
    console.error("Error generating CO number:", err);
    return "CO-01";
  }
}
```

### 3. Add Function to Handle Change Order Creation

Add this function after `generateChangeOrderNumber()`:

```javascript
async function handleCreateChangeOrder() {
  if (!changeOrderForm.title.trim()) {
    alert("Please enter a title for the change order");
    return;
  }

  try {
    // Generate CO number
    const coNumber = await generateChangeOrderNumber();
    
    // Create change order record
    const { data: newCO, error } = await supabase
      .from("change_orders")
      .insert([{
        project_name: project.name,
        change_order_number: coNumber,
        title: changeOrderForm.title.trim(),
        description: changeOrderForm.description.trim() || null,
        change_order_date: new Date().toISOString().split('T')[0],
        status: 'pending',
        total: 0,
        created_by: user.id
      }])
      .select()
      .single();

    if (error) throw error;

    // Close modal and reset form
    setShowChangeOrderModal(false);
    setChangeOrderForm({ title: '', description: '', change_order_number: '' });

    // Navigate to estimate with change order ID
    navigate(`/project/${id}/estimate?type=changeorder&coId=${newCO.id}&coNumber=${coNumber}`);
  } catch (err) {
    console.error("Error creating change order:", err);
    alert("Failed to create change order: " + err.message);
  }
}
```

### 4. Update the "+ New Change Order" Button

Find the button that says "+ New Change Order" (around line with "Change Orders Card") and replace:

```javascript
// OLD:
<button 
  onClick={() => navigate(`/project/${id}/estimate?type=changeorder`)} 
  style={styles.addEstimateButton}
>
  + New Change Order
</button>

// NEW:
<button 
  onClick={() => setShowChangeOrderModal(true)} 
  style={styles.addEstimateButton}
>
  + New Change Order
</button>
```

### 5. Add Change Order Modal Component

Add this modal right before the closing `</div>` of the main container (after the Edit Project Modal):

```javascript
{/* Change Order Modal */}
{showChangeOrderModal && (
  <div style={styles.modalOverlay} onClick={() => setShowChangeOrderModal(false)}>
    <div style={{...styles.modal, maxWidth: 600}} onClick={(e) => e.stopPropagation()}>
      <h2 style={styles.modalTitle}>🔄 Create Change Order</h2>
      <p style={{fontSize: 14, color: '#666', marginBottom: 20}}>
        Enter the details for this change order. A unique CO number will be generated automatically.
      </p>
      
      <div style={styles.field}>
        <label style={styles.modalLabel}>Title *</label>
        <input
          type="text"
          value={changeOrderForm.title}
          onChange={(e) => setChangeOrderForm({...changeOrderForm, title: e.target.value})}
          style={{...styles.select, padding: '10px'}}
          placeholder="e.g., Additional Outlets in Kitchen"
          autoFocus
        />
      </div>

      <div style={styles.field}>
        <label style={styles.modalLabel}>Description</label>
        <textarea
          value={changeOrderForm.description}
          onChange={(e) => setChangeOrderForm({...changeOrderForm, description: e.target.value})}
          style={{...styles.select, padding: '10px', minHeight: 120, resize: 'vertical'}}
          placeholder="Describe what changed and why..."
        />
      </div>

      <div style={{padding: 12, backgroundColor: '#f0f9ff', borderRadius: 6, marginBottom: 20}}>
        <div style={{fontSize: 13, color: '#666', marginBottom: 4}}>
          A unique CO number will be assigned automatically (e.g., CO-01, CO-02, etc.)
        </div>
      </div>

      <div style={styles.modalActions}>
        <button 
          onClick={() => {
            setShowChangeOrderModal(false);
            setChangeOrderForm({ title: '', description: '', change_order_number: '' });
          }} 
          style={styles.cancelButton}
        >
          Cancel
        </button>
        <button 
          onClick={handleCreateChangeOrder}
          style={styles.submitButton}
          disabled={!changeOrderForm.title.trim()}
        >
          🔄 Create & Start Estimating
        </button>
      </div>
    </div>
  </div>
)}
```

### 6. Update Estimate.jsx to Show CO Number

In `src/pages/Estimate.jsx`, update the header to show the CO number:

```javascript
// Add to the top where you get URL params:
const coNumber = searchParams.get('coNumber');

// Update the header section:
<h2 style={{ margin: 0, color: "#f97316", fontSize: 24 }}>
  {projectName || "Loading..."}
  {isChangeOrder && coNumber && (
    <span style={{ color: "#ef4444", marginLeft: 10, fontSize: 20, fontWeight: "bold" }}>
      - {coNumber} Change Order
    </span>
  )}
  {!isChangeOrder && currentEstimateId && newAlternateTitle && newAlternateTitle !== "Base Bid" && (
    <span style={{ color: "#8b5cf6", marginLeft: 10, fontSize: 20 }}>
      - {newAlternateTitle}
    </span>
  )}
</h2>
```

## Summary

This implementation:
1. ✅ Shows a modal when clicking "+ New Change Order"
2. ✅ Allows user to enter title and description
3. ✅ Automatically generates CO numbers (CO-01, CO-02, etc.)
4. ✅ Saves to the `change_orders` table
5. ✅ Navigates to estimate with the CO number displayed
6. ✅ Persists CO number across all estimate sections

The user will see the change order number in the header throughout their estimating session.
