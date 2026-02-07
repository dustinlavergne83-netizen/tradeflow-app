const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hyhjxdgdetdqoyoscflu.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5aGp4ZGdkZXRkcW95b3NjZmx1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4MjQ0NDUsImV4cCI6MjA4MTQwMDQ0NX0.kuEyoo4q-7utRafZHqjPD2lndBm-vRyUPeVqjkfDUF4';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function findTransaction() {
  try {
    console.log('🔍 Searching for transaction from Dec 22 for $11,147.63...\n');
    
    // Search for the transaction with the specific amount
    const { data, error } = await supabase
      .from('bank_transactions')
      .select('id, transaction_date, description, amount, is_cleared, bank_account_id, category, payee')
      .or(`amount.eq.11147.63,amount.eq.-11147.63`)
      .order('transaction_date', { ascending: false });

    if (error) {
      console.error('❌ Error querying Supabase:', error);
      return;
    }

    if (!data || data.length === 0) {
      console.log('❌ No transaction found with amount $11,147.63');
      console.log('\nSearching for similar amounts near that date...');
      
      // Try searching by date instead
      const { data: byDate, error: dateError } = await supabase
        .from('bank_transactions')
        .select('id, transaction_date, description, amount, is_cleared')
        .gte('transaction_date', '2025-12-20')
        .lte('transaction_date', '2025-12-24')
        .order('transaction_date', { ascending: false });

      if (dateError) {
        console.error('Error querying by date:', dateError);
        return;
      }

      console.log(`Found ${byDate?.length || 0} transactions between Dec 20-24:`);
      byDate?.forEach(t => {
        console.log(`  ${t.transaction_date} - ${t.description} - $${t.amount} - Cleared: ${t.is_cleared}`);
      });
      return;
    }

    console.log(`✅ Found ${data.length} transaction(s):\n`);
    
    data.forEach((t, idx) => {
      console.log(`Transaction ${idx + 1}:`);
      console.log(`  ID: ${t.id}`);
      console.log(`  Date: ${t.transaction_date}`);
      console.log(`  Amount: $${t.amount}`);
      console.log(`  Description: ${t.description}`);
      console.log(`  Payee: ${t.payee || 'N/A'}`);
      console.log(`  Category: ${t.category || 'N/A'}`);
      console.log(`  Is Cleared: ${t.is_cleared}`);
      console.log(`  Bank Account ID: ${t.bank_account_id}`);
      console.log('');
    });

    // Check if it's marked as cleared
    const uncleared = data.filter(t => !t.is_cleared);
    if (uncleared.length > 0) {
      console.log('⚠️  WARNING: Found uncleared transaction(s)! Marking as cleared...');
      for (const t of uncleared) {
        const { error: updateError } = await supabase
          .from('bank_transactions')
          .update({ is_cleared: true })
          .eq('id', t.id);

        if (updateError) {
          console.error(`❌ Error updating transaction ${t.id}:`, updateError);
        } else {
          console.log(`✅ Marked transaction ${t.id} as cleared`);
        }
      }
    }

  } catch (err) {
    console.error('Error:', err);
  }
}

findTransaction();
