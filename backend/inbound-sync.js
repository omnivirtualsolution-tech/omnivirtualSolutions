// =================================================================
// backend/inbound-sync.js  —  Free Gmail IMAP Inbound Reply Sync
// =================================================================
// Periodically checks the configured Gmail inbox via IMAP over SSL.
// Detects client replies to contact ticket threads, extracts the clean
// reply text, saves into contact_replies with direction = 'inbound',
// resets submission read_at to NULL (lighting up unread badges),
// and broadcasts real-time SSE updates.
//
// 100% Free: Uses existing Gmail App Password.
// Zero Quota Impact: Reading emails consumes 0 of daily sending quota.
// Isolated: Failures never interrupt website forms or SMTP sending.
// =================================================================

const imaps = require("imap-simple");
const { simpleParser } = require("mailparser");
const { db } = require("./db");
const { broadcast } = require("./routes/live");

let isSyncing = false;
let syncTimer = null;

// ── Clean quoted email chain from raw text ────────────────────────
function cleanReplyText(text) {
  if (!text) return "";
  const lines = text.split(/\r?\n/);
  const cleanLines = [];
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    // Stop if common reply quote header is encountered
    if (/^On\s+.+wrote:$/i.test(trimmed)) break;
    if (/^On\s+.+,\s+.+\s+at\s+.+wrote:$/i.test(trimmed)) break;
    if (/^---+\s*(Original Message|Forwarded Message)\s*---+/i.test(trimmed)) break;
    if (/^_{5,}/.test(trimmed)) break; // divider line
    if (/^From:\s+/i.test(trimmed) && cleanLines.length > 0) break;
    if (/^>/.test(trimmed)) continue; // ignore quotation lines
    cleanLines.push(lines[i]);
  }
  return cleanLines.join("\n").trim();
}

