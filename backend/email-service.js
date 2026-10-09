// =================================================================
// backend/email-service.js  —  Nodemailer Email Service
// =================================================================
// Reads SMTP config from email_settings table.
// Never exposes credentials to the client.
// Graceful failure: database record is always primary; email is secondary.
// =================================================================

const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");
const dns = require("dns");
const { db } = require("./db");
const { getFullBusinessProfile } = require("./business-profile-sync");

// Force IPv4 DNS resolution first to avoid 20+ second ENETUNREACH / ETIMEDOUT delays on networks with partial IPv6
if (dns && typeof dns.setDefaultResultOrder === "function") {
  try {
    dns.setDefaultResultOrder("ipv4first");
} catch (_) {}
}

function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

let cachedTransporter = null;

let cachedTransporterKey = null;

function clearTransporterCache() {
  if (cachedTransporter && typeof cachedTransporter.close === "function") {
    try { cachedTransporter.close(); } catch (_) {}
  }
  cachedTransporter = null;
  cachedTransporterKey = null;
}

// ── Load all email settings from DB ──────────────────────────────
async function getSettings() {
  try {
    const result = await db.execute("SELECT setting_key, setting_value FROM email_settings");
    const settings = {};
    result.rows.forEach((r) => {
      settings[r.setting_key] = r.setting_value;
    });
    return settings;
  } catch (err) {
    console.error("[email-service] Failed to load settings:", err.message);
    return {};
  }
}

// ── Create transporter from current DB settings ───────────────────
async function createTransporter(settings, { noCache = false } = {}) {
  const host = settings.smtp_host?.trim();
  const user = settings.smtp_user?.trim();
  const pass = settings.smtp_pass?.trim();

  if (!host || !user || !pass) {
    return null; // SMTP not configured
  }

  // Prevent any sending from legacy email
  if (user.toLowerCase().includes("nsixx631")) {
    console.warn("[email-service] Blocked attempt to send using legacy email nsixx631@gmail.com");
    return null;
  }

  const key = `${host}:${settings.smtp_port}:${settings.smtp_secure}:${user}:${pass}`;
  if (!noCache && cachedTransporter && cachedTransporterKey === key) {
    return cachedTransporter;
  }

  const isGmail = host === "smtp.gmail.com" || host.includes("gmail") || user.endsWith("@gmail.com");

  let transportConfig;
  if (isGmail) {
    transportConfig = {
      service: "gmail",
      auth: { user, pass },
      pool: !noCache,
      maxConnections: 3,
      maxMessages: 50,
      connectionTimeout: 8000,
      greetingTimeout: 6000,
      socketTimeout: 12000,
    };
  } else {
    transportConfig = {
      host,
      port: parseInt(settings.smtp_port || "587", 10),
      secure: settings.smtp_secure === "true",
      auth: { user, pass },
      tls: { rejectUnauthorized: process.env.NODE_ENV === "production" },
      pool: !noCache,
      maxConnections: 3,
      connectionTimeout: 8000,
      greetingTimeout: 6000,
      socketTimeout: 12000,
    };
  }

  try {
    const transporter = nodemailer.createTransport(transportConfig);
    if (!noCache) {
      cachedTransporter = transporter;
      cachedTransporterKey = key;
    }
    return transporter;
  } catch (err) {
    console.error("[email-service] Failed to create transport:", err.message);
    return null;
  }
}

// ── Interpolate template variables ───────────────────────────────
function interpolate(template, vars) {
  let result = template || "";
  Object.entries(vars).forEach(([k, v]) => {
    result = result.replaceAll(`{${k}}`, v || "");
  });
  return result;
}

// ── Log email attempt to DB ───────────────────────────────────────
async function logEmail({ eventType, submissionId, recipientEmail, subject, status, errorMessage }) {
  try {
    await db.execute({
      sql: `INSERT INTO email_log (event_type, submission_id, recipient_email, subject, status, error_message)
            VALUES (?,?,?,?,?,?)`,
      args: [eventType, submissionId || null, recipientEmail || null, subject || null, status, errorMessage || null],
    });
    // Auto-prune logs older than 48h to prevent database bloat and keep Turso cloud storage near 0 KB
    await db.execute("DELETE FROM email_log WHERE sent_at <= datetime('now', '-48 hours')");
  } catch (err) {
    console.error("[email-service] Failed to write email log:", err.message);
  }
}

// ── Update contact_submissions email_notify_status ────────────────
async function updateNotifyStatus(submissionId, status) {
  try {
    await db.execute({
      sql: "UPDATE contact_submissions SET email_notify_status = ? WHERE id = ?",
      args: [status, submissionId],
    });
  } catch (_) {}
}

// ── Visual Design Template Builders (Compliant with Email Visual Design Skill) ──

// Emails use hosted HTTPS URL for the header logo to prevent Gmail from showing an attachment chip
function getLogoAttachment() {
  return [];
}

