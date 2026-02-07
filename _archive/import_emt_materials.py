"""
Import EMT Conduit and Connectors to Database
"""

from supabase import create_client

# Supabase connection details
SUPABASE_URL = "https://hyhjxdgdetdqoyoscflu.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5aGp4ZGdkZXRkcW95b3NjZmx1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4MjQ0NDUsImV4cCI6MjA4MTQwMDQ0NX0.kuEyoo4q-7utRafZHqjPD2lndBm-vRyUPeVqjkfDUF4"
COMPANY_ID = "3c75eb59-0549-46cb-b8d2-3a006a7a6c9a"

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# EMT Conduit materials
emt_conduit = [
    {"id": "emt_0_5", "name": "1/2\" EMT Conduit", "category": "Conduit", "unit": "ft", "basecost": 0.35, "laborhours": 0.08},
    {"id": "emt_0_75", "name": "3/4\" EMT Conduit", "category": "Conduit", "unit": "ft", "basecost": 0.50, "laborhours": 0.10},
    {"id": "emt_1", "name": "1\" EMT Conduit", "category": "Conduit", "unit": "ft", "basecost": 0.85, "laborhours": 0.12},
    {"id": "emt_1_25", "name": "1-1/4\" EMT Conduit", "category": "Conduit", "unit": "ft", "basecost": 1.35, "laborhours": 0.14},
    {"id": "emt_1_5", "name": "1-1/2\" EMT Conduit", "category": "Conduit", "unit": "ft", "basecost": 1.75, "laborhours": 0.16},
    {"id": "emt_2", "name": "2\" EMT Conduit", "category": "Conduit", "unit": "ft", "basecost": 2.65, "laborhours": 0.20},
    {"id": "emt_2_5", "name": "2-1/2\" EMT Conduit", "category": "Conduit", "unit": "ft", "basecost": 4.50, "laborhours": 0.24},
    {"id": "emt_3", "name": "3\" EMT Conduit", "category": "Conduit", "unit": "ft", "basecost": 6.25, "laborhours": 0.28},
    {"id": "emt_4", "name": "4\" EMT Conduit", "category": "Conduit", "unit": "ft", "basecost": 9.50, "laborhours": 0.35},
]

# EMT Set Screw Connectors
emt_connectors = [
    {"id": "emt_connector_0_5", "name": "1/2\" EMT Set Screw Connector", "category": "Fittings", "unit": "ea", "basecost": 0.35, "laborhours": 0.05},
    {"id": "emt_connector_0_75", "name": "3/4\" EMT Set Screw Connector", "category": "Fittings", "unit": "ea", "basecost": 0.50, "laborhours": 0.05},
    {"id": "emt_connector_1", "name": "1\" EMT Set Screw Connector", "category": "Fittings", "unit": "ea", "basecost": 0.85, "laborhours": 0.06},
    {"id": "emt_connector_1_25", "name": "1-1/4\" EMT Set Screw Connector", "category": "Fittings", "unit": "ea", "basecost": 1.50, "laborhours": 0.07},
    {"id": "emt_connector_1_5", "name": "1-1/2\" EMT Set Screw Connector", "category": "Fittings", "unit": "ea", "basecost": 1.95, "laborhours": 0.08},
    {"id": "emt_connector_2", "name": "2\" EMT Set Screw Connector", "category": "Fittings", "unit": "ea", "basecost": 3.25, "laborhours": 0.10},
    {"id": "emt_connector_2_5", "name": "2-1/2\" EMT Set Screw Connector", "category": "Fittings", "unit": "ea", "basecost": 6.50, "laborhours": 0.12},
    {"id": "emt_connector_3", "name": "3\" EMT Set Screw Connector", "category": "Fittings", "unit": "ea", "basecost": 9.75, "laborhours": 0.14},
    {"id": "emt_connector_4", "name": "4\" EMT Set Screw Connector", "category": "Fittings", "unit": "ea", "basecost": 15.50, "laborhours": 0.16},
]

# Missing ground wire
ground_wire = [
    {"id": "grn_2_0", "name": "2/0 AWG Green THHN", "category": "Wire", "unit": "ft", "basecost": 4.50, "laborhours": 0.0},
]

print("🚀 Starting EMT materials import...\n")

all_materials = emt_conduit + emt_connectors + ground_wire
success_count = 0
skip_count = 0
error_count = 0

for material in all_materials:
    try:
        # Check if exists
        existing = supabase.table('base_materials').select('id').eq('id', material['id']).execute()
        
        if existing.data and len(existing.data) > 0:
            print(f"⏭️  Skipping {material['name']} - already exists")
            skip_count += 1
            continue
        
        # Insert
        insert_data = {
            'id': material['id'],
            'name': material['name'],
            'category': material['category'],
            'unit': material['unit'],
            'basecost': material['basecost'],
            'laborhours': material['laborhours']
        }
        
        supabase.table('base_materials').insert(insert_data).execute()
        print(f"✅ Imported {material['name']} - ${material['basecost']}/{material['unit']}")
        success_count += 1
        
    except Exception as e:
        print(f"❌ Error importing {material['name']}: {str(e)}")
        error_count += 1

print("\n" + "="*60)
print(f"✅ Successfully imported: {success_count}")
print(f"⏭️  Skipped (already exist): {skip_count}")
print(f"❌ Errors: {error_count}")
print(f"📊 Total processed: {len(all_materials)}")
print("="*60)

if success_count > 0:
    print("\n🎉 EMT materials imported! Now you can re-run the assembly import.")
    print("   Run: python import_10_assemblies.py")
