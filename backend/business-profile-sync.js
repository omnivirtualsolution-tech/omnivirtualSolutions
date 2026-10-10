// =================================================================
// backend/business-profile-sync.js — Universal Business Profile & Contact Synchronizer
// =================================================================
// Single Source of Truth for persistent business data:
//  - Company Name & Tagline
//  - Public Contact Email & Notification Email
//  - Phone Number
//  - Location & Address (Street, Suite, City/State/Zip)
//  - Operating Hours
//  - Copyright Notice
//
// When updated anywhere, this module synchronizes:
//  1. `company_profile` table
//  2. `email_settings` table (recipient_email, sender_email, sender_name)
//  3. `content_blocks` table (footer.email, services.cta.email, footer.phone, footer.address, footer.hq.caption, footer.copyright, site.name)
//  4. Real-time Server-Sent Events (SSE) broadcast to all open browser tabs,
//     visitors, and admin editors.
// =================================================================

const { db } = require("./db");
const { broadcast } = require("./routes/live");

const PROFILE_BLOCK_KEYS = [
  "footer.email",
  "services.cta.email",
  "company.email",
  "contact.email",
  "footer.phone",
  "company.phone",
  "footer.address",
  "company.address",
  "footer.hq.caption",
  "footer.copyright",
  "site.name",
  "company.name",
];

function isProfileKey(key) {
  if (!key) return false;
  const lower = String(key).toLowerCase().trim();
  return (
    PROFILE_BLOCK_KEYS.includes(lower) ||
    lower.endsWith(".email") ||
    lower.endsWith(".phone") ||
    lower.endsWith(".address") ||
    lower === "site.name" ||
    lower === "company.name"
  );
}

/**
 * Retrieve unified business profile from company_profile + email_settings + content_blocks
 */
async function getFullBusinessProfile() {
  try {
    const [compRes, emailSettingsRes, blocksRes] = await Promise.all([
      db.execute("SELECT * FROM company_profile ORDER BY id DESC LIMIT 1"),
      db.execute(
        "SELECT setting_key, setting_value FROM email_settings WHERE setting_key IN ('recipient_email', 'sender_email', 'sender_name')"
      ).catch(() => ({ rows: [] })),
      db.execute(
        "SELECT block_key, value FROM content_blocks WHERE block_key IN ('footer.email', 'services.cta.email', 'footer.phone', 'footer.address', 'footer.hq.caption', 'footer.copyright', 'site.name')"
      ).catch(() => ({ rows: [] })),
    ]);

    const company = compRes.rows && compRes.rows[0] ? compRes.rows[0] : {};
    const emailSettings = {};
    if (emailSettingsRes.rows) {
      emailSettingsRes.rows.forEach((r) => {
        emailSettings[r.setting_key] = r.setting_value;
      });
    }

    const blockMap = {};
    if (blocksRes.rows) {
      blocksRes.rows.forEach((r) => {
        blockMap[r.block_key] = r.value;
      });
    }

    const addressParts = [
      company.address_line1 || "1350 Ave of the Americas",
      company.address_line2 || "Fl 2 -1100",
      company.city_state_zip || "New York, NY 10019",
    ].filter(Boolean);

    const full_address = blockMap["footer.address"] || addressParts.join(", ");

    return {
      company_name: company.company_name || blockMap["site.name"] || emailSettings.sender_name || "Omni Virtual Solutions",
      tagline: company.tagline || "Empowering Individuals and Businesses",
      email: company.email || emailSettings.sender_email || blockMap["footer.email"] || "admin@omnivirtualsolution.com",
      recipient_email: emailSettings.recipient_email || company.email || "admin@omnivirtualsolution.com",
      phone: company.phone || blockMap["footer.phone"] || "+1 315-915-4799",
      address_line1: company.address_line1 || "1350 Ave of the Americas",
      address_line2: company.address_line2 || "Fl 2 -1100",
      city_state_zip: company.city_state_zip || "New York, NY 10019",
      full_address,
      hq_caption: blockMap["footer.hq.caption"] || "New York, NY",
      copyright_text: company.copyright_text || blockMap["footer.copyright"] || "© 2026 Omni Virtual Solutions. All Rights Reserved.",
      updated_at: company.updated_at || new Date().toISOString(),
    };
  } catch (err) {
    console.error("[business-profile-sync] Error reading profile:", err.message);
    return {
      company_name: "Omni Virtual Solutions",
      tagline: "Empowering Individuals and Businesses",
      email: "admin@omnivirtualsolution.com",
      recipient_email: "admin@omnivirtualsolution.com",
      phone: "+1 315-915-4799",
      address_line1: "1350 Ave of the Americas",
      address_line2: "Fl 2 -1100",
      city_state_zip: "New York, NY 10019",
      full_address: "1350 Ave of the Americas, Fl 2 -1100, New York, NY 10019",
      hq_caption: "New York, NY",
      copyright_text: "© 2026 Omni Virtual Solutions. All Rights Reserved.",
      updated_at: new Date().toISOString(),
    };
  }
}

