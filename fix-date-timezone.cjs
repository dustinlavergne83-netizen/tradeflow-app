const fs = require('fs');
const path = require('path');

const pagesDir = path.join(__dirname, 'src', 'pages');
const reportsDir = path.join(pagesDir, 'reports');

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;
  
  // Skip if already has formatDate import
  if (content.includes('import { formatDate }') || content.includes('import {formatDate}')) {
    console.log(`  SKIP (already has import): ${path.basename(filePath)}`);
    return;
  }
  
  // Check if file has the problematic pattern: new Date(variable).toLocaleDateString
  // but NOT patterns like new Date().toLocaleDateString (current date is fine)
  // and NOT patterns that already have T00:00:00
  const hasDateBug = /new Date\([a-zA-Z_$][^)]*\)\.toLocaleDateString/.test(content);
  
  if (!hasDateBug) {
    console.log(`  SKIP (no bug): ${path.basename(filePath)}`);
    return;
  }
  
  // Add import after the last existing import
  const importLine = `import { formatDate } from "${filePath.includes('reports') ? '../../' : '../'}utils/dateUtils";\n`;
  
  // Find last import statement
  const importRegex = /^import .+from .+;?\s*$/gm;
  let lastImportIndex = -1;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    lastImportIndex = match.index + match[0].length;
  }
  
  if (lastImportIndex > -1) {
    content = content.slice(0, lastImportIndex) + '\n' + importLine + content.slice(lastImportIndex);
  }
  
  // Replace patterns like: new Date(variable).toLocaleDateString()
  // but NOT: new Date().toLocaleDateString() (no args = current date, which is fine)
  // and NOT: new Date(variable).toLocaleTimeString() (time display is different)
  // and NOT: already fixed ones with T00:00:00
  
  // Pattern: {new Date(expr).toLocaleDateString()} or {new Date(expr).toLocaleDateString('en-US', opts)}
  // Replace with: {formatDate(expr)} or {formatDate(expr, opts)}
  
  // Simple case: new Date(expr).toLocaleDateString()  (no args to toLocaleDateString)
  content = content.replace(
    /new Date\(([^)]+)\)\.toLocaleDateString\(\)/g,
    (match, expr) => {
      // Skip if expr is empty (current date) or already has T00:00:00
      if (!expr.trim() || expr.includes("T00:00:00") || expr.includes("T12:00:00")) return match;
      return `formatDate(${expr})`;
    }
  );
  
  // Case with locale arg: new Date(expr).toLocaleDateString('en-US', { ... })
  content = content.replace(
    /new Date\(([^)]+)\)\.toLocaleDateString\((['"][^'"]+['"],\s*\{[^}]+\})\)/g,
    (match, expr, args) => {
      if (!expr.trim() || expr.includes("T00:00:00") || expr.includes("T12:00:00")) return match;
      // Extract just the options object (second arg)
      const optsMatch = args.match(/,\s*(\{[^}]+\})/);
      if (optsMatch) {
        return `formatDate(${expr}, ${optsMatch[1]})`;
      }
      return `formatDate(${expr})`;
    }
  );
  
  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`  FIXED: ${path.basename(filePath)}`);
  } else {
    console.log(`  NO CHANGE: ${path.basename(filePath)}`);
  }
}

// Process all JSX files in pages dir
console.log('Fixing date timezone bugs...\n');

const dirs = [pagesDir];
if (fs.existsSync(reportsDir)) dirs.push(reportsDir);

for (const dir of dirs) {
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.jsx'));
  for (const file of files) {
    fixFile(path.join(dir, file));
  }
}

console.log('\nDone!');
