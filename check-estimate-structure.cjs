const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkStructure() {
  try {
    console.log('🔍 Checking estimate #1005 structure...\n');
    
    // Get estimate 1005
    const { data: estimate, error: estError } = await supabase
      .from('estimates')
      .select('*')
      .eq('estimate_number', '1005')
      .single();
    
    if (estError) throw estError;
    
    console.log('📋 ESTIMATE #1005 DATA:');
    console.log('ID:', estimate.id);
    console.log('Project Name:', estimate.project_name);
    console.log('Customer:', estimate.customer_name);
    console.log('Total in DB:', estimate.total);
    console.log('Material Subtotal:', estimate.material_subtotal);
    console.log('Labor Subtotal:', estimate.labor_subtotal);
    console.log('Created:', new Date(estimate.created_at).toLocaleString());
    console.log('\n');
    
    // Count items
    const { data: items, count } = await supabase
      .from('estimate_items')
      .select('*', { count: 'exact' })
      .eq('estimate_id', estimate.id);
    
    console.log(`📦 ITEMS: ${count} items found`);
    
    if (items && items.length > 0) {
      console.log('\nFirst 5 items:');
      items.slice(0, 5).forEach((item, idx) => {
        console.log(`  ${idx + 1}. ${item.description} - $${(item.material_total || 0).toFixed(2)}`);
      });
    } else {
      console.log('⚠️  NO ITEMS FOUND for this estimate!');
      console.log('\nThis means the $47,341.11 you see might be:');
      console.log('  1. Manually entered and stored in the "total" field');
      console.log('  2. From a different estimate');
      console.log('  3. Old data that was never properly saved');
    }
    
    // Check if there are ANY estimates with items
    console.log('\n🔍 Searching for ALL estimates with items...\n');
    
    const { data: allEstimates } = await supabase
      .from('estimates')
      .select('id, estimate_number, project_name, total');
    
    for (const est of allEstimates || []) {
      const { count: itemCount } = await supabase
        .from('estimate_items')
        .select('*', { count: 'exact', head: true })
        .eq('estimate_id', est.id);
      
      if (itemCount > 0) {
        console.log(`📋 Estimate #${est.estimate_number} (${est.project_name})`);
        console.log(`   Items: ${itemCount}`);
        console.log(`   Total: $${(est.total || 0).toFixed(2)}`);
        console.log('');
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkStructure();
