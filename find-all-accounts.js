import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function findAllAccounts() {
  try {
    console.log('🔍 Finding ALL accounts...\n');

    // Get all accounts
    const { data, error } = await supabase
      .from('accounts')
      .select('id, account_number, account_name, normal_balance, balance, account_type')
      .order('account_number', { ascending: true });

    if (error) {
      console.error('❌ Error fetching accounts:', error);
      return;
    }

    if (!data || data.length === 0) {
      console.log('⚠️  No accounts found.');
      return;
    }

    console.log(`\nTotal Accounts: ${data.length}\n`);
    data.forEach((account, idx) => {
      console.log(`${idx + 1}. ID: ${account.id}`);
      console.log(`   Number: ${account.account_number}`);
      console.log(`   Name: ${account.account_name}`);
      console.log(`   Type: ${account.account_type}`);
      console.log(`   Normal Balance: ${account.normal_balance}`);
      console.log(`   Current Balance: $${account.balance}\n`);
    });

  } catch (err) {
    console.error('Fatal error:', err);
  }
}

findAllAccounts();
