const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://hyhjxdgdetdqoyoscflu.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5aGp4ZGdkZXRkcW95b3NjZmx1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4MjQ0NDUsImV4cCI6MjA4MTQwMDQ0NX0.kuEyoo4q-7utRafZHqjPD2lndBm-vRyUPeVqjkfDUF4'
);

async function main() {
  // Check count measurements
  const { data, error } = await supabase
    .from('plan_measurements')
    .select('id, label, measurement_type, material_id, calculated_value')
    .eq('measurement_type', 'count');
  
  if (error) { console.error('Error:', error); return; }
  
  console.log('=== COUNT MEASUREMENTS ===');
  data.forEach(m => {
    console.log(`  ${m.label || '(no label)'} - count: ${m.calculated_value} - material_id: ${m.material_id || 'NULL ❌'}`);
  });
  console.log(`\nTotal: ${data.length}`);
  console.log(`With material_id: ${data.filter(m => m.material_id).length}`);
  console.log(`WITHOUT material_id: ${data.filter(m => !m.material_id).length}`);
}

main();
