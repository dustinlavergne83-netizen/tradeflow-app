const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

(async () => {
  // Check assembly components for one assembly
  const assemblyId = 'df0aadfa-16b2-4986-8577-5ef0db7538f8'; // HVL Standard Assembly
  
  const { data: components, error } = await supabase
    .from('assembly_components')
    .select('*')
    .eq('assembly_id', assemblyId)
    .order('sequence');

  console.log('\n=== HVL ASSEMBLY COMPONENTS ===');
  if (error) {
    console.error('Error:', error);
  } else if (!components || components.length === 0) {
    console.log('NO COMPONENTS FOUND!');
  } else {
    console.log(`Found ${components.length} components:`);
    components.forEach((c, i) => {
      console.log(`  ${i+1}. ${c.material_name}`);
      console.log(`     qty: ${c.quantity} | type: ${c.quantity_type || 'fixed'} | unit: ${c.unit}`);
      console.log(`     material_id: ${c.material_id}`);
      console.log(`     material_unit_cost: ${c.material_unit_cost} | labor_hours: ${c.labor_hours}`);
    });
  }

  // Check a few base_materials to verify price/labor fields
  const { data: materials, error: matErr } = await supabase
    .from('base_materials')
    .select('id, name, basecost, laborhours, unit, category')
    .limit(5);

  console.log('\n=== SAMPLE BASE MATERIALS (field check) ===');
  if (matErr) {
    console.error('Error:', matErr);
  } else {
    materials.forEach(m => {
      console.log(`  "${m.name}" | basecost: ${m.basecost} | laborhours: ${m.laborhours} | unit: ${m.unit}`);
    });
  }

  // Cross-reference: For each assembly component, check if the material exists in base_materials
  if (components && components.length > 0) {
    console.log('\n=== CROSS-REFERENCE: Component Materials ===');
    for (const comp of components) {
      if (!comp.material_id) {
        console.log(`  ❌ ${comp.material_name}: NO material_id`);
        continue;
      }
      
      const { data: mat, error: matErr2 } = await supabase
        .from('base_materials')
        .select('id, name, basecost, laborhours')
        .eq('id', comp.material_id)
        .maybeSingle();
      
      if (matErr2) {
        console.log(`  ❌ ${comp.material_name}: Error looking up - ${matErr2.message}`);
      } else if (!mat) {
        // Try custom_materials
        const { data: customMat } = await supabase
          .from('custom_materials')
          .select('id, name, basecost, laborhours')
          .eq('id', comp.material_id)
          .maybeSingle();
        
        if (customMat) {
          console.log(`  ✅ ${comp.material_name}: Found in CUSTOM materials | cost: $${customMat.basecost} | labor: ${customMat.laborhours}h`);
        } else {
          console.log(`  ❌ ${comp.material_name}: NOT FOUND in base or custom materials (id: ${comp.material_id})`);
        }
      } else {
        console.log(`  ✅ ${comp.material_name}: Found | cost: $${mat.basecost} | labor: ${mat.laborhours}h`);
      }
    }
  }
})();
