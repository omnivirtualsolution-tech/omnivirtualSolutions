// =================================================================
// backend/migrate-email.js  —  Email Management System Migration
// =================================================================
// Run: node backend/migrate-email.js
// Adds: contact_replies, email_settings, email_log tables
// Seeds default email configuration.
// =================================================================

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const { db } = require("./db");

const NEW_TABLES = [
  // ── Contact reply threads ────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS contact_replies (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    submission_id   INTEGER NOT NULL,
    direction       TEXT NOT NULL DEFAULT 'outbound',  -- 'outbound' (admin→visitor) | 'inbound' (visitor→admin, future)
    reply_body      TEXT NOT NULL,
    sent_by         TEXT,
    email_sent      INTEGER DEFAULT 0,   -- 1 = email successfully sent
    email_error     TEXT,               -- error message if sending failed
    sent_at         DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (submission_id) REFERENCES contact_submissions(id) ON DELETE CASCADE
  )`,

  // ── Email notification log ───────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS email_log (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type      TEXT NOT NULL,   -- 'new_submission_notify' | 'reply_sent' | 'retry'
    submission_id   INTEGER,
    recipient_email TEXT,
    subject         TEXT,
    status          TEXT DEFAULT 'pending', -- 'sent' | 'failed' | 'skipped'
    error_message   TEXT,
    sent_at         DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (submission_id) REFERENCES contact_submissions(id) ON DELETE SET NULL
  )`,

  // ── Admin-configurable email settings ───────────────────────────
  `CREATE TABLE IF NOT EXISTS email_settings (
    id                        INTEGER PRIMARY KEY AUTOINCREMENT,
    setting_key               TEXT UNIQUE NOT NULL,
    setting_value             TEXT,
    setting_label             TEXT,
    updated_at                DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_by                TEXT
  )`,

  // Indexes
  `CREATE INDEX IF NOT EXISTS idx_replies_submission ON contact_replies(submission_id)`,
  `CREATE INDEX IF NOT EXISTS idx_email_log_submission ON email_log(submission_id)`,
  `CREATE INDEX IF NOT EXISTS idx_email_log_status ON email_log(status)`,
  `CREATE INDEX IF NOT EXISTS idx_email_settings_key ON email_settings(setting_key)`,
];

// ── Extend contact_submissions if columns missing ─────────────────
// SQLite doesn't support IF NOT EXISTS on ADD COLUMN, so we do it safely
const COLUMN_MIGRATIONS = [
  { table: "contact_submissions", column: "phone",       sql: "ALTER TABLE contact_submissions ADD COLUMN phone TEXT" },
  { table: "contact_submissions", column: "admin_notes", sql: "ALTER TABLE contact_submissions ADD COLUMN admin_notes TEXT" },
  { table: "contact_submissions", column: "email_notify_status", sql: "ALTER TABLE contact_submissions ADD COLUMN email_notify_status TEXT DEFAULT 'pending'" },
  { table: "contact_submissions", column: "read_at",     sql: "ALTER TABLE contact_submissions ADD COLUMN read_at DATETIME" },
];

// ── Default email settings seed ──────────────────────────────────
const DEFAULT_SETTINGS = [
  { key: "email_notifications_enabled",  value: "true",                        label: "Enable Email Notifications (true/false)" },
  { key: "email_failure_alert_enabled",  value: "true",                        label: "Send Delivery Failure Alert to Business Email (true/false)" },
  { key: "recipient_email",              value: "admin@omnivirtualsolution.com", label: "Notification Recipient Email" },
  { key: "smtp_host",                    value: "",                             label: "SMTP Host (e.g. smtp.gmail.com)" },
  { key: "smtp_port",                    value: "587",                          label: "SMTP Port (587 for TLS, 465 for SSL)" },
  { key: "smtp_secure",                  value: "false",                        label: "SMTP Secure / Use SSL (true/false)" },
  { key: "smtp_user",                    value: "",                             label: "SMTP Username / Email" },
  { key: "smtp_pass",                    value: "",                             label: "SMTP Password / App Password" },
  { key: "sender_name",                  value: "Omni Virtual Solutions",       label: "From Name (shown in email client)" },
  { key: "sender_email",                 value: "",                             label: "From Email Address" },
  { key: "notification_subject",         value: "New Website Inquiry — {customer_name}",  label: "New Inquiry Notification Subject" },
  { key: "notification_pref",            value: "all",                          label: "Notification Preference: all | new_only | off" },
  { key: "reply_template",              
    value: "Hello {customer_name},\n\nThank you for reaching out to Omni Virtual Solutions.\n\n{reply_body}\n\nBest regards,\nOmni Virtual Solutions Team\nadmin@omnivirtualsolution.com",
    label: "Reply Email Template (use {customer_name} and {reply_body})" },
  { key: "auto_reply_enabled",          value: "false",                        label: "Send Auto-Reply to Customer on Submission (true/false)" },
  { key: "auto_reply_subject",          value: "We received your message — Omni Virtual Solutions", label: "Auto-Reply Subject" },
  { key: "auto_reply_body",
    value: "Hello {customer_name},\n\nThank you for contacting Omni Virtual Solutions! We have received your message and will get back to you within 1-2 business days.\n\nBest regards,\nOmni Virtual Solutions Team",
    label: "Auto-Reply Body Template (use {customer_name})" },
];

async function run() {
  console.log("\n🔧 Running Email Management System migration...\n");

  // Create new tables
  for (const sql of NEW_TABLES) {
    const label = sql.match(/(TABLE|INDEX)\s+IF\s+NOT\s+EXISTS\s+(\w+)/i);
    try {
      await db.execute(sql);
      if (label) console.log(`  ✅ ${label[1].toLowerCase()}: ${label[2]}`);
    } catch (err) {
      console.error("❌ Error:", err.message);
    }
  }

  // Add missing columns to contact_submissions
  console.log("\n📋 Patching contact_submissions columns...");
  const colCheck = await db.execute("PRAGMA table_info(contact_submissions)");
  const existingCols = colCheck.rows.map((r) => r.name);

  for (const migration of COLUMN_MIGRATIONS) {
    if (!existingCols.includes(migration.column)) {
      try {
        await db.execute(migration.sql);
        console.log(`  ✅ Added column: ${migration.column}`);
      } catch (err) {
        console.log(`  ⚠️  Column ${migration.column} may already exist: ${err.message}`);
      }
    } else {
      console.log(`  ─  Column ${migration.column} already exists`);
    }
  }

  // Seed default email settings (INSERT OR IGNORE = never overwrite admin changes)
  console.log("\n📧 Seeding default email settings...");
  for (const s of DEFAULT_SETTINGS) {
    await db.execute({
      sql: "INSERT OR IGNORE INTO email_settings (setting_key, setting_value, setting_label) VALUES (?,?,?)",
      args: [s.key, s.value, s.label],
    });
  }
  console.log(`  ✅ ${DEFAULT_SETTINGS.length} email settings ready.`);

  console.log("\n✅ Email Management migration complete.\n");
  process.exit(0);
}

run().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
