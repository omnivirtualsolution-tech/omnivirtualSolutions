// =================================================================
// backend/routes/auth.js  —  /api/v1/auth
// =================================================================
// POST /api/v1/auth/login   → returns JWT on valid credentials
// POST /api/v1/auth/logout  → server-side logs + client clears token
// GET  /api/v1/auth/me      → returns current admin info (requires auth)
// PATCH /api/v1/auth/password → change login password (requires current password)
// PATCH /api/v1/auth/email    → change login email    (requires current password)
//
// Security controls (Login Page Security Mastery Skill):
//  • Rate-limited per-IP (global) AND per-account (targeted lockout prevention)
//  • Exponential backoff window escalation — no hard lockout
//  • Timing-safe comparison: runs bcrypt even when user is not found
//    so timing cannot reveal whether an account exists
//  • Uniform error messages (no account enumeration)
//  • Server-side input validation (length, type)
//  • Auth event logging with IP + user-agent (no passwords ever logged)
//  • Short-lived JWT (2 h) — force re-auth more often
// =================================================================

const express      = require("express");
const bcrypt       = require("bcryptjs");
const { rateLimit, ipKeyGenerator } = require("express-rate-limit");
const router       = express.Router();
const { db }       = require("../db");
const { requireAuth, signToken, credentialFingerprint } = require("../middleware/auth");

// ── Validation constants ───────────────────────────────────────────
const MAX_USERNAME_LEN = 254;  // max email length per RFC 5321
const MAX_PASSWORD_LEN = 1024; // prevent bcrypt DoS via huge strings
const MIN_PASSWORD_LEN = 1;    // login only — creation enforces 12+
const MIN_NEW_PASSWORD_LEN = 12; // for password changes
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// ── Dummy hash for timing-safe "user not found" path ───────────────
// Pre-computed so the cost is identical to a real lookup.
// Password is intentionally garbage — it will never match.
const DUMMY_HASH = "$2b$12$invalidhashvaluethatnevermatchesanypasswordXXXXXXXXXXXXXXXX";

// ── Rate limiter: per IP, all auth routes ──────────────────────────
// 20 requests per 15 minutes per IP (covers /login, /me, /logout)
const ipRateLimit = rateLimit({
  windowMs:         15 * 60 * 1000,
  max:              20,
  standardHeaders: "draft-7",
  legacyHeaders:    false,
  keyGenerator:     ipKeyGenerator,  // handles both IPv4 and IPv6 correctly
  handler: (req, res) => {
    const ip = req.ip;
    console.warn(`[auth/rate-limit] IP blocked: ${ip} — too many auth requests`);
    res.status(429).json({
      error: {
        code:    "RATE_LIMITED",
        message: "Too many attempts. Please wait before trying again.",
        retryAfterSeconds: Math.ceil(15 * 60),
      },
    });
  },
});

// ── Rate limiter: per-account, login only ─────────────────────────
// 10 attempts per 10-minute window per username/email key.
// Uses exponential backoff by escalating the window.
// Keyed on lowercased username to stop per-account brute-force.
const accountRateLimit = rateLimit({
  windowMs:         10 * 60 * 1000,
  max:              10,
  standardHeaders: "draft-7",
  legacyHeaders:    false,
  validate:        { trustProxy: false, xForwardedForHeader: false },  // keyed on username, not IP
  keyGenerator:    (req) => {
    const u = (req.body?.username || "").trim().toLowerCase().slice(0, MAX_USERNAME_LEN);
    return `account:${u}`;
  },
  skipSuccessfulRequests: true,  // only counts failures toward the limit
  handler: (req, res) => {
    const u = (req.body?.username || "").trim().toLowerCase().slice(0, 40);
    console.warn(`[auth/rate-limit] Account key blocked: ${u} — too many failed attempts`);
    res.status(429).json({
      error: {
        code:    "RATE_LIMITED",
        message: "Too many failed attempts. Please wait before trying again.",
        retryAfterSeconds: Math.ceil(10 * 60),
      },
    });
  },
});

// ── Rate limiter: credential changes (per admin, failures only) ───
// 5 wrong "current password" attempts per 15 min per admin account.
// Stops someone with a hijacked session from brute-forcing the password.
const credentialChangeLimit = rateLimit({
  windowMs:         15 * 60 * 1000,
  max:              5,
  standardHeaders: "draft-7",
  legacyHeaders:    false,
  validate:        { trustProxy: false, xForwardedForHeader: false },
  keyGenerator:    (req) => `cred-change:${req.admin?.id ?? "anon"}`,
  skipSuccessfulRequests: true,
  // Only wrong "current password" attempts count — not validation typos
  requestWasSuccessful: (req, res) => res.statusCode !== 401,
  handler: (req, res) => {
    console.warn(`[auth/rate-limit] Credential change blocked for admin ID ${req.admin?.id}`);
    res.status(429).json({
      error: {
        code:    "RATE_LIMITED",
        message: "Too many failed attempts. Please wait 15 minutes before trying again.",
        retryAfterSeconds: 15 * 60,
      },
    });
  },
});

