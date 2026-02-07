const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hyhjxdgdetdqoyoscflu.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5aGp4ZGdkZXRkcW95b3NjZmx1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4MjQ0NDUsImV4cCI6MjA4MTQwMDQ0NX0.kuEyoo4q-7utRafZHqjPD2lndBm-vRyUPeVqjkfDUF4';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function markReconciled() {
  try {
    console.log('🔍 Finding and marking transaction as RECONCILED (not just cleared)...\n');
    
    // Get ALL transactions
    const { data: allTrans, error } = await supabase
      .from('bank_transactions')
      .select('id, transaction_date, description, amount, is_cleared, is_reconciled')
      .limit(5000);

    if (error) {
      console.error('Error:', error);
      return;
    }

    // Find the one with $11,147.63
    const match = allTrans.find(t => 
      Math.abs(Math.abs(t.amount) - 11147.63) < 0.01
    );

    if (!match) {
      console.log('❌ Transaction not found');
      return;
    }

    console.log(`✅ FOUND IT!`);
    console.log(`  Date: ${match.transaction_date}`);
    console.log(`  Amount: $${match.amount}`);
    console.log(`  is_cleared: ${match.is_cleared}`);
    console.log(`  is_reconciled: ${match.is_reconciled}`);
    console.log('');

    if (match.is_reconciled) {
      console.log('✅ Already marked as RECONCILED!');
      return;
    }

    console.log('⏳ Marking as RECONCILED...\n');

    const { error: updateError } = await supabase
      .from('bank_transactions')
      .update({ is_reconciled: true })
      .eq('id', match.id);

    if (updateError) {
      console.error('❌ Error:', updateError);
    } else {
      console.log('✅✅✅ SUCCESS! Transaction is now RECONCILED!');
      console.log('   Go to Bank Reconciliation and it should appear now!');
    }

  } catch (err) {
    console.error('Error:', err);
  }
}

markReconciled();
