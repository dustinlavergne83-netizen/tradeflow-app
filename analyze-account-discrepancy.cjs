const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hyhjxdgdetdqoyoscflu.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5aGp4ZGdkZXRkcW95b3NjZmx1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4MjQ0NDUsImV4cCI6MjA4MTQwMDQ0NX0.kuEyoo4q-7utRafZHqjPD2lndBm-vRyUPeVqjkfDUF4';

const supabase = createClient(supabaseUrl, supabaseKey);

async function analyzeAccount() {
  try {
    console.log('='.repeat(80));
    console.log('ANALYZING HW BUSINESS CHECKING ACCOUNT (1010)');
    console.log('='.repeat(80));

    // Get ALL bank accounts first to see what we have
    const { data: allBankAccounts, error: allBankError } = await supabase
      .from('bank_accounts')
      .select('*');

    if (allBankError) {
      console.error('Error fetching bank accounts:', allBankError);
      return;
    }

    console.log('\n📊 ALL BANK ACCOUNTS IN SYSTEM:');
    if (allBankAccounts && allBankAccounts.length > 0) {
      allBankAccounts.forEach(acc => {
        console.log(`  - ${acc.id}: ${acc.account_name} (Opening: $${acc.opening_balance}, Current: $${acc.current_balance})`);
      });
    } else {
      console.log('  No bank accounts found!');
    }

    // Get all chart of accounts to see what we have
    const { data: allChartAccounts, error: allChartError } = await supabase
      .from('accounts')
      .select('*')
      .order('account_number');

    if (!allChartError && allChartAccounts && allChartAccounts.length > 0) {
      console.log('\n📖 ALL ACCOUNTS IN CHART:');
      allChartAccounts.forEach(acc => {
        console.log(`  - ${acc.account_number}: ${acc.account_name} (Balance: $${acc.current_balance})`);
      });
    }

    // Now look for HW Business Checking specifically
    let bankAccounts = allBankAccounts;
    
    if (!bankAccounts || bankAccounts.length === 0) {
      console.log('\nNo bank accounts found in bank_accounts table.');
      return;
    }

    // Try to find HW Business Checking
    let targetAccount = bankAccounts.find(acc => 
      acc.account_name && (
        acc.account_name.includes('Business Checking') || 
        acc.account_name.includes('business checking') ||
        acc.account_name.includes('HW Business')
      )
    );

    if (!targetAccount && bankAccounts.length > 0) {
      console.log('\nCould not find "Business Checking" account, using first account:', bankAccounts[0].account_name);
      targetAccount = bankAccounts[0];
    }

    if (!targetAccount) {
      console.log('\nNo suitable bank account found.');
      return;
    }

    // Get the bank account ID
    let accountId = targetAccount.id;
    
    if (!accountId) {
      console.log('Could not determine bank account ID');
      return;
    }

    console.log(`\n🏦 Bank Account ID: ${accountId}`);
    console.log(`📛 Account Name: ${bankAccounts[0].account_name}`);
    console.log(`💰 Current Balance (in system): $${bankAccounts[0].current_balance}`);
    console.log(`🏦 Opening Balance: $${bankAccounts[0].opening_balance}`);

    // Get all transactions for this account
    const { data: transactions, error: transError } = await supabase
      .from('bank_transactions')
      .select('*')
      .eq('bank_account_id', accountId)
      .order('transaction_date', { ascending: true });

    if (transError) {
      console.error('Error fetching transactions:', transError);
      return;
    }

    console.log(`\n📋 TOTAL TRANSACTIONS: ${transactions.length}`);

    // Analyze cleared vs uncleared
    const cleared = transactions.filter(t => t.is_cleared);
    const uncleared = transactions.filter(t => !t.is_cleared);

    console.log(`\n✅ CLEARED TRANSACTIONS: ${cleared.length}`);
    console.log(`❌ UNCLEARED TRANSACTIONS: ${uncleared.length}`);

    // Calculate sums
    const clearedSum = cleared.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
    const unclearedSum = uncleared.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
    const totalSum = transactions.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

    const openingBalance = parseFloat(bankAccounts[0].opening_balance || 0);
    const actualBalance = openingBalance + clearedSum;

    console.log('\n💵 AMOUNT CALCULATIONS:');
    console.log(`Opening Balance: $${openingBalance.toFixed(2)}`);
    console.log(`Sum of Cleared Transactions: $${clearedSum.toFixed(2)}`);
    console.log(`ACTUAL BALANCE (Opening + Cleared): $${actualBalance.toFixed(2)}`);
    console.log(`Sum of Uncleared Transactions: $${unclearedSum.toFixed(2)}`);
    console.log(`Total of ALL Transactions: $${totalSum.toFixed(2)}`);

    const systemBalance = parseFloat(bankAccounts[0].current_balance || 0);
    const discrepancy = actualBalance - systemBalance;

    console.log('\n⚖️  BALANCE COMPARISON:');
    console.log(`System/Books Balance: $${systemBalance.toFixed(2)}`);
    console.log(`Calculated Actual Balance: $${actualBalance.toFixed(2)}`);
    console.log(`DISCREPANCY: $${discrepancy.toFixed(2)} (${discrepancy > 0 ? 'ACTUAL OVER' : 'ACTUAL UNDER'})`);

    // Get chart of accounts entry for this account
    if (bankAccounts[0].chart_account_id) {
      const { data: chartAccount, error: chartError } = await supabase
        .from('accounts')
        .select('*')
        .eq('id', bankAccounts[0].chart_account_id);

      if (!chartError && chartAccount && chartAccount.length > 0) {
        console.log('\n📖 CHART OF ACCOUNTS ENTRY:');
        console.log(`Account Number: ${chartAccount[0].account_number}`);
        console.log(`Account Name: ${chartAccount[0].account_name}`);
        console.log(`Book Balance: $${chartAccount[0].current_balance}`);
      }
    }

    // Show recent cleared and uncleared transactions
    console.log('\n\n📌 RECENT UNCLEARED TRANSACTIONS:');
    console.log('='.repeat(80));
    uncleared.slice(-10).reverse().forEach(t => {
      console.log(`${t.transaction_date} | ${t.description.substring(0, 30).padEnd(30)} | ${t.transaction_type.padEnd(10)} | $${parseFloat(t.amount).toFixed(2).padStart(10)}`);
    });

    console.log('\n\n✅ RECENT CLEARED TRANSACTIONS:');
    console.log('='.repeat(80));
    cleared.slice(-10).reverse().forEach(t => {
      console.log(`${t.transaction_date} | ${t.description.substring(0, 30).padEnd(30)} | ${t.transaction_type.padEnd(10)} | $${parseFloat(t.amount).toFixed(2).padStart(10)}`);
    });

  } catch (err) {
    console.error('Error:', err.message);
  }
}

analyzeAccount();
