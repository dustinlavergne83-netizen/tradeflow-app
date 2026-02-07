#!/usr/bin/env python3
"""
Import Assemblies from CSV Template
Generates SQL INSERT statements for assemblies and their components
"""

import csv
import sys
from collections import defaultdict

def generate_assembly_imports(csv_file):
    """Read CSV and generate SQL INSERT statements"""
    
    # Read the CSV file
    assemblies = defaultdict(lambda: {
        'name': '',
        'category': '',
        'description': '',
        'components': []
    })
    
    try:
        with open(csv_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            
            for row in reader:
                assembly_name = row['assembly_name']
                
                # Store assembly info
                if not assemblies[assembly_name]['name']:
                    assemblies[assembly_name]['name'] = assembly_name
                    assemblies[assembly_name]['category'] = row['assembly_category']
                    assemblies[assembly_name]['description'] = row['assembly_description']
                
                # Add component
                assemblies[assembly_name]['components'].append({
                    'material_id': row['component_material_id'],
                    'quantity': row['component_quantity'],
                    'quantity_type': row['component_quantity_type'],
                    'description': row.get('component_description', '')
                })
    
    except FileNotFoundError:
        print(f"ERROR: File '{csv_file}' not found!")
        sys.exit(1)
    except Exception as e:
        print(f"ERROR reading CSV: {e}")
        sys.exit(1)
    
    # Generate SQL
    print("-- Generated SQL for Assembly Import")
    print("-- Run this in Supabase SQL Editor")
    print("-- Make sure to replace 'YOUR_COMPANY_ID' with your actual user ID\n")
    
    print("BEGIN;\n")
    
    for assembly_name, assembly_data in assemblies.items():
        print(f"-- Assembly: {assembly_name}")
        print(f"-- Category: {assembly_data['category']}")
        print(f"-- Components: {len(assembly_data['components'])}\n")
        
        # Insert assembly
        print(f"INSERT INTO assemblies (company_id, name, category, description, unit, is_custom, is_active)")
        print(f"VALUES (")
        print(f"  'YOUR_COMPANY_ID',")
        print(f"  '{assembly_data['name'].replace("'", "''")}',")
        print(f"  '{assembly_data['category']}',")
        print(f"  '{assembly_data['description'].replace("'", "''")}',")
        print(f"  'ea',")
        print(f"  true,")
        print(f"  true")
        print(f")")
        print(f"RETURNING id INTO assembly_id_{assemblies.keys().list().index(assembly_name) + 1};")
        print()
        
        # Insert components
        for idx, component in enumerate(assembly_data['components'], 1):
            print(f"-- Component {idx}: {component['description']}")
            print(f"INSERT INTO assembly_components (")
            print(f"  assembly_id,")
            print(f"  material_id,")
            print(f"  quantity,")
            print(f"  quantity_type,")
            print(f"  description,")
            print(f"  sequence")
            print(f")")
            print(f"SELECT ")
            print(f"  id,")
            print(f"  (SELECT id FROM base_materials WHERE id = '{component['material_id']}' LIMIT 1),")
            print(f"  {component['quantity']},")
            print(f"  '{component['quantity_type']}',")
            desc = component['description'].replace("'", "''") if component['description'] else ''
            print(f"  '{desc}',")
            print(f"  {idx}")
            print(f"FROM assemblies")
            print(f"WHERE name = '{assembly_data['name'].replace("'", "''")}'")
            print(f"  AND company_id = 'YOUR_COMPANY_ID'")
            print(f"LIMIT 1;")
            print()
        
        print()
    
    print("COMMIT;")
    print()
    print("-- ✅ SQL generation complete!")
    print(f"-- Total assemblies: {len(assemblies)}")
    print(f"-- Total components: {sum(len(a['components']) for a in assemblies.values())}")

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python import_assemblies_from_csv.py <csv_file>")
        print("Example: python import_assemblies_from_csv.py public/assemblies_import_template.csv")
        sys.exit(1)
    
    csv_file = sys.argv[1]
    generate_assembly_imports(csv_file)
