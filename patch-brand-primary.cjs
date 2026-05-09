/**
 * patch-brand-primary.cjs
 *
 * In every .tsx file under timeclock-mobile/app that already has
 *   `const theme = useTheme();`
 * replace all usages of BRAND.primary (and the raw hex #0b3ea8) in
 * backgroundColor / borderColor / color props with theme.primaryBtnBg.
 *
 * Run: node patch-brand-primary.cjs
 */

const fs   = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "timeclock-mobile", "app");

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (fs.statSync(full).isDirectory()) {
      walk(full, files);
    } else if (entry.endsWith(".tsx") || entry.endsWith(".ts")) {
      files.push(full);
    }
  }
  return files;
}

let patched = 0;
let skipped = 0;

for (const file of walk(ROOT)) {
  let src = fs.readFileSync(file, "utf8");

  // Only touch files that already have the theme hook
  if (!src.includes("const theme = useTheme()")) {
    skipped++;
    continue;
  }

  const original = src;

  // Replace ALL usages of BRAND.primary (ternary or plain) with theme.primaryBtnBg
  // Safe: only the BRAND.primary dot-notation reference, not the const definition
  src = src
    .replace(/BRAND\.primary\b/g, "theme.primaryBtnBg")
    // Hardcoded navy hex anywhere it appears as a color value
    .replace(/backgroundColor:\s*["']#0b3ea8["']/g, "backgroundColor: theme.primaryBtnBg")
    .replace(/borderColor:\s*["']#0b3ea8["']/g, "borderColor: theme.primaryBtnBg")
    .replace(/color:\s*["']#0b3ea8["']/g, "color: theme.primaryBtnBg")
    ;

  if (src !== original) {
    fs.writeFileSync(file, src, "utf8");
    console.log("✅ patched:", path.relative(__dirname, file));
    patched++;
  } else {
    console.log("  (unchanged):", path.relative(__dirname, file));
  }
}

console.log(`\nDone. ${patched} files patched, ${skipped} skipped (no theme hook).`);
