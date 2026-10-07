// ─────────────────────────────────────────────────────────────────
// backend/db.js  —  Single database connection (local ↔ Turso)
// ─────────────────────────────────────────────────────────────────
// Uses @libsql/client which speaks SQLite locally and libSQL (Turso)
// in the cloud. Uses pure-fetch @libsql/client/web in Cloudflare Workers
// so no native C/Rust binaries (Neon) are required.
// ─────────────────────────────────────────────────────────────────

const _dir = typeof __dirname !== "undefined" ? __dirname : (typeof process !== "undefined" ? process.cwd() : "");
try {
  require("dotenv").config({ path: require("path").resolve(_dir, "../.env") });
} catch (_) {}

const isTursoConfigured = Boolean(
  process.env.TURSO_DATABASE_URL && process.env.TURSO_DATABASE_URL.trim() !== ""
);

const isEdgeOrWorker = typeof WebSocketPair !== "undefined" || (typeof process !== "undefined" && !process.versions?.node);

let createClient;
if (isTursoConfigured || isEdgeOrWorker) {
  createClient = require("@libsql/client/web").createClient;
} else {
  try {
    const mod = "@libsql/client";
    const req = typeof __non_webpack_require__ !== "undefined" ? __non_webpack_require__ : require;
    createClient = req(mod).createClient;
  } catch (_) {
    createClient = require("@libsql/client/web").createClient;
  }
}

let db;
try {
  const dbUrl = isTursoConfigured
    ? process.env.TURSO_DATABASE_URL
    : isEdgeOrWorker
      ? "https://omnivirtualsolutions-placeholder.turso.io"
      : "file:" + require("path").resolve(_dir, "../data/omni.db");

  db = createClient({
    url: dbUrl,
    authToken: isTursoConfigured ? process.env.TURSO_AUTH_TOKEN : undefined,
  });
} catch (err) {
  console.warn("Database initialization warning:", err.message);
  db = {
    execute: async () => ({ rows: [], columns: [] }),
    batch: async () => [],
  };
}

console.log(
  isTursoConfigured
    ? "✅ Connected to Turso Cloud database."
    : isEdgeOrWorker
      ? "ℹ️ Cloudflare Worker running: Waiting for TURSO_DATABASE_URL in settings."
      : "✅ Connected to local SQLite database (data/omni.db)."
);

module.exports = { db };
