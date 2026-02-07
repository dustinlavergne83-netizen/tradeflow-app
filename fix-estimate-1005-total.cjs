const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function fixEstimateTotal() {
  try {
    console.log('🔍 Loading estimate 1005...');
    
    // Load the estimate
    const { data: estimate, error: estError } = await supabase
      .from('estimates')
      .select('*')
      .eq('estimate_number', '1005')
      .single();
    
    if (estError) throw estError;
    
    console.log('📊 Current total:', estimate.total);
    console.log('');
    
    // Load all items for this estimate
    const { data: items, error: itemsError } = await supabase
      .from('estimate_items')
      .select('*')
      .eq('estimate_id', estimate.id);
    
    if (itemsError) throw itemsError;
    
    // Separate parents from children
    const parents = items.filter(item => !item.parent_id);
    const children = items.filter(item => item.parent_id);
    
    console.log(`Found ${parents.length} parent items and ${children.length} child items`);
    console.log('');
    
    // Calculate section totals (only parent items)
    const sections = ['lighting', 'power', 'branch', 'switchgear', 'feeders', 'equipment', 'special'];
    
    let totalMaterials = 0;
    let totalLaborHours = 0;
    
    sections.forEach(section => {
      const sectionItems = parents.filter(item => item.section === section);
      const sectionMaterials = sectionItems.reduce((sum, item) => sum + (item.material_total || 0), 0);
      const sectionHours = sectionItems.reduce((sum, item) => {
        const qty = Number(item.quantity || 0);
        const hrs = Number(item.labor_hours || 0);
        const mult = Number(item.labor_multiplier || 1);
        return sum + (qty * hrs * mult);
      }, 0);
      
      totalMaterials += sectionMaterials;
      totalLaborHours += sectionHours;
      
      if (sectionItems.length > 0) {
        console.log(`${section}: $${sectionMaterials.toFixed(2)} materials, ${sectionHours.toFixed(2)} hours`);
      }
    });
    
    console.log('');
    console.log('📈 TOTALS:');
    console.log(`  Materials: $${totalMaterials.toFixed(2)}`);
    console.log(`  Labor Hours: ${totalLaborHours.toFixed(2)}`);
    console.log('');
    
    // Get markup settings
    const materialMarkup = estimate.material_markup_percent || 0;
    const feesMarkup = estimate.fees_markup_percent || 0;
    const packagesMarkup = estimate.packages_markup_percent || 0;
    const laborCostRate = estimate.labor_cost_rate || 25;
    const laborMarkupPercent = estimate.labor_markup_percent || 50;
    
    // Calculate fees total
    const feesTotal = (estimate.mobilization || 0) + 
                     (estimate.room_board || 0) + 
                     (estimate.equipment_rental || 0) + 
                     (estimate.material_storage || 0) + 
                     (estimate.misc_expenses || 0) + 
                     (estimate.permit_fees || 0);
    
    // Calculate packages total
    const packagesTotal = (estimate.lighting_package_cost || 0) + 
                         (estimate.switchgear_package_cost || 0) + 
                         (estimate.special_systems_cost || 0) + 
                         (estimate.subcontractors_cost || 0);
    
    // Calculate markup amounts
    const materialMarkupAmount = totalMaterials * (materialMarkup / 100);
    const feesMarkupAmount = feesTotal * (feesMarkup / 100);
    const packagesMarkupAmount = packagesTotal * (packagesMarkup / 100);
    
    // Calculate labor budget and sell price
    const laborBudgetTotal = totalLaborHours * laborCostRate;
    const laborSellPrice = laborBudgetTotal * (1 + laborMarkupPercent / 100);
    
    // Calculate CORRECT total
    const correctTotal = totalMaterials + materialMarkupAmount + 
                        feesTotal + feesMarkupAmount + 
                        packagesTotal + packagesMarkupAmount + 
                        laborSellPrice;
    
    console.log('💰 BREAKDOWN:');
    console.log(`  Materials: $${totalMaterials.toFixed(2)}`);
    console.log(`  Material Markup (${materialMarkup}%): $${materialMarkupAmount.toFixed(2)}`);
    console.log(`  Fees: $${feesTotal.toFixed(2)}`);
    console.log(`  Fees Markup (${feesMarkup}%): $${feesMarkupAmount.toFixed(2)}`);
    console.log(`  Packages: $${packagesTotal.toFixed(2)}`);
    console.log(`  Packages Markup (${packagesMarkup}%): $${packagesMarkupAmount.toFixed(2)}`);
    console.log(`  Labor Budget (${totalLaborHours.toFixed(2)} hrs × $${laborCostRate}): $${laborBudgetTotal.toFixed(2)}`);
    console.log(`  Labor Sell Price (+${laborMarkupPercent}%): $${laborSellPrice.toFixed(2)}`);
    console.log('');
    console.log(`✨ CORRECT TOTAL: $${correctTotal.toFixed(2)}`);
    console.log('');
    
    // Update the database
    const { error: updateError } = await supabase
      .from('estimates')
      .update({ total: correctTotal })
      .eq('id', estimate.id);
    
    if (updateError) throw updateError;
    
    console.log('✅ Total updated in database!');
    console.log(`   Old: $${estimate.total.toFixed(2)}`);
    console.log(`   New: $${correctTotal.toFixed(2)}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

fixEstimateTotal();
