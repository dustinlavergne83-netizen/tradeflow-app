const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function fixNow() {
  try {
    console.log('🔧 Updating estimate with ID: 9e399f51-24d7-4d03-b891-34c96c7259aa');
    console.log('Setting total to: $6840.27');
    
    const { error } = await supabase
      .from('estimates')
      .update({ total: 6840.27 })
      .eq('id', '9e399f51-24d7-4d03-b891-34c96c7259aa');
    
    if (error) {
      console.error('❌ Update error:', error);
      throw error;
    }
    
    // Verify the update
    const { data, error: verifyError } = await supabase
      .from('estimates')
      .select('total')
      .eq('id', '9e399f51-24d7-4d03-b891-34c96c7259aa')
      .single();
    
    if (verifyError) throw verifyError;
    
    console.log('✅ Update successful!');
    console.log('New total in database:', data.total);
    console.log('');
    console.log('Now do a HARD REFRESH in your browser:');
    console.log('Press Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

fixNow();
