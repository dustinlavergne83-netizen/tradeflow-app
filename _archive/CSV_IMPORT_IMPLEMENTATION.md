# CSV Import - Final Steps to Complete

I've added the buttons and template, but due to context limits, here are the remaining steps to complete the CSV import feature:

## What's Already Done ✅
- CSV template file created (`public/bulk_materials_template.csv`)
- State variables added for import modal
- "Import from CSV" button added to toolbar
- "Download Template" link added

## Add These Functions (before the `return` statement):

```javascript
// CSV file handler
function handleCSVFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target.result;
    parseCSV(text);
  };
  reader.readAsText(file);
}

// Parse CSV text
function parseCSV(text) {
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  
  // Validate headers
  const required = ['id', 'category', 'name', 'unit', 'basecost', 'laborhours'];
  const missing = required.filter(h => !headers.includes(h));
  if (missing.length > 0) {
    alert(`Missing required columns: ${missing.join(', ')}`);
    return;
  }
  
  // Parse data rows
  const data = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    
    const values = lines[i].split(',').map(v => v.trim());
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    data.push(row);
  }
  
  setCsvData(data);
  setShowImportModal(true);
}

// Bulk import function
async function bulkImport() {
  setImporting(true);
  setImportProgress(0);
  
  let imported = 0;
  let skipped = 0;
  let errors = [];
  
  for (let i = 0; i < csvData.length; i++) {
    const row = csvData[i];
    
    try {
      // Check if already exists
      const { data: existing } = await supabase
        .from('base_materials')
        .select('id')
        .eq('id', row.id)
        .maybeSingle();
      
      if (existing) {
        skipped++;
        continue;
      }
      
      // Insert new material
      const { error } = await supabase
        .from('base_materials')
        .insert([{
          id: row.id,
          category: row.category,
          name: row.name,
          description: row.description || '',
          unit: row.unit,
          basecost: parseFloat(row.basecost),
          laborhours: parseFloat(row.laborhours)
        }]);
      
      if (error) {
        errors.push(`Row ${i + 2}: ${error.message}`);
      } else {
        imported++;
      }
    } catch (err) {
      errors.push(`Row ${i + 2}: ${err.message}`);
    }
    
    setImportProgress(Math.round(((i + 1) / csvData.length) * 100));
  }
  
  setImporting(false);
  setShowImportModal(false);
  setCsvData([]);
  
  loadMaterials();
  
  let message = `Import complete!\n`;
  message += `✅ Imported: ${imported}\n`;
  if (skipped > 0) message += `⏭️ Skipped (duplicates): ${skipped}\n`;
  if (errors.length > 0) message += `❌ Errors: ${errors.length}\n\n${errors.slice(0, 5).join('\n')}`;
  
  alert(message);
}
```

## Add Import Modal (after the Add/Edit modal, before closing `</div>`):

```jsx
{showImportModal && (
  <div style={styles.modal} onClick={() => {if (!importing) setShowImportModal(false)}}>
    <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
      <h2>Import Materials from CSV</h2>
      
      {csvData.length === 0 ? (
        <>
          <p>Select a CSV file to import materials in bulk.</p>
          <input
            type="file"
            accept=".csv"
            onChange={handleCSVFile}
            style={styles.input}
          />
        </>
      ) : (
        <>
          <p>Found {csvData.length} materials to import.</p>
          <div style={{maxHeight: 200, overflowY: 'auto', marginBottom: 20}}>
            {csvData.slice(0, 5).map((row, i) => (
              <div key={i} style={{padding: 8, borderBottom: '1px solid #eee'}}>
                <strong>{row.name}</strong> - {row.category} (${row.basecost}, {row.laborhours}hrs)
              </div>
            ))}
            {csvData.length > 5 && <p>...and {csvData.length - 5} more</p>}
          </div>
          
          {importing && (
            <div style={{marginBottom: 20}}>
              <div style={{backgroundColor: '#eee', height: 20, borderRadius: 10, overflow: 'hidden'}}>
                <div style={{backgroundColor: '#0070f3', height: '100%', width: `${importProgress}%`, transition: 'width 0.3s'}} />
              </div>
              <p style={{textAlign: 'center', marginTop: 8}}>{importProgress}%</p>
            </div>
          )}
          
          <div style={styles.modalButtons}>
            <button onClick={() => {setShowImportModal(false); setCsvData([]);}} style={styles.cancelButton} disabled={importing}>
              Cancel
            </button>
            <button onClick={bulkImport} style={styles.saveButton} disabled={importing}>
              {importing ? 'Importing...' : `Import ${csvData.length} Materials`}
            </button>
          </div>
        </>
      )}
    </div>
  </div>
)}
```

## Add These Styles:

```javascript
importButton: {
  padding: "10px 20px",
  backgroundColor: "#10b981",
  color: "white",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
  fontWeight: 600
},
downloadLink: {
  padding: "10px 20px",
  backgroundColor: "#6366f1",
  color: "white",
  border: "none",
  borderRadius: 6,
  textDecoration: "none",
  fontWeight: 600,
  display: "inline-block"
}
```

## Usage:
1. Click "Download Template" to get the CSV format
2. Fill in your materials in Excel/Google Sheets
3. Save as CSV
4. Click "Import from CSV"
5. Select your file
6. Review preview
7. Click "Import X Materials"
8. Done! ✅

This will import hundreds of materials in seconds!
