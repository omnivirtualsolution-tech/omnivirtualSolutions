// ─────────────────────────────────────────────────────────────────
// backend/db.js  —  Single database connection (local ↔ Turso)
// ─────────────────────────────────────────────────────────────────
// Uses @libsql/client which speaks SQLite locally and libSQL (Turso)
// in the cloud. Uses pure-fetch @libsql/client/web in Cloudflare Workers
// so no native C/Rust binaries (Neon) are required.
// Lazily connects on first query so runtime environment variables
// (like Cloudflare Worker secrets) are always captured.
// ─────────────────────────────────────────────────────────────────

const _dir = typeof __dirname !== "undefined" ? __dirname : (typeof process !== "undefined" ? process.cwd() : "");
try {
  require("dotenv").config({ path: require("path").resolve(_dir, "../.env") });
} catch (_) {}

const isEdgeOrWorker = typeof WebSocketPair !== "undefined" || (typeof process !== "undefined" && !process.versions?.node);

let createClientFn = null;
function getCreateClient() {
  if (createClientFn) return createClientFn;
  const isTurso = Boolean(process.env.TURSO_DATABASE_URL && process.env.TURSO_DATABASE_URL.trim() !== "");
  if (isTurso || isEdgeOrWorker) {
    createClientFn = require("@libsql/client/web").createClient;
  } else {
    try {
      const mod = "@libsql/client";
      const req = typeof __non_webpack_require__ !== "undefined" ? __non_webpack_require__ : require;
      createClientFn = req(mod).createClient;
    } catch (_) {
      createClientFn = require("@libsql/client/web").createClient;
    }
  }
  return createClientFn;
}

let activeClient = null;
let lastUsedUrl = null;
let lastUsedToken = null;

function getDbClient() {
  const tursoUrl = process.env.TURSO_DATABASE_URL && process.env.TURSO_DATABASE_URL.trim();
  const tursoToken = process.env.TURSO_AUTH_TOKEN && process.env.TURSO_AUTH_TOKEN.trim();

  // If already connected with the current credentials, reuse
  if (activeClient && lastUsedUrl === tursoUrl && lastUsedToken === tursoToken) {
    return activeClient;
  }

  const createClient = getCreateClient();

  if (tursoUrl) {
    activeClient = createClient({
      url: tursoUrl,
      authToken: tursoToken || undefined,
    });
    lastUsedUrl = tursoUrl;
    lastUsedToken = tursoToken;
    return activeClient;
  }

  // Local SQLite fallback (only in Node.js)
  if (!isEdgeOrWorker) {
    activeClient = createClient({
      url: "file:" + require("path").resolve(_dir, "../data/omni.db"),
    });
    lastUsedUrl = "local";
    return activeClient;
  }

  // Safe fallback if no database URL is set yet
  return {
    execute: async () => ({ rows: [], columns: [] }),
    batch: async () => [],
  };
}

// Proxy all db operations to activeClient lazily
const db = new Proxy({}, {
  get(target, prop) {
    const client = getDbClient();
    const value = client[prop];
    if (typeof value === "function") {
      return value.bind(client);
    }
    return value;
  }
});

module.exports = { db, getDbClient };
