const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function findEstimateItems() {
  try {
    // Find the project with this estimate
    const projectId = 'e8d09197-51d8-46db-9feb-01407da1f5d7';
    
    console.log('🔍 Finding all estimates for project...\n');
    
    // Get all estimates for this project
    const { data: estimates, error: estError } = await supabase
      .from('estimates')
      .select('id, estimate_number, total, created_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    
    if (estError) throw estError;
    
    console.log(`Found ${estimates.length} estimates:\n`);
    
    for (const est of estimates) {
      // Count items for each estimate
      const { data: items, error: itemsError } = await supabase
        .from('estimate_items')
        .select('id, description, material_total, labor_total')
        .eq('estimate_id', est.id);
      
      if (itemsError) {
        console.log(`❌ Error loading items for ${est.estimate_number}:`, itemsError);
        continue;
      }
      
      const itemCount = items?.length || 0;
      const itemsTotal = items?.reduce((sum, item) => sum + (item.material_total || 0) + (item.labor_total || 0), 0) || 0;
      
      console.log(`📋 Estimate #${est.estimate_number}`);
      console.log(`   ID: ${est.id}`);
      console.log(`   Stored Total: $${est.total?.toFixed(2) || '0.00'}`);
      console.log(`   Items: ${itemCount}`);
      console.log(`   Items Sum: $${itemsTotal.toFixed(2)}`);
      console.log(`   Created: ${new Date(est.created_at).toLocaleString()}`);
      console.log('');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

findEstimateItems();
