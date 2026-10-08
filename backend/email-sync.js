// =================================================================
// backend/email-sync.js — Universal Business Email Synchronizer
// =================================================================
// Ensures a Single Source of Truth for the business email across the entire
// system. When the business email is edited anywhere (Services Live Editor,
// Homepage Live Editor, Admin Contact/Email Settings, etc.), this synchronizer
// updates all relevant database tables and broadcasts real-time SSE events
// to all connected clients and pages.
// =================================================================

const { db } = require("./db");
const { broadcast } = require("./routes/live");

const EMAIL_BLOCK_KEYS = [
  "services.cta.email",
  "footer.email",
  "company.email",
  "contact.email",
];

function isEmailKey(key) {
  if (!key) return false;
  const lower = String(key).toLowerCase().trim();
  return (
    EMAIL_BLOCK_KEYS.includes(lower) ||
    lower.endsWith(".email") ||
    lower === "recipient_email" ||
    lower === "sender_email" ||
    lower === "business_email"
  );
}

/**
 * Synchronize the business email across all database tables and broadcast to all live listeners.
 * @param {string} rawEmail - The new business email address
 * @param {string} editor - Username of the admin making the change
 */
async function syncUniversalEmail(rawEmail, editor = "admin") {
  const email = String(rawEmail || "").trim();
  if (!email) return;

  console.log(`[email-sync] Syncing universal business email to '${email}' (by: ${editor})`);

  // 1. Synchronize all known email keys in content_blocks
  const keysToUpdate = ["services.cta.email", "footer.email"];
  for (const bKey of keysToUpdate) {
    try {
      await db.execute({
        sql: `INSERT INTO content_blocks (block_key, block_type, label, value, updated_by)
              VALUES (?, 'text', ?, ?, ?)
              ON CONFLICT(block_key) DO UPDATE SET
                value = excluded.value,
                updated_at = CURRENT_TIMESTAMP,
                updated_by = excluded.updated_by`,
        args: [bKey, bKey, email, editor],
      });


      // Broadcast content block change
      broadcast({
        key: bKey,
        value: email,
        blockType: "text",
        updatedBy: editor,
        table: "content_blocks",
      });
      broadcast({
        type: "cms_block_updated",
        key: bKey,
        value: email,
        updatedBy: editor,
      });
    } catch (err) {
      console.error(`[email-sync] Error updating block ${bKey}:`, err.message);
    }
  }

  // 2. Synchronize email_settings (recipient_email and sender_email)
  for (const sKey of ["recipient_email", "sender_email"]) {
    try {
      await db.execute({
        sql: `INSERT INTO email_settings (setting_key, setting_value, updated_by)
              VALUES (?, ?, ?)
              ON CONFLICT(setting_key) DO UPDATE SET
                setting_value = excluded.setting_value,
                updated_at = CURRENT_TIMESTAMP,
                updated_by = excluded.updated_by`,
        args: [sKey, email, editor],
      });
    } catch (err) {
      console.error(`[email-sync] Error updating email_settings ${sKey}:`, err.message);
    }
  }

  // 3. Synchronize company_profile table
  try {
    await db.execute({
      sql: `UPDATE company_profile 
            SET email = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE id = (SELECT id FROM company_profile ORDER BY id DESC LIMIT 1)`,
      args: [email],
    });
  } catch (err) {
    console.error("[email-sync] Error updating company_profile:", err.message);
  }

  // 4. Broadcast global live events for frontend React state & SSE listeners
  broadcast({
    type: "email_settings_updated",
    recipient_email: email,
    timestamp: new Date().toISOString(),
  });

  broadcast({
    type: "company_updated",
    company: {
      email: email,
      recipient_email: email,
    },
    timestamp: new Date().toISOString(),
  });

  console.log(`[email-sync] Universal business email fully synced across all tables and SSE streams!`);
}

module.exports = {
  syncUniversalEmail,
  isEmailKey,
  EMAIL_BLOCK_KEYS,
};
