import json
import os
from supabase import create_client

# Supabase connection details - HARDCODED
SUPABASE_URL = "https://hyhjxdgdetdqoyoscflu.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5aGp4ZGdkZXRkcW95b3NjZmx1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4MjQ0NDUsImV4cCI6MjA4MTQwMDQ0NX0.kuEyoo4q-7utRafZHqjPD2lndBm-vRyUPeVqjkfDUF4"

# Initialize Supabase client
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# Your company_id
COMPANY_ID = "3c75eb59-0549-46cb-b8d2-3a006a7a6c9a"

# Wire materials data
wire_materials = [
    {"name": "1 AWG THHN", "category": "Wire", "unit": "ft", "basecost": "2.75", "id": "thhn_1"},
    {"name": "1/0 AWG Green THHN", "category": "Wire", "unit": "ft", "basecost": "3.60", "id": "grn_1_0"},
    {"name": "1/0 AWG THHN", "category": "Wire", "unit": "ft", "basecost": "3.50", "id": "thhn_1_0"},
    {"name": "1/0 AWG THHN AL", "category": "Wire", "unit": "ft", "basecost": "1.40", "id": "thhn_al_1_0"},
    {"name": "10 AWG Green THHN", "category": "Wire", "unit": "ft", "basecost": "0.38", "id": "grn_10"},
    {"name": "10 AWG THHN", "category": "Wire", "unit": "ft", "basecost": "0.35", "id": "thhn_10"},
    {"name": "1000 MCM THHN AL", "category": "Wire", "unit": "ft", "basecost": "9.25", "id": "thhn_al_1000"},
    {"name": "12 AWG Green THHN", "category": "Wire", "unit": "ft", "basecost": "0.24", "id": "grn_12"},
    {"name": "12 AWG THHN", "category": "Wire", "unit": "ft", "basecost": "0.22", "id": "thhn_12"},
    {"name": "14 AWG Green THHN", "category": "Wire", "unit": "ft", "basecost": "0.17", "id": "grn_14"},
    {"name": "14 AWG THHN", "category": "Wire", "unit": "ft", "basecost": "0.16", "id": "thhn_14"},
    {"name": "16 AWG THHN", "category": "Wire", "unit": "ft", "basecost": "0.12", "id": "thhn_16"},
    {"name": "2 AWG Green THHN", "category": "Wire", "unit": "ft", "basecost": "2.20", "id": "grn_2"},
    {"name": "2 AWG THHN", "category": "Wire", "unit": "ft", "basecost": "2.15", "id": "thhn_2"},
    {"name": "2/0 AWG THHN", "category": "Wire", "unit": "ft", "basecost": "4.40", "id": "thhn_2_0"},
    {"name": "2/0 AWG THHN AL", "category": "Wire", "unit": "ft", "basecost": "1.70", "id": "thhn_al_2_0"},
    {"name": "250 MCM THHN", "category": "Wire", "unit": "ft", "basecost": "9.50", "id": "thhn_250"},
    {"name": "250 MCM THHN AL", "category": "Wire", "unit": "ft", "basecost": "3.10", "id": "thhn_al_250"},
    {"name": "3 AWG THHN", "category": "Wire", "unit": "ft", "basecost": "1.70", "id": "thhn_3"},
    {"name": "3/0 AWG THHN", "category": "Wire", "unit": "ft", "basecost": "5.60", "id": "thhn_3_0"},
    {"name": "3/0 AWG THHN AL", "category": "Wire", "unit": "ft", "basecost": "2.10", "id": "thhn_al_3_0"},
    {"name": "300 MCM THHN", "category": "Wire", "unit": "ft", "basecost": "11.00", "id": "thhn_300"},
    {"name": "300 MCM THHN AL", "category": "Wire", "unit": "ft", "basecost": "3.50", "id": "thhn_al_300"},
    {"name": "350 MCM THHN", "category": "Wire", "unit": "ft", "basecost": "12.75", "id": "thhn_350"},
    {"name": "350 MCM THHN AL", "category": "Wire", "unit": "ft", "basecost": "3.95", "id": "thhn_al_350"},
    {"name": "4 AWG Green THHN", "category": "Wire", "unit": "ft", "basecost": "1.40", "id": "grn_4"},
    {"name": "4 AWG THHN", "category": "Wire", "unit": "ft", "basecost": "1.35", "id": "thhn_4"},
    {"name": "4/0 AWG Green THHN", "category": "Wire", "unit": "ft", "basecost": "7.20", "id": "grn_4_0"},
    {"name": "4/0 AWG THHN", "category": "Wire", "unit": "ft", "basecost": "7.10", "id": "thhn_4_0"},
    {"name": "4/0 AWG THHN AL", "category": "Wire", "unit": "ft", "basecost": "2.65", "id": "thhn_al_4_0"},
    {"name": "400 MCM THHN", "category": "Wire", "unit": "ft", "basecost": "14.50", "id": "thhn_400"},
    {"name": "400 MCM THHN AL", "category": "Wire", "unit": "ft", "basecost": "4.35", "id": "thhn_al_400"},
    {"name": "500 MCM THHN", "category": "Wire", "unit": "ft", "basecost": "17.75", "id": "thhn_500"},
    {"name": "500 MCM THHN AL", "category": "Wire", "unit": "ft", "basecost": "5.25", "id": "thhn_al_500"},
    {"name": "6 AWG Green THHN", "category": "Wire", "unit": "ft", "basecost": "0.90", "id": "grn_6"},
    {"name": "6 AWG THHN", "category": "Wire", "unit": "ft", "basecost": "0.85", "id": "thhn_6"},
    {"name": "600 MCM THHN", "category": "Wire", "unit": "ft", "basecost": "21.00", "id": "thhn_600"},
    {"name": "600 MCM THHN AL", "category": "Wire", "unit": "ft", "basecost": "6.15", "id": "thhn_al_600"},
    {"name": "750 MCM THHN", "category": "Wire", "unit": "ft", "basecost": "26.50", "id": "thhn_750"},
    {"name": "750 MCM THHN AL", "category": "Wire", "unit": "ft", "basecost": "7.50", "id": "thhn_al_750"},
    {"name": "8 AWG Green THHN", "category": "Wire", "unit": "ft", "basecost": "0.60", "id": "grn_8"},
    {"name": "8 AWG THHN", "category": "Wire", "unit": "ft", "basecost": "0.55", "id": "thhn_8"}
]

