/**
 * backup-database.cjs
 * ─────────────────────────────────────────────────────────────────────────
 * Real DATA backup for TradeFlow's Supabase project.
 *
 * Unlike backup-to-google-drive.ps1 (which only copies source code folders
 * — src/, public/, supabase/ — and never touches the database), this script
 * connects directly to Postgres and exports every row from every table in
 * the `public` schema to a single timestamped JSON file. That file is a
 * complete, independent copy of your business data (customers, invoices,
 * estimates, expenses, time entries, etc.) that lives outside Supabase.
 *
 * Credentials are read from environment variables — never hard-coded and
 * never bundled into the backup output — so this script is safe to keep
 * in the repo and safe to schedule.
 *
 * Usage:
 *   node src/scripts/backup-database.cjs
 *
 * Required environment variables (read from the repo's .env):
 *   SUPABASE_DB_HOST      e.g. aws-1-us-east-2.pooler.supabase.com
 *   SUPABASE_DB_PORT      default 5432
 *   SUPABASE_DB_NAME      default postgres
 *   SUPABASE_DB_USER      e.g. postgres.hyhjxdgdetdqoyoscflu
 *   SUPABASE_DB_PASSWORD  the database password
 *
 * Output:
 *   G:\My Drive\TradeFlow_Backups\db_data_YYYY-MM-DD_HHMM.json.gz
 *   (falls back to a local folder if Google Drive isn't mounted)
 * ─────────────────────────────────────────────────────────────────────────
 */

const { Client } = require("pg");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

// Repo root is two levels up from src/scripts/
const REPO_ROOT = path.join(__dirname, "..", "..");

// ── Load .env (no extra dependency — tiny manual parser) ──────────────────
function loadEnv(envPath) {
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/i);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
loadEnv(path.join(REPO_ROOT, ".env"));

const DB_HOST = process.env.SUPABASE_DB_HOST;
const DB_PORT = Number(process.env.SUPABASE_DB_PORT || 5432);
const DB_NAME = process.env.SUPABASE_DB_NAME || "postgres";
const DB_USER = process.env.SUPABASE_DB_USER;
const DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD;

// ── Where to save ──────────────────────────────────────────────────────────
const CANDIDATE_BACKUP_DIRS = [
  "G:\\My Drive\\TradeFlow_Backups",
  path.join(process.env.USERPROFILE || "", "TradeFlow_Backups_Local"),
];

const KEEP_COUNT = 14; // retention: keep the most recent 14 backups

function pickBackupDir() {
  for (const dir of CANDIDATE_BACKUP_DIRS) {
    const parent = path.dirname(dir);
    if (fs.existsSync(parent) || fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      return dir;
    }
  }
  const fallback = path.join(process.env.USERPROFILE || REPO_ROOT, "TradeFlow_Backups_Local");
  fs.mkdirSync(fallback, { recursive: true });
  return fallback;
}

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
}

async function main() {
  if (!DB_HOST || !DB_USER || !DB_PASSWORD) {
    console.error("ERROR: Missing DB credentials. Set SUPABASE_DB_HOST / SUPABASE_DB_USER / SUPABASE_DB_PASSWORD in .env");
    process.exit(1);
  }

  const client = new Client({
    host: DB_HOST,
    port: DB_PORT,
    database: DB_NAME,
    user: DB_USER,
    password: DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
    statement_timeout: 120000,
  });

  console.log(`[${new Date().toISOString()}] Connecting to database...`);
  await client.connect();

  console.log("Discovering tables in public schema...");
  const tablesRes = await client.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name"
  );
  const tables = tablesRes.rows.map((r) => r.table_name);
  console.log(`Found ${tables.length} tables.`);

  const dump = {
    generated_at: new Date().toISOString(),
    table_count: tables.length,
    tables: {},
  };

  let totalRows = 0;
  const failures = [];

  for (const table of tables) {
    try {
      const res = await client.query(`SELECT * FROM "${table}"`);
      dump.tables[table] = res.rows;
      totalRows += res.rows.length;
      console.log(`  ${table.padEnd(32)} ${res.rows.length} rows`);
    } catch (err) {
      console.error(`  ${table.padEnd(32)} FAILED: ${err.message}`);
      failures.push({ table, error: err.message });
      dump.tables[table] = null;
    }
  }

  await client.end();

  dump.total_rows = totalRows;
  dump.failures = failures;

  const backupDir = pickBackupDir();
  const file = path.join(backupDir, `db_data_${timestamp()}.json.gz`);

  console.log(`Writing backup to ${file} ...`);
  const json = JSON.stringify(dump);
  const gz = zlib.gzipSync(Buffer.from(json, "utf8"), { level: 9 });
  fs.writeFileSync(file, gz);

  const sizeMb = (gz.length / (1024 * 1024)).toFixed(2);

  // ── Sanity check — a near-empty backup is worse than no backup ─────────
  if (totalRows === 0) {
    console.error("ERROR: Backup contains 0 total rows across all tables — this looks like a failed backup, not an empty database. Investigate before trusting this file.");
    process.exitCode = 2;
  } else if (failures.length > 0) {
    console.warn(`WARNING: ${failures.length} table(s) failed to export: ${failures.map(f => f.table).join(", ")}`);
    process.exitCode = 1;
  }

  console.log(`Backup complete: ${totalRows} rows across ${tables.length} tables, ${sizeMb} MB (gzipped)`);
  console.log(`Saved to: ${file}`);

  // ── Retention cleanup — keep only the most recent KEEP_COUNT backups ───
  const existing = fs.readdirSync(backupDir)
    .filter((f) => /^db_data_.*\.json\.gz$/.test(f))
    .map((f) => ({ name: f, full: path.join(backupDir, f), mtime: fs.statSync(path.join(backupDir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);

  const toDelete = existing.slice(KEEP_COUNT);
  for (const old of toDelete) {
    fs.unlinkSync(old.full);
    console.log(`  Removed old backup: ${old.name}`);
  }

  console.log(`Retention: kept ${Math.min(existing.length, KEEP_COUNT)} of ${existing.length} backups.`);
}

main().catch((err) => {
  console.error("BACKUP FAILED:", err.message);
  process.exit(1);
});
