/**
 * patch-theme-remaining.cjs
 * Patches the remaining files that were skipped by the first patcher
 * (index.tsx files, timeclock.tsx, crew-clock files).
 *
 * Strategy: find the first useState/useEffect/useCompany hook call and
 * insert `const theme = useTheme();` just before it.
 *
 * Run: node patch-theme-remaining.cjs
 */

const fs = require("fs");
const path = require("path");

const BASE = path.join(__dirname, "timeclock-mobile");

const TARGETS = [
  { rel: "app/(tabs)/timeclock.tsx",                  depth: 2 },
  { rel: "app/admin/crew-clock.tsx",                  depth: 2 },
  { rel: "app/supervisor/crew-clock.tsx",              depth: 2 },
  { rel: "app/supervisor/index.tsx",                   depth: 2 },
  { rel: "app/supervisor/employee-timesheet/index.tsx", depth: 3 },
];

for (const { rel, depth } of TARGETS) {
  const full = path.join(BASE, rel);
  if (!fs.existsSync(full)) {
    console.log(`⚠️  Not found: ${rel}`);
    continue;
  }

  let src = fs.readFileSync(full, "utf8");

  if (!src.includes("BRAND.bg")) {
    console.log(`⏭  No BRAND.bg: ${rel}`);
    continue;
  }
  if (src.includes("useTheme")) {
    console.log(`⏭  Already patched: ${rel}`);
    continue;
  }

  const themePath = "../".repeat(depth) + "lib/useTheme";

  // ── 1. Add import ─────────────────────────────────────────────────────────
  const lines = src.split("\n");
  let lastImportIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("import ")) lastImportIdx = i;
  }
  if (lastImportIdx >= 0) {
    lines.splice(lastImportIdx + 1, 0, `import { useTheme } from "${themePath}";`);
    src = lines.join("\n");
  }

  // ── 2. Add `const theme = useTheme();` ────────────────────────────────────
  // Find the first useState/useEffect/useCompany/useRef/useMemo/router call
  // and insert the theme hook just before it.
  if (!src.includes("const theme = useTheme()")) {
    src = src.replace(
      /([ \t]+)(const \[|useEffect|useRef|useMemo|const { company|const company|const router\s*=|const { router|const \w+ = router)/,
      (match, indent, rest) => `${indent}const theme = useTheme();\n${indent}${rest}`
    );
  }

  // ── 3. Replace background colors ──────────────────────────────────────────
  src = src.replace(/backgroundColor:\s*BRAND\.bg(\s*[,}])/g, "backgroundColor: theme.pageBg$1");
  src = src.replace(/backgroundColor=\{BRAND\.bg\}/g,         "backgroundColor={theme.pageBg}");
  src = src.replace(/barStyle="light-content"/g,               'barStyle={theme.statusBarStyle as any}');

  fs.writeFileSync(full, src, "utf8");
  console.log(`✅ Patched: ${rel}`);
}

console.log("\nDone!");
