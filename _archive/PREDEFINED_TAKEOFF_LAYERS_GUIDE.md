# Predefined Takeoff Layers - Implementation Guide

## Overview
Create 7 permanent, non-deletable layers that map to estimate sections for seamless integration between digital takeoff and estimating.

## Predefined Layers
1. **Fixtures** → Links to Fixtures section
2. **Power** → Links to Power section
3. **Branch** → Links to Branch section
4. **Feeders** → Links to Feeders section
5. **Switchgear** → Links to Switchgear section
6. **Equipment** → Links to Equipment section
7. **Special Systems** → Links to Special Systems section

---

## Step 1: Database Migration

Create a new migration file: `supabase/migrations/055_add_predefined_layers.sql`

```sql
-- Add section_name field to measurement_layers
ALTER TABLE measurement_layers
ADD COLUMN section_name TEXT,
ADD COLUMN is_predefined BOOLEAN DEFAULT FALSE,
ADD COLUMN display_order INTEGER;

-- Add index for faster lookups
CREATE INDEX idx_measurement_layers_section ON measurement_layers(section_name);
CREATE INDEX idx_measurement_layers_predefined ON measurement_layers(is_predefined);

-- Update existing layers to not be predefined
UPDATE measurement_layers SET is_predefined = FALSE WHERE is_predefined IS NULL;

-- Function to auto-create predefined layers for a plan
CREATE OR REPLACE FUNCTION create_predefined_layers(p_plan_id UUID, p_company_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Only create if they don't exist
  INSERT INTO measurement_layers (plan_id, name, section_name, color, visible, is_predefined, display_order, company_id)
  SELECT p_plan_id, name, section, color, TRUE, TRUE, ord, p_company_id
  FROM (VALUES
    ('Fixtures', 'Fixtures', '#EF4444', 1),
    ('Power', 'Power', '#F59E0B', 2),
    ('Branch', 'Branch', '#10B981', 3),
    ('Feeders', 'Feeders', '#3B82F6', 4),
    ('Switchgear', 'Switchgear', '#8B5CF6', 5),
    ('Equipment', 'Equipment', '#EC4899', 6),
    ('Special Systems', 'Special Systems', '#06B6D4', 7)
  ) AS predefined(name, section, color, ord)
  WHERE NOT EXISTS (
    SELECT 1 FROM measurement_layers 
    WHERE plan_id = p_plan_id 
    AND section_name = predefined.section
    AND is_predefined = TRUE
  );
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-create predefined layers when a plan is accessed
CREATE OR REPLACE FUNCTION ensure_predefined_layers()
RETURNS TRIGGER AS $$
BEGIN
  -- This will be called from the app when a plan is loaded
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

## Step 2: Update Takeoff.jsx

### 2.1: Auto-create Predefined Layers on Load

In the `loadPlan()` function, add:

```javascript
async function loadPlan() {
  try {
    // ... existing plan loading code ...
    
    // Auto-create predefined layers if they don't exist
    await createPredefinedLayers();
    
    // Load measurements and layers
    loadMeasurements();
    loadLayers();
  } catch (err) {
    // ... error handling ...
  }
}

