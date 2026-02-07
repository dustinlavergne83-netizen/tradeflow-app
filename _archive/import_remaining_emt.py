"""
Import the remaining EMT materials that were marked as emt_unknown or _other
This manually fixes the IDs based on the old_id pattern
"""

import csv
import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv('VITE_SUPABASE_URL')
SUPABASE_KEY = os.getenv('VITE_SUPABASE_ANON_KEY')

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ Error: Supabase credentials not found")
    exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

CSV_FILE = r'C:\Users\dusti\Downloads\Supabase Snippet EMT Materials Export with New ID Mapping.csv'

def fix_new_id(old_id, name, current_new_id):
    """Manually fix the new_id based on old_id patterns"""
    
    # Handle materials by old_id pattern
    if '_0_5' in old_id or '_0.5' in old_id:
        size = 'emt12'
    elif '_0_75' in old_id or '_0.75' in old_id or 'three_quarter' in old_id:
        size = 'emt34'
    elif old_id.endswith('_1') or '_1"' in name or '1"' in name:
        size = 'emt1'
    elif '_1_25' in old_id or '_1.25' in old_id:
        size = 'emt114'
    elif '_1_5' in old_id or '_1.5' in old_id:
        size = 'emt112'
    elif old_id.endswith('_2') or '_2"' in name or '2"' in name:
        size = 'emt2'
    elif '_2_5' in old_id or '_2.5' in old_id:
        size = 'emt212'
    elif old_id.endswith('_3') or '_3"' in name or '3"' in name:
        size = 'emt3'
    elif old_id.endswith('_4') or '_4"' in name or '4"' in name:
        size = 'emt4'
    else:
        return None  # Can't determine size
    
    # Determine component type
    name_lower = name.lower()
    
    if '45' in name:
        return f'{size}_45'
    elif '90' in name or 'elbow' in name_lower:
        return f'{size}_90'
    elif 'flex' in name_lower and 'coupling' in name_lower:
        return f'{size}_flexcpl'
    elif 'compression' in name_lower and 'connector' in name_lower:
        return f'{size}_cpconn'
    elif 'compression' in name_lower and 'coupling' in name_lower:
        return f'{size}_cpcpl'
    elif 'connector' in name_lower:
        return f'{size}_ssconn'
    elif 'coupling' in name_lower:
        return f'{size}_sscpl'
    elif 'lb' in name_lower or 'l.b' in name_lower or 'lb body' in name_lower:
        return f'{size}_lb'
    elif 'll' in name_lower or 'l.l' in name_lower or 'll body' in name_lower:
        return f'{size}_ll'
    elif 'lr' in name_lower or 'l.r' in name_lower or 'lr body' in name_lower:
        return f'{size}_lr'
    elif ('strap' in name_lower or 'unistrut' in name_lower) and '1' in name and 'hole' in name_lower:
        return f'{size}_1hole'
    elif ('strap' in name_lower or 'unistrut' in name_lower) and '2' in name and 'hole' in name_lower:
        return f'{size}_2hole'
    elif 'strap' in name_lower or 'unistrut' in name_lower:
        return f'{size}_strap'
    elif 'standoff' in name_lower:
        return f'{size}_standoff'
    elif 'bender' in name_lower:
        return f'{size}_bender'
    elif 'bushing' in name_lower:
        return f'{size}_bushing'
    else:
        return size  # Assume conduit if no component type found

def main():
    print("🔧 Importing remaining EMT materials...\n")
    
    imported_count = 0
    skipped_count = 0
    error_count = 0
    
    with open(CSV_FILE, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        
        for row_num, row in enumerate(reader, start=2):
            try:
                new_id = row.get('new_id', '').strip().strip('"')
                old_id = row.get('old_id', '').strip().strip('"')
                name = row.get('name', '').strip().strip('"')
                
                # Only process materials that were skipped before
                if new_id != 'emt_unknown' and '_other' not in new_id:
                    continue
                
                # Fix the new_id
                fixed_id = fix_new_id(old_id, name, new_id)
                
                if not fixed_id:
                    print(f"⚠️  Row {row_num}: Can't determine ID for '{old_id}' - {name}")
                    skipped_count += 1
                    continue
                
                # Prepare material data
                material_data = {
                    'id': fixed_id,
                    'name': name,
                    'basecost': float(row.get('basecost', 0) or 0),
                    'laborhours': float(row.get('laborhours', 0) or 0),
                    'category': row.get('category', '').strip().strip('"') or 'Material',
                    'unit': row.get('unit', '').strip().strip('"') or 'EA',
                }
                
                # Try to insert
                result = supabase.table('base_materials').insert(material_data).execute()
                
                print(f"✅ Row {row_num}: Imported '{fixed_id}' (was {new_id}) - {name}")
                imported_count += 1
                
            except Exception as e:
                error_msg = str(e)
                if 'duplicate key' in error_msg.lower():
                    print(f"⚠️  Row {row_num}: '{fixed_id}' already exists - skipping")
                    skipped_count += 1
                else:
                    print(f"❌ Row {row_num}: Error - {error_msg}")
                    error_count += 1
    
    print("\n" + "="*60)
    print("📊 Import Summary:")
    print(f"   ✅ Successfully imported: {imported_count}")
    print(f"   ⚠️  Skipped (duplicates or can't determine): {skipped_count}")
    print(f"   ❌ Errors: {error_count}")
    print("="*60)

if __name__ == "__main__":
    main()
