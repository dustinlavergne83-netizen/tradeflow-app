import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

// Try with service role key for admin access
const serviceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
const anonKey = process.env.VITE_SUPABASE_ANON_KEY

console.log('Keys available:')
console.log('  Anon key:', anonKey ? 'YES' : 'NO')
console.log('  Service key:', serviceKey ? 'YES' : 'NO')

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  serviceKey || anonKey // Use service key if available
)

async function forceFixTotal() {
  console.log('\n🔧 FORCING UPDATE...\n')
  
  try {
    // First, let's see what's in the database
    const { data: before, error: beforeError } = await supabase
      .from('estimates')
      .select('id, estimate_number, total')
      .eq('estimate_number', '1005')
      .single()
    
    if (beforeError) {
      console.error('❌ Error reading:', beforeError)
      return
    }
    
    console.log('BEFORE:')
    console.log(`  ID: ${before.id}`)
    console.log(`  Total: $${before.total}`)
    
    // Now update it
    const { data: updated, error: updateError } = await supabase
      .from('estimates')
      .update({ total: 6600.30 })
      .eq('id', before.id) // Use ID instead of estimate_number
      .select()
    
    if (updateError) {
      console.error('❌ Update error:', updateError)
      console.error('Full error:', JSON.stringify(updateError, null, 2))
      return
    }
    
    console.log('\n✅ UPDATE SUCCESSFUL!')
    console.log('Updated data:', updated)
    
    // Verify the update
    const { data: after, error: afterError } = await supabase
      .from('estimates')
      .select('total')
      .eq('id', before.id)
      .single()
    
    if (afterError) {
      console.error('❌ Error verifying:', afterError)
      return
    }
    
    console.log('\nAFTER:')
    console.log(`  Total: $${after.total}`)
    
    if (after.total === 6600.30) {
      console.log('\n🎉 SUCCESS! Total is now $6600.30')
    } else {
      console.log('\n❌ FAILED! Total is still $' + after.total)
    }
    
  } catch (err) {
    console.error('❌ EXCEPTION:', err)
  }
}

forceFixTotal()