/**
 * Universal update function: writes to company_profile, email_settings, content_blocks,
 * and pushes SSE real-time updates.
 */
async function updateBusinessProfile(data = {}, editor = "admin") {
  console.log(`[business-profile-sync] Updating universal business profile (by: ${editor})`);

  // 1. Fetch current profile to support non-destructive partial updates
  const current = await getFullBusinessProfile();

  const company_name = (data.company_name !== undefined && String(data.company_name).trim()) ? String(data.company_name).trim() : current.company_name;
  const tagline = (data.tagline !== undefined) ? String(data.tagline).trim() : current.tagline;
  const email = (data.email !== undefined && String(data.email).trim()) ? String(data.email).trim() : current.email;
  const recipient_email = (data.recipient_email !== undefined && String(data.recipient_email).trim())
    ? String(data.recipient_email).trim()
    : ((data.email !== undefined && String(data.email).trim()) ? email : current.recipient_email);
  const phone = (data.phone !== undefined && String(data.phone).trim()) ? String(data.phone).trim() : current.phone;
  const address_line1 = (data.address_line1 !== undefined) ? String(data.address_line1).trim() : current.address_line1;
  const address_line2 = (data.address_line2 !== undefined) ? String(data.address_line2).trim() : current.address_line2;
  const city_state_zip = (data.city_state_zip !== undefined) ? String(data.city_state_zip).trim() : current.city_state_zip;
  const hq_caption = (data.hq_caption !== undefined && String(data.hq_caption).trim()) ? String(data.hq_caption).trim() : current.hq_caption;
  const copyright_text = (data.copyright_text !== undefined && String(data.copyright_text).trim()) ? String(data.copyright_text).trim() : current.copyright_text;

  const addressTokens = [address_line1, address_line2, city_state_zip].filter(Boolean);
  const full_address = addressTokens.join(", ");

  // 2. Persist to company_profile table
  try {
    const check = await db.execute("SELECT id FROM company_profile ORDER BY id DESC LIMIT 1");
    if (check.rows && check.rows.length > 0) {
      await db.execute({
        sql: `UPDATE company_profile SET
                company_name = ?,
                tagline = ?,
                phone = ?,
                email = ?,
                address_line1 = ?,
                address_line2 = ?,
                city_state_zip = ?,
                copyright_text = ?,
                updated_at = CURRENT_TIMESTAMP
              WHERE id = ?`,
        args: [
          company_name,
          tagline,
          phone,
          email,
          address_line1,
          address_line2,
          city_state_zip,
          copyright_text,
          check.rows[0].id,
        ],
      });
    } else {
      await db.execute({
        sql: `INSERT INTO company_profile (company_name, tagline, phone, email, address_line1, address_line2, city_state_zip, copyright_text)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          company_name,
          tagline,
          phone,
          email,
          address_line1,
          address_line2,
          city_state_zip,
          copyright_text,
        ],
      });
    }
  } catch (err) {
    console.error("[business-profile-sync] Failed to update company_profile table:", err.message);
  }

  // 3. Persist to email_settings table (sender_name, sender_email, recipient_email)
  const emailSettingsToSync = [
    { key: "recipient_email", val: recipient_email },
    { key: "sender_email",    val: email },
    { key: "sender_name",     val: company_name },
  ];
  for (const s of emailSettingsToSync) {
    try {
      await db.execute({
        sql: `INSERT INTO email_settings (setting_key, setting_value, updated_by)
              VALUES (?, ?, ?)
              ON CONFLICT(setting_key) DO UPDATE SET
                setting_value = excluded.setting_value,
                updated_at = CURRENT_TIMESTAMP,
                updated_by = excluded.updated_by`,
        args: [s.key, s.val, editor],
      });
    } catch (err) {
      console.error(`[business-profile-sync] Error updating email_settings ${s.key}:`, err.message);
    }
  }

  // 4. Persist to content_blocks table for website & editor synchronicity
  const blockUpdates = [
    { key: "footer.email",       val: email,          label: "Footer — Email" },
    { key: "services.cta.email", val: email,          label: "Services CTA — Email" },
    { key: "footer.phone",       val: phone,          label: "Footer — Phone Number" },
    { key: "footer.address",     val: full_address,   label: "Footer — Address" },
    { key: "footer.hq.caption",  val: hq_caption,     label: "Footer — HQ Caption" },
    { key: "footer.copyright",   val: copyright_text, label: "Footer — Copyright Notice" },
    { key: "site.name",          val: company_name,   label: "Website Brand Name" },
  ];

  for (const b of blockUpdates) {
    try {
      await db.execute({
        sql: `INSERT INTO content_blocks (block_key, block_type, label, value, updated_by)
              VALUES (?, 'text', ?, ?, ?)
              ON CONFLICT(block_key) DO UPDATE SET
                value = excluded.value,
                updated_at = CURRENT_TIMESTAMP,
                updated_by = excluded.updated_by`,
        args: [b.key, b.label, b.val, editor],
      });

      broadcast({
        key: b.key,
        value: b.val,
        blockType: "text",
        updatedBy: editor,
        table: "content_blocks",
      });

      broadcast({
        type: "cms_block_updated",
        key: b.key,
        value: b.val,
        updatedBy: editor,
      });
    } catch (err) {
      console.error(`[business-profile-sync] Error syncing block ${b.key}:`, err.message);
    }
  }

  // 4b. Synchronize services table cta_email column
  try {
    await db.execute({
      sql: "UPDATE services SET cta_email = ?",
      args: [email],
    });
  } catch (err) {
    console.warn("[business-profile-sync] Notice updating services cta_email:", err.message);
  }

  // 4c. Invalidate Nodemailer transporter cache on email changes
  try {
    const emailSvc = require("./email-service");
    if (typeof emailSvc.clearTransporterCache === "function") {
      emailSvc.clearTransporterCache();
    }
  } catch (_) {}

  const updatedProfile = {
    company_name,
    tagline,
    email,
    recipient_email,
    phone,
    address_line1,
    address_line2,
    city_state_zip,
    full_address,
    hq_caption,
    copyright_text,
    updated_at: new Date().toISOString(),
  };

  // 5. Broadcast global profile events
  broadcast({
    type: "business_profile_updated",
    profile: updatedProfile,
    company: updatedProfile,
    timestamp: new Date().toISOString(),
  });

  broadcast({
    type: "company_updated",
    company: updatedProfile,
    timestamp: new Date().toISOString(),
  });

  broadcast({
    type: "email_settings_updated",
    recipient_email,
    sender_email: email,
    sender_name: company_name,
    timestamp: new Date().toISOString(),
  });

  console.log(`[business-profile-sync] Business profile successfully synchronized site-wide.`);
  return updatedProfile;
}

module.exports = {
  getFullBusinessProfile,
  updateBusinessProfile,
  isProfileKey,
  PROFILE_BLOCK_KEYS,
};
