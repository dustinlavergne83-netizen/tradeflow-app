/**
 * verify-backup.cjs — sanity-check the most recent backup produced by
 * backup-database.cjs. Confirms the gzip decompresses, the JSON parses,
 * and prints per-table row counts so you can eyeball that nothing is
 * suspiciously empty.
 *
 * Usage: node src/scripts/verify-backup.cjs [path-to-file]
 * If no path is given, verifies the newest db_data_*.json.gz in
 * G:\My Drive\TradeFlow_Backups.
 */
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const BACKUP_DIR = "G:\\My Drive\\TradeFlow_Backups";

function findLatest() {
  const files = fs.readdirSync(BACKUP_DIR)
    .filter((f) => /^db_data_.*\.json\.gz$/.test(f))
    .map((f) => ({ name: f, full: path.join(BACKUP_DIR, f), mtime: fs.statSync(path.join(BACKUP_DIR, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  if (files.length === 0) throw new Error(`No backups found in ${BACKUP_DIR}`);
  return files[0].full;
}

const target = process.argv[2] || findLatest();
console.log(`Verifying: ${target}`);

const gz = fs.readFileSync(target);
const json = zlib.gunzipSync(gz).toString("utf8");
const dump = JSON.parse(json);

console.log(`generated_at: ${dump.generated_at}`);
console.log(`table_count:  ${dump.table_count}`);
console.log(`total_rows:   ${dump.total_rows}`);
console.log(`failures:     ${dump.failures?.length || 0}`);

if (dump.failures && dump.failures.length > 0) {
  console.log("Failed tables:", dump.failures.map(f => f.table).join(", "));
}

const emptyTables = Object.entries(dump.tables)
  .filter(([, rows]) => Array.isArray(rows) && rows.length === 0)
  .map(([name]) => name);
console.log(`Empty tables (${emptyTables.length}):`, emptyTables.join(", "));

console.log("\nOK — file decompresses and parses correctly.");
