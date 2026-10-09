// =================================================================
// backend/routes/contact.js  —  /api/v1/contact
// =================================================================
// Public endpoints (rate-limited):
//   POST /api/v1/contact/submit   → save message + trigger email notification
//
// Admin endpoints (requireAuth):
//   GET    /api/v1/contact/submissions       → list all (with search/filter)
//   GET    /api/v1/contact/submissions/:id   → single submission + replies
//   PATCH  /api/v1/contact/submissions/:id   → update status / admin_notes
//   DELETE /api/v1/contact/submissions/:id   → delete submission + replies
//   POST   /api/v1/contact/submissions/:id/reply  → send reply email
//   POST   /api/v1/contact/submissions/:id/retry  → retry failed email notification
//   GET    /api/v1/contact/email-settings    → read email settings (no passwords)
//   PUT    /api/v1/contact/email-settings    → save email settings
//   POST   /api/v1/contact/email-settings/test  → test SMTP connection
//   GET    /api/v1/contact/email-stats       → email usage stats
// =================================================================

const express   = require("express");
const router    = express.Router();
const { db }    = require("../db");
const { requireAuth } = require("../middleware/auth");
const emailSvc  = require("../email-service");
const { broadcast } = require("./live");
const { syncUniversalEmail } = require("../email-sync");

// ── Rate limiting: Production safe threshold (configurable via env) ──
let rateLimit;
try {
  const rl = require("express-rate-limit");
  const maxSubmissions = process.env.CONTACT_RATE_LIMIT
    ? parseInt(process.env.CONTACT_RATE_LIMIT, 10)
    : (process.env.NODE_ENV === "production" ? 10 : 100);

  rateLimit = rl({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: maxSubmissions,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    validate: false,
    message: { error: { code: "RATE_LIMIT", message: "Too many submissions. Please wait a few minutes before trying again." } },
    keyGenerator: (req) => req.ip || req.socket?.remoteAddress || "unknown",
  });
} catch (_) {
  rateLimit = (_req, _res, next) => next(); // fallback if package missing
}

// ── Helpers ───────────────────────────────────────────────────────
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Honeypot field check (bot protection)
function isBot(body) {
  // If a hidden "website" field is filled, it's almost certainly a bot
  if (body.website && body.website.trim().length > 0) return true;
  // If timestamps are impossibly fast (< 300ms from load)
  const loadTime = body._form_load_time || body.form_load_time;
  if (loadTime) {
    const elapsed = Date.now() - parseInt(loadTime, 10);
    if (elapsed > 0 && elapsed < 300) return true;
  }
  return false;
}

