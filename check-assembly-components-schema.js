import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function checkSchema() {
  try {
    // Query to get column information
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT 
          column_name,
          data_type,
          is_nullable,
          column_default
        FROM information_schema.columns
        WHERE table_name = 'assembly_components'
        ORDER BY ordinal_position;
      `
    });

    if (error) {
      console.error('Error querying schema:', error);
      
      // Try alternative method - just select from the table to see columns
      const { data: sampleData, error: sampleError } = await supabase
        .from('assembly_components')
        .select('*')
        .limit(1);
      
      if (sampleError) {
        console.error('Sample query error:', sampleError);
      } else {
        console.log('\nSample row structure:');
        console.log(JSON.stringify(sampleData, null, 2));
        if (sampleData && sampleData.length > 0) {
          console.log('\nColumn names:', Object.keys(sampleData[0]));
        }
      }
    } else {
      console.log('assembly_components table schema:');
      console.log(JSON.stringify(data, null, 2));
    }
  } catch (err) {
    console.error('Exception:', err);
  }
}

checkSchema();
