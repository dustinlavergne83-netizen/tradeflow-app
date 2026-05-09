/**
 * patch-theme.cjs
 * Batch-patches all timeclock-mobile .tsx screens to use useTheme()
 * for dynamic background colors based on company tier.
 *
 * Run: node patch-theme.cjs
 */

const fs = require("fs");
const path = require("path");

const APP_DIR = path.join(__dirname, "timeclock-mobile", "app");

// Pages to skip (auth/setup don't need theming, index.tsx is the root layout)
const SKIP = new Set([
  "_layout.tsx",
  "index.tsx",
  "lock.tsx",
  "auth/callback.tsx",
  "auth/set-password.tsx",
  "setup-profile.tsx",
  "sign-in.tsx",
]);

// Collect all .tsx files recursively
function getFiles(dir, base = "") {
  const results = [];
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    const rel  = base ? `${base}/${entry}` : entry;
    if (fs.statSync(full).isDirectory()) {
      results.push(...getFiles(full, rel));
    } else if (entry.endsWith(".tsx")) {
      results.push({ full, rel });
    }
  }
  return results;
}

function depthOf(rel) {
  // e.g. "admin/employees.tsx" → 1 deep → "../../lib/useTheme"
  //      "admin/employee-timesheet/[id].tsx" → 2 deep → "../../../lib/useTheme"
  const depth = rel.split("/").length; // 1 = top-level, 2 = one folder, etc.
  return "../".repeat(depth) + "lib/useTheme";
}

let patched = 0;
let skipped = 0;

for (const { full, rel } of getFiles(APP_DIR)) {
  if (SKIP.has(rel) || [...SKIP].some(s => rel.endsWith(s))) {
    skipped++;
    continue;
  }

  let src = fs.readFileSync(full, "utf8");

  // Must contain BRAND.bg to be a candidate
  if (!src.includes("BRAND.bg")) {
    skipped++;
    continue;
  }

  // Already patched
  if (src.includes("useTheme")) {
    console.log(`⏭  Already patched: ${rel}`);
    skipped++;
    continue;
  }

  const themePath = depthOf(rel);
  let changed = false;

  // ── 1. Add useTheme import ──────────────────────────────────────────────
  // Insert after the last existing import line
  const importInsert = `import { useTheme } from "${themePath}";\n`;
  if (!src.includes(importInsert)) {
    // Find last import line
    const lines = src.split("\n");
    let lastImportIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith("import ")) lastImportIdx = i;
    }
    if (lastImportIdx >= 0) {
      lines.splice(lastImportIdx + 1, 0, importInsert.trimEnd());
      src = lines.join("\n");
      changed = true;
    }
  }

  // ── 2. Add `const theme = useTheme();` after `export default function` ──
  // Look for the export default function body opening
  if (!src.includes("const theme = useTheme()")) {
    // Match the first line after "export default function XXX(" that has a brace
    src = src.replace(
      /(export default function [A-Za-z]+\([^)]*\)\s*\{)/,
      (match) => `${match}\n  const theme = useTheme();`
    );
    changed = true;
  }

  // ── 3. Replace SafeAreaView / View outer background ─────────────────────
  // <SafeAreaView style={{ flex: 1, backgroundColor: BRAND.bg }}>
  src = src.replace(
    /backgroundColor:\s*BRAND\.bg(\s*[,}])/g,
    "backgroundColor: theme.pageBg$1"
  );

  // ── 4. Replace StatusBar backgroundColor prop ───────────────────────────
  // backgroundColor={BRAND.bg}
  src = src.replace(
    /backgroundColor=\{BRAND\.bg\}/g,
    "backgroundColor={theme.pageBg}"
  );

  // ── 5. Replace StatusBar barStyle hardcoded ─────────────────────────────
  // barStyle="light-content"  →  barStyle={theme.statusBarStyle as any}
  src = src.replace(
    /barStyle="light-content"/g,
    'barStyle={theme.statusBarStyle as any}'
  );

  if (changed) {
    fs.writeFileSync(full, src, "utf8");
    console.log(`✅ Patched: ${rel}`);
    patched++;
  } else {
    console.log(`⏭  No changes needed: ${rel}`);
    skipped++;
  }
}

console.log(`\nDone! Patched ${patched} files, skipped ${skipped}.`);
