const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function fix() {
  // First, find estimate 1009
  const { data: est, error: findErr } = await supabase
    .from('estimates')
    .select('id, estimate_number, company_id, created_by, project_name, customer_name')
    .eq('estimate_number', '1009')
    .maybeSingle();

  if (findErr) {
    console.error('Error finding estimate:', findErr);
    return;
  }

  if (!est) {
    console.log('Estimate 1009 not found by estimate_number. Searching all recent...');
    const { data: recent, error: recentErr } = await supabase
      .from('estimates')
      .select('id, estimate_number, company_id, created_by, project_name, customer_name, created_at')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (recentErr) {
      console.error('Error:', recentErr);
      return;
    }
    
    console.log('Recent estimates:');
    recent.forEach(e => {
      console.log(`  #${e.estimate_number} | ID: ${e.id} | company_id: ${e.company_id} | created_by: ${e.created_by} | "${e.project_name}" | ${e.customer_name} | ${e.created_at}`);
    });
    
    // Fix ALL estimates that have company_id but no created_by
    const toFix = recent.filter(e => e.company_id && !e.created_by);
    if (toFix.length > 0) {
      console.log(`\nFound ${toFix.length} estimates missing created_by. Fixing...`);
      for (const e of toFix) {
        const { error: updateErr } = await supabase
          .from('estimates')
          .update({ created_by: e.company_id })
          .eq('id', e.id);
        
        if (updateErr) {
          console.error(`  Error fixing #${e.estimate_number}:`, updateErr);
        } else {
          console.log(`  ✅ Fixed #${e.estimate_number} - set created_by = ${e.company_id}`);
        }
      }
    } else {
      console.log('\nNo estimates need fixing.');
    }
    return;
  }

  console.log('Found estimate 1009:', est);
  
  if (est.created_by) {
    console.log('created_by is already set:', est.created_by);
    return;
  }

  // Set created_by = company_id
  const { error: updateErr } = await supabase
    .from('estimates')
    .update({ created_by: est.company_id })
    .eq('id', est.id);

  if (updateErr) {
    console.error('Error updating:', updateErr);
  } else {
    console.log('✅ Fixed! Set created_by =', est.company_id, 'for estimate 1009');
  }
}

fix();
