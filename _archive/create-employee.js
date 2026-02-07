import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

const { data, error } = await supabase
  .from('employees')
  .insert([
    {
      email: 'dustin@dmlelectrical.com',
      first_name: 'Dustin',
      last_name: '',
      role: 'admin',
      is_active: true
    }
  ])
  .select();

if (error) {
  console.error('Error creating employee:', error);
} else {
  console.log('Employee created successfully:');
  console.log(JSON.stringify(data, null, 2));
}