// =================================================================
// POST /api/v1/contact/submit & POST /api/v1/contact  (public, rate-limited)
// =================================================================
const handleContactSubmission = async (req, res) => {
  // Bot check
  if (isBot(req.body)) {
    // Silently return 200 to confuse bots
    return res.status(200).json({ success: true, message: "Thank you for your message." });
  }

  const full_name = (req.body.full_name || req.body.name || "").trim();
  const email = (req.body.email || "").trim();
  const subject = (req.body.subject || "").trim() || "General Inquiry";
  const message = (req.body.message || "").trim();
  const phone = (req.body.phone || "").trim();
  const rawInterest = req.body.service_interest_id ?? req.body.service_interest;
  const parsedInterestId = (rawInterest !== null && rawInterest !== undefined && rawInterest !== "" && !isNaN(Number(rawInterest)))
    ? parseInt(rawInterest, 10)
    : null;

  // Validation
  const errors = [];
  if (!full_name || full_name.length < 2) errors.push("Full name is required (min 2 characters).");
  if (!email || !isValidEmail(email))     errors.push("A valid email address is required.");
  if (!message || message.length < 3)     errors.push("Message is required (min 3 characters).");
  if (phone && phone.length > 0 && !/^[\d\s\+\-\(\)\.]+$/.test(phone))
    errors.push("Phone number format is invalid.");

  if (errors.length > 0) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: errors.join(" ") } });
  }

  const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket?.remoteAddress || null;

  // Validate service_interest_id against existing services in DB to avoid foreign key errors
  let safeServiceInterestId = null;
  if (parsedInterestId) {
    try {
      const svcCheck = await db.execute({
        sql: "SELECT id FROM services WHERE id = ? LIMIT 1",
        args: [parsedInterestId]
      });
      if (svcCheck.rows && svcCheck.rows.length > 0) {
        safeServiceInterestId = Number(svcCheck.rows[0].id);
      }
    } catch (_) {}
  }

  // Duplicate submission guard (10 seconds debounce to prevent accidental double-clicks)
  try {
    const dupeCheck = await db.execute({
      sql: `SELECT id FROM contact_submissions WHERE email = ? AND message = ? AND created_at > datetime('now', '-10 seconds') LIMIT 1`,
      args: [email.toLowerCase(), message],
    });
    if (dupeCheck.rows.length > 0) {
      return res.status(200).json({ success: true, message: "Your message has already been received. We will get back to you shortly." });
    }
  } catch (_) {}

  // ── SAVE TO DB FIRST (Guaranteed Resilience) ──────────────────────
  let newId;
  try {
    const result = await db.execute({
      sql: `INSERT INTO contact_submissions
              (full_name, email, phone, subject, message, service_interest_id, status, ip_address, email_notify_status)
            VALUES (?,?,?,?,?,?,'new',?,'pending')`,
      args: [
        full_name,
        email.toLowerCase(),
        phone || null,
        subject || null,
        message,
        safeServiceInterestId,
        ip,
      ],
    });
    newId = Number(result.lastInsertRowid);
    console.log(`[contact] New submission #${newId} from: ${email.toLowerCase()}`);
  } catch (err) {
    console.warn("[contact] Primary insert failed, executing safe fallback:", err.message);
    try {
      const fallbackResult = await db.execute({
        sql: `INSERT INTO contact_submissions
                (full_name, email, phone, subject, message, service_interest_id, status, ip_address, email_notify_status)
              VALUES (?,?,?,?,?,NULL,'new',?,'pending')`,
        args: [
          full_name,
          email.toLowerCase(),
          phone || null,
          subject || null,
          message,
          ip,
        ],
      });
      newId = Number(fallbackResult.lastInsertRowid);
      console.log(`[contact] Fallback submission #${newId} saved successfully for: ${email.toLowerCase()}`);
    } catch (fallbackErr) {
      console.error("[contact] Critical insert error:", fallbackErr.message);
      return res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to save your submission. Please try again." } });
    }
  }

  // Broadcast live event to real-time dashboards
  try {
    broadcast({
      type: "new_submission",
      submissionId: newId,
      submission: {
        id: newId,
        full_name: full_name ? full_name.slice(0, 50) : "Client Lead",
        subject: subject ? subject.slice(0, 80) : "General Inquiry",
        status: 'new',
        created_at: new Date().toISOString(),
      },
      lead: {
        id: newId,
        full_name: full_name ? full_name.slice(0, 30) : "Client Lead",
        subject: subject ? subject.slice(0, 50) : "General Inquiry",
        status: 'new',
        created_at: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (_) {}

  // ── DELIVERY STRATEGY & QUOTA ENGINE ────────────────────────────
  const submission = { id: newId, full_name, email: email.toLowerCase(), phone: phone || null, subject, message, ip_address: ip, created_at: new Date().toISOString() };
  
  const quota = await emailSvc.getQuotaStatus();

  if (quota.shouldUsePopupFallback) {
    console.log(`[contact] Fallback active (strategy: ${quota.strategy}, sent24h: ${quota.sent24h}/${quota.limit}). Prompting frontend popup.`);
    return res.status(201).json({
      success: true,
      id: newId,
      mode: "popup_fallback",
      reason: quota.strategy === "force_popup" ? "admin_forced_popup" : "quota_exceeded",
      sent24h: quota.sent24h,
      limit: quota.limit,
      message: quota.strategy === "force_popup"
        ? "Submission saved to CRM. Opening direct Gmail compose window..."
        : "Daily automated email quota reached. Opening direct Gmail compose fallback...",
    });
  }

  // Under quota: Send admin notification and customer auto-reply concurrently.
  // We await them with an 8-second safety timeout so serverless environments (Netlify)
  // do not freeze the function container before the emails are transmitted to Gmail.
  try {
    const emailPromise = Promise.allSettled([
      emailSvc.sendNewSubmissionNotification(submission),
      emailSvc.sendAutoReply(submission),
    ]);

    const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve("timeout"), 8000));
    const raceResult = await Promise.race([emailPromise, timeoutPromise]);
    if (raceResult === "timeout") {
      console.warn(`[contact] Submission #${newId} emails took >8s; response returned while sending completes.`);
    }
  } catch (err) {
    console.error("[contact] Email dispatch error:", err.message);
  }

  // Self-healing: recover any previously pending submissions left by cold container pauses
  emailSvc.processPendingSubmissions(3).catch(() => {});

  res.status(201).json({
    success: true,
    id: newId,
    mode: "background_sent",
    sent24h: quota.sent24h + 1,
    limit: quota.limit,
    message: "Your message has been received! We will get back to you within 1-2 business days.",
  });
};

router.post("/submit", rateLimit, handleContactSubmission);
router.post("/", rateLimit, handleContactSubmission);

// =================================================================
// GET /api/v1/contact/submissions  — Admin: list all
// Query: ?status=new|in_review|contacted|closed|replied
//        &search=<text>
//        &page=1&limit=50
// =================================================================
router.get("/submissions", requireAuth, async (req, res) => {
  const { status, search, page = 1, limit = 50 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  try {
    const conditions = [];
    const args = [];

    if (status) {
      conditions.push("cs.status = ?");
      args.push(status);
    }
    if (search) {
      conditions.push("(cs.full_name LIKE ? OR cs.email LIKE ? OR cs.subject LIKE ? OR cs.message LIKE ?)");
      const q = `%${search}%`;
      args.push(q, q, q, q);
    }

    const where = conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";

    const [rows, countRow] = await Promise.all([
      db.execute({
        sql: `SELECT cs.id, cs.full_name, cs.email, cs.phone, cs.subject, cs.message,
                     cs.status, cs.created_at, cs.read_at, cs.admin_notes, cs.email_notify_status,
                     s.title AS service_interest_title,
                     (SELECT COUNT(*) FROM contact_replies r WHERE r.submission_id = cs.id) AS reply_count,
                     (SELECT reply_body FROM contact_replies r WHERE r.submission_id = cs.id ORDER BY sent_at DESC LIMIT 1) AS latest_reply_body,
                     (SELECT direction FROM contact_replies r WHERE r.submission_id = cs.id ORDER BY sent_at DESC LIMIT 1) AS latest_reply_direction,
                     (SELECT sent_at FROM contact_replies r WHERE r.submission_id = cs.id ORDER BY sent_at DESC LIMIT 1) AS latest_reply_at,
                     COALESCE((SELECT MAX(sent_at) FROM contact_replies r WHERE r.submission_id = cs.id), cs.created_at) AS last_activity_at
              FROM contact_submissions cs
              LEFT JOIN services s ON cs.service_interest_id = s.id
              ${where}
              ORDER BY last_activity_at DESC
              LIMIT ? OFFSET ?`,
        args: [...args, parseInt(limit), offset],
      }),
      db.execute({
        sql: `SELECT COUNT(*) AS total FROM contact_submissions cs ${where}`,
        args,
      }),
    ]);

    res.json({ submissions: rows.rows, total: countRow.rows[0].total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    console.error("[contact/submissions] GET Error:", err.message);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to load submissions." } });
  }
});

// =================================================================
// GET /api/v1/contact/submissions/:id  — Admin: single submission + replies
// =================================================================
router.get("/submissions/:id", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    const [subRow, replies] = await Promise.all([
      db.execute({
        sql: `SELECT cs.*, s.title AS service_interest_title
              FROM contact_submissions cs
              LEFT JOIN services s ON cs.service_interest_id = s.id
              WHERE cs.id = ? LIMIT 1`,
        args: [id],
      }),
      db.execute({
        sql: "SELECT * FROM contact_replies WHERE submission_id = ? ORDER BY sent_at ASC",
        args: [id],
      }),
    ]);

    if (subRow.rows.length === 0) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Submission not found." } });
    }

    res.json({ submission: subRow.rows[0], replies: replies.rows });
  } catch (err) {
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to load submission." } });
  }
});

// =================================================================
// PATCH /api/v1/contact/submissions/:id  — Admin: update status/notes
// Body: { status?, admin_notes?, mark_unread?, mark_read?, read? }
// =================================================================
router.patch("/submissions/:id", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { status, admin_notes, mark_unread, mark_read, read } = req.body;
  const VALID_STATUSES = ["new", "in_review", "contacted", "replied", "closed"];

  const updates = [];
  const args = [];

  if (status !== undefined) {
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: `status must be one of: ${VALID_STATUSES.join(", ")}` } });
    }
    updates.push("status = ?");
    args.push(status);
  }
  if (admin_notes !== undefined) {
    updates.push("admin_notes = ?");
    args.push(admin_notes);
  }
  if (mark_read === true || read === true) {
    updates.push("read_at = CURRENT_TIMESTAMP");
  } else if (mark_unread === true) {
    updates.push("read_at = NULL");
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Nothing to update." } });
  }

  args.push(id);
  try {
    await db.execute({ sql: `UPDATE contact_submissions SET ${updates.join(", ")} WHERE id = ?`, args });
    console.log(`[cms] admin updated submission #${id}`);
    const isMarkedRead = mark_read === true || read === true;
    const isMarkedUnread = mark_unread === true;
    try {
      broadcast({
        type: "lead_updated",
        id,
        status: status || null,
        read_at: isMarkedRead ? new Date().toISOString() : (isMarkedUnread ? null : undefined),
        timestamp: new Date().toISOString()
      });
    } catch (_) {}
    res.json({ success: true, id, status, read_at: isMarkedRead ? new Date().toISOString() : (isMarkedUnread ? null : undefined) });
  } catch (err) {
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to update submission." } });
  }
});