print(f"🔄 Starting import of {len(wire_materials)} wire materials...")
print(f"📋 Using company_id: {COMPANY_ID}")
print()

# Import each material
success_count = 0
skip_count = 0
error_count = 0

for material in wire_materials:
    try:
        # Check if material already exists
        existing = supabase.table('base_materials').select('id').eq('id', material['id']).execute()
        
        if existing.data and len(existing.data) > 0:
            print(f"⏭️  Skipping {material['name']} - already exists")
            skip_count += 1
            continue
        
        # Insert the material
        insert_data = {
            'id': material['id'],
            'name': material['name'],
            'category': material['category'],
            'unit': material['unit'],
            'basecost': float(material['basecost']),
            'laborhours': 0.0,  # Default labor hours
            'company_id': COMPANY_ID
        }
        
        result = supabase.table('base_materials').insert(insert_data).execute()
        print(f"✅ Imported {material['name']} - ${material['basecost']}/ft")
        success_count += 1
        
    except Exception as e:
        print(f"❌ Error importing {material['name']}: {str(e)}")
        error_count += 1

print()
print("=" * 60)
print(f"✅ Successfully imported: {success_count}")
print(f"⏭️  Skipped (already exist): {skip_count}")
print(f"❌ Errors: {error_count}")
print(f"📊 Total processed: {len(wire_materials)}")
print("=" * 60)

if success_count > 0:
    print()
    print("🎉 Wire materials have been imported into your database!")
    print("   You can now use them in conduit assemblies.")
