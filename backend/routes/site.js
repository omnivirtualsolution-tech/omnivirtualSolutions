// =================================================================
// backend/routes/site.js  —  /api/v1/site-meta
// =================================================================
// Returns company profile, stats, media assets, and showcase books
// in one response — powers the homepage without multiple round-trips.
// =================================================================

const express = require("express");
const router  = express.Router();
const { db }  = require("../db");

// GET /api/v1/site-meta
// Returns everything the homepage needs: company info, stats, books, hero images
router.get("/", async (req, res) => {
  try {
    const [companyResult, statsResult, booksResult, assetsResult, blocksResult, emailSettingResult] = await Promise.all([
      db.execute("SELECT * FROM company_profile ORDER BY id DESC LIMIT 1"),
      db.execute("SELECT stat_key, stat_value, stat_label FROM company_stats ORDER BY display_order"),
      db.execute(`
        SELECT sb.id, sb.title, sb.author, sb.display_order, sb.is_active,
               ma.file_path AS image_path, ma.alt_text AS image_alt
        FROM showcase_books sb
        LEFT JOIN media_assets ma ON sb.image_asset_id = ma.id
        WHERE sb.is_active = 1
        ORDER BY sb.display_order
      `),
      db.execute("SELECT asset_key, file_path, alt_text, category FROM media_assets ORDER BY category"),
      db.execute("SELECT block_key, block_type, value FROM content_blocks"),
      db.execute("SELECT setting_value FROM email_settings WHERE setting_key = 'recipient_email' LIMIT 1").catch(() => ({ rows: [] })),
    ]);

    const blockMap = {};
    for (const b of blocksResult.rows) {
      blockMap[b.block_key] = b.value;
    }

    const company = companyResult.rows[0] ? { ...companyResult.rows[0] } : {};
    const configuredEmail = emailSettingResult.rows[0]?.setting_value?.trim();
    const activeEmail = company.email || configuredEmail || blockMap['services.cta.email'] || blockMap['footer.email'] || "admin@omnivirtualsolution.com";
    company.recipient_email = configuredEmail || activeEmail;
    company.email = activeEmail;
    blockMap['services.cta.email'] = activeEmail;
    blockMap['footer.email'] = activeEmail;

    if (company.phone) {
      blockMap['footer.phone'] = company.phone;
    } else if (blockMap['footer.phone']) {
      company.phone = blockMap['footer.phone'];
    }

    const addressParts = [
      company.address_line1,
      company.address_line2,
      company.city_state_zip
    ].filter(Boolean);
    const computedAddress = addressParts.length > 0 ? addressParts.join(', ') : null;
    company.full_address = computedAddress || blockMap['footer.address'] || "1350 Ave of the Americas, Fl 2 -1100, New York, NY 10019";
    blockMap['footer.address'] = company.full_address;

    if (company.company_name) {
      blockMap['site.name'] = company.company_name;
    }
    if (company.tagline) {
      blockMap['site.tagline'] = company.tagline;
    }
    if (company.copyright_text) {
      blockMap['footer.copyright'] = company.copyright_text;
    }

    res.set("Cache-Control", "no-cache, no-store, must-revalidate");
    res.json({
      company,
      recipient_email: configuredEmail || company.email || null,
      stats:          statsResult.rows,
      showcase_books:  booksResult.rows,
      media_assets:   assetsResult.rows,
      blocks:         blocksResult.rows,
      blockMap,
    });
  } catch (err) {
    console.error("[site-meta] Error:", err.message);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to load site meta." } });
  }
});

module.exports = router;