// =================================================================
// DELETE /api/v1/contact/submissions/:id  — Admin: delete message
// =================================================================
router.delete("/submissions/:id", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    await db.execute({ sql: "DELETE FROM contact_submissions WHERE id = ?", args: [id] });
    console.log(`[cms] admin deleted submission #${id}`);
    broadcast({
      type: "lead_deleted",
      id,
      timestamp: new Date().toISOString()
    });
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to delete submission." } });
  }
});

// =================================================================
// POST /api/v1/contact/submissions/:id/reply  — Admin: send reply
// Body: { reply_body: "..." }
// =================================================================
router.post("/submissions/:id/reply", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { reply_body } = req.body;

  if (!reply_body || reply_body.trim().length < 5) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Reply body is required (min 5 characters)." } });
  }

  // Fetch submission
  let submission;
  try {
    const row = await db.execute({ sql: "SELECT * FROM contact_submissions WHERE id = ? LIMIT 1", args: [id] });
    if (row.rows.length === 0) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Submission not found." } });
    submission = row.rows[0];
  } catch (err) {
    return res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to fetch submission." } });
  }

  // Save reply to DB first
  let replyId;
  try {
    const r = await db.execute({
      sql: `INSERT INTO contact_replies (submission_id, direction, reply_body, sent_by, email_sent)
            VALUES (?, 'outbound', ?, ?, 0)`,
      args: [id, reply_body.trim(), req.admin.username],
    });
    replyId = Number(r.lastInsertRowid);
    // Auto-update status to 'replied'
    await db.execute({ sql: "UPDATE contact_submissions SET status = 'replied' WHERE id = ?", args: [id] });
    broadcast({
      type: "reply_sent",
      submissionId: id,
      reply: {
        id: replyId,
        submission_id: id,
        direction: "outbound",
        reply_body: reply_body.trim(),
        sent_by: req.admin.username,
        email_sent: 0,
        sent_at: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    return res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to save reply." } });
  }

  // Send email in background
  const emailResult = await emailSvc.sendReply({
    submission,
    replyBody: reply_body.trim(),
    replyId,
    sentBy: req.admin.username,
  });

  console.log(`[cms] admin replied to submission #${id} — email: ${emailResult.success ? "sent" : "failed"}`);

  res.json({
    success: true,
    replyId,
    emailSent: emailResult.success,
    emailError: emailResult.reason || null,
  });
});

// =================================================================
// POST /api/v1/contact/submissions/:id/retry  — Admin: retry notification
// =================================================================
router.post("/submissions/:id/retry", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    const row = await db.execute({ sql: "SELECT * FROM contact_submissions WHERE id = ? LIMIT 1", args: [id] });
    if (row.rows.length === 0) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Submission not found." } });
    const submission = row.rows[0];

    await db.execute({ sql: "UPDATE contact_submissions SET email_notify_status = 'pending' WHERE id = ?", args: [id] });

    const [notifyResult, autoReplyResult] = await Promise.allSettled([
      emailSvc.sendNewSubmissionNotification(submission),
      emailSvc.sendAutoReply(submission),
    ]);

    const notifySuccess = notifyResult.status === "fulfilled" && notifyResult.value?.success;
    res.json({
      success: notifySuccess,
      notification: notifyResult.status === "fulfilled" ? notifyResult.value : { success: false, reason: notifyResult.reason?.message },
      autoReply: autoReplyResult.status === "fulfilled" ? autoReplyResult.value : { success: false, reason: autoReplyResult.reason?.message },
      reason: notifyResult.status === "fulfilled" ? notifyResult.value?.reason : notifyResult.reason?.message,
    });
  } catch (err) {
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to retry." } });
  }
});

