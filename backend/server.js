// =================================================================
// backend/server.js  —  Main Express application entry point
// =================================================================
// Omni Virtual Solutions — full API + CMS + SSE live-push server
//
// Public API:
//   GET  /api/v1/site-meta
//   GET  /api/v1/services, /api/v1/services/:slug
//   POST /api/v1/contact
//   GET  /api/v1/live            ← SSE real-time stream
//   GET  /api/v1/health
//
// Admin (requires JWT):
//   POST /api/v1/auth/login
//   GET  /api/v1/auth/me
//   GET  /api/v1/cms/blocks, PATCH /api/v1/cms/blocks/:key
//   GET  /api/v1/cms/blocks/:key/history
//   PATCH /api/v1/cms/services/:slug
//   POST  /api/v1/cms/upload
//   GET   /api/v1/cms/submissions, PATCH /api/v1/cms/submissions/:id
//   GET   /api/v1/cms/stats
// =================================================================

const _dir = typeof __dirname !== "undefined" ? __dirname : (typeof process !== "undefined" ? process.cwd() : "");
try {
  require("dotenv").config({ path: require("path").resolve(_dir, "../.env") });
} catch (_) {}
const express = require("express");
const cors    = require("cors");
const path    = require("path");
const fs      = require("fs");

const { rateLimit: createRateLimit } = require("express-rate-limit");

// ── Route modules ─────────────────────────────────────────────────
const siteRoutes       = require("./routes/site");
const servicesRoutes   = require("./routes/services");
const contactRoutes    = require("./routes/contact");
const authRoutes       = require("./routes/auth");
const cmsRoutes        = require("./routes/cms");
const { router: liveRouter, broadcast } = require("./routes/live");

const app  = express();
const PORT = process.env.PORT || 3000;

// ─────────────────────────────────────────────────────────────────
// Trust Proxy Configuration (for reverse proxies: Render, Railway, Nginx, Cloudflare)
// ─────────────────────────────────────────────────────────────────
const trustProxyVal = process.env.TRUST_PROXY || "1";
app.set(
  "trust proxy",
  trustProxyVal === "false" ? false : isNaN(Number(trustProxyVal)) ? trustProxyVal : parseInt(trustProxyVal, 10)
);

// ─────────────────────────────────────────────────────────────────
// Security Gatekeeper: Block unauthorized access to sensitive files
// Prevents downloading database files, backend source, .env, or package configs
// ─────────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  let decodedPath = "";
  try {
    decodedPath = decodeURIComponent(req.path).toLowerCase();
  } catch (_) {
    return res.status(400).json({ error: { code: "BAD_REQUEST", message: "Invalid path encoding." } });
  }

  const isSensitive =
    /(?:^|\/)\.env/i.test(decodedPath) ||
    /(?:^|\/)data(?:\/|$)/i.test(decodedPath) ||
    /(?:^|\/)backend(?:\/|$)/i.test(decodedPath) ||
    /(?:^|\/)node_modules(?:\/|$)/i.test(decodedPath) ||
    /(?:^|\/)\.git/i.test(decodedPath) ||
    /(?:^|\/)\.vscode/i.test(decodedPath) ||
    /(?:^|\/)\.agents/i.test(decodedPath) ||
    /\.(db|sqlite|sqlite3|sql|log)$/i.test(decodedPath) ||
    /(?:^|\/)package(?:-lock)?\.json$/i.test(decodedPath);

  if (isSensitive) {
    return res.status(403).json({
      error: { code: "FORBIDDEN", message: "Access denied." },
    });
  }

  next();
});

// ─────────────────────────────────────────────────────────────────
// Security Headers (Login Page Security Mastery Skill §2)
// ─────────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  // Prevent MIME-type sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");
  // Block the admin from being framed (clickjacking protection)
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  // Basic XSS protection for older browsers
  res.setHeader("X-XSS-Protection", "1; mode=block");
  // Tell browsers to prefer HTTPS (HSTS) — 1 year, include subdomains
  if (req.secure || req.headers["x-forwarded-proto"] === "https") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  // Referrer: don't leak URL path info to third parties
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  // Content Security Policy for admin pages
  if (req.path.startsWith("/admin")) {
    res.setHeader(
      "Content-Security-Policy",
      [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: blob: https:",
        "connect-src 'self'",
        "frame-ancestors 'self'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join("; ")
    );
  }
  next();
});

