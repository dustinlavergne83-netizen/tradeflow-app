import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
)

async function deleteDuplicates() {
  const estimateId = '9e399f51-24d7-4d03-b891-34c96c7259aa'
  
  console.log('🔍 Loading all items for estimate #1005...\n')
  
  // Get all parent items
  const { data: items, error } = await supabase
    .from('estimate_items')
    .select('*')
    .eq('estimate_id', estimateId)
    .is('parent_id', null)
    .order('created_at')
  
  if (error) {
    console.error('❌ Error loading items:', error)
    return
  }
  
  console.log(`📦 Found ${items.length} total parent items\n`)
  
  // Group by description + quantity + section
  const groups = new Map()
  items.forEach(item => {
    const key = `${item.description}-${item.quantity}-${item.section}`
    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key).push(item)
  })
  
  // Find duplicates
  const toDelete = []
  groups.forEach((group, key) => {
    if (group.length > 1) {
      console.log(`⚠️  DUPLICATE: "${group[0].description}" (${group.length} copies)`)
      // Keep first, delete rest
      group.slice(1).forEach(item => {
        console.log(`   🗑️  Will delete ID: ${item.id}`)
        toDelete.push(item.id)
      })
    }
  })
  
  if (toDelete.length === 0) {
    console.log('\n✅ No duplicates found!')
    return
  }
  
  console.log(`\n💥 Deleting ${toDelete.length} duplicate items...`)
  
  const { error: deleteError } = await supabase
    .from('estimate_items')
    .delete()
    .in('id', toDelete)
  
  if (deleteError) {
    console.error('❌ Delete error:', deleteError)
    return
  }
  
  console.log('✅ Duplicates deleted!')
  
  // Verify
  const { data: afterItems } = await supabase
    .from('estimate_items')
    .select('id')
    .eq('estimate_id', estimateId)
    .is('parent_id', null)
  
  console.log(`\n📊 Remaining items: ${afterItems.length}`)
  console.log('\n🎉 DONE! Refresh your app to see the fix.')
}

deleteDuplicates()