async function createPredefinedLayers() {
  try {
    const predefinedLayers = [
      { name: 'Fixtures', section_name: 'Fixtures', color: '#EF4444', display_order: 1 },
      { name: 'Power', section_name: 'Power', color: '#F59E0B', display_order: 2 },
      { name: 'Branch', section_name: 'Branch', color: '#10B981', display_order: 3 },
      { name: 'Feeders', section_name: 'Feeders', color: '#3B82F6', display_order: 4 },
      { name: 'Switchgear', section_name: 'Switchgear', color: '#8B5CF6', display_order: 5 },
      { name: 'Equipment', section_name: 'Equipment', color: '#EC4899', display_order: 6 },
      { name: 'Special Systems', section_name: 'Special Systems', color: '#06B6D4', display_order: 7 },
    ];
    
    for (const layer of predefinedLayers) {
      // Check if layer already exists
      const { data: existing } = await supabase
        .from('measurement_layers')
        .select('id')
        .eq('plan_id', planId)
        .eq('section_name', layer.section_name)
        .eq('is_predefined', true)
        .single();
      
      if (!existing) {
        // Create the layer
        await supabase
          .from('measurement_layers')
          .insert([{
            plan_id: planId,
            name: layer.name,
            section_name: layer.section_name,
            color: layer.color,
            visible: true,
            is_predefined: true,
            display_order: layer.display_order,
            company_id: user.id,
          }]);
        
        console.log(`✅ Created predefined layer: ${layer.name}`);
      }
    }
  } catch (err) {
    console.error('Error creating predefined layers:', err);
  }
}
```

### 2.2: Update Layer Display

Modify the layers section in the JSX to show predefined layers differently:

```javascript
{/* Predefined Layers */}
<div style={styles.toolSection}>
  <h4 style={styles.sectionTitle}>Section Layers</h4>
  {layers.filter(l => l.is_predefined).sort((a, b) => a.display_order - b.display_order).map(layer => (
    <div
      key={layer.id}
      onClick={() => setActiveLayer(layer.id)}
      style={{
        ...styles.layerItem,
        ...(activeLayer === layer.id ? styles.layerItemActive : {}),
        position: 'relative'
      }}
      title={`${layer.name} - Maps to ${layer.section_name} section`}
    >
      <div
        style={{
          width: 12,
          height: 12,
          borderRadius: 2,
          backgroundColor: layer.color,
          marginRight: 8,
        }}
      />
      <span style={{ flex: 1 }}>{layer.name}</span>
      {/* No delete button for predefined layers */}
    </div>
  ))}
</div>

<div style={styles.divider} />

{/* Custom Layers */}
<div style={styles.toolSection}>
  <h4 style={styles.sectionTitle}>Custom Layers</h4>
  <button onClick={() => openLayerModal()} style={styles.toolButton}>
    + New Layer
  </button>
  {layers.filter(l => !l.is_predefined).map(layer => (
    <div
      key={layer.id}
      onClick={() => setActiveLayer(layer.id)}
      onDoubleClick={() => openLayerModal(layer.id)}
      style={{
        ...styles.layerItem,
        ...(activeLayer === layer.id ? styles.layerItemActive : {}),
        position: 'relative'
      }}
      title="Double-click to rename"
    >
      <div
        style={{
          width: 12,
          height: 12,
          borderRadius: 2,
          backgroundColor: layer.color,
          marginRight: 8,
        }}
      />
      <span style={{ flex: 1 }}>{layer.name}</span>
      <button
        onClick={(e) => deleteLayer(layer.id, e)}
        style={styles.layerDeleteButton}
        title="Delete layer"
      >
        ✕
      </button>
    </div>
  ))}
</div>
```

### 2.3: Prevent Deletion of Predefined Layers

Update `deleteLayer()` function:

```javascript
async function deleteLayer(layerId, e) {
  e.stopPropagation();
  
  // Check if it's a predefined layer
  const layer = layers.find(l => l.id === layerId);
  if (layer?.is_predefined) {
    alert('Cannot delete predefined section layers');
    return;
  }
  
  // ... rest of existing delete code ...
}
```

---

## Step 3: Link to Estimate Sections

When exporting/integrating measurements to estimates, you can now:

1. Query measurements by layer's `section_name`
2. Automatically add counts to the correct estimate section
3. Maintain traceability between takeoff and estimate

Example query:
```javascript
// Get all Fixtures measurements
const { data } = await supabase
  .from('plan_measurements')
  .select(`
    *,
    measurement_layers!inner (
      section_name
    )
  `)
  .eq('plan_id', planId)
  .eq('measurement_layers.section_name', 'Fixtures');
```

---

## Step 4: Run Migration

1. Save the migration file
2. Apply it to your database:
   ```bash
   supabase db reset
   # or
   supabase migration up
   ```

3. Test by opening a plan - should auto-create the 7 predefined layers

---

## Benefits

✅ **Standardized Categories** - Every plan has the same 7 section layers
✅ **No Accidental Deletion** - Predefined layers can't be deleted
✅ **Estimate Integration** - Direct mapping to estimate sections via `section_name`
✅ **Custom Flexibility** - Users can still create additional custom layers
✅ **Clear Organization** - Section layers shown separately from custom layers

---

## Testing Checklist

- [ ] Migration runs successfully
- [ ] Opening a plan auto-creates 7 predefined layers
- [ ] Predefined layers appear in "Section Layers" group
- [ ] Cannot delete predefined layers
- [ ] Can still create/edit/delete custom layers
- [ ] Active layer selection works for both types
- [ ] Measurements correctly associate with layers
- [ ] Layer colors are distinct and visible