// ── Extract submission ID from email headers or subject ───────────
function extractSubmissionId(subject, inReplyTo, references) {
  // 1. Check subject tag [Ref: #14] or [Ref: 14] or [Ticket #14]
  if (subject) {
    const sMatch = subject.match(/\[(?:Ref|Ticket|Inquiry):\s*#?(\d+)\]/i) ||
                   subject.match(/#(\d+)\b/);
    if (sMatch) return parseInt(sMatch[1], 10);
  }

  // 2. Check In-Reply-To header
  const headersToCheck = [inReplyTo, references].filter(Boolean).join(" ");
  const hMatch = headersToCheck.match(/submission-(\d+)/i);
  if (hMatch) return parseInt(hMatch[1], 10);

  return null;
}

// ── Single sync tick ──────────────────────────────────────────────
async function syncInboundReplies() {
  if (isSyncing) return;
  isSyncing = true;

  let connection = null;
  try {
    // 1. Load email settings from DB
    const settingsRes = await db.execute("SELECT setting_key, setting_value FROM email_settings");
    const settings = {};
    settingsRes.rows.forEach(r => { settings[r.setting_key] = r.setting_value; });

    const smtpHost = settings.smtp_host?.trim() || "";
    const smtpUser = settings.smtp_user?.trim() || "";
    const smtpPass = settings.smtp_pass?.trim() || "";

    // Require valid Gmail credentials
    if (!smtpUser || !smtpPass) {
      return;
    }

    // Determine IMAP host (default imap.gmail.com for Gmail users)
    let imapHost = "imap.gmail.com";
    if (smtpHost && !smtpHost.includes("gmail") && !smtpHost.includes("google")) {
      imapHost = smtpHost.replace(/^smtp\./i, "imap.");
    }

    const config = {
      imap: {
        user: smtpUser,
        password: smtpPass,
        host: imapHost,
        port: 993,
        tls: true,
        tlsOptions: { rejectUnauthorized: false },
        authTimeout: 15000,
      },
    };

    connection = await imaps.connect(config);
    await connection.openBox("INBOX");

    // Search for UNSEEN messages received in recent days
    const searchCriteria = ["UNSEEN"];
    const fetchOptions = {
      bodies: ["HEADER", "TEXT", ""],
      markSeen: false,
    };

    const messages = await connection.search(searchCriteria, fetchOptions);

    if (messages && messages.length > 0) {
      console.log(`[inbound-sync] Found ${messages.length} unread email(s) in inbox. Inspecting for client replies...`);

      for (const item of messages) {
        try {
          const allPart = item.parts.find(p => !p.which || p.which === "") || item.parts[0];
          const rawSource = allPart?.body || "";
          if (!rawSource) continue;

          const parsed = await simpleParser(rawSource);
          const subject = parsed.subject || "";
          const fromAddress = parsed.from?.value?.[0]?.address || "";
          const fromName = parsed.from?.value?.[0]?.name || fromAddress;
          const inReplyTo = parsed.inReplyTo || "";
          const references = Array.isArray(parsed.references) ? parsed.references.join(" ") : (parsed.references || "");

          // Ignore automated bounces or self-sent emails
          if (fromAddress.toLowerCase() === smtpUser.toLowerCase()) {
            await connection.addFlags(item.attributes.uid, "\\Seen").catch(() => {});
            continue;
          }
          if (fromAddress.includes("mailer-daemon") || fromAddress.includes("postmaster")) {
            continue;
          }

          let submissionId = extractSubmissionId(subject, inReplyTo, references);

          // Fallback: If no tag in subject, match against open customer email
          if (!submissionId && fromAddress) {
            const findSub = await db.execute({
              sql: "SELECT id FROM contact_submissions WHERE lower(email) = lower(?) ORDER BY created_at DESC LIMIT 1",
              args: [fromAddress],
            });
            if (findSub.rows.length > 0) {
              submissionId = findSub.rows[0].id;
            }
          }

          if (submissionId) {
            const cleanText = cleanReplyText(parsed.text || parsed.html || "");
            if (cleanText && cleanText.length > 2) {
              // Deduplicate: avoid re-inserting identical reply
              const dupeCheck = await db.execute({
                sql: "SELECT id FROM contact_replies WHERE submission_id = ? AND direction = 'inbound' AND reply_body = ? LIMIT 1",
                args: [submissionId, cleanText],
              });

              if (dupeCheck.rows.length === 0) {
                // Insert into contact_replies
                await db.execute({
                  sql: `INSERT INTO contact_replies (submission_id, direction, reply_body, sent_by, email_sent, sent_at)
                        VALUES (?, 'inbound', ?, ?, 1, CURRENT_TIMESTAMP)`,
                  args: [submissionId, cleanText, fromName || "Customer"],
                });

                // Reset read_at to NULL so conversation becomes UNREAD (lights up badges)
                await db.execute({
                  sql: `UPDATE contact_submissions 
                        SET read_at = NULL, status = 'contacted'
                        WHERE id = ?`,
                  args: [submissionId],
                });

                console.log(`[inbound-sync] Successfully captured customer reply for submission #${submissionId} from '${fromAddress}'!`);

                // Real-time broadcast
                try {
                  broadcast({
                    type: "inbound_reply_received",
                    submissionId,
                    senderName: fromName || "Customer",
                    preview: cleanText.substring(0, 100),
                    timestamp: new Date().toISOString(),
                  });
                } catch (_) {}
              }
            }

            // Mark message as Seen in Gmail so it's not processed repeatedly
            await connection.addFlags(item.attributes.uid, "\\Seen").catch(() => {});
          }
        } catch (msgErr) {
          console.warn("[inbound-sync] Error parsing single message:", msgErr.message);
        }
      }
    }
  } catch (err) {
    // Graceful error logging — never crash
    if (!err.message?.includes("Timed out") && !err.message?.includes("ECONNRESET")) {
      console.warn("[inbound-sync] IMAP check notice:", err.message);
    }
  } finally {
    if (connection) {
      try { await connection.end(); } catch (_) {}
    }
    isSyncing = false;
  }
}

// ── Start / Stop Lifecycle ─────────────────────────────────────────
function startInboundSync(intervalMs = 45000) {
  if (syncTimer) clearInterval(syncTimer);

  // Initial delayed check (10s after server boot)
  setTimeout(() => {
    syncInboundReplies().catch(() => {});
  }, 10000);

  // Periodic recurring check
  syncTimer = setInterval(() => {
    syncInboundReplies().catch(() => {});
  }, intervalMs);

  console.log(`[inbound-sync] Background Gmail IMAP sync service active (polling every ${Math.round(intervalMs / 1000)}s)`);
}

function stopInboundSync() {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
}

module.exports = {
  startInboundSync,
  stopInboundSync,
  syncInboundReplies,
  cleanReplyText,
  extractSubmissionId,
};
