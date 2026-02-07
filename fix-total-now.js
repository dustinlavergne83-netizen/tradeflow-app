import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
)

async function fixTotal() {
  console.log('🔧 FIXING ESTIMATE #1005 TOTAL NOW...\n')
  
  const newTotal = 6600.30
  
  const { data, error } = await supabase
    .from('estimates')
    .update({ total: newTotal })
    .eq('estimate_number', '1005')
    .select()
  
  if (error) {
    console.error('❌ Error:', error)
    return
  }
  
  console.log('✅ FIXED!')
  console.log(`   Old total: $61,770.19`)
  console.log(`   New total: $${newTotal.toFixed(2)}`)
  console.log('\n🔄 Refresh your Project page now!')
}

fixTotal()
