const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function verifyTotal() {
  try {
    const { data, error } = await supabase
      .from('estimates')
      .select('id, estimate_number, total')
      .eq('estimate_number', '1005');
    
    if (error) throw error;
    
    console.log('📊 All estimates with number 1005:');
    console.log(data);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

verifyTotal();
