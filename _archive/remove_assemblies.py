import csv

# Read the original file
with open('public/materials.csv', 'r', encoding='utf-8') as infile:
    reader = csv.DictReader(infile)
    rows = [row for row in reader if row['category'] != 'ASSEMBLIES']

# Write the filtered data
with open('public/materials.csv', 'w', encoding='utf-8', newline='') as outfile:
    fieldnames = ['id', 'name', 'category', 'description', 'unit', 'baseCost', 'laborHours']
    writer = csv.DictWriter(outfile, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(rows)

print(f"Done! Removed all ASSEMBLIES category items. {len(rows)} items remaining.")
