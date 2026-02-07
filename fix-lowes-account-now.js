#!/usr/bin/env node

/**
 * Fix Lowes Credit Card Account (2110) Configuration
 * 
 * This script fixes the sign issue where payments increase the negative balance
 * instead of decreasing it. The problem is that account 2110 needs to be:
 * - account_type = 'Liability'
 * - normal_balance = 'credit'
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hyhjxdgdetdqoyoscflu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5aGp4ZGdkZXRkcW95b3NjZmx1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4MjQ0NDUsImV4cCI6MjA4MTQwMDQ0NX0.kuEyoo4q-7utRafZHqjPD2lndBm-vRyUPeVqjkfDUF4';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  console.log('🔍 Checking Lowes Credit Card Account (2110) configuration...\n');

  try {
    // Check current configuration
    const { data: accounts, error: checkError } = await supabase
      .from('accounts')
      .select('id, account_number, account_name, account_type, normal_balance')
      .eq('account_number', '2110');

    if (checkError) {
      console.error('❌ Error checking account:', checkError.message);
      return;
    }

    if (!accounts || accounts.length === 0) {
      console.error('❌ Account 2110 not found!');
      return;
    }

    if (accounts.length > 1) {
      console.warn(`⚠️  Found ${accounts.length} accounts with number 2110. Using the first one.`);
    }

    const currentAccount = accounts[0];

    console.log('📋 Current Account Configuration:');
    console.log(`   Account Number: ${currentAccount.account_number}`);
    console.log(`   Account Name: ${currentAccount.account_name}`);
    console.log(`   Account Type: ${currentAccount.account_type}`);
    console.log(`   Normal Balance: ${currentAccount.normal_balance}`);
    console.log();

    // Check if account needs fixing
    const needsFix = currentAccount.account_type !== 'Liability' || currentAccount.normal_balance !== 'credit';

    if (!needsFix) {
      console.log('✅ Account is already correctly configured!');
      console.log('   - account_type = "Liability" ✓');
      console.log('   - normal_balance = "credit" ✓');
      console.log('\n📝 If you are still seeing issues with payments, it may be due to:');
      console.log('   1. Existing incorrect journal entries - may need to be recreated');
      console.log('   2. Unclearedtransactions - need to be re-cleared with the correct logic\n');
      return;
    }

    console.log('⚠️  Account configuration needs fixing!');
    console.log();
    console.log('Current Settings:');
    if (currentAccount.account_type !== 'Liability') {
      console.log(`   ❌ account_type = "${currentAccount.account_type}" (should be "Liability")`);
    } else {
      console.log(`   ✓ account_type = "${currentAccount.account_type}"`);
    }
    
    if (currentAccount.normal_balance !== 'credit') {
      console.log(`   ❌ normal_balance = "${currentAccount.normal_balance}" (should be "credit")`);
    } else {
      console.log(`   ✓ normal_balance = "${currentAccount.normal_balance}"`);
    }
    console.log();

    // Update the account
    console.log('🔧 Fixing account configuration...\n');

    const { data: updatedAccount, error: updateError } = await supabase
      .from('accounts')
      .update({
        account_type: 'Liability',
        normal_balance: 'credit'
      })
      .eq('account_number', '2110')
      .select()
      .single();

    if (updateError) {
      console.error('❌ Error updating account:', updateError.message);
      return;
    }

    console.log('✅ Account successfully fixed!\n');
    console.log('📋 New Account Configuration:');
    console.log(`   Account Number: ${updatedAccount.account_number}`);
    console.log(`   Account Name: ${updatedAccount.account_name}`);
    console.log(`   Account Type: ${updatedAccount.account_type}`);
    console.log(`   Normal Balance: ${updatedAccount.normal_balance}`);
    console.log();

    console.log('📝 IMPORTANT - Next Steps:');
    console.log('');
    console.log('1. ✅ Account configuration is fixed!');
    console.log('');
    console.log('2. Clear any existing transactions that have incorrect journal entries:');
    console.log('   - Go to Bank Transactions');
    console.log('   - Find any cleared Lowes credit card transactions');
    console.log('   - UNCLEAR them first (this will delete the incorrect journal entries)');
    console.log('');
    console.log('3. RE-CLEAR the transactions:');
    console.log('   - With the account now correctly configured as a Liability,');
    console.log('   - The journal entries will be created with the CORRECT debit/credit logic');
    console.log('   - Payments will now correctly REDUCE the negative balance');
    console.log('');
    console.log('4. Expected Result:');
    console.log('   - Opening balance: -$6,311.57');
    console.log('   - Payment of $500: -$6,311.57 + $500 = -$5,811.57 ✓');
    console.log('');

  } catch (err) {
    console.error('❌ Unexpected error:', err);
  }
}

main();
