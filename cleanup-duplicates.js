import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
)

async function cleanupDuplicates() {
  console.log('🔍 Finding duplicate entries...\n')
  
  // Get all estimate_items grouped by estimate_id and section
  const { data: allItems, error } = await supabase
    .from('estimate_items')
    .select('*')
    .order('estimate_id')
    .order('section')
    .order('sequence')
  
  if (error) {
    console.error('❌ Error loading items:', error)
    return
  }
  
  console.log(`📦 Total items in database: ${allItems.length}\n`)
  
  // Group by estimate + section + description to find duplicates
  const groups = {}
  allItems.forEach(item => {
    // Only check parent items (items without parent_id)
    if (!item.parent_id) {
      const key = `${item.estimate_id}-${item.section}-${item.description}`
      if (!groups[key]) {
        groups[key] = []
      }
      groups[key].push(item)
    }
  })
  
  // Find groups with duplicates
  const duplicateGroups = Object.entries(groups).filter(([key, items]) => items.length > 1)
  
  if (duplicateGroups.length === 0) {
    console.log('✅ No duplicates found!')
    return
  }
  
  console.log(`⚠️  Found ${duplicateGroups.length} items with duplicates:\n`)
  
  // Show duplicates and ask for confirmation
  let totalToDelete = 0
  duplicateGroups.forEach(([key, items]) => {
    const [estimateId, section, description] = key.split('-')
    console.log(`📋 "${description}" in ${section} section (${items.length} copies)`)
    console.log(`   IDs: ${items.map(i => i.id).join(', ')}`)
    console.log(`   Will keep: ${items[0].id} (first one)`)
    console.log(`   Will delete: ${items.slice(1).map(i => i.id).join(', ')}`)
    console.log()
    totalToDelete += items.length - 1
  })
  
  console.log(`\n🗑️  Ready to delete ${totalToDelete} duplicate entries`)
  console.log('⚠️  This will keep the FIRST occurrence of each duplicate\n')
  
  // Delete duplicates (keep first, delete rest)
  for (const [key, items] of duplicateGroups) {
    const idsToDelete = items.slice(1).map(i => i.id)
    
    console.log(`Deleting ${idsToDelete.length} duplicates of "${items[0].description}"...`)
    
    const { error: deleteError } = await supabase
      .from('estimate_items')
      .delete()
      .in('id', idsToDelete)
    
    if (deleteError) {
      console.error(`❌ Error deleting:`, deleteError)
    } else {
      console.log(`✅ Deleted ${idsToDelete.length} duplicates`)
    }
  }
  
  console.log('\n✨ Cleanup complete!')
  console.log('🔄 Refresh your estimate page to see the changes')
}

cleanupDuplicates()
