import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function fixAccountNormalBalance() {
  try {
    console.log('🔧 Fixing bank account normal balance...');

    // Update the account's normal_balance from 'debit' to 'credit'
    const { data, error } = await supabase
      .from('accounts')
      .update({ normal_balance: 'credit' })
      .eq('account_type', 'Asset')
      .eq('normal_balance', 'debit')
      .like('account_name', '%checking%')
      .select('id, account_number, account_name, normal_balance, balance');

    if (error) {
      console.error('❌ Error updating account:', error);
      return;
    }

    if (!data || data.length === 0) {
      console.log('⚠️  No checking accounts found to update.');
      return;
    }

    console.log('✅ Successfully updated accounts:');
    data.forEach(account => {
      console.log(`   - ${account.account_number}: ${account.account_name}`);
      console.log(`     Normal Balance: ${account.normal_balance}`);
      console.log(`     Current Balance: $${account.balance}`);
    });

    // Now recalculate the balance from journal entries
    console.log('\n📊 Recalculating balances from journal entries...');
    
    for (const account of data) {
      // Get all journal entry lines for this account
      const { data: journalLines, error: linesError } = await supabase
        .from('journal_entry_lines')
        .select('debit, credit')
        .eq('account_id', account.id);

      if (linesError) {
        console.error(`Error loading journal lines for account ${account.id}:`, linesError);
        continue;
      }

      // Calculate balance based on new normal_balance setting (credit)
      let calculatedBalance = 0;
      if (journalLines && journalLines.length > 0) {
        const totalDebits = journalLines.reduce((sum, line) => sum + parseFloat(line.debit || 0), 0);
        const totalCredits = journalLines.reduce((sum, line) => sum + parseFloat(line.credit || 0), 0);
        
        // For credit normal balance: credits - debits
        calculatedBalance = totalCredits - totalDebits;
      }

      // Update the account balance
      const { error: updateError } = await supabase
        .from('accounts')
        .update({ balance: calculatedBalance })
        .eq('id', account.id);

      if (updateError) {
        console.error(`Error updating balance for ${account.account_name}:`, updateError);
      } else {
        console.log(`   ✓ ${account.account_name}: Updated balance to $${calculatedBalance.toFixed(2)}`);
      }
    }

    console.log('\n✅ All done! Your account is now fixed.');
    console.log('📝 Deposits will now appear as CREDITS and expenses as DEBITS.');

  } catch (err) {
    console.error('Fatal error:', err);
  }
}

fixAccountNormalBalance();
