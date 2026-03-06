const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

(async () => {
  // Get ALL recent measurements
  const { data, error } = await supabase
    .from('plan_measurements')
    .select('id, label, material_id, measurement_type, calculated_value, materials, layer_id')
    .order('created_at', { ascending: false })
    .limit(20);

  console.log('\n=== ALL RECENT MEASUREMENTS ===');
  console.log('Error:', error);
  console.log('Count:', data?.length || 0);
  
  if (data) {
    data.forEach((m, i) => {
      console.log(`\n${i+1}. [${m.measurement_type}] "${m.label || 'NO LABEL'}"`);
      console.log(`   material_id: ${m.material_id || 'NULL'}`);
      console.log(`   calculated_value: ${m.calculated_value}`);
      console.log(`   layer_id: ${m.layer_id}`);
      console.log(`   materials: ${m.materials ? JSON.stringify(m.materials).substring(0, 200) : 'NULL'}`);
    });
  }

  // Also check what the loadMaterials function loads
  const { data: baseMats, error: baseErr } = await supabase
    .from('base_materials')
    .select('id, name, unit, basecost')
    .limit(3);
  
  const { data: assemblies, error: asmErr } = await supabase
    .from('assemblies')
    .select('id, name, unit, category')
    .eq('is_active', true)
    .limit(10);
  
  console.log('\n=== MATERIALS LOADING CHECK ===');
  console.log('Base materials error:', baseErr);
  console.log('Base materials sample:', baseMats?.length);
  console.log('Assemblies error:', asmErr);
  console.log('Assemblies count:', assemblies?.length);
  if (assemblies) {
    assemblies.forEach(a => {
      console.log(`  Assembly: "${a.name}" | unit: "${a.unit}" | category: "${a.category}"`);
    });
  }

  // Check: does the formatted assembly have unit='assembly'?
  // In loadMaterials, assemblies get: unit: 'assembly'
  // In export, the check is: material.unit === 'assembly'
  // So if the assembly in DB has unit=null, it gets overridden to 'assembly' by the formatter
  console.log('\n=== ASSEMBLY UNIT CHECK ===');
  if (assemblies) {
    assemblies.forEach(a => {
      const formatted = { ...a, category: a.category || 'Assemblies', unit: 'assembly' };
      console.log(`  "${a.name}": DB unit="${a.unit}" → formatted unit="${formatted.unit}"`);
    });
  }
})();
