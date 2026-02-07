#!/usr/bin/env node

/**
 * IMMEDIATE DIAGNOSTIC AND FIX
 * Check account 2110 and fix the sign issue NOW
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hyhjxdgdetdqoyoscflu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5aGp4ZGdkZXRkcW95b3NjZmx1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4MjQ0NDUsImV4cCI6MjA4MTQwMDQ0NX0.kuEyoo4q-7utRafZHqjPD2lndBm-vRyUPeVqjkfDUF4';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  console.log('🔧 CHECKING ACCOUNT 2110 AND FIXING SIGN ISSUE...\n');

  try {
    // Get ALL accounts with account number starting with 21
    const { data: allAccounts } = await supabase
      .from('accounts')
      .select('*')
      .gte('account_number', '2100')
      .lte('account_number', '2200');

    console.log('📋 All accounts in 2100-2200 range:');
    if (allAccounts && allAccounts.length > 0) {
      allAccounts.forEach(acc => {
        console.log(`   ${acc.account_number} - ${acc.account_name}`);
        console.log(`      Type: ${acc.account_type}, Normal Balance: ${acc.normal_balance}, Balance: ${acc.balance}`);
      });
    } else {
      console.log('   (None found)');
    }
    console.log();

    // Find Lowes by name
    const { data: lowesAccounts } = await supabase
      .from('accounts')
      .select('*')
      .ilike('account_name', '%lowes%');

    if (!lowesAccounts || lowesAccounts.length === 0) {
      console.log('❌ NO LOWES ACCOUNT FOUND!');
      console.log('\n⚠️  Account needs to be created. See LOWES-CREDIT-CARD-SETUP.md');
      return;
    }

    console.log(`✅ FOUND ${lowesAccounts.length} Lowes account(s):\n`);

    for (const account of lowesAccounts) {
      console.log(`🏠 Account: ${account.account_number} - ${account.account_name}`);
      console.log(`   ID: ${account.id}`);
      console.log(`   Type: ${account.account_type}`);
      console.log(`   Normal Balance: ${account.normal_balance}`);
      console.log(`   Current Balance: ${account.balance}`);
      console.log();

      // CHECK FOR PROBLEMS
      const problems = [];
      
      if (account.account_type !== 'Liability') {
        problems.push(`❌ Account Type is "${account.account_type}" but should be "Liability"`);
      }
      if (account.normal_balance !== 'credit') {
        problems.push(`❌ Normal Balance is "${account.normal_balance}" but should be "credit"`);
      }

      if (problems.length > 0) {
        console.log('🚨 PROBLEMS FOUND:');
        problems.forEach(p => console.log(`   ${p}`));
        console.log();

        console.log('🔧 FIXING NOW...\n');

        const { error: updateError } = await supabase
          .from('accounts')
          .update({
            account_type: 'Liability',
            normal_balance: 'credit'
          })
          .eq('id', account.id);

        if (updateError) {
          console.error('❌ FIX FAILED:', updateError.message);
          return;
        }

        console.log('✅ ACCOUNT FIXED!');
        console.log('   account_type = "Liability" ✓');
        console.log('   normal_balance = "credit" ✓');
        console.log();
      } else {
        console.log('✅ Account configuration looks CORRECT');
        console.log();
      }

      // Check journal entries for this account
      console.log('📊 Journal Entries for this account:\n');

      const { data: entries } = await supabase
        .from('journal_entry_lines')
        .select(`
          id,
          entry_id,
          debit,
          credit,
          journal_entries!inner(
            entry_number,
            entry_date,
            description
          )
        `)
        .eq('account_id', account.id)
        .order('journal_entries(entry_date)', { ascending: false });

      if (entries && entries.length > 0) {
        entries.slice(0, 10).forEach(line => {
          const je = line.journal_entries;
          const debitCredit = line.debit > 0 ? `DEBIT: $${line.debit}` : `CREDIT: $${line.credit}`;
          console.log(`   Entry #${je.entry_number} (${je.entry_date})`);
          console.log(`      ${debitCredit}`);
          console.log(`      ${je.description}`);
        });
        console.log(`   ... (${entries.length} total entries)`);
      } else {
        console.log('   (No entries found)');
      }
      console.log();

      // NEXT STEPS
      console.log('📋 NEXT STEPS:\n');
      console.log('1. ✅ Account configuration is now FIXED');
      console.log('');
      console.log('2. UNCLEAR any cleared transactions with wrong entries:');
      console.log('   - Go to Bank Transactions');
      console.log('   - Find Lowes credit card payments');
      console.log('   - Click UNCHECK to mark as not cleared');
      console.log('   - This will DELETE the incorrect journal entries');
      console.log('');
      console.log('3. RE-CLEAR those transactions:');
      console.log('   - Now with CORRECT account type (Liability),');
      console.log('   - NEW journal entries will be created with CORRECT debit/credit');
      console.log('');
      console.log('4. Check Chart of Accounts:');
      console.log('   - Balance should decrease (become less negative) when you pay');
      console.log('   - Example: -$6,311.57 - $500 payment = -$5,811.57 ✓');
      console.log();
    }

  } catch (err) {
    console.error('❌ ERROR:', err.message);
  }
}

main();
