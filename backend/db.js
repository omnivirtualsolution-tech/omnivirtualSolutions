// ─────────────────────────────────────────────────────────────────
// backend/db.js  —  Single database connection (local ↔ Turso)
// ─────────────────────────────────────────────────────────────────
// Uses @libsql/client which speaks SQLite locally and libSQL (Turso)
// in the cloud. Zero SQL changes when you flip to Turso — only the
// connection string and token in .env need to change.
// ─────────────────────────────────────────────────────────────────

const _dir = typeof __dirname !== "undefined" ? __dirname : (typeof process !== "undefined" ? process.cwd() : "");
try {
  require("dotenv").config({ path: require("path").resolve(_dir, "../.env") });
} catch (_) {}
const { createClient } = require("@libsql/client");

const isTursoConfigured = Boolean(
  process.env.TURSO_DATABASE_URL && process.env.TURSO_DATABASE_URL.trim() !== ""
);

const db = createClient({
  url: isTursoConfigured
    ? process.env.TURSO_DATABASE_URL
    : "file:" + require("path").resolve(_dir, "../data/omni.db"),
  authToken: isTursoConfigured ? process.env.TURSO_AUTH_TOKEN : undefined,
});

console.log(
  isTursoConfigured
    ? "✅ Connected to Turso Cloud database."
    : "✅ Connected to local SQLite database (data/omni.db)."
);

module.exports = { db };
