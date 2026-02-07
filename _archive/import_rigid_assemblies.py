"""
Import Rigid Conduit Assemblies from CSV to Supabase Database
This script processes the CSV file and inserts assemblies and their components properly.
"""

import csv
import os
from collections import defaultdict
from supabase import create_client, Client

# Supabase connection details - HARDCODED
SUPABASE_URL = "https://hyhjxdgdetdqoyoscflu.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5aGp4ZGdkZXRkcW95b3NjZmx1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4MjQ0NDUsImV4cCI6MjA4MTQwMDQ0NX0.kuEyoo4q-7utRafZHqjPD2lndBm-vRyUPeVqjkfDUF4"

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Your company_id
COMPANY_ID = "3c75eb59-0549-46cb-b8d2-3a006a7a6c9a"

def load_material_mapping(supabase):
    """Load all base materials to create a mapping from short names to IDs and details"""
    print("📦 Loading materials from database...")
    
    response = supabase.from_("base_materials").select("id, name, basecost, laborhours").execute()
    materials = response.data
    
    # Create mapping dictionary
    material_map = {}
    for mat in materials:
        # Create keys for common wire sizes and conduit
        name_lower = mat['name'].lower()
        
        # Handle THHN wire
        if 'thhn' in name_lower or 'thwn' in name_lower:
            for size in ['14', '12', '10', '8', '6', '4', '2', '1', '1/0', '2/0', '3/0', '4/0', '250', '300', '350', '400', '500', '600', '750']:
                if f'#{size}' in name_lower or f'{size} awg' in name_lower or f'{size}awg' in name_lower:
                    key = f"thhn_{size.replace('/', '_')}"
                    material_map[key] = {
                        'id': mat['id'],
                        'name': mat['name'],
                        'cost': mat['basecost'],
                        'labor': mat['laborhours']
                    }
                    break
        
        # Handle ground wire
        if 'ground' in name_lower or 'grounding' in name_lower or ('green' in name_lower and 'wire' in name_lower):
            for size in ['14', '12', '10', '8', '6', '4', '2', '1', '1/0', '2/0']:
                if f'#{size}' in name_lower or f'{size} awg' in name_lower:
                    key = f"grn_{size.replace('/', '_')}"
                    material_map[key] = {
                        'id': mat['id'],
                        'name': mat['name'],
                        'cost': mat['basecost'],
                        'labor': mat['laborhours']
                    }
                    break
        
        # Handle rigid conduit
        if 'rigid' in name_lower and 'conduit' in name_lower:
            for size in ['0.5', '0.75', '1', '1.25', '1.5', '2', '2.5', '3', '4']:
                size_variants = [
                    f'{size}"',
                    f'{size} "',
                    f'{size}in',
                    f'{size} in'
                ]
                # Also check fractional equivalents
                if size == '0.5':
                    size_variants.extend(['1/2"', '1/2 "', '1/2in'])
                elif size == '0.75':
                    size_variants.extend(['3/4"', '3/4 "', '3/4in'])
                elif size == '1.25':
                    size_variants.extend(['1-1/4"', '1-1/4 "'])
                elif size == '1.5':
                    size_variants.extend(['1-1/2"', '1-1/2 "'])
                elif size == '2.5':
                    size_variants.extend(['2-1/2"', '2-1/2 "'])
                
                if any(variant in name_lower for variant in size_variants):
                    key = f"rigid_{size.replace('.', '_')}"
                    material_map[key] = {
                        'id': mat['id'],
                        'name': mat['name'],
                        'cost': mat['basecost'],
                        'labor': mat['laborhours']
                    }
                    break
        
        # Handle rigid straps
        if 'rigid' in name_lower and 'strap' in name_lower:
            for size in ['0.5', '0.75', '1', '1.25', '1.5', '2', '2.5', '3', '4']:
                size_variants = [f'{size}"']
                if size == '0.5':
                    size_variants.extend(['1/2"', '1/2 "'])
                elif size == '0.75':
                    size_variants.extend(['3/4"', '3/4 "'])
                elif size == '1.25':
                    size_variants.extend(['1-1/4"'])
                elif size == '1.5':
                    size_variants.extend(['1-1/2"'])
                elif size == '2.5':
                    size_variants.extend(['2-1/2"'])
                
                if any(variant in name_lower for variant in size_variants):
                    key = f"rigid_strap_{size.replace('.', '_')}"
                    material_map[key] = {
                        'id': mat['id'],
                        'name': mat['name'],
                        'cost': mat['basecost'],
                        'labor': mat['laborhours']
                    }
                    break
    
    print(f"✅ Loaded {len(material_map)} material mappings")
    return material_map