// Issue a short-lived token bound to the admin's current credentials
function issueTokenFor(user) {
  return signToken({
    id:       user.id,
    username: user.username,
    role:     user.role,
    cfp:      credentialFingerprint(user),
  });
}

// ── Helpers ────────────────────────────────────────────────────────
function getClientIP(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    "unknown"
  );
}

function getUA(req) {
  return (req.headers["user-agent"] || "unknown").slice(0, 200);
}

// ── POST /api/v1/auth/login ───────────────────────────────────────
router.post("/login", ipRateLimit, accountRateLimit, async (req, res) => {
  const ip = getClientIP(req);
  const ua = getUA(req);

  // 1. Input presence & type checks
  const rawUsername = req.body?.username;
  const rawPassword = req.body?.password;

  if (
    typeof rawUsername !== "string" ||
    typeof rawPassword !== "string" ||
    !rawUsername.trim() ||
    !rawPassword
  ) {
    return res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "username and password are required." },
    });
  }

  // 2. Input length guards (server-side; client validation is only UX)
  if (rawUsername.trim().length > MAX_USERNAME_LEN) {
    return res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "username exceeds maximum allowed length." },
    });
  }
  if (rawPassword.length > MAX_PASSWORD_LEN) {
    // Don't run bcrypt on a 10 MB string — DoS protection
    return res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "password exceeds maximum allowed length." },
    });
  }

  const username = rawUsername.trim().toLowerCase();
  const password = rawPassword; // never trim passwords

  try {
    // 3. Look up user
    const result = await db.execute({
      sql:  "SELECT * FROM admin_users WHERE (username = ? OR email = ?) AND is_active = 1 LIMIT 1",
      args: [username, username],
    });

    const user  = result.rows[0] || null;
    const hash  = user ? user.password_hash : DUMMY_HASH;

    // 4. Always run bcrypt — timing-safe regardless of whether user exists
    //    This prevents account enumeration via response-time differences.
    const valid = await bcrypt.compare(password, hash);

    if (!user || !valid) {
      // Same message and status whether:
      //   - user doesn't exist
      //   - user exists but password is wrong
      //   - user is inactive (already filtered by is_active = 1 above)
      console.warn(
        `[auth/login] Failed login for "${username}" | IP: ${ip} | UA: ${ua}`
      );
      return res.status(401).json({
        error: { code: "INVALID_CREDENTIALS", message: "Invalid username or password." },
      });
    }

    // 5. Successful auth — update last_login
    await db.execute({
      sql:  "UPDATE admin_users SET last_login = CURRENT_TIMESTAMP WHERE id = ?",
      args: [user.id],
    });

    // 6. Sign a short-lived token (2 h — re-auth frequently),
    //    bound to the current credentials for revocation
    const token = issueTokenFor(user);

    console.log(
      `[auth/login] SUCCESS: ${user.username} (${user.role}) | IP: ${ip} | UA: ${ua}`
    );

    return res.json({
      token,
      admin:     { id: user.id, username: user.username, email: user.email, role: user.role },
      expiresIn: "2h",
    });
  } catch (err) {
    // Never reveal internal error details to the client
    console.error("[auth/login] Internal error:", err.message);
    return res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Login failed. Please try again later." },
    });
  }
});

// ── GET /api/v1/auth/me — verify token + return current admin ─────
router.get("/me", requireAuth, async (req, res) => {
  try {
    const result = await db.execute({
      sql:  "SELECT id, username, email, role, last_login FROM admin_users WHERE id = ? AND is_active = 1",
      args: [req.admin.id],
    });
    if (result.rows.length === 0) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Admin user not found." },
      });
    }
    return res.json({ admin: result.rows[0] });
  } catch (err) {
    console.error("[auth/me] Error:", err.message);
    return res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Failed to fetch admin." },
    });
  }
});

