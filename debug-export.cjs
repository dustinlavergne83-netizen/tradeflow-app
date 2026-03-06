const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

(async () => {
  // Get recent count measurements to see what's stored
  const { data: counts, error } = await supabase
    .from('plan_measurements')
    .select('id, label, material_id, measurement_type, calculated_value, materials')
    .eq('measurement_type', 'count')
    .order('created_at', { ascending: false })
    .limit(10);

  console.log('\n=== RECENT COUNT MEASUREMENTS ===');
  if (error) { console.error('Error:', error); return; }
  
  counts.forEach((c, i) => {
    console.log(`\n${i+1}. "${c.label || 'NO LABEL'}" (ID: ${c.id})`);
    console.log(`   material_id: ${c.material_id || 'NULL'}`);
    console.log(`   calculated_value: ${c.calculated_value}`);
    console.log(`   materials column: ${JSON.stringify(c.materials)}`);
    
    // Check if material_id points to an assembly
    if (c.material_id) {
      console.log(`   → Will look up material_id in assemblies table...`);
    } else {
      console.log(`   → NO material_id! Export will treat as label-only with $0 cost`);
    }
  });

  // For each count with a material_id, check if it's an assembly
  for (const c of counts) {
    if (!c.material_id) continue;
    
    // Check base_materials
    const { data: baseMat } = await supabase
      .from('base_materials')
      .select('id, name, unit, basecost')
      .eq('id', c.material_id)
      .maybeSingle();
    
    // Check assemblies
    const { data: assembly } = await supabase
      .from('assemblies')
      .select('id, name, unit')
      .eq('id', c.material_id)
      .maybeSingle();
    
    console.log(`\n   LOOKUP for material_id "${c.material_id}":`);
    console.log(`   - In base_materials: ${baseMat ? `YES → "${baseMat.name}" unit="${baseMat.unit}" cost=$${baseMat.basecost}` : 'NOT FOUND'}`);
    console.log(`   - In assemblies: ${assembly ? `YES → "${assembly.name}" unit="${assembly.unit}"` : 'NOT FOUND'}`);
    
    if (assembly) {
      // Load components
      const { data: comps } = await supabase
        .from('assembly_components')
        .select('material_name, quantity, material_unit_cost, labor_hours, quantity_type')
        .eq('assembly_id', assembly.id)
        .order('sequence');
      
      console.log(`   - Components: ${comps?.length || 0}`);
      comps?.forEach((comp, j) => {
        console.log(`     ${j+1}. ${comp.material_name} | qty: ${comp.quantity} | cost: $${comp.material_unit_cost} | labor: ${comp.labor_hours}h | type: ${comp.quantity_type || 'fixed'}`);
      });
    }
  }
})();