def parse_csv(filename):
    """Parse the CSV and group components by assembly"""
    assemblies = defaultdict(lambda: {
        'category': '',
        'description': '',
        'components': []
    })
    
    with open(filename, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            assembly_name = row['assembly_name'].strip()
            
            # Skip empty rows
            if not assembly_name:
                continue
            
            # Store assembly metadata
            if row['assembly_category']:
                assemblies[assembly_name]['category'] = row['assembly_category']
            if row['assembly_description']:
                assemblies[assembly_name]['description'] = row['assembly_description']
            
            # Add component
            if row['component_material_id']:
                assemblies[assembly_name]['components'].append({
                    'material_id': row['component_material_id'],
                    'quantity': float(row['component_quantity']),
                    'quantity_type': row['component_quantity_type'],
                    'description': row['component_description']
                })
    
    return assemblies

def import_assemblies(csv_filename, company_id):
    """Main import function"""
    print("🚀 Starting assembly import...")
    
    # Load material mapping
    material_map = load_material_mapping(supabase)
    
    # Parse CSV
    print(f"📄 Reading CSV file: {csv_filename}")
    assemblies = parse_csv(csv_filename)
    print(f"✅ Found {len(assemblies)} unique assemblies")
    
    # Process each assembly
    success_count = 0
    error_count = 0
    
    for assembly_name, assembly_data in assemblies.items():
        try:
            print(f"\n📝 Processing: {assembly_name}")
            
            # Calculate totals
            total_material_cost = 0
            total_labor_hours = 0
            
            valid_components = []
            for comp in assembly_data['components']:
                mat_id = comp['material_id']
                if mat_id not in material_map:
                    print(f"  ⚠️  Material '{mat_id}' not found in database, skipping...")
                    continue
                
                material = material_map[mat_id]
                qty = comp['quantity']
                
                # Adjust quantity based on type
                if comp['quantity_type'] == 'per_10_feet':
                    qty = qty / 10  # Convert to per_foot
                
                total_material_cost += material['cost'] * qty
                total_labor_hours += material['labor'] * qty
                
                valid_components.append({
                    'material_id': material['id'],
                    'material_name': material['name'],
                    'quantity': qty,
                    'unit': 'ft',  # Assuming per foot
                    'material_unit_cost': material['cost'],
                    'labor_hours': material['labor']
                })
            
            if not valid_components:
                print(f"  ❌ No valid components found, skipping assembly")
                error_count += 1
                continue
            
            # Insert assembly
            assembly_insert = {
                'company_id': company_id,
                'name': assembly_name,
                'category': assembly_data['category'] or 'Rigid Conduit',
                'description': assembly_data['description'],
                'unit': 'ft',
                'total_material_cost': round(total_material_cost, 2),
                'total_labor_hours': round(total_labor_hours, 2)
            }
            
            result = supabase.from_("assemblies").insert(assembly_insert).execute()
            assembly_id = result.data[0]['id']
            print(f"  ✅ Assembly created (ID: {assembly_id})")
            
            # Insert components
            for idx, comp in enumerate(valid_components):
                comp['assembly_id'] = assembly_id
                comp['sequence'] = idx
            
            supabase.from_("assembly_components").insert(valid_components).execute()
            print(f"  ✅ Added {len(valid_components)} components")
            print(f"  💰 Total cost: ${total_material_cost:.2f}, Labor: {total_labor_hours:.2f}h")
            
            success_count += 1
            
        except Exception as e:
            print(f"  ❌ Error: {str(e)}")
            error_count += 1
    
    print(f"\n{'='*60}")
    print(f"✅ Import complete!")
    print(f"   Successful: {success_count}")
    print(f"   Errors: {error_count}")
    print(f"{'='*60}")

if __name__ == "__main__":
    # Path to your CSV file
    csv_file = r"c:\Users\dusti\OneDrive\Desktop\Material database\Rigid Con Assemblies.csv"
    
    # Run import
    import_assemblies(csv_file, COMPANY_ID)
