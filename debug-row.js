// Add this temporarily to materialTotal function to debug
console.log('🔍 materialTotal called for row:', {
  item: row.item,
  hasChildren: !!row.children,
  childrenLength: row.children?.length || 0,
  children: row.children,
  qty: row.qty
});

if (row.children && row.children.length > 0) {
  console.log('📊 Children details:');
  row.children.forEach((child, idx) => {
    console.log(`  Child ${idx}:`, {
      desc: child.description,
      qty: child.quantity,
      price: child.material_unit_cost,
      calc: (child.quantity || 0) * (child.material_unit_cost || 0)
    });
  });
  
  const total = row.children.reduce((sum, child) => {
    const childQty = Number(child.quantity || 0);
    const childPrice = Number(child.material_unit_cost || 0);
    const childTotal = childQty * childPrice;
    console.log(`    Adding ${childQty} × $${childPrice} = $${childTotal}`);
    return sum + childTotal;
  }, 0) * Number(row.qty || 1);
  
  console.log(`  🎯 Final total: $${total} (subtotal × qty ${row.qty})`);
}
