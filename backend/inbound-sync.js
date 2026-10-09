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

const dns = require("dns");
// Force IPv4 DNS resolution first to avoid Windows IPv6 delays on imap.gmail.com
if (dns && typeof dns.setDefaultResultOrder === "function") {
  try {
    dns.setDefaultResultOrder("ipv4first");
  } catch (_) {}
}

const Imap = require("imap");
const imaps = require("imap-simple");
const { simpleParser } = require("mailparser");
const { db } = require("./db");
const { broadcast } = require("./routes/live");

let isSyncing = false;
let syncTimer = null;

// ── Clean quoted email chain from raw text ────────────────────────
function cleanReplyText(text) {
  if (!text) return "";
  let clean = text.replace(/\r\n/g, "\n");

  // Cut off multi-line "On ... wrote:" (matches across newlines in mobile Gmail)
  clean = clean.replace(/\n\s*On\s+[\s\S]+?wrote:\s*[\s\S]*/i, "");

  // Cut off divider lines / original message blocks
  clean = clean.replace(/\n\s*---+[\s\S]*?(Original Message|Forwarded Message)[\s\S]*/i, "");
  clean = clean.replace(/\n\s*_{5,}[\s\S]*/, "");

  const lines = clean.split("\n");
  const cleanLines = [];
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (/^On\s+.+wrote:?$/i.test(trimmed)) break;
    if (/^On\s+.+,\s+.+\s+at\s+.+wrote:?$/i.test(trimmed)) break;
    if (/^From:\s+/i.test(trimmed) && cleanLines.length > 0) break;
    if (/^>/.test(trimmed)) continue; // ignore quotation lines
    cleanLines.push(lines[i]);
  }
  return cleanLines.join("\n").trim();
}

