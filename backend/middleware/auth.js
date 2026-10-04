// =================================================================
// backend/middleware/auth.js  —  JWT authentication middleware
// =================================================================
// Attach to any route that requires an authenticated admin.
// Usage: router.patch("/...", requireAuth, handler)
//
// Security controls (Login Page Security Mastery Skill):
//  • Fails fast with a loud startup warning if JWT_SECRET is the
//    default placeholder — prevents silent production misconfiguration
//  • Token expiry shortened to 2 h (matching signToken)
//  • Returns distinct codes for expired vs. invalid tokens so the
//    client can show "session expired — please log in again" vs.
//    a generic auth error, without leaking server internals
//  • Session revocation: every token carries a fingerprint of the
//    admin's current credentials (password hash + email). Changing
//    the password or login email instantly invalidates every token
//    issued before the change (e.g. a stolen/leaked session).
// =================================================================

const jwt    = require("jsonwebtoken");
const crypto = require("crypto");
const { db } = require("../db");

const JWT_SECRET = process.env.JWT_SECRET;

// ── Fail-fast: warn loudly if the secret is missing or is the demo default ──
if (!JWT_SECRET || JWT_SECRET === "omni-cms-secret-change-in-production") {
  if (process.env.NODE_ENV === "production") {
    // Hard-fail in production — a weak secret in prod is a critical vulnerability
    console.error(
      "\n[FATAL] JWT_SECRET is not set or is the default placeholder.\n" +
      "  Set a strong, random secret in your .env file before running in production.\n" +
      "  Example: JWT_SECRET=$(node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\")\n"
    );
    process.exit(1);
  } else {
    // Warn loudly in development so the dev knows to fix it before shipping
    console.warn(
      "\n⚠️  [auth] WARNING: JWT_SECRET is using the insecure default value.\n" +
      "   Set a strong JWT_SECRET in your .env file before deploying to production.\n"
    );
  }
}

// Use the env var if set, fall back to a development placeholder only
const EFFECTIVE_SECRET = JWT_SECRET || "omni-cms-dev-secret-DO-NOT-USE-IN-PRODUCTION";

// ── Credential fingerprint ────────────────────────────────────────
// HMAC of the stored password hash + email, keyed with the JWT secret.
// Not reversible, and changes whenever either credential changes.
function credentialFingerprint(user) {
  return crypto
    .createHmac("sha256", EFFECTIVE_SECRET)
    .update(`${user.password_hash}|${String(user.email).toLowerCase()}`)
    .digest("base64url")
    .slice(0, 22);
}

// ── requireAuth middleware ─────────────────────────────────────────
async function requireAuth(req, res, next) {
  const header = req.headers["authorization"] || "";
  const token  = header.startsWith("Bearer ") ? header.slice(7).trim() : (req.query?.token || null);

  if (!token) {
    return res.status(401).json({
      error: { code: "UNAUTHORIZED", message: "Authentication required. Provide a Bearer token." },
    });
  }

  let payload;
  try {
    payload = jwt.verify(token, EFFECTIVE_SECRET);
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({
        error: { code: "TOKEN_EXPIRED", message: "Session expired. Please log in again." },
      });
    }
    return res.status(401).json({
      error: { code: "TOKEN_INVALID", message: "Invalid authentication token." },
    });
  }

  // Revocation check — token must match the admin's CURRENT credentials
  try {
    const result = await db.execute({
      sql:  "SELECT password_hash, email FROM admin_users WHERE id = ? AND is_active = 1 LIMIT 1",
      args: [payload.id],
    });
    const user = result.rows[0];
    const expected = user ? credentialFingerprint(user) : null;
    if (
      !expected ||
      typeof payload.cfp !== "string" ||
      payload.cfp.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(payload.cfp), Buffer.from(expected))
    ) {
      return res.status(401).json({
        error: { code: "SESSION_REVOKED", message: "Your session is no longer valid. Please log in again." },
      });
    }
  } catch (err) {
    console.error("[auth/middleware] Revocation check failed:", err.message);
    return res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Authentication check failed." },
    });
  }

  req.admin = payload; // { id, username, role, cfp, iat, exp }
  return next();
}

// ── signToken ─────────────────────────────────────────────────────
// Short-lived 2 h tokens — per skill §6: short-lived access tokens
// reduce the window of exposure if a token is leaked.
function signToken(payload) {
  return jwt.sign(payload, EFFECTIVE_SECRET, { expiresIn: "2h" });
}

module.exports = { requireAuth, signToken, credentialFingerprint };