// =================================================================
// POST /api/v1/contact/submissions/retry-pending — Admin: retry all pending
// =================================================================
router.post("/submissions/retry-pending", requireAuth, async (req, res) => {
  try {
    const result = await emailSvc.processPendingSubmissions(10);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: err.message } });
  }
});

// =================================================================
// GET /api/v1/contact/email-settings  — Admin: read settings
// NOTE: Never return smtp_pass in response
// =================================================================
router.get("/email-settings", requireAuth, async (req, res) => {
  try {
    const result = await db.execute("SELECT setting_key, setting_value, setting_label, updated_at, updated_by FROM email_settings ORDER BY setting_key");
    // Mask password
    const settings = result.rows.map((r) => ({
      ...r,
      setting_value: r.setting_key === "smtp_pass" && r.setting_value ? "••••••••" : r.setting_value,
    }));
    res.json({ settings });
  } catch (err) {
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to load email settings." } });
  }
});

// =================================================================
// PUT /api/v1/contact/email-settings  — Admin: save one or many settings
// Body: { settings: [{ key, value }] }
//   OR: { key, value }  (single update)
// =================================================================
router.put("/email-settings", requireAuth, async (req, res) => {
  const editor = req.admin.username;
  let pairs = [];

  if (Array.isArray(req.body.settings)) {
    pairs = req.body.settings;
  } else if (req.body.key !== undefined) {
    pairs = [{ key: req.body.key, value: req.body.value }];
  } else {
    // Treat entire body as key→value map
    pairs = Object.entries(req.body).map(([key, value]) => ({ key, value }));
  }

  if (pairs.length === 0) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "No settings to save." } });
  }

  try {
    for (const { key, value } of pairs) {
      if (!key) continue;
      // Don't overwrite password if masked value sent
      if (key === "smtp_pass" && value === "••••••••") continue;

      await db.execute({
        sql: `INSERT INTO email_settings (setting_key, setting_value, updated_by)
              VALUES (?,?,?)
              ON CONFLICT(setting_key) DO UPDATE SET
                setting_value = excluded.setting_value,
                updated_at = CURRENT_TIMESTAMP,
                updated_by = excluded.updated_by`,
        args: [key, value ?? "", editor],
      });
      if ((key === "recipient_email" || key === "sender_email") && value) {
        await syncUniversalEmail(value.trim(), editor);
      }
    }
    if (typeof emailSvc.clearTransporterCache === "function") {
      emailSvc.clearTransporterCache();
    }
    res.json({ success: true, saved: pairs.length });
  } catch (err) {
    console.error("[email-settings] Save error:", err.message);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to save settings." } });
  }
});

