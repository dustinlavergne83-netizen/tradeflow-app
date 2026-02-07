import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function findBankAccount() {
  try {
    console.log('🔍 Finding all Asset accounts...\n');

    // Get all asset accounts
    const { data, error } = await supabase
      .from('accounts')
      .select('id, account_number, account_name, normal_balance, balance, account_type')
      .eq('account_type', 'Asset')
      .order('account_number', { ascending: true });

    if (error) {
      console.error('❌ Error fetching accounts:', error);
      return;
    }

    if (!data || data.length === 0) {
      console.log('⚠️  No asset accounts found.');
      return;
    }

    console.log('Asset Accounts:');
    data.forEach(account => {
      console.log(`\n  ID: ${account.id}`);
      console.log(`  Number: ${account.account_number}`);
      console.log(`  Name: ${account.account_name}`);
      console.log(`  Normal Balance: ${account.normal_balance}`);
      console.log(`  Current Balance: $${account.balance}`);
      console.log(`  Account Type: ${account.account_type}`);
    });

  } catch (err) {
    console.error('Fatal error:', err);
  }
}

findBankAccount();
