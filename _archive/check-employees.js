import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

const { data, error } = await supabase.from('employees').select('*');

if (error) {
  console.error('Error:', error);
} else {
  console.log('Employees in database:');
  console.log(JSON.stringify(data, null, 2));
  
  console.log('\nLooking for: dustin@dmlelectrical.com');
  const match = data.find(emp => emp.email === 'dustin@dmlelectrical.com');
  if (match) {
    console.log('FOUND:', match);
  } else {
    console.log('NOT FOUND - Need to create this employee record');
  }
}