// =================================================================
// POST /api/v1/contact/email-settings/test  — Admin: test SMTP
// =================================================================
router.post("/email-settings/test", requireAuth, async (req, res) => {
  try {
    // Load current settings from DB, then override with request body (allows testing before saving)
    const dbSettings = await emailSvc.getSettings();
    const testSettings = { ...dbSettings, ...req.body };
    // If password sent as masked, use DB value
    if (testSettings.smtp_pass === "••••••••") testSettings.smtp_pass = dbSettings.smtp_pass;

    const result = await emailSvc.testSmtpConnection(testSettings);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, reason: err.message });
  }
});

// =================================================================
// GET /api/v1/contact/email-settings/quota  — Admin: check 24h quota & strategy
// =================================================================
router.get("/email-settings/quota", requireAuth, async (req, res) => {
  try {
    // tz = minutes east of UTC (e.g. 480 for Philippines). Defaults to +08:00.
    const tzOffsetMinutes = req.query.tz !== undefined ? Number(req.query.tz) : 480;
    const quota = await emailSvc.getQuotaStatus({ tzOffsetMinutes });
    res.json({ success: true, quota });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: err.message } });
  }
});

// =================================================================
// GET /api/v1/contact/email-stats  — Admin: email usage overview
// =================================================================
router.get("/email-stats", requireAuth, async (req, res) => {
  try {
    const [emailStats, contactStats] = await Promise.all([
      emailSvc.getEmailStats(),
      db.execute(`SELECT 
        COUNT(*) AS total_submissions,
        SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) AS new_count,
        SUM(CASE WHEN email_notify_status = 'sent' THEN 1 ELSE 0 END) AS notified,
        SUM(CASE WHEN email_notify_status = 'failed' THEN 1 ELSE 0 END) AS notify_failed,
        SUM(CASE WHEN email_notify_status = 'skipped' THEN 1 ELSE 0 END) AS notify_skipped
        FROM contact_submissions`),
    ]);

    const recentLog = await db.execute(
      "SELECT * FROM email_log ORDER BY sent_at DESC LIMIT 20"
    );

    res.json({
      emailStats,
      contactStats: contactStats.rows[0],
      recentLog: recentLog.rows,
    });
  } catch (err) {
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to load stats." } });
  }
});

