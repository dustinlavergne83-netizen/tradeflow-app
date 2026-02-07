"""
Check what materials were skipped or had errors during import
"""

import csv
import os

CSV_FILE = r'C:\Users\dusti\Downloads\Supabase Snippet EMT Materials Export with New ID Mapping.csv'

print("🔍 Analyzing Import Issues...\n")

# Track issues
unknown_materials = []
other_materials = []
row_count = 0

with open(CSV_FILE, 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    
    for row_num, row in enumerate(reader, start=2):
        row_count += 1
        new_id = row.get('new_id', '').strip().strip('"')
        old_id = row.get('old_id', '').strip().strip('"')
        name = row.get('name', '').strip().strip('"')
        
        if new_id == 'emt_unknown':
            unknown_materials.append({
                'row': row_num,
                'old_id': old_id,
                'name': name
            })
        elif '_other' in new_id:
            other_materials.append({
                'row': row_num,
                'old_id': old_id,
                'new_id': new_id,
                'name': name
            })

print(f"📊 Total Rows in CSV: {row_count}")
print(f"❌ Materials marked as 'emt_unknown': {len(unknown_materials)}")
print(f"⚠️  Materials marked as '_other': {len(other_materials)}\n")

if unknown_materials:
    print("="*80)
    print("❌ UNKNOWN MATERIALS (couldn't determine size):")
    print("="*80)
    for mat in unknown_materials[:20]:  # Show first 20
        print(f"Row {mat['row']}: {mat['old_id']} - {mat['name']}")
    if len(unknown_materials) > 20:
        print(f"... and {len(unknown_materials) - 20} more")
    print()

if other_materials:
    print("="*80)
    print("⚠️  'OTHER' MATERIALS (couldn't determine component type):")
    print("="*80)
    for mat in other_materials[:20]:  # Show first 20
        print(f"Row {mat['row']}: {mat['old_id']} → {mat['new_id']} - {mat['name']}")
    if len(other_materials) > 20:
        print(f"... and {len(other_materials) - 20} more")
    print()

print("\n" + "="*80)
print("💡 RECOMMENDATION:")
print("="*80)
print("These materials need manual ID assignment.")
print("Open the CSV and manually set proper new_id values for these materials.")
print("Then re-run the import script.")
