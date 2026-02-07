"""
Re-import EMT Materials with Clean IDs
Reads the exported CSV and inserts materials back into database with new IDs
"""

import csv
import os
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize Supabase client
SUPABASE_URL = os.getenv('VITE_SUPABASE_URL')
SUPABASE_KEY = os.getenv('VITE_SUPABASE_ANON_KEY')

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ Error: Supabase credentials not found in .env file")
    print("Make sure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set")
    exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Path to your CSV file
CSV_FILE = r'C:\Users\dusti\Downloads\Supabase Snippet EMT Materials Export with New ID Mapping.csv'

def clean_value(value):
    """Clean up CSV values"""
    if value is None or value == '':
        return None
    # Remove quotes if present
    if isinstance(value, str):
        value = value.strip().strip('"')
    return value

def main():
    print("🚀 Starting EMT Materials Re-Import...")
    print(f"📁 Reading from: {CSV_FILE}\n")
    
    if not os.path.exists(CSV_FILE):
        print(f"❌ Error: CSV file not found at {CSV_FILE}")
        print("Please update the CSV_FILE path in the script")
        return
    
    imported_count = 0
    skipped_count = 0
    error_count = 0
    
    with open(CSV_FILE, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        
        for row_num, row in enumerate(reader, start=2):  # Start at 2 (header is row 1)
            try:
                # Get the new ID
                new_id = clean_value(row.get('new_id'))
                name = clean_value(row.get('name'))
                
                if not new_id or not name:
                    print(f"⚠️  Row {row_num}: Skipping - missing new_id or name")
                    skipped_count += 1
                    continue
                
                # Skip if new_id is 'emt_unknown' or 'emt*_other'
                if new_id == 'emt_unknown' or '_other' in new_id:
                    print(f"⚠️  Row {row_num}: Skipping '{new_id}' - needs manual review")
                    skipped_count += 1
                    continue
                
                # Prepare material data
                material_data = {
                    'id': new_id,
                    'name': name,
                    'basecost': float(row.get('basecost', 0) or 0),
                    'laborhours': float(row.get('laborhours', 0) or 0),
                    'category': clean_value(row.get('category')) or 'Material',
                    'unit': clean_value(row.get('unit')) or 'EA',
                }
                
                # Insert into database
                result = supabase.table('base_materials').insert(material_data).execute()
                
                print(f"✅ Row {row_num}: Imported '{new_id}' - {name}")
                imported_count += 1
                
            except Exception as e:
                print(f"❌ Row {row_num}: Error importing '{row.get('new_id', 'unknown')}' - {str(e)}")
                error_count += 1
    
    print("\n" + "="*60)
    print("📊 Import Summary:")
    print(f"   ✅ Successfully imported: {imported_count}")
    print(f"   ⚠️  Skipped: {skipped_count}")
    print(f"   ❌ Errors: {error_count}")
    print("="*60)
    
    if imported_count > 0:
        print("\n🎉 EMT Materials successfully re-imported with clean IDs!")
        print("   Check your database to verify the new material IDs")

if __name__ == "__main__":
    main()
