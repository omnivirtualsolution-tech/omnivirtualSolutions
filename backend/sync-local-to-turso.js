#!/usr/bin/env node
// =================================================================
// backend/sync-local-to-turso.js  —  One-Click Local to Turso Data Sync
// =================================================================
// Copies all tables & real data from data/omni.db to Turso Cloud.
// Usage:
//   node backend/sync-local-to-turso.js
// =================================================================

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const { createClient } = require("@libsql/client");

const tursoUrl = process.env.TURSO_DATABASE_URL?.trim();
const tursoToken = process.env.TURSO_AUTH_TOKEN?.trim();

if (!tursoUrl || !tursoToken) {
  console.error("\n❌ Error: TURSO_DATABASE_URL or TURSO_AUTH_TOKEN is missing in .env!");
  console.error("   Please add them to your .env file first, then run this script again.\n");
  process.exit(1);
}

const localDb = createClient({
  url: "file:" + path.resolve(__dirname, "../data/omni.db"),
});

const cloudDb = createClient({
  url: tursoUrl,
  authToken: tursoToken,
});

async function run() {
  console.log("\n========================================================");
  console.log("  🚀 Omni Virtual Solutions — Local to Turso Cloud Sync");
  console.log("========================================================");
  console.log(`Source:      💾 Local SQLite (data/omni.db)`);
  console.log(`Destination: ☁️  Turso Cloud (${tursoUrl})\n`);

  // Dependency order ensures parent records exist before children with foreign keys
  const preferredOrder = [
    "admin_users",
    "company_profile",
    "company_stats",
    "email_settings",
    "email_log",
    "media_assets",
    "page_visits",
    "content_blocks",
    "content_block_revisions",
    "service_categories",
    "service_subcategories",
    "services",
    "service_features",
    "contact_submissions",
    "contact_replies",
    "showcase_books",
  ];

  // 1. Get all tables from local SQLite
  const tablesRes = await localDb.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
  );
  const foundTables = tablesRes.rows.map((r) => r.name);
  const tables = [
    ...preferredOrder.filter((t) => foundTables.includes(t)),
    ...foundTables.filter((t) => !preferredOrder.includes(t)),
  ];

  console.log(`Found ${tables.length} tables in local database: ${tables.join(", ")}\n`);

  // Disable foreign keys during migration/sync so table insertion order does not fail
  try {
    await cloudDb.execute("PRAGMA foreign_keys = OFF;");
  } catch (_) {}

  // Phase 1: Create all tables first
  console.log("Phase 1: Ensuring all tables exist on Turso...");
  for (const table of tables) {
    const ddlRes = await localDb.execute({
      sql: "SELECT sql FROM sqlite_master WHERE type='table' AND name = ?",
      args: [table],
    });
    const createSql = ddlRes.rows[0]?.sql;
    if (createSql) {
      await cloudDb.execute(createSql.replace(/CREATE TABLE\s+/i, "CREATE TABLE IF NOT EXISTS "));
    }
  }
  console.log("✅ All tables created on Turso Cloud.\n");

  // Phase 2: Copy rows
  console.log("Phase 2: Transferring rows...");
  for (const table of tables) {
    process.stdout.write(`Syncing table [${table}]... `);

    // Fetch all rows from local table
    const rowsRes = await localDb.execute(`SELECT * FROM ${table}`);
    const rows = rowsRes.rows;

    if (rows.length === 0) {
      console.log(`0 rows (empty, skipped)`);
      continue;
    }

    // Insert rows in batches
    let inserted = 0;
    for (const row of rows) {
      const keys = Object.keys(row);
      const placeholders = keys.map(() => "?").join(", ");
      const values = keys.map((k) => row[k]);

      await cloudDb.execute({
        sql: `INSERT OR REPLACE INTO ${table} (${keys.join(", ")}) VALUES (${placeholders})`,
        args: values,
      });
      inserted++;
    }

    console.log(`✅ ${inserted} rows transferred`);
  }

  try {
    await cloudDb.execute("PRAGMA foreign_keys = ON;");
  } catch (_) {}

  console.log("\n========================================================");
  console.log("  🎉 SUCCESS: All local data is now live on Turso Cloud!");
  console.log("========================================================\n");
  process.exit(0);
}

run().catch((err) => {
  console.error("\n❌ Sync failed:", err.message);
  process.exit(1);
});