// =================================================================
// GET /api/v1/contact/email-templates/preview  — Admin: live preview of email design
// Query: ?style=luxury_gold|clean_minimal|gradient_glass&type=auto_reply|notification|reply
// =================================================================
router.get("/email-templates/preview", requireAuth, async (req, res) => {
  const { style = "luxury_gold", type = "auto_reply" } = req.query;
  try {
    const { getFullBusinessProfile } = require("../business-profile-sync");
    const company = await getFullBusinessProfile();
    const html = emailSvc.previewEmail({ style, type, company });
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (err) {
    res.status(500).send(`<div style="color:red; padding:20px;">Preview error: ${err.message}</div>`);
  }
});

// =================================================================
// POST /api/v1/contact/email-templates/select  — Admin: choose active email design
// Body: { style: 'luxury_gold' | 'clean_minimal' | 'gradient_glass' }
// =================================================================
router.post("/email-templates/select", requireAuth, async (req, res) => {
  let { style } = req.body;
  if (style === "gradient_glass") style = "warm_editorial";
  const validStyles = ["luxury_gold", "clean_minimal", "warm_editorial", "gradient_glass"];
  if (!style || !validStyles.includes(style)) {
    return res.status(400).json({ error: { code: "INVALID_STYLE", message: `Invalid style. Choose one of: ${validStyles.join(", ")}` } });
  }

  const editor = req.admin?.username || "admin";
  try {
    await db.execute({
      sql: `INSERT INTO email_settings (setting_key, setting_value, setting_label, updated_by)
            VALUES ('email_template_style', ?, 'Active Email UI Template Style', ?)
            ON CONFLICT(setting_key) DO UPDATE SET
              setting_value = excluded.setting_value,
              updated_at = CURRENT_TIMESTAMP,
              updated_by = excluded.updated_by`,
      args: [style, editor],
    });

    broadcast({
      type: "email_settings_updated",
      key: "email_template_style",
      value: style,
      updated_by: editor,
      timestamp: new Date().toISOString(),
    });

    res.json({ success: true, activeStyle: style, message: `Active email UI set to ${style}.` });
  } catch (err) {
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to update email template style." } });
  }
});

// =================================================================
// POST /api/v1/contact/sync-inbound-replies — Admin manual sync trigger
// =================================================================
router.post("/sync-inbound-replies", requireAuth, async (req, res) => {
  try {
    const { syncInboundReplies } = require("../inbound-sync");
    const count = await syncInboundReplies();
    res.json({ success: true, count: typeof count === "number" ? count : 0, message: "Inbound email sync completed." });
  } catch (err) {
    res.status(500).json({ error: { code: "SYNC_ERROR", message: err.message } });
  }
});

module.exports = router;

