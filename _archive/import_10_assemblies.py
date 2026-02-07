"""
Import 10 EMT Conduit Assemblies from CSV to Supabase Database
"""

import csv
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
    """Load all base materials to create a mapping from IDs to details"""
    print("📦 Loading materials from database...")
    
    response = supabase.from_("base_materials").select("id, name, basecost, laborhours").execute()
    materials = response.data
    
    # Create mapping dictionary by ID
    material_map = {}
    for mat in materials:
        material_map[mat['id']] = {
            'id': mat['id'],
            'name': mat['name'],
            'cost': mat['basecost'],
            'labor': mat['laborhours']
        }
    
    print(f"✅ Loaded {len(material_map)} materials")
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
    missing_materials = set()
    
    for assembly_name, assembly_data in assemblies.items():
        try:
            print(f"\n📝 Processing: {assembly_name}")
            
            # Check if assembly already exists
            existing = supabase.from_("assemblies").select("id").eq("name", assembly_name).eq("company_id", company_id).execute()
            if existing.data and len(existing.data) > 0:
                print(f"  ⏭️  Assembly already exists, skipping...")
                continue
            
            # Validate all materials exist
            valid_components = []
            for comp in assembly_data['components']:
                mat_id = comp['material_id']
                if mat_id not in material_map:
                    print(f"  ⚠️  Material '{mat_id}' not found in database")
                    missing_materials.add(mat_id)
                    continue
                
                material = material_map[mat_id]
                
                valid_components.append({
                    'component_material_id': material['id'],
                    'component_quantity': comp['quantity'],
                    'component_quantity_type': comp['quantity_type'],
                    'component_description': comp['description'],
                    'material_id': material['id'],
                    'material_name': material['name'],
                    'quantity': comp['quantity'],
                    'unit': 'ft',
                    'material_unit_cost': material['cost'],
                    'labor_hours': material['labor'],
                    'quantity_type': comp['quantity_type'],
                    'description': comp['description']
                })
            
            if not valid_components:
                print(f"  ❌ No valid components found, skipping assembly")
                error_count += 1
                continue
            
            # Insert assembly
            assembly_insert = {
                'company_id': company_id,
                'name': assembly_name,
                'category': assembly_data['category'] or 'Conduit & Wire',
                'description': assembly_data['description'],
                'unit': 'ft',
                'is_active': True
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
            
            success_count += 1
            
        except Exception as e:
            print(f"  ❌ Error: {str(e)}")
            error_count += 1
    
    print(f"\n{'='*60}")
    print(f"✅ Import complete!")
    print(f"   Successful: {success_count}")
    print(f"   Errors: {error_count}")
    
    if missing_materials:
        print(f"\n⚠️  Missing materials in database:")
        for mat_id in sorted(missing_materials):
            print(f"   - {mat_id}")
        print(f"\n💡 You need to add these EMT materials to your database first!")
    
    print(f"{'='*60}")

if __name__ == "__main__":
    # Run import
    import_assemblies("10_conduit_assemblies_simple.csv", COMPANY_ID)
