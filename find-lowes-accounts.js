#!/usr/bin/env node

/**
 * Find all Lowes accounts in the database
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hyhjxdgdetdqoyoscflu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5aGp4ZGdkZXRkcW95b3NjZmx1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4MjQ0NDUsImV4cCI6MjA4MTQwMDQ0NX0.kuEyoo4q-7utRafZHqjPD2lndBm-vRyUPeVqjkfDUF4';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  console.log('🔍 Searching for Lowes accounts...\n');

  try {
    // First, get all accounts with "Lowes" in name
    const { data: accounts, error: searchError } = await supabase
      .from('accounts')
      .select('*')
      .ilike('account_name', '%lowes%');

    if (searchError) {
      console.error('❌ Error searching accounts:', searchError.message);
      return;
    }

    if (!accounts || accounts.length === 0) {
      console.log('❌ No accounts with "Lowes" in name found');
      console.log('\n📝 Let me check ALL liability accounts instead...\n');
      
      const { data: liabilities } = await supabase
        .from('accounts')
        .select('*')
        .eq('account_type', 'Liability');
      
      console.log('📋 All Liability Accounts:');
      if (liabilities && liabilities.length > 0) {
        liabilities.forEach(acc => {
          console.log(`   ${acc.account_number} - ${acc.account_name} (Balance: ${acc.balance}, Normal: ${acc.normal_balance})`);
        });
      } else {
        console.log('   (None found)');
      }
      return;
    }

    console.log(`✅ Found ${accounts.length} account(s) with "Lowes" in name:\n`);
    
    accounts.forEach((acc, i) => {
      console.log(`${i + 1}. Account Details:`);
      console.log(`   ID: ${acc.id}`);
      console.log(`   Account Number: ${acc.account_number}`);
      console.log(`   Account Name: ${acc.account_name}`);
      console.log(`   Account Type: ${acc.account_type}`);
      console.log(`   Normal Balance: ${acc.normal_balance}`);
      console.log(`   Balance: ${acc.balance}`);
      console.log();
    });

  } catch (err) {
    console.error('❌ Unexpected error:', err);
  }
}

main();
