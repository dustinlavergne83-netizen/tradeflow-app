const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Use service role key to bypass RLS
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY);

(async () => {
  // Check ALL measurements (not just counts)
  const { data: allMeasurements, error: allErr } = await supabase
    .from('plan_measurements')
    .select('id, label, material_id, measurement_type, calculated_value, plan_id')
    .order('created_at', { ascending: true })
    .limit(30);

  if (allErr) {
    console.error('All measurements error:', allErr);
  } else {
    console.log('\n=== ALL MEASUREMENTS (' + allMeasurements.length + ' total) ===');
    allMeasurements.forEach(m => {
      console.log(`Type: ${m.measurement_type} | Label: "${m.label}" | material_id: ${m.material_id || 'NULL'} | qty: ${m.calculated_value} | plan: ${m.plan_id?.substring(0,8)}`);
    });
  }

  // Check count measurements specifically
  const counts = (allMeasurements || []).filter(m => m.measurement_type === 'count');
  console.log('\n=== COUNTS ONLY: ' + counts.length + ' ===');
  
  // Check assemblies
  const { data: assemblies, error: assErr } = await supabase
    .from('assemblies')
    .select('id, name, category')
    .limit(10);

  console.log('\n=== ASSEMBLIES ===');
  if (assErr) console.error('Error:', assErr);
  else assemblies.forEach(a => console.log(`"${a.name}" (${a.category}) | id: ${a.id}`));
})();
