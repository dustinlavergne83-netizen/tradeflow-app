const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function fixEstimateTotal() {
  try {
    console.log('🔍 Searching for estimate #1005...');
    
    // 1. Find estimate by number
    const { data: estimate, error: estError } = await supabase
      .from('estimates')
      .select('*')
      .eq('estimate_number', '1005')
      .single();
    
    if (estError) throw estError;
    
    console.log('📋 Estimate #', estimate.estimate_number);
    console.log('📋 Estimate ID:', estimate.id);
    console.log('Current total in DB:', estimate.total);
    
    // 2. Load all estimate items
    const { data: items, error: itemsError } = await supabase
      .from('estimate_items')
      .select('*')
      .eq('estimate_id', estimate.id);
    
    if (itemsError) throw itemsError;
    
    console.log('📦 Total items:', items.length);
    
    // 3. Calculate materials total (only parent items, children are included in parent totals)
    const parentItems = items.filter(item => !item.parent_id);
    const grandTotalMaterials = parentItems.reduce((sum, item) => {
      return sum + (item.material_total || 0);
    }, 0);
    
    console.log('💰 Materials subtotal:', grandTotalMaterials.toFixed(2));
    
    // 4. Calculate total labor hours (only parent items)
    const totalLaborHours = parentItems.reduce((sum, item) => {
      const qty = Number(item.quantity || 0);
      const hours = Number(item.labor_hours || 0);
      const mult = Number(item.labor_multiplier || 1);
      return sum + (qty * hours * mult);
    }, 0);
    
    console.log('⏱️  Total labor hours:', totalLaborHours.toFixed(2));
    
    // 5. Get fees, packages, and markup settings
    const mobilization = estimate.mobilization || 0;
    const roomBoard = estimate.room_board || 0;
    const equipmentRental = estimate.equipment_rental || 0;
    const materialStorage = estimate.material_storage || 0;
    const miscExpenses = estimate.misc_expenses || 0;
    const permitFees = estimate.permit_fees || 0;
    
    const feesTotal = mobilization + roomBoard + equipmentRental + materialStorage + miscExpenses + permitFees;
    console.log('🎫 Fees total:', feesTotal.toFixed(2));
    
    const lightingPackageCost = estimate.lighting_package_cost || 0;
    const switchgearPackageCost = estimate.switchgear_package_cost || 0;
    const specialSystemsCost = estimate.special_systems_cost || 0;
    const subcontractorsCost = estimate.subcontractors_cost || 0;
    
    const packagesTotal = lightingPackageCost + switchgearPackageCost + specialSystemsCost + subcontractorsCost;
    console.log('📦 Packages total:', packagesTotal.toFixed(2));
    
    // 6. Calculate markup amounts
    const materialMarkup = estimate.material_markup_percent || 0;
    const feesMarkup = estimate.fees_markup_percent || 0;
    const packagesMarkup = estimate.packages_markup_percent || 0;
    
    const materialMarkupAmount = grandTotalMaterials * (materialMarkup / 100);
    const feesMarkupAmount = feesTotal * (feesMarkup / 100);
    const packagesMarkupAmount = packagesTotal * (packagesMarkup / 100);
    
    console.log('📈 Material markup:', materialMarkupAmount.toFixed(2), `(${materialMarkup}%)`);
    console.log('📈 Fees markup:', feesMarkupAmount.toFixed(2), `(${feesMarkup}%)`);
    console.log('📈 Packages markup:', packagesMarkupAmount.toFixed(2), `(${packagesMarkup}%)`);
    
    // 7. Calculate labor sell price
    const laborCostRate = estimate.labor_cost_rate || 25;
    const laborMarkupPercent = estimate.labor_markup_percent || 50;
    
    const laborBudgetTotal = totalLaborHours * laborCostRate;
    const laborSellPrice = laborBudgetTotal * (1 + laborMarkupPercent / 100);
    
    console.log('👷 Labor budget:', laborBudgetTotal.toFixed(2), `(${totalLaborHours.toFixed(2)} hrs @ $${laborCostRate}/hr)`);
    console.log('👷 Labor sell price:', laborSellPrice.toFixed(2), `(${laborMarkupPercent}% markup)`);
    
    // 8. Calculate CORRECT total using Summary formula
    const correctTotal = grandTotalMaterials + materialMarkupAmount + feesTotal + feesMarkupAmount + packagesTotal + packagesMarkupAmount + laborSellPrice;
    
    console.log('\n' + '='.repeat(50));
    console.log('🎯 CORRECT TOTAL:', correctTotal.toFixed(2));
    console.log('❌ OLD TOTAL:', estimate.total.toFixed(2));
    console.log('📊 DIFFERENCE:', (correctTotal - estimate.total).toFixed(2));
    console.log('='.repeat(50) + '\n');
    
    // 9. Update the database
    console.log('💾 Updating database...');
    const { error: updateError } = await supabase
      .from('estimates')
      .update({ total: correctTotal })
      .eq('id', estimate.id);
    
    if (updateError) throw updateError;
    
    console.log('✅ SUCCESS! Estimate #1005 total updated to $' + correctTotal.toFixed(2));
    console.log('🔄 Refresh your browser to see the updated total on the Projects page!');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixEstimateTotal();