// ─────────────────────────────────────────────────────────────────
// Middleware & CORS
// ─────────────────────────────────────────────────────────────────
const configuredOrigins = (process.env.ALLOWED_ORIGINS || process.env.CLIENT_URL || "")
  .split(",")
  .map((s) => s.trim().replace(/\/$/, ""))
  .filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || origin === "null") return cb(null, true);

    // Development origins
    if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      return cb(null, true);
    }

    // Default production domain
    if (/^https:\/\/(www\.)?omnivirtualsolution\.com$/i.test(origin)) {
      return cb(null, true);
    }

    // Cloudflare Workers and Pages domains
    if (/^https:\/\/[a-z0-9-.]+\.workers\.dev$/i.test(origin) || /^https:\/\/[a-z0-9-.]+\.pages\.dev$/i.test(origin)) {
      return cb(null, true);
    }

    // Custom environment configured origins
    if (configuredOrigins.some((allowed) => allowed === origin || (allowed.startsWith("*.") && origin.endsWith(allowed.slice(1))))) {
      return cb(null, true);
    }

    // Allow during development
    if (process.env.NODE_ENV !== "production") {
      return cb(null, true);
    }

    cb(null, false);
  },
  methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
}));

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: false, limit: "2mb" }));

// ─────────────────────────────────────────────────────────────────
// Static Files: Whitelisted directories only (NO full root exposure)
// ─────────────────────────────────────────────────────────────────
const { db: appDb } = require("./db");

// ── Serve uploaded media stored directly in Turso Database (BLOB) ──
app.get(["/assets/uploads/:filename", "/api/v1/media/:filename"], async (req, res, next) => {
  const filename = req.params.filename;
  try {
    const result = await appDb.execute({
      sql: "SELECT mime_type, data FROM media_files WHERE filename = ? OR asset_key = ? LIMIT 1",
      args: [filename, filename],
    });

    if (result.rows && result.rows.length > 0) {
      const row = result.rows[0];
      const buffer = Buffer.from(row.data);
      res.setHeader("Content-Type", row.mime_type || "image/webp");
      res.setHeader("Content-Length", buffer.length);
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      return res.end(buffer);
    }
  } catch (err) {
    console.warn("[media/turso] Database fetch warning:", err.message);
  }
  next();
});

// 1. Shared assets: /assets/* -> ../assets/*
app.use("/assets", express.static(path.resolve(_dir, "../assets")));

// 2. Forms: /forms/* -> ../forms/*
app.use("/forms", express.static(path.resolve(_dir, "../forms")));

// 3. Admin dashboard: /admin/* -> ../admin/*
app.use("/admin", express.static(path.resolve(_dir, "../admin")));

// 4. Live In-Place Editor mirror for admin visual iframe
// Allow only the designated preview HTML documents and assets (prevents root scripts/configs exposure)
const ALLOWED_PREVIEW_HTML = new Set(["index.html", "services.html", "sev.html", "starter-page.html", "dropdown.html"]);
app.use("/admin/site/assets", express.static(path.resolve(_dir, "../assets")));
app.use("/admin/site", (req, res, next) => {
  const reqFile = req.path.replace(/^\/+/, "");
  if (!reqFile || ALLOWED_PREVIEW_HTML.has(reqFile)) {
    const target = path.resolve(_dir, "..", reqFile || "index.html");
    if (fs.existsSync(target)) {
      return res.sendFile(target);
    }
  }
  return res.status(403).json({ error: { code: "FORBIDDEN", message: "Access denied." } });
});


// 5. Frontend React distribution build (if built)
const frontendDistPath = path.resolve(_dir, "../frontend/dist");
if (fs.existsSync(frontendDistPath)) {
  app.use(express.static(frontendDistPath));
}

// ─────────────────────────────────────────────────────────────────
// Public API Routes
// ─────────────────────────────────────────────────────────────────
app.use("/api/v1/site-meta", siteRoutes);
app.use("/api/v1/services",  servicesRoutes);
app.use("/api/v1/contact",   contactRoutes);
app.use("/api/v1/live",      liveRouter);

// ── Lightweight visitor tracking (privacy-preserving & rate-limited) ──
const crypto = require("crypto");

const trackVisitLimit = createRateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // max 60 visit pings per minute per IP
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: (_req, res) => res.status(429).json({ ok: false, error: "Rate limit exceeded" }),
});

