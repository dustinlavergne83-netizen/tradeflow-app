const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function setTotal() {
  try {
    console.log('🔍 Finding estimate 1005...');
    
    const { data: estimate, error: estError } = await supabase
      .from('estimates')
      .select('id, estimate_number, total')
      .eq('estimate_number', '1005')
      .single();
    
    if (estError) throw estError;
    
    console.log('Current total:', estimate.total);
    console.log('Setting total to: $6840.27');
    
    const { error: updateError } = await supabase
      .from('estimates')
      .update({ total: 6840.27 })
      .eq('id', estimate.id);
    
    if (updateError) throw updateError;
    
    console.log('✅ Total updated successfully!');
    console.log('Refresh your browser to see the change.');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

setTotal();