// ── Extract submission ID from email headers or subject ───────────
function extractSubmissionId(subject, inReplyTo, references) {
  // 1. Invisible RFC headers (preferred): submission-58@omnivirtualsolution.com
  const headersToCheck = [inReplyTo, references].filter(Boolean).join(" ");
  const hMatch = headersToCheck.match(/submission-(\d+)/i);
  if (hMatch) return parseInt(hMatch[1], 10);

  // 2. Legacy / subject tags: [Ref: #58] or [Ref: 58] or #58
  if (subject) {
    const sMatch = subject.match(/\[(?:Ref|Ticket|Inquiry):\s*#?(\d+)\]/i) ||
                   subject.match(/#(\d+)\b/);
    if (sMatch) return parseInt(sMatch[1], 10);
  }

  return null;
}

// ── Single sync tick ──────────────────────────────────────────────
async function syncInboundReplies() {
  if (isSyncing) return 0;
  isSyncing = true;
  let newRepliesCount = 0;

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
      return 0;
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

    // Guard against unhandled 'error' event crash when Gmail resets idle socket
    connection.on("error", (err) => {
      if (err?.code !== "ECONNRESET" && !err?.message?.includes("ECONNRESET")) {
        console.warn("[inbound-sync/socket] Connection notice:", err.message || err);
      }
    });
    if (connection.imap) {
      connection.imap.on("error", (err) => {
        if (err?.code !== "ECONNRESET" && !err?.message?.includes("ECONNRESET")) {
          console.warn("[inbound-sync/imap] IMAP socket notice:", err.message || err);
        }
      });
    }

    await connection.openBox("INBOX");

    // 1. Fast metadata search for messages from the last 2 days
    const d = new Date();
    d.setDate(d.getDate() - 2);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const sinceDate = `${d.getDate()}-${months[d.getMonth()]}-${d.getFullYear()}`;

    const allMsgs = await connection.search([["SINCE", sinceDate]]);
    if (!allMsgs || allMsgs.length === 0) return 0;

    // 2. Select target UIDs: inspect only the most recent 10 messages (executes in <0.8s)
    const recentSlice = allMsgs.slice(-10);
    const targetUids = recentSlice.map(m => m.attributes.uid);
    if (targetUids.length === 0) return 0;

    // 3. Batch fetch bodies in one rapid query
    const range = `${targetUids[0]}:${targetUids[targetUids.length - 1]}`;
    const candidateMessages = await connection.search([["UID", range]], { bodies: [""], markSeen: false });

    if (candidateMessages && candidateMessages.length > 0) {
      for (const item of candidateMessages) {
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

          // Fallback: If no tag in subject or headers, match against open customer email
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
            if (cleanText && cleanText.length > 0) {
              // Deduplicate: avoid re-inserting identical reply
              const dupeCheck = await db.execute({
                sql: "SELECT id FROM contact_replies WHERE submission_id = ? AND direction = 'inbound' AND reply_body = ? LIMIT 1",
                args: [submissionId, cleanText],
              });

              if (dupeCheck.rows.length === 0) {
                // Insert into contact_replies
                const insRes = await db.execute({
                  sql: `INSERT INTO contact_replies (submission_id, direction, reply_body, sent_by, email_sent, sent_at)
                        VALUES (?, 'inbound', ?, ?, 1, CURRENT_TIMESTAMP)`,
                  args: [submissionId, cleanText, fromName || "Customer"],
                });

                const newReplyId = insRes.lastInsertRowid || Date.now();

                // Reset read_at to NULL so conversation becomes UNREAD (lights up badges)
                await db.execute({
                  sql: `UPDATE contact_submissions 
                        SET read_at = NULL, status = 'contacted'
                        WHERE id = ?`,
                  args: [submissionId],
                });

                newRepliesCount++;
                console.log(`[inbound-sync] Successfully captured customer reply for submission #${submissionId} from '${fromAddress}': "${cleanText.substring(0, 40)}"`);

                // Real-time broadcast
                try {
                  broadcast({
                    type: "inbound_reply_received",
                    submissionId,
                    reply: {
                      id: Number(newReplyId),
                      submission_id: Number(submissionId),
                      direction: "inbound",
                      reply_body: cleanText,
                      sent_by: fromName || "Customer",
                      email_sent: 1,
                      sent_at: new Date().toISOString(),
                    },
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

    // 4. Two-Way Sync: Inspect Sent Mail for replies sent by Admin directly via external email client (phone/web)
    try {
      const boxes = await connection.getBoxes();
      let sentBoxName = null;
      if (boxes["[Gmail]"]?.children?.["Sent Mail"]) {
        sentBoxName = "[Gmail]/Sent Mail";
      } else if (boxes["[Gmail]"]?.children?.["Sent Messages"]) {
        sentBoxName = "[Gmail]/Sent Messages";
      } else if (boxes["Sent"]) {
        sentBoxName = "Sent";
      } else if (boxes["Sent Mail"]) {
        sentBoxName = "Sent Mail";
      }

      if (sentBoxName) {
        await connection.openBox(sentBoxName);
        const allSentMsgs = await connection.search([["SINCE", sinceDate]]);
        if (allSentMsgs && allSentMsgs.length > 0) {
          const recentSent = allSentMsgs.slice(-10);
          const sentUids = recentSent.map(m => m.attributes.uid);
          const sentRange = `${sentUids[0]}:${sentUids[sentUids.length - 1]}`;
          const candidateSent = await connection.search([["UID", sentRange]], { bodies: [""], markSeen: false });

          if (candidateSent && candidateSent.length > 0) {
            for (const item of candidateSent) {
              try {
                const allPart = item.parts.find(p => !p.which || p.which === "") || item.parts[0];
                const rawSource = allPart?.body || "";
                if (!rawSource) continue;

                const parsed = await simpleParser(rawSource);
                const toAddress = parsed.to?.value?.[0]?.address || "";
                const subject = parsed.subject || "";
                const inReplyTo = parsed.inReplyTo || "";
                const references = Array.isArray(parsed.references) ? parsed.references.join(" ") : (parsed.references || "");

                let submissionId = extractSubmissionId(subject, inReplyTo, references);

                // Fallback: match recipient email against recent contact_submissions
                if (!submissionId && toAddress) {
                  const findSub = await db.execute({
                    sql: "SELECT id FROM contact_submissions WHERE lower(email) = lower(?) ORDER BY created_at DESC LIMIT 1",
                    args: [toAddress],
                  });
                  if (findSub.rows.length > 0) {
                    submissionId = findSub.rows[0].id;
                  }
                }

                if (submissionId) {
                  const cleanText = cleanReplyText(parsed.text || parsed.html || "");
                  if (cleanText && cleanText.length > 0) {
                    // Check if this outbound reply was ALREADY saved (sent from web dashboard or previous sync)
                    const dupeCheck = await db.execute({
                      sql: `SELECT id FROM contact_replies 
                            WHERE submission_id = ? AND direction = 'outbound' 
                            AND (reply_body = ? OR reply_body LIKE ? || '%') 
                            LIMIT 1`,
                      args: [submissionId, cleanText, cleanText.substring(0, 40)],
                    });

                    if (dupeCheck.rows.length === 0) {
                      const sentAtStr = parsed.date
                        ? new Date(parsed.date).toISOString().replace("T", " ").substring(0, 19)
                        : new Date().toISOString().replace("T", " ").substring(0, 19);

                      const insRes = await db.execute({
                        sql: `INSERT INTO contact_replies (submission_id, direction, reply_body, sent_by, email_sent, sent_at)
                              VALUES (?, 'outbound', ?, 'Admin (via Email)', 1, ?)`,
                        args: [submissionId, cleanText, sentAtStr],
                      });

                      const newReplyId = insRes.lastInsertRowid || Date.now();

                      // Update submission status to 'replied'
                      await db.execute({
                        sql: `UPDATE contact_submissions SET status = 'replied' WHERE id = ?`,
                        args: [submissionId],
                      });

                      newRepliesCount++;
                      console.log(`[inbound-sync] Successfully captured admin email reply for submission #${submissionId}: "${cleanText.substring(0, 40)}"`);

                      // Real-time broadcast
                      try {
                        broadcast({
                          type: "inbound_reply_received",
                          submissionId,
                          reply: {
                            id: Number(newReplyId),
                            submission_id: Number(submissionId),
                            direction: "outbound",
                            reply_body: cleanText,
                            sent_by: "Admin (via Email)",
                            email_sent: 1,
                            sent_at: sentAtStr,
                          },
                          senderName: "Admin (via Email)",
                          preview: cleanText.substring(0, 100),
                          timestamp: new Date().toISOString(),
                        });
                      } catch (_) {}
                    }
                  }
                }
              } catch (sentMsgErr) {
                console.warn("[inbound-sync] Error parsing sent message:", sentMsgErr.message);
              }
            }
          }
        }
      }
    } catch (sentBoxErr) {
      if (!sentBoxErr.message?.includes("Timed out") && !sentBoxErr.message?.includes("ECONNRESET")) {
        console.warn("[inbound-sync] Sent mail check notice:", sentBoxErr.message);
      }
    }

    return newRepliesCount;
  } catch (err) {
    // Graceful error logging — never crash
    if (!err.message?.includes("Timed out") && !err.message?.includes("ECONNRESET")) {
      console.warn("[inbound-sync] IMAP check notice:", err.message);
    }
    return 0;
  } finally {
    if (connection) {
      try {
        connection.removeAllListeners("error");
        if (connection.imap) connection.imap.removeAllListeners("error");
        await connection.end();
      } catch (_) {}
    }
    isSyncing = false;
  }
}

// ── Real-Time IMAP IDLE Push Engine & Lifecycle ────────────────────
let idleSocket = null;
let idleReconnectTimer = null;
let isServiceActive = false;

async function startIdleSocket() {
  if (!isServiceActive) return;
  try {
    const settingsRes = await db.execute("SELECT setting_key, setting_value FROM email_settings");
    const settings = {};
    settingsRes.rows.forEach(r => { settings[r.setting_key] = r.setting_value; });

    const smtpHost = settings.smtp_host?.trim() || "";
    const smtpUser = settings.smtp_user?.trim() || "";
    const smtpPass = settings.smtp_pass?.trim() || "";

    if (!smtpUser || !smtpPass) return;

    let imapHost = "imap.gmail.com";
    if (smtpHost && !smtpHost.includes("gmail") && !smtpHost.includes("google")) {
      imapHost = smtpHost.replace(/^smtp\./i, "imap.");
    }

    if (idleSocket) {
      try { idleSocket.end(); } catch (_) {}
      idleSocket = null;
    }

    const imap = new Imap({
      user: smtpUser,
      password: smtpPass,
      host: imapHost,
      port: 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
      authTimeout: 15000,
      keepalive: {
        interval: 10000,
        idleInterval: 300000,
        forceNoop: false,
      },
    });

    idleSocket = imap;

    imap.once("ready", () => {
      imap.openBox("INBOX", false, (err) => {
        if (err) {
          console.warn("[inbound-sync/idle] openBox notice:", err.message);
          return;
        }
        console.log("[inbound-sync/idle] ⚡ Real-Time IMAP IDLE push active on INBOX (sub-second push notification enabled)");

        // Immediate catch-up check
        syncInboundReplies().catch(() => {});

        // Listen for INSTANT push events from Gmail
        imap.on("mail", (numNewMsgs) => {
          console.log(`[inbound-sync/idle] ⚡ Gmail push: ${numNewMsgs} new email(s) arrived. Syncing instantly...`);
          syncInboundReplies().catch(() => {});
        });
      });
    });

    imap.on("error", (err) => {
      if (err?.code !== "ECONNRESET" && !err?.message?.includes("ECONNRESET")) {
        console.warn("[inbound-sync/idle] Socket notice:", err.message);
      }
    });

    imap.once("close", () => {
      if (isServiceActive) {
        clearTimeout(idleReconnectTimer);
        idleReconnectTimer = setTimeout(startIdleSocket, 4000);
      }
    });

    imap.once("end", () => {
      if (isServiceActive) {
        clearTimeout(idleReconnectTimer);
        idleReconnectTimer = setTimeout(startIdleSocket, 4000);
      }
    });

    imap.connect();
  } catch (err) {
    console.warn("[inbound-sync/idle] Failed to start IDLE socket:", err.message);
    if (isServiceActive) {
      clearTimeout(idleReconnectTimer);
      idleReconnectTimer = setTimeout(startIdleSocket, 6000);
    }
  }
}

function startInboundSync(intervalMs = 20000) {
  isServiceActive = true;
  if (syncTimer) clearInterval(syncTimer);

  // 1. Launch real-time IMAP IDLE push socket (sub-second notifications)
  setTimeout(() => {
    startIdleSocket().catch(() => {});
  }, 1500);

  // 2. Secondary fallback pulse (every 20s) to guarantee Sent Mail & reconnect coverage
  syncTimer = setInterval(() => {
    syncInboundReplies().catch(() => {});
  }, intervalMs);

  console.log(`[inbound-sync] Real-Time Gmail sync service initialized (IMAP IDLE Push + ${Math.round(intervalMs / 1000)}s heartbeat fallback)`);
}

function stopInboundSync() {
  isServiceActive = false;
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
  if (idleReconnectTimer) {
    clearTimeout(idleReconnectTimer);
    idleReconnectTimer = null;
  }
  if (idleSocket) {
    try { idleSocket.end(); } catch (_) {}
    idleSocket = null;
  }
}

module.exports = {
  startInboundSync,
  stopInboundSync,
  syncInboundReplies,
  cleanReplyText,
  extractSubmissionId,
};
