import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
)

async function checkEstimate() {
  console.log('🔍 Checking estimate #1005...\n')
  
  // Get the estimate
  const { data: estimate, error } = await supabase
    .from('estimates')
    .select('*')
    .eq('estimate_number', '1005')
    .single()
  
  if (error) {
    console.error('❌ Error:', error)
    return
  }
  
  console.log('📋 Estimate #1005:')
  console.log(`   ID: ${estimate.id}`)
  console.log(`   Total in DB: $${(estimate.total || 0).toFixed(2)}`)
  console.log(`   Created: ${estimate.created_at}`)
  console.log(`   Project: ${estimate.project_name}`)
  console.log('\n')
  
  // Get all items for this estimate
  const { data: items } = await supabase
    .from('estimate_items')
    .select('*')
    .eq('estimate_id', estimate.id)
  
  console.log(`📦 Total items: ${items?.length || 0}`)
  
  // Calculate actual total from items
  const parents = items?.filter(i => !i.parent_id) || []
  console.log(`   Parent items: ${parents.length}`)
  
  const calculatedTotal = parents.reduce((sum, item) => {
    return sum + (item.material_total || 0) + (item.labor_total || 0)
  }, 0)
  
  console.log(`\n💰 Calculated total from items: $${calculatedTotal.toFixed(2)}`)
  console.log(`💾 Saved total in database: $${(estimate.total || 0).toFixed(2)}`)
  console.log(`\n${calculatedTotal.toFixed(2) === (estimate.total || 0).toFixed(2) ? '✅ MATCH!' : '❌ MISMATCH!'}`)
}

checkEstimate()
