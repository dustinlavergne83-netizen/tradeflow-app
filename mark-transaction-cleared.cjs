const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hyhjxdgdetdqoyoscflu.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5aGp4ZGdkZXRkcW95b3NjZmx1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4MjQ0NDUsImV4cCI6MjA4MTQwMDQ0NX0.kuEyoo4q-7utRafZHqjPD2lndBm-vRyUPeVqjkfDUF4';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function markAsCleared() {
  try {
    console.log('🔍 Finding transaction from Dec 21, 2025 for $11,147.63...\n');
    
    // Search for the transaction - trying Dec 21
    const { data: transactions, error: searchError } = await supabase
      .from('bank_transactions')
      .select('id, transaction_date, description, amount, is_cleared')
      .eq('transaction_date', '2025-12-21')
      .order('created_at', { ascending: false });

    if (searchError) {
      console.error('Error searching:', searchError);
      return;
    }

    // Find the one with matching amount
    const match = transactions.find(t => 
      Math.abs(Math.abs(t.amount) - 11147.63) < 0.01
    );

    if (!match) {
      console.log('❌ Transaction not found on Dec 21');
      console.log('\nTrying Dec 22...');
      
      // Try Dec 22 instead
      const { data: dec22, error: dec22Error } = await supabase
        .from('bank_transactions')
        .select('id, transaction_date, description, amount, is_cleared')
        .eq('transaction_date', '2025-12-22')
        .order('created_at', { ascending: false });

      if (dec22Error) {
        console.error('Error searching Dec 22:', dec22Error);
        return;
      }

      const match22 = dec22.find(t => 
        Math.abs(Math.abs(t.amount) - 11147.63) < 0.01
      );

      if (!match22) {
        console.log('❌ Transaction not found on Dec 22 either');
        console.log('\n📊 All transactions around that date:');
        const { data: nearby } = await supabase
          .from('bank_transactions')
          .select('id, transaction_date, description, amount, is_cleared')
          .gte('transaction_date', '2025-12-20')
          .lte('transaction_date', '2025-12-23')
          .order('transaction_date', { ascending: false });

        nearby.forEach(t => {
          console.log(`${t.transaction_date} - ${t.description} - $${t.amount} - Cleared: ${t.is_cleared}`);
        });
        return;
      }

      await updateTransaction(match22);
      return;
    }

    await updateTransaction(match);

  } catch (err) {
    console.error('Error:', err);
  }
}

async function updateTransaction(transaction) {
  console.log(`✅ Found transaction:`);
  console.log(`  Date: ${transaction.transaction_date}`);
  console.log(`  Amount: $${transaction.amount}`);
  console.log(`  Currently cleared: ${transaction.is_cleared}`);
  console.log('');

  if (transaction.is_cleared) {
    console.log('✅ Transaction is already marked as cleared!');
    return;
  }

  console.log('⏳ Marking as cleared...\n');

  const { error: updateError } = await supabase
    .from('bank_transactions')
    .update({ is_cleared: true })
    .eq('id', transaction.id);

  if (updateError) {
    console.error('❌ Error marking as cleared:', updateError);
  } else {
    console.log('✅ SUCCESS! Transaction marked as cleared!');
    console.log('   It will now appear in your reconciliation view.');
  }
}

markAsCleared();