function buildEmailShell({
  title,
  heroPill,
  heroTitle,
  heroSubtitle,
  bodyContent,
  ctaText,
  ctaUrl,
  footerNote,
  supportEmail,
  templateStyle = "luxury_gold",
  isWebPreview = false,
  company = null,
}) {
  const brandName = company?.company_name || "Omni Virtual Solutions";
  const brandTagline = company?.tagline || "Empowering Individuals & Businesses";
  const brandPhone = company?.phone || "+1 315-915-4799";
  const cleanPhone = brandPhone.replace(/[^\d+]/g, "");
  const brandAddress = company?.full_address || "1350 Ave of the Americas, Fl 2 -1100, New York, NY 10019";
  const emailTo = supportEmail || company?.email || "admin@omnivirtualsolution.com";
  const copyrightLine = company?.copyright_text || `© ${new Date().getFullYear()} ${brandName}. All rights reserved.`;
  const siteBaseUrl = (process.env.PUBLIC_URL || process.env.URL || "https://www.omnivirtualsolution.com").replace(/\/$/, "");
  const logoSrc = isWebPreview
    ? "/assets/img/OmniLogo2.png"
    : `${siteBaseUrl}/assets/img/OmniLogo2.png`;
  const brandGold = "#eba22d";

  // ─────────────────────────────────────────────────────────────────
  // TEMPLATE 1: LUXURY GOLD (Executive Dark Obsidian & Gold Accent)
  // ─────────────────────────────────────────────────────────────────
  if (templateStyle === "luxury_gold") {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${title || "Omni Virtual Solutions"}</title>
  <style type="text/css">
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body { margin: 0; padding: 0; width: 100% !important; min-width: 100%; background-color: #0b0f17; }
    @media only screen and (max-width: 620px) {
      .email-container { width: 100% !important; max-width: 100% !important; }
      .mobile-p { padding: 20px 16px !important; }
      .mobile-h1 { font-size: 22px !important; line-height: 28px !important; }
      .mobile-btn { display: block !important; width: 100% !important; box-sizing: border-box !important; text-align: center !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #0b0f17; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <div style="display: none; max-height: 0px; overflow: hidden; mso-hide: all;">
    ${heroTitle} — Omni Virtual Solutions
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0b0f17">
    <tr>
      <td align="center" style="padding: 32px 12px 40px 12px;">
        <table role="presentation" class="email-container" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%; background-color: #111622; border-radius: 14px; overflow: hidden; box-shadow: 0 16px 45px rgba(0, 0, 0, 0.7); border: 1px solid rgba(235, 162, 45, 0.32);">
          
          <!-- Header with Official Logo -->
          <tr>
            <td bgcolor="#080b11" style="padding: 24px 32px; border-bottom: 3px solid ${brandGold};">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td width="52" style="vertical-align: middle; padding-right: 14px;">
                    <img src="${logoSrc}" alt="Omni Logo" width="46" height="46" style="display:block; width:46px; height:46px; border-radius:10px; border:1px solid rgba(235, 162, 45, 0.45); background:rgba(235, 162, 45, 0.08);">
                  </td>
                  <td style="vertical-align: middle;">
                    <span style="font-size: 21px; font-weight: 800; color: #ffffff; letter-spacing: 0.5px; display: inline-block;">
                      ${brandName}
                    </span>
                    <div style="font-size: 11px; color: ${brandGold}; margin-top: 3px; letter-spacing: 0.5px; text-transform: uppercase; font-weight: 700;">
                      ${brandTagline}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Hero Headline -->
          <tr>
            <td class="mobile-p" style="padding: 34px 32px 18px 32px; background-color: #111622;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    ${heroPill || ""}
                    <h1 class="mobile-h1" style="margin: 0 0 10px 0; font-size: 25px; line-height: 32px; font-weight: 800; color: #ffffff;">
                      ${heroTitle}
                    </h1>
                    ${heroSubtitle ? `<p style="margin: 0; font-size: 15px; line-height: 24px; color: #94a3b8;">${heroSubtitle}</p>` : ""}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td class="mobile-p" style="padding: 0 32px 24px 32px; background-color: #111622;">
              ${bodyContent}
            </td>
          </tr>

          <!-- Primary CTA Button -->
          ${ctaText && ctaUrl ? `
          <tr>
            <td class="mobile-p" align="center" style="padding: 6px 32px 32px 32px; background-color: #111622;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" bgcolor="${brandGold}" style="border-radius: 8px;">
                    <a href="${ctaUrl}" target="_blank" class="mobile-btn" style="background: linear-gradient(135deg, #eba22d 0%, #c87a1d 100%); color: #0d1117; font-size: 14.5px; font-weight: 800; text-decoration: none; padding: 13px 34px; border-radius: 8px; display: inline-block; letter-spacing: 0.3px;">
                      ${ctaText} &rarr;
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>` : ""}

          <!-- Footer -->
          <tr>
            <td bgcolor="#080b11" style="padding: 24px 32px; color: #64748b; font-size: 12px; line-height: 20px; border-top: 1px solid rgba(255, 255, 255, 0.08);">
              <p style="margin: 0 0 6px 0; font-size: 13px; font-weight: 700; color: #f1f5f9;">
                ${brandName}
              </p>
              <p style="margin: 0 0 8px 0; color: #94a3b8;">
                ${brandAddress}<br>
                Phone: <a href="tel:${cleanPhone}" style="color: ${brandGold}; text-decoration: none; font-weight: 600;">${brandPhone}</a> &nbsp;|&nbsp; Email: <a href="mailto:${emailTo}" style="color: ${brandGold}; text-decoration: none; font-weight: 600;">${emailTo}</a>
              </p>
              <p style="margin: 0; color: #475569; font-size: 11px;">
                ${footerNote || copyrightLine}
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  // ─────────────────────────────────────────────────────────────────
  // TEMPLATE 2: CLEAN MINIMAL (Corporate Modern Light & Navy)
  // ─────────────────────────────────────────────────────────────────
  if (templateStyle === "clean_minimal") {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${title || "Omni Virtual Solutions"}</title>
  <style type="text/css">
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body { margin: 0; padding: 0; width: 100% !important; min-width: 100%; background-color: #f4f6f9; }
    @media only screen and (max-width: 620px) {
      .email-container { width: 100% !important; max-width: 100% !important; }
      .mobile-p { padding: 20px 16px !important; }
      .mobile-h1 { font-size: 22px !important; line-height: 28px !important; }
      .mobile-btn { display: block !important; width: 100% !important; box-sizing: border-box !important; text-align: center !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f6f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <div style="display: none; max-height: 0px; overflow: hidden; mso-hide: all;">
    ${heroTitle} — Omni Virtual Solutions
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f4f6f9">
    <tr>
      <td align="center" style="padding: 32px 12px 40px 12px;">
        <table role="presentation" class="email-container" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0;">
          
          <!-- Top Accent Bar -->
          <tr>
            <td bgcolor="#0f172a" style="height: 4px; line-height: 4px; font-size: 4px; background: linear-gradient(90deg, #0f172a 0%, #1e293b 70%, #eba22d 100%);">
              &nbsp;
            </td>
          </tr>

          <!-- Header with Official Logo -->
          <tr>
            <td bgcolor="#ffffff" style="padding: 24px 32px; border-bottom: 1px solid #e2e8f0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td width="52" style="vertical-align: middle; padding-right: 14px;">
                    <img src="${logoSrc}" alt="Omni Logo" width="44" height="44" style="display:block; width:44px; height:44px; border-radius:10px; border:1px solid #e2e8f0; background:#f8fafc;">
                  </td>
                  <td style="vertical-align: middle;">
                    <span style="font-size: 20px; font-weight: 800; color: #0f172a; letter-spacing: 0.2px; display: inline-block;">
                      ${brandName}
                    </span>
                    <div style="font-size: 11px; color: #64748b; margin-top: 3px; letter-spacing: 0.4px; text-transform: uppercase; font-weight: 600;">
                      ${brandTagline}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Hero Headline -->
          <tr>
            <td class="mobile-p" style="padding: 32px 32px 18px 32px; background-color: #ffffff;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    ${heroPill || ""}
                    <h1 class="mobile-h1" style="margin: 0 0 10px 0; font-size: 25px; line-height: 32px; font-weight: 800; color: #0f172a;">
                      ${heroTitle}
                    </h1>
                    ${heroSubtitle ? `<p style="margin: 0; font-size: 15px; line-height: 24px; color: #475569;">${heroSubtitle}</p>` : ""}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td class="mobile-p" style="padding: 0 32px 24px 32px; background-color: #ffffff;">
              ${bodyContent}
            </td>
          </tr>

          <!-- Primary CTA Button -->
          ${ctaText && ctaUrl ? `
          <tr>
            <td class="mobile-p" align="center" style="padding: 6px 32px 32px 32px; background-color: #ffffff;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" bgcolor="#0f172a" style="border-radius: 8px;">
                    <a href="${ctaUrl}" target="_blank" class="mobile-btn" style="background-color: #0f172a; color: #ffffff; font-size: 14.5px; font-weight: 700; text-decoration: none; padding: 13px 32px; border-radius: 8px; display: inline-block; letter-spacing: 0.2px; border: 1px solid #1e293b;">
                      ${ctaText} &rarr;
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>` : ""}

          <!-- Footer -->
          <tr>
            <td bgcolor="#f8fafc" style="padding: 24px 32px; color: #64748b; font-size: 12px; line-height: 20px; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0 0 6px 0; font-size: 13px; font-weight: 700; color: #0f172a;">
                ${brandName}
              </p>
              <p style="margin: 0 0 8px 0; color: #64748b;">
                ${brandAddress}<br>
                Phone: <a href="tel:${cleanPhone}" style="color: #0f172a; text-decoration: none; font-weight: 600;">${brandPhone}</a> &nbsp;|&nbsp; Email: <a href="mailto:${emailTo}" style="color: #0f172a; text-decoration: none; font-weight: 600;">${emailTo}</a>
              </p>
              <p style="margin: 0; color: #94a3b8; font-size: 11px;">
                ${footerNote || copyrightLine}
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  // ─────────────────────────────────────────────────────────────────
  // TEMPLATE 3: BESPOKE WARM EDITORIAL (Heritage Publishing & Author Press)
  // ─────────────────────────────────────────────────────────────────
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${title || "Omni Virtual Solutions"}</title>
  <style type="text/css">
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body { margin: 0; padding: 0; width: 100% !important; min-width: 100%; background-color: #f7f4ed; }
    @media only screen and (max-width: 620px) {
      .email-container { width: 100% !important; max-width: 100% !important; }
      .mobile-p { padding: 22px 18px !important; }
      .mobile-h1 { font-size: 23px !important; line-height: 30px !important; }
      .mobile-btn { display: block !important; width: 100% !important; box-sizing: border-box !important; text-align: center !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f7f4ed; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <div style="display: none; max-height: 0px; overflow: hidden; mso-hide: all;">
    ${heroTitle} — Omni Virtual Solutions
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f7f4ed">
    <tr>
      <td align="center" style="padding: 34px 12px 46px 12px;">
        <table role="presentation" class="email-container" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 30px rgba(44, 34, 22, 0.07); border: 1px solid #e7ded0;">
          
          <!-- Top Cognac Bar -->
          <tr>
            <td bgcolor="#9a6724" style="height: 4px; line-height: 4px; font-size: 4px; background: linear-gradient(90deg, #9a6724 0%, #c5832b 50%, #9a6724 100%);">
              &nbsp;
            </td>
          </tr>

          <!-- Editorial Header with Official Shield Logo -->
          <tr>
            <td bgcolor="#fcfaf6" style="padding: 24px 32px; border-bottom: 1px solid #ece4d7;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td width="52" style="vertical-align: middle; padding-right: 14px;">
                    <img src="${logoSrc}" alt="Omni Logo" width="46" height="46" style="display:block; width:46px; height:46px; border-radius:8px; border:1px solid #ded5c6; background:#f4efe6;">
                  </td>
                  <td style="vertical-align: middle;">
                    <span style="font-family: 'Georgia', 'Times New Roman', serif; font-size: 22px; font-weight: 700; color: #1c1917; letter-spacing: -0.2px; display: inline-block;">
                      ${brandName}
                    </span>
                    <div style="font-family: -apple-system, sans-serif; font-size: 10.5px; color: #8c7355; margin-top: 3px; letter-spacing: 0.8px; text-transform: uppercase; font-weight: 700;">
                      ${brandTagline}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Hero Section -->
          <tr>
            <td class="mobile-p" style="padding: 34px 32px 18px 32px; background-color: #ffffff;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    ${heroPill || ""}
                    <h1 class="mobile-h1" style="margin: 0 0 12px 0; font-family: 'Georgia', 'Times New Roman', serif; font-size: 26px; line-height: 33px; font-weight: 700; color: #1c1917; letter-spacing: -0.3px;">
                      ${heroTitle}
                    </h1>
                    ${heroSubtitle ? `<p style="margin: 0; font-family: -apple-system, sans-serif; font-size: 15px; line-height: 25px; color: #57534e;">${heroSubtitle}</p>` : ""}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td class="mobile-p" style="padding: 0 32px 24px 32px; background-color: #ffffff;">
              ${bodyContent}
            </td>
          </tr>

          <!-- Primary CTA Button -->
          ${ctaText && ctaUrl ? `
          <tr>
            <td class="mobile-p" align="center" style="padding: 6px 32px 34px 32px; background-color: #ffffff;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" bgcolor="#1c1917" style="border-radius: 6px;">
                    <a href="${ctaUrl}" target="_blank" class="mobile-btn" style="background-color: #1c1917; color: #ffffff; font-family: -apple-system, sans-serif; font-size: 14.5px; font-weight: 700; text-decoration: none; padding: 13px 34px; border-radius: 6px; display: inline-block; letter-spacing: 0.3px; border: 1px solid #3d3835; box-shadow: 0 4px 14px rgba(28, 25, 23, 0.15);">
                      ${ctaText} &rarr;
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>` : ""}

          <!-- Footer -->
          <tr>
            <td bgcolor="#fcfaf6" style="padding: 26px 32px; color: #78716c; font-size: 12px; line-height: 20px; border-top: 1px solid #ece4d7;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <p style="margin: 0 0 6px 0; font-family: 'Georgia', serif; font-size: 14px; font-weight: 700; color: #1c1917;">
                      ${brandName}
                    </p>
                    <p style="margin: 0 0 8px 0; color: #78716c; font-family: -apple-system, sans-serif;">
                      ${brandAddress}<br>
                      Telephone: <a href="tel:${cleanPhone}" style="color: #9a6724; text-decoration: none; font-weight: 600;">${brandPhone}</a> &nbsp;|&nbsp; Desk: <a href="mailto:${emailTo}" style="color: #9a6724; text-decoration: none; font-weight: 600;">${emailTo}</a>
                    </p>
                    <p style="margin: 0; color: #a8a29e; font-size: 11px;">
                      ${footerNote || copyrightLine}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildAutoReplyHtml({ submission, settings, bodyText, senderEmail, isWebPreview = false, company = null }) {
  const customerName = submission.full_name || "Valued Client";
  const inquirySubject = submission.subject || "General Inquiry";
  let submissionDate = submission.created_at;
  try {
    if (submissionDate) {
      const d = new Date(submissionDate);
      if (!isNaN(d.getTime())) {
        submissionDate = d.toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        });
      }
    } else {
      submissionDate = new Date().toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    }
  } catch (_) {
    submissionDate = new Date().toISOString();
  }

  const rawMessage = (submission.message || "").trim();
  const messageExcerpt = rawMessage.length > 320 ? rawMessage.substring(0, 320) + "..." : rawMessage;
  const siteUrl = "https://omnivirtualsolution.com";
  const templateStyle = settings.email_template_style || "luxury_gold";
  const isLight = templateStyle === "clean_minimal";
  const isEditorial = templateStyle === "warm_editorial" || templateStyle === "gradient_glass";

  const brandName = company?.company_name || "Omni Virtual Solutions";
  const brandPhone = company?.phone || "+1 315-915-4799";
  const cleanPhone = brandPhone.replace(/[^\d+]/g, "");

  const heroPill = isEditorial ? `
    <div style="display: inline-block; background-color: #f4efe6; border: 1px solid #ded4c3; border-radius: 20px; padding: 4px 14px; font-size: 11.5px; font-weight: 700; color: #855f2d; margin-bottom: 14px; letter-spacing: 0.5px;">
      ✦ Editorial Dispatch: Inquiry Received
    </div>` : isLight ? `
    <div style="display: inline-block; background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 20px; padding: 4px 12px; font-size: 12px; font-weight: 700; color: #047857; margin-bottom: 14px;">
      ✓ Inquiry Received
    </div>` : `
    <div style="display: inline-block; background-color: rgba(34, 197, 94, 0.15); border: 1px solid rgba(34, 197, 94, 0.35); border-radius: 20px; padding: 4px 12px; font-size: 12px; font-weight: 700; color: #4ade80; margin-bottom: 14px;">
      ✓ Inquiry Received
    </div>`;

  const bannerBg = isEditorial ? "#fbf9f5" : isLight ? "#f8fafc" : "#161d2d";
  const bannerBorder = isEditorial ? "#9a6724" : isLight ? "#0f172a" : "#eba22d";
  const bannerText = isEditorial ? "#44403c" : isLight ? "#334155" : "#e2e8f0";

  const cardBg = isEditorial ? "#ffffff" : isLight ? "#ffffff" : "#151b29";
  const cardBorder = isEditorial ? "#e7ded0" : isLight ? "#e2e8f0" : "rgba(255, 255, 255, 0.08)";
  const cardHeaderBg = isEditorial ? "#f7f3ec" : isLight ? "#f1f5f9" : "#1b2334";
  const cardHeaderColor = isEditorial ? "#8c7355" : isLight ? "#475569" : "#eba22d";
  const labelColor = isEditorial ? "#78716c" : isLight ? "#64748b" : "#94a3b8";
  const valColor = isEditorial ? "#1c1917" : isLight ? "#0f172a" : "#f1f5f9";
  const messageColor = isEditorial ? "#44403c" : isLight ? "#334155" : "#cbd5e1";

  // Check if admin configured custom message in auto_reply_body setting
  const trimmedBodyText = (bodyText || "").trim();
  const hasCustomMessage = trimmedBodyText && !trimmedBodyText.startsWith("Hello {customer_name}, thank you for contacting us");

  const bodyContent = `
    ${hasCustomMessage ? `
    <div style="background-color: ${cardBg}; border: 1px solid ${cardBorder}; border-radius: 8px; padding: 14px 16px; margin-bottom: 20px; font-size: 14px; line-height: 1.6; color: ${valColor};">
      ${trimmedBodyText.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>")}
    </div>` : ""}

    <!-- Message Summary Card -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: ${cardBg}; border: 1px solid ${cardBorder}; border-radius: 10px; overflow: hidden; margin-bottom: 8px;">
      <tr>
        <td style="padding: 12px 16px; background-color: ${cardHeaderBg}; border-bottom: 1px solid ${cardBorder}; font-size: 12px; font-weight: 700; color: ${cardHeaderColor}; text-transform: uppercase; letter-spacing: 0.5px;">
          Inquiry Summary
        </td>
      </tr>
      <tr>
        <td style="padding: 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size: 13.5px;">
            <tr>
              <td width="115" style="padding: 6px 0; font-weight: 600; color: ${labelColor}; vertical-align: top;">Subject:</td>
              <td style="padding: 6px 0; color: ${valColor}; font-weight: 600;">${inquirySubject}</td>
            </tr>
            <tr>
              <td width="115" style="padding: 6px 0; font-weight: 600; color: ${labelColor}; vertical-align: top;">Submitted At:</td>
              <td style="padding: 6px 0; color: ${valColor};">${submissionDate}</td>
            </tr>
            ${messageExcerpt ? `
            <tr>
              <td width="115" style="padding: 6px 0; font-weight: 600; color: ${labelColor}; vertical-align: top;">Your Message:</td>
              <td style="padding: 6px 0; color: ${messageColor}; line-height: 1.6; font-style: italic;">
                "${messageExcerpt.replace(/</g, "&lt;").replace(/>/g, "&gt;")}"
              </td>
            </tr>` : ""}
          </table>
        </td>
      </tr>
    </table>
  `;

  return buildEmailShell({
    title: `We received your message — ${brandName}`,
    heroPill,
    heroTitle: "We received your message!",
    bodyContent,
    ctaText: `Visit ${brandName}`,
    ctaUrl: siteUrl,
    footerNote: `You are receiving this confirmation because an inquiry was submitted with your email on ${brandName}.`,
    supportEmail: senderEmail,
    templateStyle,
    isWebPreview,
    company,
  });
}

function buildReplyHtml({ submission, settings, fullBody, senderEmail, isWebPreview = false, company = null }) {
  const customerName = submission.full_name || "Valued Client";
  const inquirySubject = submission.subject || "Your Inquiry";
  const siteUrl = "https://omnivirtualsolution.com";
  const templateStyle = settings.email_template_style || "luxury_gold";
  const isLight = templateStyle === "clean_minimal";
  const isEditorial = templateStyle === "warm_editorial" || templateStyle === "gradient_glass";
  const brandName = company?.company_name || "Omni Virtual Solutions";

  const heroPill = isEditorial ? `
    <div style="display: inline-block; background-color: #f4efe6; border: 1px solid #ded4c3; border-radius: 20px; padding: 4px 14px; font-size: 11.5px; font-weight: 700; color: #855f2d; margin-bottom: 14px; letter-spacing: 0.5px;">
      ✦ Executive Advisory Response
    </div>` : isLight ? `
    <div style="display: inline-block; background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 20px; padding: 4px 12px; font-size: 12px; font-weight: 700; color: #1d4ed8; margin-bottom: 14px;">
      ● Team Response
    </div>` : `
    <div style="display: inline-block; background-color: rgba(235, 162, 45, 0.15); border: 1px solid rgba(235, 162, 45, 0.35); border-radius: 20px; padding: 4px 12px; font-size: 12px; font-weight: 700; color: #eba22d; margin-bottom: 14px;">
      ● Team Response
    </div>`;

  const boxBg = isEditorial ? "#ffffff" : isLight ? "#ffffff" : "#151b29";
  const boxBorder = isEditorial ? "#e7ded0" : isLight ? "#e2e8f0" : "rgba(255, 255, 255, 0.08)";
  const textColor = isEditorial ? "#292524" : isLight ? "#1f2937" : "#e2e8f0";
  const metaBg = isEditorial ? "#fbf9f5" : isLight ? "#f8fafc" : "#111622";
  const metaColor = isEditorial ? "#78716c" : isLight ? "#64748b" : "#94a3b8";

  const bodyContent = `
    <div style="background-color: ${boxBg}; border: 1px solid ${boxBorder}; border-radius: 10px; padding: 20px 22px; font-size: 15px; line-height: 1.7; color: ${textColor}; margin-bottom: 20px;">
      ${escapeHtml(fullBody).replace(/\n/g, "<br>")}
    </div>

    <div style="background-color: ${metaBg}; border: 1px solid ${boxBorder}; border-radius: 8px; padding: 12px 16px; font-size: 13px; color: ${metaColor};">
      <strong>Regarding:</strong> ${escapeHtml(inquirySubject)} &nbsp;|&nbsp; Submitted by ${escapeHtml(customerName)}
    </div>
  `;

  return buildEmailShell({
    title: `Re: ${inquirySubject} — ${brandName}`,
    heroPill,
    heroTitle: `Response to: ${inquirySubject}`,
    heroSubtitle: `A message from the team at ${brandName} for ${customerName}.`,
    bodyContent,
    ctaText: `Visit ${brandName}`,
    ctaUrl: siteUrl,
    footerNote: `This message was sent in direct response to your inquiry submitted at ${brandName}.`,
    supportEmail: senderEmail,
    templateStyle,
    isWebPreview,
    company,
  });
}

function buildNotificationHtml({ submission, settings, senderEmail, recipientEmail, isWebPreview = false, company = null }) {
  const brandName = company?.company_name || "Omni Virtual Solutions";
  const adminUrl = settings.admin_url && !settings.admin_url.includes("localhost") ? settings.admin_url : "https://omnivirtualsolution.com/admin";
  const templateStyle = settings.email_template_style || "luxury_gold";
  const isLight = templateStyle === "clean_minimal";
  const isEditorial = templateStyle === "warm_editorial" || templateStyle === "gradient_glass";

  const heroPill = isEditorial ? `
    <div style="display: inline-block; background-color: #f4efe6; border: 1px solid #ded4c3; border-radius: 20px; padding: 4px 14px; font-size: 11.5px; font-weight: 700; color: #855f2d; margin-bottom: 14px; letter-spacing: 0.5px;">
      ✦ New Author / Client Inquiry
    </div>` : isLight ? `
    <div style="display: inline-block; background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 20px; padding: 4px 12px; font-size: 12px; font-weight: 700; color: #1d4ed8; margin-bottom: 14px;">
      ● New Website Lead
    </div>` : `
    <div style="display: inline-block; background-color: rgba(59, 130, 246, 0.15); border: 1px solid rgba(59, 130, 246, 0.35); border-radius: 20px; padding: 4px 12px; font-size: 12px; font-weight: 700; color: #60a5fa; margin-bottom: 14px;">
      ● New Website Lead
    </div>`;

  const tableBg = isEditorial ? "#ffffff" : isLight ? "#ffffff" : "#151b29";
  const tableBorder = isEditorial ? "#e7ded0" : isLight ? "#e2e8f0" : "rgba(255, 255, 255, 0.08)";
  const headerBg = isEditorial ? "#f7f3ec" : isLight ? "#f1f5f9" : "#1b2334";
  const headerText = isEditorial ? "#8c7355" : isLight ? "#475569" : "#eba22d";
  const labelColor = isEditorial ? "#78716c" : isLight ? "#64748b" : "#94a3b8";
  const valColor = isEditorial ? "#1c1917" : isLight ? "#0f172a" : "#f1f5f9";
  const msgColor = isEditorial ? "#292524" : isLight ? "#1e293b" : "#cbd5e1";
  const metaBg = isEditorial ? "#fbf9f5" : isLight ? "#f8fafc" : "#0d111a";


  const bodyContent = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: ${tableBg}; border: 1px solid ${tableBorder}; border-radius: 10px; overflow: hidden; margin-bottom: 16px;">
      <tr>
        <td style="padding: 12px 16px; background-color: ${headerBg}; border-bottom: 1px solid ${tableBorder}; font-size: 12px; font-weight: 700; color: ${headerText}; text-transform: uppercase; letter-spacing: 0.5px;">
          Lead Details
        </td>
      </tr>
      <tr>
        <td style="padding: 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size: 14px;">
            <tr>
              <td width="110" style="padding: 8px 0; font-weight: 700; color: ${labelColor};">From:</td>
              <td style="padding: 8px 0; color: ${valColor}; font-weight: 600;">${escapeHtml(submission.full_name)}</td>
            </tr>
            <tr>
              <td width="110" style="padding: 8px 0; font-weight: 700; color: ${labelColor};">Email:</td>
              <td style="padding: 8px 0;"><a href="mailto:${encodeURIComponent(submission.email || '')}" style="color: #eba22d; font-weight: 600; text-decoration: none;">${escapeHtml(submission.email)}</a></td>
            </tr>
            ${submission.phone ? `
            <tr>
              <td width="110" style="padding: 8px 0; font-weight: 700; color: ${labelColor};">Phone:</td>
              <td style="padding: 8px 0; color: ${valColor};">${escapeHtml(submission.phone)}</td>
            </tr>` : ""}
            <tr>
              <td width="110" style="padding: 8px 0; font-weight: 700; color: ${labelColor};">Subject:</td>
              <td style="padding: 8px 0; color: ${valColor}; font-weight: 600;">${escapeHtml(submission.subject || "General Inquiry")}</td>
            </tr>
            <tr>
              <td width="110" style="padding: 8px 0; font-weight: 700; color: ${labelColor}; vertical-align: top;">Message:</td>
              <td style="padding: 8px 0; color: ${msgColor}; line-height: 1.6;">${escapeHtml(submission.message || "").replace(/\n/g, "<br>")}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <div style="background-color: ${metaBg}; border-radius: 8px; padding: 12px 16px; font-size: 12.5px; color: #64748b; border: 1px solid ${tableBorder};">
      Received: ${submission.created_at || new Date().toISOString()} &nbsp;|&nbsp; IP: ${submission.ip_address || "unknown"}
    </div>
  `;

  return buildEmailShell({
    title: `New Inquiry from ${submission.full_name}`,
    heroPill,
    heroTitle: "New Website Contact Inquiry",
    heroSubtitle: `You have received a new inquiry submitted via the website contact form.`,
    bodyContent,
    ctaText: "Open Admin Leads Dashboard",
    ctaUrl: adminUrl,
    footerNote: `Automated administrative notification dispatched by ${brandName} CMS.`,
    supportEmail: senderEmail,
    templateStyle,
    isWebPreview,
    company,
  });
}

// ── Live Broadcast Helper (Safe & Non-blocking) ───────────────────
function safeBroadcast(event) {
  try {
    const { broadcast } = require("./routes/live");
    if (typeof broadcast === "function") broadcast(event);
  } catch (_) {}
}

// ── Dynamic Universal Business Email Resolver ────────────────────
async function getBusinessEmail() {
  const [settings, company] = await Promise.all([getSettings(), getFullBusinessProfile()]);
  return (
    settings.recipient_email?.trim() ||
    company?.recipient_email?.trim() ||
    company?.email?.trim() ||
    settings.sender_email?.trim() ||
    settings.smtp_user?.trim() ||
    "admin@omnivirtualsolution.com"
  );
}

// ── Visual Design for Outbound Delivery Failure Report ───────────
function buildFailureAlertHtml({
  failedEventType,
  originalRecipient,
  originalSubject,
  errorMessage,
  submission,
  company,
  settings,
}) {
  const brandName = company?.company_name || "Omni Virtual Solutions";
  const siteBaseUrl = (process.env.PUBLIC_URL || process.env.URL || "https://www.omnivirtualsolution.com").replace(/\/$/, "");
  const adminUrl = `${siteBaseUrl}/admin/contacts.html#inbox`;
  const templateStyle = settings?.email_template_style || "luxury_gold";

  const safeCustomerName = escapeHtml(submission?.full_name || "Website Visitor");
  const safeCustomerEmail = escapeHtml(originalRecipient || submission?.email || "Unknown");
  const safePhone = escapeHtml(submission?.phone || "Not provided");
  const safeSubject = escapeHtml(originalSubject || submission?.subject || "General Inquiry");
  const safeError = escapeHtml(errorMessage || "Mail transfer agent rejection");
  const safeSnippet = escapeHtml((submission?.message || "").slice(0, 300));

  const encodedSubject = encodeURIComponent(`Re: ${submission?.subject || "Your Inquiry"} — ${brandName}`);
  const encodedBody = encodeURIComponent(`Hello ${submission?.full_name || ""},\n\nWe received your inquiry and wanted to follow up with you directly.\n\nBest regards,\n${brandName}`);
  const gmailComposeUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(originalRecipient || "")}&su=${encodedSubject}&body=${encodedBody}`;

  const eventLabel =
    failedEventType === "auto_reply"
      ? "Visitor Auto-Reply Acknowledgment"
      : failedEventType === "reply_sent"
      ? "Admin Direct Reply Message"
      : failedEventType === "new_submission_notify"
      ? "New Inquiry Notification Alert"
      : "Outbound System Email";

  const bodyContent = `
    <div style="background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.35); border-radius: 10px; padding: 16px 20px; margin-bottom: 22px;">
      <div style="font-weight: 700; color: #f87171; font-size: 14.5px; margin-bottom: 6px;">
        ⚠️ Outbound Email Failed to Deliver
      </div>
      <div style="color: #cbd5e1; font-size: 13px; line-height: 1.5;">
        The system attempted to send an automated <strong>${eventLabel}</strong> to 
        <span style="color:#ffffff; font-weight:700;">${safeCustomerEmail}</span>, but the mail transfer agent encountered an error.
      </div>
    </div>

    <!-- Error Diagnostics -->
    <div style="background: #0f141f; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px; padding: 14px 18px; margin-bottom: 22px;">
      <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.6px; color: #94a3b8; font-weight: 700; margin-bottom: 6px;">
        Server Error Diagnostic
      </div>
      <div style="font-family: Consolas, monospace, sans-serif; font-size: 12.5px; color: #fca5a5; word-break: break-all; line-height: 1.45;">
        ${safeError}
      </div>
    </div>

    <!-- Contact Lead Details -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 22px; background: rgba(255, 255, 255, 0.02); border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.06);">
      <tr>
        <td style="padding: 10px 14px; font-size: 12.5px; color: #94a3b8; width: 130px; border-bottom: 1px solid rgba(255, 255, 255, 0.04);">Customer Name:</td>
        <td style="padding: 10px 14px; font-size: 13px; color: #ffffff; font-weight: 600; border-bottom: 1px solid rgba(255, 255, 255, 0.04);">${safeCustomerName}</td>
      </tr>
      <tr>
        <td style="padding: 10px 14px; font-size: 12.5px; color: #94a3b8; border-bottom: 1px solid rgba(255, 255, 255, 0.04);">Intended Email:</td>
        <td style="padding: 10px 14px; font-size: 13px; color: #eba22d; font-weight: 600; border-bottom: 1px solid rgba(255, 255, 255, 0.04);">${safeCustomerEmail}</td>
      </tr>
      <tr>
        <td style="padding: 10px 14px; font-size: 12.5px; color: #94a3b8; border-bottom: 1px solid rgba(255, 255, 255, 0.04);">Phone:</td>
        <td style="padding: 10px 14px; font-size: 13px; color: #ffffff; border-bottom: 1px solid rgba(255, 255, 255, 0.04);">${safePhone}</td>
      </tr>
      <tr>
        <td style="padding: 10px 14px; font-size: 12.5px; color: #94a3b8; border-bottom: 1px solid rgba(255, 255, 255, 0.04);">Topic:</td>
        <td style="padding: 10px 14px; font-size: 13px; color: #ffffff; border-bottom: 1px solid rgba(255, 255, 255, 0.04);">${safeSubject}</td>
      </tr>
      ${safeSnippet ? `
      <tr>
        <td style="padding: 10px 14px; font-size: 12.5px; color: #94a3b8; vertical-align: top;">Message Snippet:</td>
        <td style="padding: 10px 14px; font-size: 12.5px; color: #cbd5e1; line-height: 1.5;">${safeSnippet}${submission?.message?.length > 300 ? "..." : ""}</td>
      </tr>` : ""}
    </table>

    <!-- Direct 1-Click Action Buttons -->
    <div style="margin-top: 24px; text-align: center;">
      <a href="${gmailComposeUrl}" target="_blank" style="display: inline-block; background: #eba22d; color: #0b0f17; font-weight: 700; font-size: 13px; padding: 11px 22px; border-radius: 8px; text-decoration: none; margin-right: 10px; margin-bottom: 8px;">
        ✉️ Compose Direct in Gmail
      </a>
      <a href="${adminUrl}" target="_blank" style="display: inline-block; background: rgba(255, 255, 255, 0.08); color: #ffffff; font-weight: 600; font-size: 13px; padding: 11px 20px; border-radius: 8px; text-decoration: none; border: 1px solid rgba(255, 255, 255, 0.15); margin-bottom: 8px;">
        Open Admin Inbox
      </a>
    </div>
  `;

  return buildEmailShell({
    title: `Delivery Failure Alert: ${safeCustomerName}`,
    heroPill: "⚠️ Delivery Failure Alert",
    heroTitle: "Email Dispatch Failure Notification",
    heroSubtitle: `An outbound message to ${safeCustomerEmail} could not be delivered.`,
    bodyContent,
    ctaText: "Review in Admin Portal",
    ctaUrl: adminUrl,
    footerNote: "Automated delivery telemetry dispatch from Omni Virtual Solutions Mail Engine.",
    supportEmail: settings?.recipient_email || "admin@omnivirtualsolution.com",
    templateStyle,
    company,
  });
}

// ── In-Memory Deduplication Cache for Failure Alerts (Max 1 per 30s) ──
const recentFailureAlerts = new Map();

// ── Outbound Delivery Failure Notification Handler ────────────────
async function sendEmailFailureAlert({
  failedEventType,
  originalRecipient,
  originalSubject,
  errorMessage,
  submission = null,
  replyId = null,
}) {
  try {
    // 1. Loop prevention: Never trigger a failure alert for a failed failure alert!
    if (failedEventType === "email_failure_alert") {
      console.warn("[email-service] Loop prevention: ignoring failure of a failure alert.");
      return { success: false, reason: "loop_prevention" };
    }

    const [settings, company] = await Promise.all([getSettings(), getFullBusinessProfile()]);

    // Check if failure alerts are enabled (defaults to true)
    if (settings.email_failure_alert_enabled === "false") {
      console.log("[email-service] Email failure alerts are disabled in settings.");
      return { success: false, reason: "failure_alert_disabled" };
    }

    // Dynamic resolution of the latest business email
    const businessEmail =
      settings.recipient_email?.trim() ||
      company?.recipient_email?.trim() ||
      company?.email?.trim() ||
      settings.sender_email?.trim() ||
      settings.smtp_user?.trim() ||
      "admin@omnivirtualsolution.com";

    // 2. Loop prevention: If the failed recipient WAS already the business email,
    // re-sending via the same failing route will cause a recursive loop.
    if (originalRecipient && originalRecipient.toLowerCase() === businessEmail.toLowerCase()) {
      console.warn(`[email-service] Loop prevention: failure was already targeting business email (${businessEmail}). Skipping re-send.`);
      safeBroadcast({
        type: "email_failed",
        submissionId: submission?.id || null,
        recipient: originalRecipient,
        customerName: submission?.full_name || "Lead",
        error: errorMessage,
        timestamp: new Date().toISOString(),
      });
      return { success: false, reason: "loop_prevention_same_recipient" };
    }

    // Deduplication check: max 1 alert per submission/recipient per 30 seconds
    const dedupKey = `${submission?.id || "none"}:${originalRecipient || "none"}`;
    const lastAlertTime = recentFailureAlerts.get(dedupKey);
    if (lastAlertTime && Date.now() - lastAlertTime < 30000) {
      console.log(`[email-service] Deduplication: alert for ${dedupKey} recently dispatched.`);
      return { success: false, reason: "deduplicated" };
    }
    recentFailureAlerts.set(dedupKey, Date.now());
    if (recentFailureAlerts.size > 100) {
      const now = Date.now();
      for (const [k, t] of recentFailureAlerts.entries()) {
        if (now - t > 60000) recentFailureAlerts.delete(k);
      }
    }

    // Broadcast live SSE alert to any active admin dashboards immediately
    safeBroadcast({
      type: "email_failed",
      submissionId: submission?.id || null,
      recipient: originalRecipient,
      customerName: submission?.full_name || "Lead",
      error: errorMessage,
      timestamp: new Date().toISOString(),
    });

    const transporter = await createTransporter(settings);
    if (!transporter) {
      console.warn("[email-service] Cannot send failure alert email: SMTP not configured");
      return { success: false, reason: "smtp_not_configured" };
    }

    const senderName = company?.company_name || settings.sender_name || "Omni Virtual Solutions";
    const smtpUser = settings.smtp_user?.trim();
    const fromAddress = smtpUser
      ? `"${senderName}" <${smtpUser}>`
      : `"${senderName}" <${businessEmail}>`;

    const alertSubject = `⚠️ Email Delivery Failed — ${submission?.full_name || originalSubject || "Outbound Dispatch"}`;
    const htmlBody = buildFailureAlertHtml({
      failedEventType,
      originalRecipient,
      originalSubject,
      errorMessage,
      submission,
      company,
      settings,
    });

    await transporter.sendMail({
      from: fromAddress,
      to: businessEmail,
      subject: alertSubject,
      html: htmlBody,
      text: `EMAIL DELIVERY FAILED\n\nIntended Recipient: ${originalRecipient}\nCustomer: ${submission?.full_name || "N/A"}\nError: ${errorMessage}\n\nPlease check the admin portal or reply via direct Gmail.`,
    });

    await logEmail({
      eventType: "email_failure_alert",
      submissionId: submission?.id || null,
      recipientEmail: businessEmail,
      subject: alertSubject,
      status: "sent",
    });

    console.log(`[email-service] Delivery failure alert sent to business email → ${businessEmail}`);
    return { success: true };
  } catch (alertErr) {
    console.error("[email-service] Failed to send failure alert email:", alertErr.message);
    try {
      await logEmail({
        eventType: "email_failure_alert",
        submissionId: submission?.id || null,
        recipientEmail: originalRecipient || null,
        subject: "(failure alert failed)",
        status: "failed",
        errorMessage: alertErr.message,
      });
    } catch (_) {}
    return { success: false, reason: alertErr.message };
  }
}

// =================================================================
// MAIN: Send notification to admin when a new contact form is submitted
// =================================================================
async function sendNewSubmissionNotification(submission) {
  const [settings, company] = await Promise.all([getSettings(), getFullBusinessProfile()]);

  // Check if notifications are enabled
  if (settings.email_notifications_enabled !== "true") {
    await updateNotifyStatus(submission.id, "skipped");
    return { success: false, reason: "notifications_disabled" };
  }

  if (settings.notification_pref === "off") {
    await updateNotifyStatus(submission.id, "skipped");
    return { success: false, reason: "preference_off" };
  }

  const recipientEmail = settings.recipient_email?.trim() || company?.recipient_email?.trim() || company?.email?.trim() || "admin@omnivirtualsolution.com";

  const transporter = await createTransporter(settings);
  if (!transporter) {
    await updateNotifyStatus(submission.id, "failed");
    await logEmail({
      eventType: "new_submission_notify",
      submissionId: submission.id,
      recipientEmail,
      subject: "(not sent — SMTP not configured)",
      status: "failed",
      errorMessage: "SMTP not configured. Set smtp_host, smtp_user, smtp_pass in Email Settings.",
    });
    return { success: false, reason: "smtp_not_configured" };
  }

  const subjectTemplate = settings.notification_subject || "New Website Inquiry — {customer_name}";
  const safeCustomerName = (submission.full_name || "").replace(/[\r\n]+/g, " ").trim();
  const subject = interpolate(subjectTemplate, { customer_name: safeCustomerName });

  const senderName  = company?.company_name || settings.sender_name  || "Omni Virtual Solutions";
  const smtpUser    = settings.smtp_user?.trim();
  const fromAddress = smtpUser
    ? `"${senderName}" <${smtpUser}>`
    : `"${senderName}" <${company?.email || settings.sender_email?.trim() || recipientEmail}>`;

  const htmlBody = buildNotificationHtml({ submission, settings, senderEmail: recipientEmail, recipientEmail, company });

  try {
    await transporter.sendMail({
      from: fromAddress,
      to:   recipientEmail,
      replyTo: submission.email,
      subject,
      html: htmlBody,
      text: `New inquiry from ${submission.full_name} (${submission.email})\n\nSubject: ${submission.subject || "General Inquiry"}\n\nMessage:\n${submission.message}`,
    });

    await updateNotifyStatus(submission.id, "sent");
    await logEmail({ eventType: "new_submission_notify", submissionId: submission.id, recipientEmail, subject, status: "sent" });
    console.log(`[email] Notification sent for submission #${submission.id} → ${recipientEmail}`);
    return { success: true };
  } catch (err) {
    const errMsg = err.message;
    await updateNotifyStatus(submission.id, "failed");
    await logEmail({ eventType: "new_submission_notify", submissionId: submission.id, recipientEmail, subject, status: "failed", errorMessage: errMsg });
    console.error(`[email] Notification FAILED for submission #${submission.id}:`, errMsg);
    safeBroadcast({
      type: "email_failed",
      submissionId: submission.id,
      recipient: recipientEmail,
      customerName: submission.full_name,
      error: errMsg,
      timestamp: new Date().toISOString(),
    });
    return { success: false, reason: errMsg };
  }
}

// =================================================================
// Send auto-reply acknowledgment to visitor after form submission
// =================================================================
async function sendAutoReply(submission) {
  const [settings, company] = await Promise.all([getSettings(), getFullBusinessProfile()]);
  if (settings.auto_reply_enabled !== "true") return { success: false, reason: "auto_reply_disabled" };

  if (!submission.email || submission.email.includes("direct-mail.com") || submission.email.includes("example.com")) {
    return { success: false, reason: "invalid_visitor_email" };
  }

  const transporter = await createTransporter(settings);
  if (!transporter) return { success: false, reason: "smtp_not_configured" };

  const brandName = company.company_name || "Omni Virtual Solutions";
  const rawSubj = (settings.auto_reply_subject || `We received your message — ${brandName}`).replace(/\s*\[Ref:\s*#?\d+\]/gi, "").trim();
  const subject = interpolate(rawSubj, { customer_name: submission.full_name });
  const bodyText = interpolate(settings.auto_reply_body || "Hello {customer_name}, thank you for contacting us!", { customer_name: submission.full_name });

  const recipientEmail = settings.recipient_email?.trim() || company?.recipient_email?.trim() || company?.email?.trim() || "admin@omnivirtualsolution.com";
  const senderName  = company.company_name || settings.sender_name || "Omni Virtual Solutions";
  const smtpUser    = settings.smtp_user?.trim();
  const fromAddress = smtpUser
    ? `"${senderName}" <${smtpUser}>`
    : `"${senderName}" <${recipientEmail}>`;

  const htmlBody = buildAutoReplyHtml({ submission, settings, bodyText, senderEmail: recipientEmail, company });

  try {
    await transporter.sendMail({
      from: fromAddress,
      to: submission.email,
      replyTo: recipientEmail,
      subject,
      text: bodyText,
      html: htmlBody,
      messageId: `<submission-${submission.id}@omnivirtualsolution.com>`,
    });
    await logEmail({ eventType: "auto_reply", submissionId: submission.id, recipientEmail: submission.email, subject, status: "sent" });
    return { success: true };
  } catch (err) {
    await logEmail({ eventType: "auto_reply", submissionId: submission.id, recipientEmail: submission.email, subject, status: "failed", errorMessage: err.message });
    sendEmailFailureAlert({
      failedEventType: "auto_reply",
      originalRecipient: submission.email,
      originalSubject: subject,
      errorMessage: err.message,
      submission,
    }).catch(() => {});
    return { success: false, reason: err.message };
  }
}

// =================================================================
// Send admin reply to visitor
// =================================================================
async function sendReply({ submission, replyBody, replyId, sentBy }) {
  const [settings, company] = await Promise.all([getSettings(), getFullBusinessProfile()]);
  const transporter = await createTransporter(settings);

  const senderName  = company.company_name || settings.sender_name  || "Omni Virtual Solutions";
  const senderEmail = company.email || settings.sender_email?.trim() || settings.recipient_email?.trim() || settings.smtp_user?.trim();
  if (senderEmail && senderEmail.toLowerCase().includes("nsixx631")) {
    console.warn("[email-service] Reply blocked: legacy email sender detected");
    return { success: false, reason: "legacy_sender_blocked" };
  }
  const cleanSubj = submission.subject ? submission.subject.replace(/\s*\[Ref:\s*#?\d+\]/gi, "").trim() : "Your Inquiry";
  const subject   = `Re: ${cleanSubj} — ${company.company_name || "Omni Virtual Solutions"}`;

  if (!transporter) {
    await db.execute({
      sql: "UPDATE contact_replies SET email_sent = 0, email_error = ? WHERE id = ?",
      args: ["SMTP not configured", replyId],
    });
    await logEmail({ eventType: "reply_sent", submissionId: submission.id, recipientEmail: submission.email, subject, status: "failed", errorMessage: "SMTP not configured" });
    return { success: false, reason: "smtp_not_configured" };
  }

  // Apply reply template
  const template = settings.reply_template || `Hello {customer_name},\n\n{reply_body}\n\nBest regards,\n${senderName}`;
  const fullBody = interpolate(template, { customer_name: submission.full_name, reply_body: replyBody });

  const htmlBody = buildReplyHtml({ submission, settings, fullBody, senderEmail, company });

  try {
    await transporter.sendMail({
      from: `"${senderName}" <${senderEmail}>`,
      to:   submission.email,
      replyTo: senderEmail,
      subject,
      text: fullBody,
      html: htmlBody,
      messageId: `<submission-${submission.id}-reply-${replyId || Date.now()}@omnivirtualsolution.com>`,
      inReplyTo: `<submission-${submission.id}@omnivirtualsolution.com>`,
      references: `<submission-${submission.id}@omnivirtualsolution.com>`,
    });

    await db.execute({
      sql: "UPDATE contact_replies SET email_sent = 1 WHERE id = ?",
      args: [replyId],
    });
    await logEmail({ eventType: "reply_sent", submissionId: submission.id, recipientEmail: submission.email, subject, status: "sent" });
    return { success: true };
  } catch (err) {
    await db.execute({
      sql: "UPDATE contact_replies SET email_sent = 0, email_error = ? WHERE id = ?",
      args: [err.message, replyId],
    });
    await logEmail({ eventType: "reply_sent", submissionId: submission.id, recipientEmail: submission.email, subject, status: "failed", errorMessage: err.message });
    sendEmailFailureAlert({
      failedEventType: "reply_sent",
      originalRecipient: submission.email,
      originalSubject: subject,
      errorMessage: err.message,
      submission,
      replyId,
    }).catch(() => {});
    return { success: false, reason: err.message };
  }
}

// =================================================================
// Test SMTP connection (for settings page)
// =================================================================
async function testSmtpConnection(testSettings) {
  const settings = testSettings || await getSettings();
  const transporter = await createTransporter(settings, { noCache: true });
  if (!transporter) return { success: false, reason: "Incomplete SMTP credentials" };
  try {
    await transporter.verify();
    return { success: true };
  } catch (err) {
    return { success: false, reason: err.message };
  }
}

// =================================================================
// Recovery: Process any pending submissions left by cold container pauses
// =================================================================
async function processPendingSubmissions(maxLimit = 5) {
  try {
    // Only grab submissions that were created more than 15s ago to avoid colliding with active requests
    const pending = await db.execute({
      sql: `SELECT id, full_name, email, phone, subject, message, created_at
            FROM contact_submissions
            WHERE email_notify_status = 'pending'
            AND datetime(created_at) <= datetime('now', '-15 seconds')
            ORDER BY id ASC
            LIMIT ?`,
      args: [maxLimit],
    });

    if (!pending.rows || pending.rows.length === 0) return { count: 0, sent: 0 };

    console.log(`[email-service] Recovering ${pending.rows.length} pending submission(s)...`);
    let sentCount = 0;
    for (const sub of pending.rows) {
      try {
        const results = await Promise.allSettled([
          sendNewSubmissionNotification(sub),
          sendAutoReply(sub),
        ]);
        const anySuccess = results.some((r) => r.status === "fulfilled" && r.value?.success);
        if (anySuccess) sentCount++;
      } catch (err) {
        console.error(`[email-service] Recovery error for submission #${sub.id}:`, err.message);
      }
    }
    return { count: pending.rows.length, sent: sentCount };
  } catch (err) {
    console.warn("[email-service] processPendingSubmissions warning:", err.message);
    return { count: 0, error: err.message };
  }
}

// =================================================================
// Get email usage stats
// =================================================================
async function getEmailStats() {
  try {
    const [total, sent, failed, skipped] = await Promise.all([
      db.execute("SELECT COUNT(*) AS n FROM email_log"),
      db.execute("SELECT COUNT(*) AS n FROM email_log WHERE status = 'sent'"),
      db.execute("SELECT COUNT(*) AS n FROM email_log WHERE status = 'failed'"),
      db.execute("SELECT COUNT(*) AS n FROM email_log WHERE status = 'skipped'"),
    ]);
    return {
      total:   total.rows[0].n,
      sent:    sent.rows[0].n,
      failed:  failed.rows[0].n,
      skipped: skipped.rows[0].n,
    };
  } catch (_) {
    return { total: 0, sent: 0, failed: 0, skipped: 0 };
  }
}

// =================================================================
// 24-Hour Quota & Delivery Strategy Engine
// =================================================================
async function getQuotaStatus({ tzOffsetMinutes = 480 } = {}) {
  try {
    const settings = await getSettings();
    const strategy = settings.delivery_strategy || "smart_auto"; // 'smart_auto' | 'force_smtp' | 'force_popup'
    const limit = parseInt(settings.daily_quota_limit || "500", 10);

    // Count sent emails in rolling 24 hours (this is what Google's 500/day limit enforces)
    const resCount = await db.execute({
      sql: `SELECT COUNT(*) AS n FROM email_log 
            WHERE status = 'sent' 
            AND datetime(sent_at) >= datetime('now', '-24 hours')`,
    });
    const sent24h = Number(resCount.rows?.[0]?.n || 0);

    // Count sent emails since local midnight (calendar "today" in the admin's timezone).
    // sent_at is stored in UTC, so shift to local, snap to start of day, shift back to UTC.
    const off = Number.isFinite(Number(tzOffsetMinutes)) ? Math.max(-840, Math.min(840, Math.round(Number(tzOffsetMinutes)))) : 480;
    const resToday = await db.execute({
      sql: `SELECT COUNT(*) AS n FROM email_log 
            WHERE status = 'sent' 
            AND datetime(sent_at) >= datetime('now', ? || ' minutes', 'start of day', ? || ' minutes')`,
      args: [(off >= 0 ? "+" : "") + off, (-off >= 0 ? "+" : "") + (-off)],
    });
    const sentToday = Number(resToday.rows?.[0]?.n || 0);

    // Check if Google rejected recently due to quota/daily limit
    const resLimitErr = await db.execute({
      sql: `SELECT id, error_message FROM email_log 
            WHERE status = 'failed' 
            AND datetime(sent_at) >= datetime('now', '-4 hours')
            AND (
              lower(error_message) LIKE '%daily%limit%' 
              OR lower(error_message) LIKE '%quota%' 
              OR lower(error_message) LIKE '%550%5.4.5%'
              OR lower(error_message) LIKE '%user-sending limit%'
            )
            ORDER BY id DESC LIMIT 1`,
    });
    const googleLimitHit = Boolean(resLimitErr.rows && resLimitErr.rows.length > 0);

    const isExceeded = sent24h >= limit || googleLimitHit;
    const remaining = Math.max(0, limit - sent24h);

    const shouldUsePopupFallback = strategy === "force_popup" || (strategy === "smart_auto" && isExceeded);
    const canSendSmtp = strategy !== "force_popup" && (!isExceeded || strategy === "force_smtp");

    return {
      strategy,
      limit,
      sent24h,
      sentToday,
      remaining,
      isExceeded,
      googleLimitHit,
      canSendSmtp,
      shouldUsePopupFallback,
    };
  } catch (err) {
    console.error("[email-service] getQuotaStatus error:", err.message);
    return {
      strategy: "smart_auto",
      limit: 500,
      sent24h: 0,
      sentToday: 0,
      remaining: 500,
      isExceeded: false,
      googleLimitHit: false,
      canSendSmtp: true,
      shouldUsePopupFallback: false,
    };
  }
}

// =================================================================
// Live Preview Generator for Email Templates
// =================================================================
function previewEmail({ style = "luxury_gold", type = "auto_reply", company = null }) {
  const brandName = company?.company_name || "Omni Virtual Solutions";
  const emailAddr = company?.email || "admin@omnivirtualsolution.com";
  const sampleSubmission = {
    id: 101,
    full_name: "Alexander Vance",
    email: "alexander.vance@example.com",
    phone: "+1 (555) 789-0123",
    subject: "Full-Service Publishing & Executive VA Package",
    message: "Greetings, I am looking to contract a specialized team for full editorial evaluation, custom typesetting, and multi-channel book marketing for my upcoming release.",
    created_at: new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }),
    ip_address: "192.168.1.1",
  };

  const sampleSettings = {
    email_template_style: style,
    recipient_email: emailAddr,
    sender_name: brandName,
    sender_email: emailAddr,
  };

  if (type === "notification") {
    return buildNotificationHtml({
      submission: sampleSubmission,
      settings: sampleSettings,
      senderEmail: emailAddr,
      recipientEmail: emailAddr,
      isWebPreview: true,
      company,
    });
  } else if (type === "reply") {
    return buildReplyHtml({
      submission: sampleSubmission,
      settings: sampleSettings,
      fullBody: `Hello Alexander,\n\nThank you for reaching out to ${brandName}!\n\nWe have reviewed your project requirements and would be delighted to partner on your upcoming book release. Our senior consultant has prepared a customized publishing roadmap and timeline for your review.\n\nPlease let us know if you are available for a brief discovery session this Thursday at 2:00 PM EST.\n\nWarm regards,\n${brandName} Executive Team`,
      senderEmail: emailAddr,
      isWebPreview: true,
      company,
    });
  } else {
    // auto_reply
    return buildAutoReplyHtml({
      submission: sampleSubmission,
      settings: sampleSettings,
      bodyText: `Hello {customer_name}, thank you for contacting ${brandName}! We have received your inquiry and our team is already reviewing your details.`,
      senderEmail: emailAddr,
      isWebPreview: true,
      company,
    });
  }
}

module.exports = {
  sendEmailFailureAlert,
  getBusinessEmail,
  sendNewSubmissionNotification,
  sendAutoReply,
  sendReply,
  testSmtpConnection,
  processPendingSubmissions,
  clearTransporterCache,
  getEmailStats,
  getQuotaStatus,
  getSettings,
  interpolate,
  previewEmail,
  buildEmailShell,
};
