import csv

# Read CSV and generate SQL INSERT statements
with open('public/electrical_materials_comprehensive.csv', 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    materials = list(reader)

# Generate SQL file
with open('IMPORT_ALL_MATERIALS.sql', 'w', encoding='utf-8') as out:
    out.write("-- Import all 421 materials\n")
    out.write("-- Run this in Supabase SQL Editor\n\n")
    
    for mat in materials:
        # Escape single quotes in strings
        id_val = mat['id'].replace("'", "''")
        name_val = mat['name'].replace("'", "''")
        cat_val = mat['category'].replace("'", "''")
        desc_val = mat.get('description', '').replace("'", "''") if mat.get('description') else ''
        unit_val = mat['unit'].replace("'", "''")
        cost = mat['baseCost']
        hours = mat['laborHours']
        
        # Generate INSERT
        if desc_val:
            sql = f"INSERT INTO base_materials (id, name, category, description, unit, basecost, laborhours) VALUES ('{id_val}', '{name_val}', '{cat_val}', '{desc_val}', '{unit_val}', {cost}, {hours});\n"
        else:
            sql = f"INSERT INTO base_materials (id, name, category, unit, basecost, laborhours) VALUES ('{id_val}', '{name_val}', '{cat_val}', '{unit_val}', {cost}, {hours});\n"
        
        out.write(sql)
    
    out.write("\n-- Verify import\n")
    out.write("SELECT COUNT(*) FROM base_materials;\n")
    out.write("SELECT * FROM base_materials ORDER BY category, name LIMIT 10;\n")

print(f"✅ Generated IMPORT_ALL_MATERIALS.sql with {len(materials)} INSERT statements!")
print("Run this file in Supabase SQL Editor to import all materials.")
