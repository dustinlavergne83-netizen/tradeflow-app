const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hyhjxdgdetdqoyoscflu.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5aGp4ZGdkZXRkcW95b3NjZmx1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4MjQ0NDUsImV4cCI6MjA4MTQwMDQ0NX0.kuEyoo4q-7utRafZHqjPD2lndBm-vRyUPeVqjkfDUF4';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function findAndClear() {
  try {
    console.log('🔍 Searching for ANY transaction with amount 11147.63...\n');
    
    // Get ALL transactions and search in memory
    const { data: allTrans, error } = await supabase
      .from('bank_transactions')
      .select('id, transaction_date, description, amount, is_cleared')
      .limit(5000);

    if (error) {
      console.error('Error:', error);
      return;
    }

    console.log(`Found ${allTrans.length} total transactions\n`);

    // Find matching amount
    const match = allTrans.find(t => 
      Math.abs(Math.abs(t.amount) - 11147.63) < 0.01
    );

    if (!match) {
      console.log('❌ Still no match found');
      console.log('\nSearching for amounts close to $11,147...');
      const close = allTrans.filter(t => 
        Math.abs(t.amount) > 11000 && Math.abs(t.amount) < 11200
      );
      
      console.log(`Found ${close.length} transactions in that range:`);
      close.slice(0, 10).forEach(t => {
        console.log(`  ${t.transaction_date} - ${t.description} - $${t.amount} - Cleared: ${t.is_cleared}`);
      });
      return;
    }

    console.log(`✅ FOUND IT!`);
    console.log(`  Date: ${match.transaction_date}`);
    console.log(`  Amount: $${match.amount}`);
    console.log(`  Description: ${match.description}`);
    console.log(`  ID: ${match.id}`);
    console.log(`  Currently cleared: ${match.is_cleared}`);
    console.log('');

    if (match.is_cleared) {
      console.log('✅ Already marked as cleared!');
      return;
    }

    console.log('⏳ Marking as cleared...\n');

    const { error: updateError } = await supabase
      .from('bank_transactions')
      .update({ is_cleared: true })
      .eq('id', match.id);

    if (updateError) {
      console.error('❌ Error:', updateError);
    } else {
      console.log('✅✅✅ SUCCESS! Transaction is now CLEARED!');
      console.log('   Go back to your bank account and refresh to see it in reconciliation!');
    }

  } catch (err) {
    console.error('Error:', err);
  }
}

findAndClear();
