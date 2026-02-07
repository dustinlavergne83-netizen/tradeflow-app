const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hyhjxdgdetdqoyoscflu.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5aGp4ZGdkZXRkcW95b3NjZmx1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4MjQ0NDUsImV4cCI6MjA4MTQwMDQ0NX0.kuEyoo4q-7utRafZHqjPD2lndBm-vRyUPeVqjkfDUF4';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function searchAllTransactions() {
  try {
    console.log('🔍 Searching for any transaction with amount $11,147.63...\n');
    
    // Search for the exact amount anywhere
    const { data: allAmounts, error: allError } = await supabase
      .from('bank_transactions')
      .select('id, transaction_date, description, amount, is_cleared')
      .order('transaction_date', { ascending: false })
      .limit(1000);

    if (allError) {
      console.error('Error:', allError);
      return;
    }

    // Search for matching amounts
    const matches = allAmounts.filter(t => 
      Math.abs(Math.abs(t.amount) - 11147.63) < 0.01
    );

    if (matches.length > 0) {
      console.log(`✅ Found ${matches.length} transaction(s) with amount close to $11,147.63:\n`);
      matches.forEach((t, idx) => {
        console.log(`${idx + 1}. ${t.transaction_date} - ${t.description} - $${t.amount} - Cleared: ${t.is_cleared}`);
      });
    } else {
      console.log('❌ No transaction found with that amount.');
      console.log('\n📊 Showing recent transactions:\n');
      allAmounts.slice(0, 20).forEach((t, idx) => {
        console.log(`${idx + 1}. ${t.transaction_date} - ${t.description} - $${t.amount} - Cleared: ${t.is_cleared}`);
      });
    }

  } catch (err) {
    console.error('Error:', err);
  }
}

searchAllTransactions();
