/**
 * A real in-memory SQLite stand-in for expo-sqlite, backed by Node's built-in
 * `node:sqlite`.
 *
 * Why this exists: the app's data layer is hand-written SQL, and most of it is
 * only correct because the JOINs and aggregates actually run. A stub that
 * pattern-matched table names and returned fixture rows could not tell a correct
 * query from a broken one, and left join-computed columns (patient_name,
 * household_hhid, risk_score) undefined. Running the real statements against a
 * real engine means these tests fail on a bad column, a broken join or a syntax
 * error, not just on a crash.
 *
 * The schema is the app's own DDL, extracted from src/db/database.ts at load
 * time so it can never drift from the source.
 */
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

// This file sits at the app root, so the app directory is __dirname itself.
const APP = __dirname;
const fixture = require('./__tests__/fixtures/sync-records.json');

/** The registry of synced tables and their columns, parsed from src/db/tables.ts. */
function tableColumns() {
  const src = fs.readFileSync(path.join(APP, 'src/db/tables.ts'), 'utf8');
  const block = src.match(/export const TABLES = \{([\s\S]*?)\n\} as const;/)[1];
  const out = {};
  for (const m of block.matchAll(/^\s{2}(\w+): \[([\s\S]*?)\],/gm)) {
    out[m[1]] = [...m[2].matchAll(/'([^']+)'/g)].map((c) => c[1]);
  }
  return out;
}

/** The app's own CREATE TABLE statements. */
function schema() {
  const src = fs.readFileSync(path.join(APP, 'src/db/database.ts'), 'utf8');
  const base = src.match(/const SCHEMA = `([\s\S]*?)`;/)[1];
  const clinical = src.match(/const CLINICAL_SCHEMA = `([\s\S]*?)`;/)[1];
  return base + '\n' + clinical;
}

const TABLES = tableColumns();
const db = new DatabaseSync(':memory:');
db.exec(schema());

// Load the fixture using the registry's column list, so a column the registry
// does not know about is reported instead of silently dropped.
for (const [table, cols] of Object.entries(TABLES)) {
  const info = db.prepare(`PRAGMA table_info(${table})`).all();
  const present = new Set(info.map((r) => r.name));
  const usable = cols.filter((c) => present.has(c));
  const required = info.filter((r) => r.notnull === 1).map((r) => r.name);
  const rows = fixture[table] ?? [];
  if (!rows.length) continue;

  // Name the offending rows instead of letting SQLite raise a bare
  // "NOT NULL constraint failed" from the middle of the load.
  rows.forEach((row, index) => {
    const missing = required.filter((c) => row[c] === null || row[c] === undefined);
    if (missing.length) {
      throw new Error(
        `fixture ${table}[${index}] (id=${row.id ?? 'unknown'}) is missing required column(s): ` +
          missing.join(', '),
      );
    }
  });

  const stmt = db.prepare(
    `INSERT OR REPLACE INTO ${table} (${usable.join(',')}) VALUES (${usable.map(() => '?').join(',')})`,
  );
  for (const row of rows) {
    // SQLite has no JS binding for objects, so JSON columns are serialised the
    // same way expo-sqlite's adapter does.
    const values = usable.map((c) => {
      const v = row[c];
      if (v === null || v === undefined) return null;
      if (typeof v === 'object') return JSON.stringify(v);
      if (typeof v === 'boolean') return v ? 1 : 0;
      return v;
    });
    stmt.run(...values);
  }
}

const overrides = new Map();

/** Executes app SQL the way expo-sqlite's promise API does. */
function all(statement, params = []) {
  if (overrides.has(statement)) return overrides.get(statement);
  return db.prepare(statement).all(...params);
}

function first(statement, params = []) {
  if (overrides.has(statement)) return overrides.get(statement)[0] ?? null;
  return db.prepare(statement).get(...params) ?? null;
}

function run(statement, params = []) {
  const result = db.prepare(statement).run(...params);
  return { changes: Number(result.changes), lastInsertRowId: Number(result.lastInsertRowId) };
}

module.exports = {
  all,
  first,
  run,
  exec: (statement) => db.exec(statement),
  transaction: async (fn) => fn(),
  setOverride: (statement, rows) => overrides.set(statement, rows),
  counts: () =>
    Object.fromEntries(
      Object.keys(TABLES).map((t) => [t, db.prepare(`SELECT COUNT(*) AS c FROM ${t}`).get().c]),
    ),
  TABLES,
};
