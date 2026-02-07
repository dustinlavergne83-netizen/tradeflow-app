import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
)

async function deleteDuplicates() {
  console.log('🔍 Finding and deleting duplicate entries...\n')
  
  // Get all estimate_items
  const { data: allItems, error } = await supabase
    .from('estimate_items')
    .select('*')
    .order('id')
  
  if (error) {
    console.error('❌ Error loading items:', error)
    return
  }
  
  console.log(`📦 Total items in database: ${allItems.length}\n`)
  
  // Group parent items by estimate_id + section + description + quantity
  const parentItems = allItems.filter(item => !item.parent_id)
  const groups = {}
  
  parentItems.forEach(item => {
    const key = `${item.estimate_id}-${item.section}-${item.description}-${item.quantity}`
    if (!groups[key]) {
      groups[key] = []
    }
    groups[key].push(item)
  })
  
  // Find duplicate groups
  const duplicateGroups = Object.entries(groups).filter(([key, items]) => items.length > 1)
  
  if (duplicateGroups.length === 0) {
    console.log('✅ No duplicates found!')
    return
  }
  
  console.log(`⚠️  Found ${duplicateGroups.length} items with duplicates:\n`)
  
  let totalDeleted = 0
  
  for (const [key, items] of duplicateGroups) {
    const [estimateId, section, description] = key.split('-')
    console.log(`📋 "${description}" in ${section}:`)
    console.log(`   Found ${items.length} copies`)
    console.log(`   Keeping: ID ${items[0].id}`)
    
    // Delete all but the first one
    const idsToDelete = items.slice(1).map(i => i.id)
    console.log(`   Deleting: IDs [${idsToDelete.join(', ')}]`)
    
    const { error: deleteError } = await supabase
      .from('estimate_items')
      .delete()
      .in('id', idsToDelete)
    
    if (deleteError) {
      console.error(`   ❌ Error deleting:`, deleteError)
    } else {
      console.log(`   ✅ Deleted ${idsToDelete.length} duplicates\n`)
      totalDeleted += idsToDelete.length
    }
  }
  
  console.log(`\n🎉 Cleanup complete! Deleted ${totalDeleted} duplicate entries`)
  console.log('🔄 Refresh your browser to see the updated totals')
}

deleteDuplicates()