app.post("/api/v1/track-visit", trackVisitLimit, async (req, res) => {
  const { path: p = "/", referrer = "direct" } = req.body || {};
  const ua = req.headers["user-agent"] || "";
  const ip = req.ip || req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket?.remoteAddress || "";

  // Ignore loopback, internal IPs, and localhost
  if (ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1") {
    return res.json({ ok: true, skipped: "local" });
  }

  // Ignore admin traffic with auth token or viewing admin paths
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
    return res.json({ ok: true, skipped: "admin" });
  }
  if (String(p).includes("/admin") || String(referrer).includes("/admin")) {
    return res.json({ ok: true, skipped: "admin_path" });
  }

  const ipHash = crypto.createHash("sha256").update(ip + (process.env.JWT_SECRET || "omni-salt")).digest("hex").slice(0, 16);
  const device = /mobile/i.test(ua) ? "mobile" : /tablet|ipad/i.test(ua) ? "tablet" : "desktop";

  try {
    // Session deduplication: only 1 visit per IP hash per device per 10 minutes
    const recent = await appDb.execute({
      sql: "SELECT id FROM page_visits WHERE ip_hash = ? AND device = ? AND visited_at >= datetime('now', '-10 minutes') LIMIT 1",
      args: [ipHash, device]
    });

    if (recent.rows && recent.rows.length > 0) {
      return res.json({ ok: true, deduplicated: true, device });
    }

    await appDb.execute({
      sql: "INSERT INTO page_visits (path, ip_hash, device, referrer) VALUES (?, ?, ?, ?)",
      args: [String(p).slice(0, 200), ipHash, device, String(referrer).slice(0, 200)],
    });
  } catch (_) {}

  res.json({ ok: true });
});


// ─────────────────────────────────────────────────────────────────
// Admin Routes (auth + CMS)
// ─────────────────────────────────────────────────────────────────
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/cms",  cmsRoutes);

// ─────────────────────────────────────────────────────────────────
// Health Check
// ─────────────────────────────────────────────────────────────────
app.get("/api/v1/health", (_req, res) => {
  res.json({
    status:    "ok",
    service:   "Omni Virtual Solutions API",
    version:   "2.0.0",
    timestamp: new Date().toISOString(),
    database:  process.env.TURSO_DATABASE_URL ? "turso-cloud" : "sqlite-local",
  });
});

// ─────────────────────────────────────────────────────────────────
// 404 for unknown /api routes
// ─────────────────────────────────────────────────────────────────
app.use("/api", (req, res) => {
  res.status(404).json({
    error: { code: "NOT_FOUND", message: `Route not found: ${req.method} ${req.originalUrl}` }
  });
});

// ─────────────────────────────────────────────────────────────────
// SPA Fallback for React frontend
// ─────────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  if (req.method !== "GET") return next();
  if (req.path.startsWith("/api") || req.path.startsWith("/admin")) return next();
  const indexFile = path.resolve(_dir, "../frontend/dist/index.html");
  if (fs.existsSync(indexFile)) {
    return res.sendFile(indexFile);
  }
  next();
});

// ─────────────────────────────────────────────────────────────────
// Global error handler — never leak stack traces to clients
// ─────────────────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  console.error("[unhandled]", err.message || err);
  res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." } });
});

// ─────────────────────────────────────────────────────────────────
// Start (only when executed directly, not when imported by serverless functions)
// ─────────────────────────────────────────────────────────────────
if (require.main === module) {
  app.listen(PORT, () => {
    console.log("\n" + "=".repeat(62));
    console.log("  🚀 Omni Virtual Solutions API v2.0");
    console.log("=".repeat(62));
    console.log(`  Website:  http://localhost:${PORT}/index.html`);
    console.log(`  Admin:    http://localhost:${PORT}/admin/`);
    console.log(`  Health:   http://localhost:${PORT}/api/v1/health`);
    console.log(`  Live SSE: http://localhost:${PORT}/api/v1/live`);
    console.log("=".repeat(62));
    console.log(`  Database: ${process.env.TURSO_DATABASE_URL ? "☁️  Turso Cloud" : "💾 Local SQLite (data/omni.db)"}`);
    console.log("=".repeat(62) + "\n");

    // Start background Gmail IMAP sync service
    try {
      const { startInboundSync } = require("./inbound-sync");
      startInboundSync(12000);
    } catch (syncErr) {
      console.warn("[server] Inbound sync service failed to initialize:", syncErr.message);
    }
  });
}

module.exports = app;
