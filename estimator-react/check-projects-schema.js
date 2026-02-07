import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://hxcrbuuclzdvhnpkkwos.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4Y3JidXVjbHpkdmhucGtrd29zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ4MjM0ODgsImV4cCI6MjA1MDM5OTQ4OH0.wE6o8kxP8SdVBSqMPQ0RvN9RAO0yoImrvCLAmDWXSIY'
);

async function checkSchema() {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .limit(1);
  
  if (error) {
    console.log('Error:', error);
  } else {
    console.log('Sample project:', JSON.stringify(data, null, 2));
  }
}

checkSchema();