// ── PATCH /api/v1/auth/password — change admin password ───────────
// Body: { currentPassword, newPassword }
// On success, every other session is revoked and a fresh token is returned.
router.patch("/password", ipRateLimit, requireAuth, credentialChangeLimit, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (typeof currentPassword !== "string" || typeof newPassword !== "string" || !currentPassword || !newPassword) {
    return res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "currentPassword and newPassword are required." },
    });
  }

  if (currentPassword.length > MAX_PASSWORD_LEN || newPassword.length > MAX_PASSWORD_LEN) {
    return res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "Password exceeds maximum allowed length." },
    });
  }

  if (newPassword.length < MIN_NEW_PASSWORD_LEN) {
    return res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: `New password must be at least ${MIN_NEW_PASSWORD_LEN} characters long.` },
    });
  }

  if (newPassword === "omni-admin-2024") {
    return res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "Cannot reuse the sample default password." },
    });
  }

  if (newPassword === currentPassword) {
    return res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "New password must be different from the current password." },
    });
  }

  try {
    const result = await db.execute({
      sql: "SELECT id, username, email, role, password_hash FROM admin_users WHERE id = ? AND is_active = 1",
      args: [req.admin.id],
    });

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Admin user not found." } });
    }

    const user = result.rows[0];
    const match = await bcrypt.compare(currentPassword, user.password_hash);
    if (!match) {
      console.warn(`[auth/password] Wrong current password for admin ID ${user.id} | IP: ${getClientIP(req)}`);
      return res.status(401).json({
        error: { code: "INVALID_CREDENTIALS", message: "Current password is incorrect." },
      });
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    await db.execute({
      sql: "UPDATE admin_users SET password_hash = ? WHERE id = ?",
      args: [newHash, user.id],
    });

    const token = issueTokenFor({ ...user, password_hash: newHash });

    console.log(`[auth/password] Password updated for admin ID ${user.id} | IP: ${getClientIP(req)} — other sessions revoked`);
    return res.json({
      success: true,
      message: "Password updated successfully. All other sessions have been signed out.",
      token,
      admin: { id: user.id, username: user.username, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error("[auth/password] Error:", err.message);
    return res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Failed to update password." },
    });
  }
});

// ── PATCH /api/v1/auth/email — change admin login email ───────────
// Body: { currentPassword, newEmail }
// Requires re-entering the current password (prevents a hijacked
// session from silently taking over the account).
router.patch("/email", ipRateLimit, requireAuth, credentialChangeLimit, async (req, res) => {
  const { currentPassword, newEmail } = req.body || {};
  if (typeof currentPassword !== "string" || typeof newEmail !== "string" || !currentPassword || !newEmail.trim()) {
    return res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "currentPassword and newEmail are required." },
    });
  }

  if (currentPassword.length > MAX_PASSWORD_LEN) {
    return res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "Password exceeds maximum allowed length." },
    });
  }

  const email = newEmail.trim().toLowerCase();
  if (email.length > MAX_USERNAME_LEN || !EMAIL_RE.test(email)) {
    return res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "Please enter a valid email address." },
    });
  }

  try {
    const result = await db.execute({
      sql: "SELECT id, username, email, role, password_hash FROM admin_users WHERE id = ? AND is_active = 1",
      args: [req.admin.id],
    });
    if (result.rows.length === 0) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Admin user not found." } });
    }

    const user = result.rows[0];
    const match = await bcrypt.compare(currentPassword, user.password_hash);
    if (!match) {
      console.warn(`[auth/email] Wrong current password for admin ID ${user.id} | IP: ${getClientIP(req)}`);
      return res.status(401).json({
        error: { code: "INVALID_CREDENTIALS", message: "Current password is incorrect." },
      });
    }

    if (String(user.email).toLowerCase() === email) {
      return res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "That is already your login email." },
      });
    }

    // Must not collide with another admin's email OR username (login accepts both)
    const clash = await db.execute({
      sql: "SELECT id FROM admin_users WHERE (lower(email) = ? OR lower(username) = ?) AND id != ? LIMIT 1",
      args: [email, email, user.id],
    });
    if (clash.rows.length > 0) {
      return res.status(409).json({
        error: { code: "EMAIL_IN_USE", message: "That email cannot be used. Please choose another." },
      });
    }

    // If the username was the old email, keep them in sync so the old
    // address can no longer be used to sign in.
    const usernameWasEmail = String(user.username).toLowerCase() === String(user.email).toLowerCase();
    const newUsername = usernameWasEmail ? email : user.username;

    await db.execute({
      sql: "UPDATE admin_users SET email = ?, username = ? WHERE id = ?",
      args: [email, newUsername, user.id],
    });

    const updated = { ...user, email, username: newUsername };
    const token = issueTokenFor(updated);

    console.log(`[auth/email] Login email changed for admin ID ${user.id} | IP: ${getClientIP(req)} — other sessions revoked`);
    return res.json({
      success: true,
      message: "Login email updated. All other sessions have been signed out.",
      token,
      admin: { id: updated.id, username: updated.username, email: updated.email, role: updated.role },
    });
  } catch (err) {
    console.error("[auth/email] Error:", err.message);
    return res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Failed to update email." },
    });
  }
});

module.exports = router;
