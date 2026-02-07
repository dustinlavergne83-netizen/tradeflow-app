import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
)

// MANUAL ITEMS FROM YOUR LIGHTING SECTION
// Replace these with your ACTUAL items if different
const ITEMS = [
  {
    description: '4" Square Box',
    quantity: 7,
    section: 'lighting',
    material_unit_cost: 2.50,
    labor_hours: 0.1,
    unit: 'ea'
  },
  {
    description: '4" Octagon Box',
    quantity: 7,
    section: 'lighting',
    material_unit_cost: 3.00,
    labor_hours: 0.15,
    unit: 'ea'
  },
  {
    description: 'Single Gang Box',
    quantity: 7,
    section: 'lighting',
    material_unit_cost: 1.50,
    labor_hours: 0.1,
    unit: 'ea'
  },
  {
    description: '3 Gang Box',
    quantity: 7,
    section: 'lighting',
    material_unit_cost: 4.00,
    labor_hours: 0.2,
    unit: 'ea'
  },
  {
    description: '2 Gang Box',
    quantity: 7,
    section: 'lighting',
    material_unit_cost: 3.00,
    labor_hours: 0.15,
    unit: 'ea'
  },
  {
    description: 'Decora Switch',
    quantity: 7,
    section: 'lighting',
    material_unit_cost: 2.00,
    labor_hours: 0.1,
    unit: 'ea'
  },
  {
    description: 'Decora Dimmer',
    quantity: 7,
    section: 'lighting',
    material_unit_cost: 15.00,
    labor_hours: 0.15,
    unit: 'ea'
  }
]

async function manualSave() {
  const estimateId = '9e399f51-24d7-4d03-b891-34c96c7259aa'
  
  console.log('💾 Manually saving items to estimate #1005...\n')
  
  // First, delete ALL items for this estimate to start fresh
  console.log('🗑️  Deleting any existing items...')
  await supabase
    .from('estimate_items')
    .delete()
    .eq('estimate_id', estimateId)
  
  // Build items with calculated totals
  const itemsToInsert = ITEMS.map((item, idx) => {
    const materialTotal = item.quantity * item.material_unit_cost
    const laborTotal = item.quantity * item.labor_hours * 85 // $85/hr
    const lineTotal = materialTotal + laborTotal
    
    return {
      estimate_id: estimateId,
      line_type: 'material',
      section: item.section,
      sequence: idx,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      material_unit_cost: item.material_unit_cost,
      material_total: materialTotal,
      waste_factor: 0,
      labor_hours: item.labor_hours,
      labor_multiplier: 1,
      labor_rate: 85,
      labor_total: laborTotal,
      equipment_total: 0,
      subcontractor_cost: 0,
      line_total: lineTotal,
      parent_id: null
    }
  })
  
  console.log(`📝 Inserting ${itemsToInsert.length} items...\n`)
  
  itemsToInsert.forEach((item, idx) => {
    const matTotal = item.material_total
    const labTotal = item.labor_total
    console.log(`${idx + 1}. ${item.description} (Qty: ${item.quantity})`)
    console.log(`   Mat: $${matTotal.toFixed(2)} | Lab: $${labTotal.toFixed(2)} | Total: $${item.line_total.toFixed(2)}`)
  })
  
  const { error } = await supabase
    .from('estimate_items')
    .insert(itemsToInsert)
  
  if (error) {
    console.error('\n❌ Error:', error)
    return
  }
  
  // Calculate grand total
  const grandTotal = itemsToInsert.reduce((sum, item) => sum + item.line_total, 0)
  
  console.log(`\n💰 Grand Total: $${grandTotal.toFixed(2)}`)
  
  // Update estimate total
  console.log('\n📊 Updating estimate total...')
  await supabase
    .from('estimates')
    .update({ total: grandTotal })
    .eq('id', estimateId)
  
  console.log('\n✅ DONE! Refresh your app.')
}

manualSave()
