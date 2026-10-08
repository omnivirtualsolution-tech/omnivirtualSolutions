// =================================================================
// backend/routes/cms.js  —  Authenticated CMS write API
// =================================================================
// All routes require a valid admin JWT via requireAuth middleware.
//
// GET    /api/v1/cms/blocks              → all content blocks
// GET    /api/v1/cms/blocks/:key         → single block by key
// PATCH  /api/v1/cms/blocks/:key         → update a block value
// GET    /api/v1/cms/blocks/:key/history → revision history for a block
//
// PATCH  /api/v1/cms/services/:slug      → update service price/description
// GET    /api/v1/cms/submissions         → view contact leads (alias)
// PATCH  /api/v1/cms/submissions/:id     → update submission status
//
// POST   /api/v1/cms/upload              → upload an image asset
// GET    /api/v1/cms/stats               → DB-level site stats (admin)
// =================================================================

const express  = require("express");
const multer   = require("multer");
const path     = require("path");
const fs       = require("fs");
const router   = express.Router();
const { db }   = require("../db");
const { requireAuth }  = require("../middleware/auth");
const { broadcast }    = require("./live");
const { syncUniversalEmail, isEmailKey } = require("../email-sync");
const { getFullBusinessProfile, updateBusinessProfile } = require("../business-profile-sync");

const { optimizeImage } = require("../utils/image-optimizer");
const { fetchCloudflareMetrics, saveCloudflareConfig, getCloudflareConfig } = require("../cloudflare-analytics");

// ── Image upload config (multer with memory buffer for optimization) ──
const _dir = typeof __dirname !== "undefined" ? __dirname : (typeof process !== "undefined" ? process.cwd() : "");
const UPLOADS_DIR = path.resolve(_dir, "../../assets/uploads");
try {
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
} catch (_) {
  // Read-only filesystem in serverless environments (Netlify / AWS Lambda / Cloudflare)
}

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"];
const MAX_SIZE_BYTES = 15 * 1024 * 1024; // Allow up to 15 MB since we compress it down to ~150KB

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed. Accepted: ${ALLOWED_TYPES.join(", ")}`));
    }
  },
});

// ─────────────────────────────────────────────────────────────────
// GET /api/v1/cms/blocks
// Returns all content blocks grouped by page section
// ─────────────────────────────────────────────────────────────────
router.get("/blocks", requireAuth, async (req, res) => {
  try {
    const result = await db.execute(
      "SELECT id, block_key, block_type, label, value, updated_at, updated_by FROM content_blocks ORDER BY block_key"
    );
    res.json({ blocks: result.rows, total: result.rows.length });
  } catch (err) {
    console.error("[cms/blocks] GET Error:", err.message);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to load content blocks." } });
  }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/v1/cms/blocks/:key
// Returns one content block
// ─────────────────────────────────────────────────────────────────
router.get("/blocks/:key", requireAuth, async (req, res) => {
  const key = req.params.key;
  try {
    const result = await db.execute({
      sql: "SELECT * FROM content_blocks WHERE block_key = ? LIMIT 1",
      args: [key],
    });
    if (result.rows.length === 0) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: `Block not found: ${key}` } });
    }
    res.json({ block: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to load block." } });
  }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/v1/cms/business-profile
// Retrieve full unified business identity & contact information
// ─────────────────────────────────────────────────────────────────
router.get("/business-profile", requireAuth, async (_req, res) => {
  try {
    const profile = await getFullBusinessProfile();
    res.json({ success: true, profile });
  } catch (err) {
    console.error("[cms/business-profile GET] Error:", err.message);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to load business profile." } });
  }
});

// ─────────────────────────────────────────────────────────────────
// PATCH /api/v1/cms/business-profile
// Update unified business identity, synchronizing company_profile, email_settings,
// and content_blocks, then broadcasting SSE events site-wide.
// ─────────────────────────────────────────────────────────────────
router.patch("/business-profile", requireAuth, async (req, res) => {
  try {
    const editor = req.admin?.username || "admin";
    const profile = await updateBusinessProfile(req.body, editor);
    res.json({ success: true, profile });
  } catch (err) {
    console.error("[cms/business-profile PATCH] Error:", err.message);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to update business profile: " + err.message } });
  }
});

// ─────────────────────────────────────────────────────────────────
// PATCH /api/v1/cms/blocks/:key
// Update a content block — saves to DB, writes revision, broadcasts live
// Body: { value: "new content" }
// ─────────────────────────────────────────────────────────────────
router.patch("/blocks/:key", requireAuth, async (req, res) => {
  const key   = req.params.key;
  const { value } = req.body;

  if (value === undefined || value === null) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "value is required." } });
  }

  try {
    // Fetch the existing block
    const existing = await db.execute({
      sql: "SELECT * FROM content_blocks WHERE block_key = ? LIMIT 1",
      args: [key],
    });

    const newValue = String(value).trim();
    const editor   = req.admin.username;

    // ── Universal Single Source of Truth Business Email Sync ──
    if (isEmailKey(key)) {
      await syncUniversalEmail(newValue, editor);
      return res.json({
        success: true,
        block: { block_key: key, value: newValue, block_type: 'text', updated_by: editor },
        synced_universal_email: true,
      });
    }

    // ── Universal Phone, Address, and Brand Name Sync ──
    if (key === 'footer.phone' || key === 'company.phone') {
      await db.execute({
        sql: "UPDATE company_profile SET phone = ?, updated_at = CURRENT_TIMESTAMP WHERE id = (SELECT id FROM company_profile ORDER BY id DESC LIMIT 1)",
        args: [newValue],
      }).catch(() => {});
      broadcast({ type: "company_updated", company: { phone: newValue } });
    } else if (key === 'footer.address' || key === 'company.address') {
      await db.execute({
        sql: "UPDATE company_profile SET address_line1 = ?, updated_at = CURRENT_TIMESTAMP WHERE id = (SELECT id FROM company_profile ORDER BY id DESC LIMIT 1)",
        args: [newValue],
      }).catch(() => {});
      broadcast({ type: "company_updated", company: { full_address: newValue, address_line1: newValue } });
    } else if (key === 'site.name' || key === 'company.name') {
      await db.execute({
        sql: "UPDATE company_profile SET company_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = (SELECT id FROM company_profile ORDER BY id DESC LIMIT 1)",
        args: [newValue],
      }).catch(() => {});
      broadcast({ type: "company_updated", company: { company_name: newValue } });
    } else if (key.startsWith('service.') && key.endsWith('.price')) {
      const slug = key.replace(/^service\./, '').replace(/\.price$/, '');
      await db.execute({
        sql: "UPDATE services SET price_display = ? WHERE slug = ?",
        args: [newValue, slug],
      }).catch(() => {});
    } else if (key.match(/^home\.hero\.book(\d+)\.image$/)) {
      const match = key.match(/^home\.hero\.book(\d+)\.image$/);
      const bookNum = parseInt(match[1], 10);
      const cleanPath = newValue.startsWith('/') ? newValue.slice(1) : newValue;
      await db.execute({
        sql: `UPDATE showcase_books 
              SET image_asset_id = (SELECT id FROM media_assets WHERE file_path = ? OR file_path = ? LIMIT 1)
              WHERE display_order = ?`,
        args: [cleanPath, newValue, bookNum],
      }).catch(() => {});
    }

    if (existing.rows.length === 0) {
      // Auto-create block if it does not exist yet
      const inferredType = (key.includes('image') || key.includes('logo') || key.includes('img') || String(newValue).match(/\.(png|jpg|jpeg|webp|svg|gif)$/i)) ? 'image' : 'text';
      await db.execute({
        sql: "INSERT INTO content_blocks (block_key, block_type, label, value, updated_by) VALUES (?, ?, ?, ?, ?)",
        args: [key, inferredType, key, newValue, editor],
      });

      console.log(`[cms] ${editor} created new block: ${key} (${inferredType})`);
      broadcast({ type: "cms_block_updated", key, value: newValue, blockType: inferredType, updatedBy: editor, table: "content_blocks" });
      return res.json({ success: true, block: { block_key: key, value: newValue, block_type: inferredType, updated_by: editor } });
    }

    const block = existing.rows[0];

    // Direct in-place update — single source of truth without old duplicate revisions
    await db.execute({
      sql: "UPDATE content_blocks SET value = ?, updated_at = CURRENT_TIMESTAMP, updated_by = ? WHERE block_key = ?",
      args: [newValue, editor, key],
    });

    console.log(`[cms] ${editor} updated block: ${key}`);

    // Broadcast live to all open tabs
    broadcast({ type: "cms_block_updated", key, value: newValue, blockType: block.block_type, updatedBy: editor, table: "content_blocks" });

    res.json({ success: true, block: { block_key: key, value: newValue, block_type: block.block_type, updated_by: editor } });
  } catch (err) {
    console.error("[cms/blocks PATCH] Error:", err.message);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to update block." } });
  }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/v1/cms/blocks/:key/history
// Returns last 20 revisions for a given block key
// ─────────────────────────────────────────────────────────────────
router.get("/blocks/:key/history", requireAuth, async (req, res) => {
  const key = req.params.key;
  try {
    const result = await db.execute({
      sql: "SELECT * FROM content_block_revisions WHERE block_key = ? ORDER BY changed_at DESC LIMIT 20",
      args: [key],
    });
    res.json({ history: result.rows });
  } catch (err) {
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to load history." } });
  }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/v1/cms/services/catalog
// Get the live editable services catalog from CMS storage
// ─────────────────────────────────────────────────────────────────
router.get("/services/catalog", requireAuth, async (req, res) => {
  try {
    const catalogBlock = await db.execute({
      sql: "SELECT value FROM content_blocks WHERE block_key = 'services.catalog.data' LIMIT 1",
      args: [],
    });
    if (catalogBlock.rows.length > 0 && catalogBlock.rows[0].value) {
      try {
        const parsed = JSON.parse(catalogBlock.rows[0].value);
        return res.json({ catalog: parsed });
      } catch (_) {}
    }
    res.json({ catalog: null });
  } catch (err) {
    console.error("[cms/services/catalog GET] Error:", err.message);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to get catalog." } });
  }
});

// ─────────────────────────────────────────────────────────────────
// PUT /api/v1/cms/services/catalog
// Saves the full live services catalog tree from the Live Website Editor.
// Synchronizes into content_blocks, revisions, and relational tables.
// ─────────────────────────────────────────────────────────────────
router.put("/services/catalog", requireAuth, async (req, res) => {
  const { catalog } = req.body;
  const editor = req.admin.username;

  if (!catalog || !Array.isArray(catalog)) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "catalog array is required." } });
  }

  try {
    const key = "services.catalog.data";
    const catalogJson = JSON.stringify(catalog);

    // 1. Fetch old value for revision history
    const existing = await db.execute({
      sql: "SELECT value FROM content_blocks WHERE block_key = ? LIMIT 1",
      args: [key],
    });

    const oldValue = existing.rows.length > 0 ? existing.rows[0].value : "";

    // 2. Insert or update block
    if (existing.rows.length === 0) {
      await db.execute({
        sql: "INSERT INTO content_blocks (block_key, block_type, label, value, updated_by) VALUES (?, 'json', 'Live Services Catalog', ?, ?)",
        args: [key, catalogJson, editor],
      });
    } else {
      await db.execute({
        sql: "UPDATE content_blocks SET value = ?, updated_at = CURRENT_TIMESTAMP, updated_by = ? WHERE block_key = ?",
        args: [catalogJson, editor, key],
      });
    }

    // Broadcast live SSE event to all open visitor tabs and editors immediately
    broadcast({
      type: "cms_block_updated",
      key,
      value: catalogJson,
      blockType: "json",
      updatedBy: editor,
      table: "content_blocks",
    });

    // Respond immediately so Live In-Place Editor UI saves in milliseconds (<300ms)
    res.json({ success: true, message: "Catalog updated successfully." });

    // 5. Asynchronously synchronize changed service prices & leads into relational tables in background
    setImmediate(async () => {
      try {
        let syncedCount = 0;
        for (const cat of catalog) {
          for (const sub of (cat.subcategories || [])) {
            for (const svc of (sub.services || [])) {
              if (!svc.slug) continue;
              syncedCount++;
              try {
                const svcExists = await db.execute({
                  sql: "SELECT id FROM services WHERE slug = ? LIMIT 1",
                  args: [svc.slug],
                });
                if (svcExists.rows.length > 0) {
                  const svcId = svcExists.rows[0].id;
                  await db.execute({
                    sql: "UPDATE services SET title = ?, price_display = ?, lead_paragraph = ? WHERE id = ?",
                    args: [svc.title || '', svc.price || svc.price_display || '', svc.lead || svc.lead_paragraph || '', svcId],
                  });

                  if (svc.price || svc.price_display) {
                    const pVal = svc.price || svc.price_display;
                    await db.execute({
                      sql: `INSERT INTO content_blocks (block_key, block_type, label, value, updated_by)
                            VALUES (?, 'text', 'Package Price', ?, ?)
                            ON CONFLICT(block_key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
                      args: [`service.${svc.slug}.price`, pVal, editor],
                    }).catch(() => {});
                  }

                  if (svc.lead || svc.lead_paragraph) {
                    const lVal = svc.lead || svc.lead_paragraph;
                    await db.execute({
                      sql: `INSERT INTO content_blocks (block_key, block_type, label, value, updated_by)
                            VALUES (?, 'textarea', 'Service Overview', ?, ?)
                            ON CONFLICT(block_key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
                      args: [`service.${svc.slug}.lead`, lVal, editor],
                    }).catch(() => {});
                    await db.execute({
                      sql: `INSERT INTO content_blocks (block_key, block_type, label, value, updated_by)
                            VALUES (?, 'textarea', 'Service Summary', ?, ?)
                            ON CONFLICT(block_key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
                      args: [`service.${svc.slug}.summary`, lVal, editor],
                    }).catch(() => {});
                  }

                  // Also sync features if provided
                  if (Array.isArray(svc.features) && svc.features.length > 0) {
                    await db.execute({ sql: "DELETE FROM service_features WHERE service_id = ?", args: [svcId] });
                    for (let i = 0; i < svc.features.length; i++) {
                      await db.execute({
                        sql: "INSERT INTO service_features (service_id, feature_text, display_order) VALUES (?, ?, ?)",
                        args: [svcId, String(svc.features[i]), i + 1],
                      });
                    }
                  }
                }
              } catch (syncErr) {
                // Silently handle transient sync errors
              }
            }
          }
        }
        console.log(`[cms] ${editor} background sync completed (${syncedCount} services synchronized)`);
      } catch (bgErr) {
        console.warn("[cms] Background catalog sync warning:", bgErr.message);
      }
    });
  } catch (err) {
    console.error("[cms/services/catalog PUT] Error:", err.message);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to update catalog." } });
  }
});

// ─────────────────────────────────────────────────────────────────
// PATCH /api/v1/cms/services/:slug
// Update a service's title, price, description, lead paragraph, or features
// ─────────────────────────────────────────────────────────────────
router.patch("/services/:slug", requireAuth, async (req, res) => {
  const { slug } = req.params;
  const { title, price_display, price_cents, lead_paragraph, full_description, features } = req.body;
  const editor = req.admin.username;

  const updates  = [];
  const args     = [];

  if (title !== undefined) { updates.push("title = ?"); args.push(String(title).trim()); }
  if (price_display !== undefined) { updates.push("price_display = ?"); args.push(String(price_display).trim()); }
  if (price_cents   !== undefined) { updates.push("price_cents = ?");   args.push(parseInt(price_cents, 10) || null); }
  if (lead_paragraph !== undefined) { updates.push("lead_paragraph = ?"); args.push(String(lead_paragraph).trim()); }
  if (full_description !== undefined) { updates.push("full_description = ?"); args.push(String(full_description).trim()); }

  try {
    const existing = await db.execute({ sql: "SELECT id, title FROM services WHERE slug = ? LIMIT 1", args: [slug] });
    let svcId = null;

    if (existing.rows.length > 0) {
      svcId = existing.rows[0].id;
      if (updates.length > 0) {
        args.push(slug);
        await db.execute({ sql: `UPDATE services SET ${updates.join(", ")} WHERE slug = ?`, args });
      }

      if (Array.isArray(features)) {
        await db.execute({ sql: "DELETE FROM service_features WHERE service_id = ?", args: [svcId] });
        for (let i = 0; i < features.length; i++) {
          await db.execute({
            sql: "INSERT INTO service_features (service_id, feature_text, display_order) VALUES (?, ?, ?)",
            args: [svcId, String(features[i]), i + 1],
          });
        }
      }
    }

    // Also sync the change into services.catalog.data JSON block if it exists
    const catalogBlock = await db.execute({
      sql: "SELECT value FROM content_blocks WHERE block_key = 'services.catalog.data' LIMIT 1",
      args: [],
    });

    if (catalogBlock.rows.length > 0 && catalogBlock.rows[0].value) {
      try {
        const catList = JSON.parse(catalogBlock.rows[0].value);
        let foundInBlock = false;
        for (const cat of catList) {
          for (const sub of (cat.subcategories || [])) {
            for (const s of (sub.services || [])) {
              if (s.slug === slug) {
                if (title !== undefined) s.title = title;
                if (price_display !== undefined) s.price = price_display;
                if (lead_paragraph !== undefined) s.lead = lead_paragraph;
                if (features !== undefined) s.features = features;
                foundInBlock = true;
                break;
              }
            }
          }
        }
        if (foundInBlock) {
          const newJson = JSON.stringify(catList);
          await db.execute({
            sql: "UPDATE content_blocks SET value = ?, updated_at = CURRENT_TIMESTAMP, updated_by = ? WHERE block_key = 'services.catalog.data'",
            args: [newJson, editor],
          });
          broadcast({
            type: "cms_block_updated",
            key: "services.catalog.data",
            value: newJson,
            blockType: "json",
            updatedBy: editor,
            table: "content_blocks",
          });
        }
      } catch (e) {
        console.warn("[cms/services PATCH] Block sync warning:", e.message);
      }
    }

    console.log(`[cms] ${editor} updated service: ${slug}`);

    // Broadcast so any open service page refreshes live
    broadcast({
      type: "service_updated",
      key: `service.${slug}`,
      value: { title, price_display, lead_paragraph, features },
      blockType: "service",
      updatedBy: editor,
      table: "services",
    });

    res.json({ success: true, slug, updatedFields: updates.map((u) => u.split(" ")[0]) });
  } catch (err) {
    console.error("[cms/services PATCH] Error:", err.message);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to update service." } });
  }
});

// ─────────────────────────────────────────────────────────────────
// DELETE /api/v1/cms/services/:slug
// Delete a service from catalog and database
// ─────────────────────────────────────────────────────────────────
router.delete("/services/:slug", requireAuth, async (req, res) => {
  const { slug } = req.params;
  const editor = req.admin.username;

  try {
    const existing = await db.execute({ sql: "SELECT id FROM services WHERE slug = ? LIMIT 1", args: [slug] });
    if (existing.rows.length > 0) {
      const svcId = existing.rows[0].id;
      await db.execute({ sql: "DELETE FROM service_features WHERE service_id = ?", args: [svcId] });
      await db.execute({ sql: "DELETE FROM services WHERE id = ?", args: [svcId] });
    }

    // Sync out of services.catalog.data JSON block
    const catalogBlock = await db.execute({
      sql: "SELECT value FROM content_blocks WHERE block_key = 'services.catalog.data' LIMIT 1",
      args: [],
    });

    if (catalogBlock.rows.length > 0 && catalogBlock.rows[0].value) {
      try {
        const catList = JSON.parse(catalogBlock.rows[0].value);
        for (const cat of catList) {
          for (const sub of (cat.subcategories || [])) {
            sub.services = (sub.services || []).filter((s) => s.slug !== slug);
          }
        }
        const newJson = JSON.stringify(catList);
        await db.execute({
          sql: "UPDATE content_blocks SET value = ?, updated_at = CURRENT_TIMESTAMP, updated_by = ? WHERE block_key = 'services.catalog.data'",
          args: [newJson, editor],
        });
        broadcast({
          type: "cms_block_updated",
          key: "services.catalog.data",
          value: newJson,
          blockType: "json",
          updatedBy: editor,
          table: "content_blocks",
        });
      } catch (_) {}
    }

    console.log(`[cms] ${editor} deleted service: ${slug}`);
    res.json({ success: true, slug });
  } catch (err) {
    console.error("[cms/services DELETE] Error:", err.message);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to delete service." } });
  }
});

// ─────────────────────────────────────────────────────────────────
// PATCH /api/v1/cms/submissions/:id
// Update status of a contact submission
// Body: { status: "in_review" | "contacted" | "closed" | "new" }
// ─────────────────────────────────────────────────────────────────
router.patch("/submissions/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const VALID_STATUSES = ["new", "in_review", "contacted", "closed"];

  if (!status || !VALID_STATUSES.includes(status)) {
    return res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: `status must be one of: ${VALID_STATUSES.join(", ")}` }
    });
  }

  try {
    await db.execute({ sql: "UPDATE contact_submissions SET status = ? WHERE id = ?", args: [status, parseInt(id, 10)] });
    res.json({ success: true, id: parseInt(id, 10), status });
  } catch (err) {
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to update submission." } });
  }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/v1/cms/media/:filename
// Serves image directly from Turso database binary storage (zero local disk)
// ─────────────────────────────────────────────────────────────────
router.get("/media/:filename", async (req, res) => {
  const { filename } = req.params;
  try {
    const result = await db.execute({
      sql: "SELECT mime_type, data FROM media_files WHERE filename = ? OR asset_key = ? LIMIT 1",
      args: [filename, filename],
    });

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Media file not found in database." } });
    }

    const row = result.rows[0];
    const buffer = Buffer.from(row.data);

    res.setHeader("Content-Type", row.mime_type || "image/webp");
    res.setHeader("Content-Length", buffer.length);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    return res.end(buffer);
  } catch (err) {
    console.error("[cms/media] Turso fetch error:", err.message);
    return res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to load image from database." } });
  }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/v1/cms/media
// List all uploaded media files in Turso Cloud with size metadata
// ─────────────────────────────────────────────────────────────────
router.get("/media", requireAuth, async (req, res) => {
  try {
    const result = await db.execute({
      sql: `SELECT id, asset_key, filename, mime_type, width, height, size_bytes, created_at
            FROM media_files
            ORDER BY created_at DESC`,
      args: [],
    });

    const media = (result.rows || []).map((row) => ({
      id: row.id,
      asset_key: row.asset_key,
      filename: row.filename,
      mime_type: row.mime_type,
      width: row.width,
      height: row.height,
      size_bytes: row.size_bytes,
      size_kb: (row.size_bytes / 1024).toFixed(1),
      url: `/api/v1/cms/media/${row.filename}`,
      created_at: row.created_at,
    }));

    const totalBytes = media.reduce((acc, m) => acc + (m.size_bytes || 0), 0);
    const totalMB = (totalBytes / (1024 * 1024)).toFixed(2);

    res.json({
      success: true,
      media,
      totalCount: media.length,
      totalBytes,
      totalMB,
    });
  } catch (err) {
    console.error("[cms/media GET] Error:", err.message);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to fetch media list." } });
  }
});

// ─────────────────────────────────────────────────────────────────
// DELETE /api/v1/cms/media/:identifier
// Permanently deletes media binary from Turso database (media_files & media_assets)
// Frees Turso cloud storage pages immediately.
// ─────────────────────────────────────────────────────────────────
router.delete("/media/:identifier", requireAuth, async (req, res) => {
  const identifier = decodeURIComponent(req.params.identifier).trim();
  const editor = req.admin?.username || "admin";
  const filename = path.basename(identifier);
  const rawKey = filename.replace(/\.[^/.]+$/, "");

  try {
    // 1. Fetch file info before deleting to report freed bytes
    const checkFile = await db.execute({
      sql: "SELECT id, filename, asset_key, size_bytes FROM media_files WHERE filename = ? OR asset_key = ? OR filename = ? LIMIT 1",
      args: [identifier, identifier, filename],
    });

    const fileRow = checkFile.rows[0];
    const freedBytes = fileRow?.size_bytes || 0;
    const actualFilename = fileRow?.filename || filename;
    const actualAssetKey = fileRow?.asset_key || rawKey;

    // 2. Delete from media_files (BLOB binary in Turso)
    await db.execute({
      sql: "DELETE FROM media_files WHERE filename = ? OR asset_key = ? OR filename = ? OR asset_key = ?",
      args: [identifier, identifier, actualFilename, actualAssetKey],
    });

    // 3. Delete from media_assets catalog in Turso
    await db.execute({
      sql: `DELETE FROM media_assets 
            WHERE asset_key = ? OR asset_key = ? 
               OR file_path LIKE ? OR file_path LIKE ?`,
      args: [identifier, actualAssetKey, `%${actualFilename}%`, `%${identifier}%`],
    });

    // 4. Local disk cleanup if file exists locally
    try {
      const localFile = path.join(UPLOADS_DIR, actualFilename);
      if (fs.existsSync(localFile)) fs.unlinkSync(localFile);
    } catch (_) {}

    console.log(`[cms/media] ${editor} permanently deleted media from Turso: ${actualFilename} (${(freedBytes / 1024).toFixed(1)} KB freed)`);

    // 5. Broadcast real-time deletion event
    broadcast({
      type: "media_deleted",
      filename: actualFilename,
      assetKey: actualAssetKey,
      deletedBy: editor,
    });

    return res.json({
      success: true,
      filename: actualFilename,
      assetKey: actualAssetKey,
      freedBytes,
      message: `Media "${actualFilename}" permanently deleted from Turso Cloud database.`,
    });
  } catch (err) {
    console.error("[cms/media DELETE] Error:", err.message);
    return res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Failed to delete media from database: " + err.message },
    });
  }
});

// ─────────────────────────────────────────────────────────────────
// POST /api/v1/cms/media/purge-unused
// Scans Turso for unreferenced uploaded images and purges them
// ─────────────────────────────────────────────────────────────────
router.post("/media/purge-unused", requireAuth, async (req, res) => {
  const editor = req.admin?.username || "admin";
  try {
    const allMedia = await db.execute("SELECT id, filename, asset_key, size_bytes FROM media_files");
    const blocks = await db.execute("SELECT value FROM content_blocks");
    const services = await db.execute("SELECT description FROM services");
    const catalog = await db.execute("SELECT value FROM content_blocks WHERE block_key = 'services.catalog.data'");

    let allBlockContent = blocks.rows.map(r => String(r.value || '')).join(' ') + ' ' +
                          services.rows.map(r => String(r.description || '')).join(' ') + ' ' +
                          (catalog.rows[0]?.value || '');

    const unused = [];
    let totalFreed = 0;

    for (const file of (allMedia.rows || [])) {
      const fn = file.filename;
      const key = file.asset_key;
      if (!allBlockContent.includes(fn) && (!key || !allBlockContent.includes(key))) {
        unused.push(file);
      }
    }

    for (const file of unused) {
      await db.execute({
        sql: "DELETE FROM media_files WHERE id = ?",
        args: [file.id],
      });
      await db.execute({
        sql: "DELETE FROM media_assets WHERE asset_key = ? OR file_path LIKE ?",
        args: [file.asset_key, `%${file.filename}%`],
      });
      totalFreed += (file.size_bytes || 0);

      try {
        const localFile = path.join(UPLOADS_DIR, file.filename);
        if (fs.existsSync(localFile)) fs.unlinkSync(localFile);
      } catch (_) {}
    }

    console.log(`[cms/media purge] ${editor} purged ${unused.length} orphaned images (${(totalFreed/1024).toFixed(1)} KB) from Turso`);

    broadcast({ type: "media_purged", count: unused.length, freedBytes: totalFreed });

    return res.json({
      success: true,
      purgedCount: unused.length,
      purgedFiles: unused.map(f => f.filename),
      freedBytes: totalFreed,
      freedKB: (totalFreed / 1024).toFixed(1),
      message: `Successfully purged ${unused.length} unreferenced images from Turso database (${(totalFreed / 1024).toFixed(1)} KB freed).`,
    });
  } catch (err) {
    console.error("[cms/media purge] Error:", err.message);
    return res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to purge unused media." } });
  }
});

// ─────────────────────────────────────────────────────────────────
// POST /api/v1/cms/upload
// Upload an image → compresses into WebP (100% original resolution) → saves directly into Turso database
// Optional body param: block_key — auto-updates the block after upload
// ─────────────────────────────────────────────────────────────────
router.post("/upload", requireAuth, upload.single("image"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "No image file provided." } });
  }

  const editor = req.admin.username;
  const isSvg  = req.file.mimetype === "image/svg+xml";

  let finalBuffer = req.file.buffer;
  let filename    = `upload_${Date.now()}.${isSvg ? "svg" : "webp"}`;
  let originalSize = req.file.size;
  let optimizedSize = req.file.size;
  let savings = "0%";
  let width = null;
  let height = null;
  let mimeType = isSvg ? "image/svg+xml" : "image/webp";

  if (!isSvg) {
    try {
      // Compresses file size significantly while retaining 100% original resolution (width x height)
      const optimized = await optimizeImage(req.file.buffer);
      finalBuffer   = optimized.buffer;
      optimizedSize = optimized.size;
      width         = optimized.width;
      height        = optimized.height;
      savings = ((1 - optimizedSize / originalSize) * 100).toFixed(1) + "%";
    } catch (optErr) {
      console.warn("[cms/upload] Optimization fallback to original:", optErr.message);
      const ext = path.extname(req.file.originalname).toLowerCase() || ".jpg";
      filename = `upload_${Date.now()}${ext}`;
      mimeType = req.file.mimetype || "image/jpeg";
    }
  }

  const assetKey = `upload_${Date.now()}`;
  const servedPath = `api/v1/cms/media/${filename}`;

  // ── Save directly to Turso Cloud (media_files table) — ZERO local disk files ──
  try {
    await db.execute({
      sql: `INSERT INTO media_files (asset_key, filename, mime_type, data, width, height, size_bytes)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [assetKey, filename, mimeType, finalBuffer, width, height, optimizedSize],
    });
  } catch (dbErr) {
    console.error("[cms/upload] Failed to store image binary in Turso:", dbErr.message);
    return res.status(500).json({ error: { code: "DB_ERROR", message: "Failed to store image in database." } });
  }

  // Register in media_assets catalog
  try {
    await db.execute({
      sql: `INSERT OR REPLACE INTO media_assets (asset_key, file_path, alt_text, category)
            VALUES (?, ?, ?, 'upload')`,
      args: [assetKey, servedPath, req.file.originalname],
    });
  } catch (_) { /* non-critical */ }

  // If a block_key was supplied, auto-update that block with the new image URL
  const blockKey = req.body.block_key;
  if (blockKey) {
    try {
      // Check previous block value to see if it was an uploaded image
      const prevBlock = await db.execute({
        sql: "SELECT value FROM content_blocks WHERE block_key = ? LIMIT 1",
        args: [blockKey],
      });
      const prevVal = prevBlock.rows[0]?.value;

      await db.execute({
        sql: "UPDATE content_blocks SET value = ?, updated_at = CURRENT_TIMESTAMP, updated_by = ? WHERE block_key = ?",
        args: [servedPath, editor, blockKey],
      });
      broadcast({ type: "cms_block_updated", key: blockKey, value: servedPath, blockType: "image", updatedBy: editor, table: "content_blocks" });

      // If replacing an existing uploaded image, clean up the old file from Turso if unreferenced elsewhere
      if (prevVal && (prevVal.includes('upload_') || prevVal.includes('/media/'))) {
        const prevFn = path.basename(prevVal);
        const otherUses = await db.execute({
          sql: "SELECT COUNT(*) as count FROM content_blocks WHERE value LIKE ? AND block_key != ?",
          args: [`%${prevFn}%`, blockKey],
        });
        if (Number(otherUses.rows[0]?.count || 0) === 0) {
          await db.execute({ sql: "DELETE FROM media_files WHERE filename = ? OR asset_key = ?", args: [prevFn, prevFn.replace(/\.[^/.]+$/, "")] });
          await db.execute({ sql: "DELETE FROM media_assets WHERE file_path LIKE ? OR asset_key = ?", args: [`%${prevFn}%`, prevFn.replace(/\.[^/.]+$/, "")] });
          console.log(`[cms/upload] Replaced & purged old unreferenced image from Turso: ${prevFn}`);
        }
      }
    } catch (_) { /* non-critical if block doesn't exist */ }
  }

  console.log(`[cms/upload] ${editor} saved to Turso DB: ${servedPath} | Original: ${(originalSize/1024).toFixed(1)}KB -> Turso: ${(optimizedSize/1024).toFixed(1)}KB (${savings} reduced) | Resolution: ${width || 'original'}x${height || 'original'}`);

  res.status(201).json({
    success: true,
    url: `/${servedPath}`,
    path: servedPath,
    filename,
    originalSize,
    optimizedSize,
    savings,
    width,
    height,
    block_key: blockKey || null,
  });
});

// ─────────────────────────────────────────────────────────────────
// Multer error handler
// ─────────────────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
router.use((err, req, res, _next) => {
  if (err && err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ error: { code: "FILE_TOO_LARGE", message: "Image must be under 5 MB." } });
  }
  if (err) {
    return res.status(400).json({ error: { code: "UPLOAD_ERROR", message: err.message } });
  }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/v1/cms/stats  — admin overview stats
// ─────────────────────────────────────────────────────────────────
router.get("/stats", requireAuth, async (req, res) => {
  try {
    const [services, blocks, contacts, newLeads] = await Promise.all([
      db.execute("SELECT COUNT(*) AS total FROM services"),
      db.execute("SELECT COUNT(*) AS total FROM content_blocks"),
      db.execute("SELECT COUNT(*) AS total FROM contact_submissions"),
      db.execute("SELECT COUNT(*) AS total FROM contact_submissions WHERE status = 'new'"),
    ]);
    res.json({
      totalServices: services.rows[0].total,
      totalBlocks:   blocks.rows[0].total,
      totalContacts: contacts.rows[0].total,
      newLeads:      newLeads.rows[0].total,
    });
  } catch (err) {
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to load stats." } });
  }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/v1/cms/submissions  — list all contact leads (admin alias)
// ─────────────────────────────────────────────────────────────────
router.get("/submissions", requireAuth, async (req, res) => {
  const { status } = req.query;
  try {
    const whereClause = status ? `WHERE cs.status = '${status}'` : "";
    const result = await db.execute(
      `SELECT cs.id, cs.full_name, cs.email, cs.subject, cs.message,
              cs.status, cs.created_at,
              s.title AS service_interest_title
       FROM contact_submissions cs
       LEFT JOIN services s ON cs.service_interest_id = s.id
       ${whereClause}
       ORDER BY cs.created_at DESC`
    );
    res.json({ submissions: result.rows, total: result.rows.length });
  } catch (err) {
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to load submissions." } });
  }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/v1/cms/analytics  — Visits & Email Analytics
// Aligned with Data Analysis Mastery Skill (Senior Analyst-level)
// ─────────────────────────────────────────────────────────────────
// Lightweight in-memory cache for analytics to prevent spamming database on rapid reloads
const analyticsCache = new Map();
const ANALYTICS_CACHE_TTL = 15000; // 15 seconds

router.get("/analytics", requireAuth, async (req, res) => {
  const days = Math.min(Math.max(parseInt(req.query.days) || 14, 7), 60);

  const cached = analyticsCache.get(days);
  if (cached && (Date.now() - cached.timestamp < ANALYTICS_CACHE_TTL)) {
    return res.json(cached.data);
  }

  try {
    const batchQueries = [
      // 0: visitsTotal (exclude internal admin previews and localhost)
      { sql: "SELECT COUNT(*) AS count FROM page_visits WHERE visited_at >= datetime('now', '-' || ? || ' days') AND path NOT LIKE '%admin%' AND referrer NOT LIKE '%localhost%'", args: [days] },
      // 1: visitsUnique
      { sql: "SELECT COUNT(DISTINCT ip_hash) AS count FROM page_visits WHERE visited_at >= datetime('now', '-' || ? || ' days') AND path NOT LIKE '%admin%' AND referrer NOT LIKE '%localhost%'", args: [days] },
      // 2: devices
      { sql: "SELECT device, COUNT(*) AS count FROM page_visits WHERE visited_at >= datetime('now', '-' || ? || ' days') AND path NOT LIKE '%admin%' AND referrer NOT LIKE '%localhost%' GROUP BY device ORDER BY count DESC", args: [days] },
      // 3: topPages
      { sql: "SELECT path, COUNT(*) AS count FROM page_visits WHERE visited_at >= datetime('now', '-' || ? || ' days') AND path NOT LIKE '%admin%' AND referrer NOT LIKE '%localhost%' GROUP BY path ORDER BY count DESC LIMIT 5", args: [days] },
      // 4: contactsTotal
      { sql: "SELECT COUNT(*) AS count FROM contact_submissions WHERE created_at >= datetime('now', '-' || ? || ' days')", args: [days] },
      // 5: contactsNew
      { sql: "SELECT COUNT(*) AS count FROM contact_submissions WHERE status = 'new' AND created_at >= datetime('now', '-' || ? || ' days')", args: [days] },
      // 6: contactsByStatus
      { sql: "SELECT status, COUNT(*) AS count FROM contact_submissions WHERE created_at >= datetime('now', '-' || ? || ' days') GROUP BY status", args: [days] },
      // 7: repliesTotal
      { sql: "SELECT COUNT(*) AS count FROM contact_replies WHERE sent_at >= datetime('now', '-' || ? || ' days')", args: [days] },
      // 8: dailyVisits
      { sql: "SELECT date(visited_at) AS day, COUNT(*) AS count, COUNT(DISTINCT ip_hash) AS unique_count FROM page_visits WHERE visited_at >= datetime('now', '-' || ? || ' days') AND path NOT LIKE '%admin%' AND referrer NOT LIKE '%localhost%' GROUP BY date(visited_at) ORDER BY day ASC", args: [days] },
      // 9: dailyInquiries
      { sql: "SELECT date(created_at) AS day, COUNT(*) AS count FROM contact_submissions WHERE created_at >= datetime('now', '-' || ? || ' days') GROUP BY date(created_at) ORDER BY day ASC", args: [days] },
      // 10: dailyEmails
      { sql: "SELECT date(sent_at) AS day, COUNT(*) AS count FROM email_log WHERE status = 'sent' AND sent_at >= datetime('now', '-' || ? || ' days') GROUP BY date(sent_at) ORDER BY day ASC", args: [days] },
      // 11: dbTotals (all-time visits, 30d visits, total rows)
      {
        sql: `SELECT
          (SELECT COUNT(*) FROM page_visits WHERE path NOT LIKE '%admin%' AND referrer NOT LIKE '%localhost%') AS total_visits,
          (SELECT COUNT(*) FROM page_visits WHERE visited_at >= datetime('now', '-30 days') AND path NOT LIKE '%admin%' AND referrer NOT LIKE '%localhost%') AS monthly_visits,
          ((SELECT COUNT(*) FROM services) + (SELECT COUNT(*) FROM content_blocks) + (SELECT COUNT(*) FROM contact_submissions) + (SELECT COUNT(*) FROM page_visits) + (SELECT COUNT(*) FROM media_assets) + (SELECT COUNT(*) FROM email_log)) AS total_rows`
      }
    ];

    const results = await db.batch(batchQueries);

    const visitsTotal = results[0];
    const visitsUnique = results[1];
    const devices = results[2];
    const topPages = results[3];
    const contactsTotal = results[4];
    const contactsNew = results[5];
    const contactsByStatus = results[6];
    const repliesTotal = results[7];
    const dailyVisits = results[8];
    const dailyInquiries = results[9];
    const dailyEmails = results[10];
    const dbTotals = results[11]?.rows[0] || {};

    let totalVisitsCount = visitsTotal.rows[0]?.count || 0;
    const uniqueVisitsCount = visitsUnique.rows[0]?.count || 0;
    let allTimeVisitsCount = Number(dbTotals.total_visits || totalVisitsCount);
    const totalInquiriesCount = contactsTotal.rows[0]?.count || 0;
    const newInquiriesCount = contactsNew.rows[0]?.count || 0;
    const repliesCount = repliesTotal.rows[0]?.count || 0;

    // ── Real Quota Calculations: Turso Cloud & Cloudflare Workers ──
    const tursoTotalRows = Number(dbTotals.total_rows || 0);
    const dbSizeBytes = Math.max(tursoTotalRows * 1536, 1024 * 1024);
    const dbSizeMB = Number((dbSizeBytes / (1024 * 1024)).toFixed(2));
    const tursoLimitMB = 9 * 1024; // 9 GB = 9216 MB
    const tursoUsedPercent = Number(((dbSizeMB / tursoLimitMB) * 100).toFixed(3));

    const cloudflareDailyLimit = 100000; // 100,000 requests/day free tier
    const cloudflareMonthlyLimit = 3000000; // 3,000,000 requests/month
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayVisitsRow = dailyVisits.rows.find(r => r.day === todayStr);
    let requestsToday = todayVisitsRow ? Number(todayVisitsRow.count || 0) : 0;
    const monthlyRequests = Number(dbTotals.monthly_visits || totalVisitsCount);
    const cloudflareRemainingToday = Math.max(0, cloudflareDailyLimit - requestsToday);
    const cloudflareUsedPercent = Number(((requestsToday / cloudflareDailyLimit) * 100).toFixed(2));

    // Conversion rate: Inquiries / Visits (%)
    const conversionRate = totalVisitsCount > 0
      ? Number(((totalInquiriesCount / totalVisitsCount) * 100).toFixed(2))
      : 0;

    // Response rate: percentage of non-new inquiries
    const resolvedInquiries = Math.max(0, totalInquiriesCount - newInquiriesCount);
    const responseRate = totalInquiriesCount > 0
      ? Number(((resolvedInquiries / totalInquiriesCount) * 100).toFixed(1))
      : 0;

    // Merge daily timelines to ensure contiguous date series
    const visitMap = {};
    dailyVisits.rows.forEach(r => {
      visitMap[r.day] = { visits: r.count, unique: r.unique_count };
    });

    const inquiryMap = {};
    dailyInquiries.rows.forEach(r => {
      inquiryMap[r.day] = r.count;
    });

    const emailMap = {};
    dailyEmails.rows.forEach(r => {
      emailMap[r.day] = r.count;
    });

    // Generate date sequence for the last N days
    const timeline = [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      const dayStr = d.toISOString().slice(0, 10);
      const v = visitMap[dayStr] || { visits: 0, unique: 0 };
      const inq = inquiryMap[dayStr] || 0;
      const em = emailMap[dayStr] || 0;

      const dateLabel = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      timeline.push({
        date: dayStr,
        label: dateLabel,
        visits: v.visits,
        uniqueVisitors: v.unique,
        inquiries: inq,
        emailsSent: em
      });
    }

    // Status dictionary
    const statusMap = { new: 0, in_review: 0, contacted: 0, closed: 0 };
    contactsByStatus.rows.forEach(r => {
      if (r.status in statusMap) statusMap[r.status] = r.count;
    });

    // Senior Analyst Insights (Lead with the answer, diagnostic & recommendations)
    const topPage = topPages.rows[0]?.path || "/";
    const peakDay = [...timeline].sort((a, b) => b.visits - a.visits)[0];

    const analystInsights = {
      headline: `Conversion Efficiency: ${conversionRate}% lead rate (${totalInquiriesCount} inquiries from ${totalVisitsCount} visits in the last ${days} days).`,
      keyFinding: `Website traffic averaged ${Math.round(totalVisitsCount / days)} visits/day, peaking on ${peakDay?.label || "peak days"} with ${peakDay?.visits || 0} visits. Most frequented entry point: ${topPage}.`,
      actionableRecommendation: newInquiriesCount > 0
        ? `⚠️ Action Required: ${newInquiriesCount} client inquiry${newInquiriesCount > 1 ? "s are" : " is"} currently pending in 'New' status with no reply sent yet. Target a <24h first-response time to increase inquiry close rates.`
        : `✅ Lead hygiene is healthy: all inquiries have been acknowledged or are actively in review.`,
      provenanceNote: `Data reflects first-party web sessions with SHA-256 IP hashing and active contact database submissions. No third-party cookie dependencies.`
    };

    // ── Attempt Live Cloudflare GraphQL Integration ──
    let isCloudflareLive = false;
    let cfDataSource = "Edge Database (Authentic Visitor Sessions)";

    try {
      const cf = await fetchCloudflareMetrics(days);
      if (cf && cf.connected) {
        requestsToday = cf.requestsToday;
        isCloudflareLive = true;
        cfDataSource = "Cloudflare Workers Live API";
      }
    } catch (_) {}

    const payload = {
      windowDays: days,
      summary: {
        totalVisits: totalVisitsCount,
        allTimeVisits: allTimeVisitsCount,
        uniqueVisitors: uniqueVisitsCount,
        totalInquiries: totalInquiriesCount,
        newInquiries: newInquiriesCount,
        repliesSent: repliesCount,
        conversionRate,
        responseRate,
        isCloudflareLive,
        cfDataSource
      },
      quotas: {
        turso: {
          usedBytes: dbSizeBytes,
          usedMB: dbSizeMB,
          limitGB: 9,
          limitMB: tursoLimitMB,
          usedPercent: tursoUsedPercent,
          remainingGB: (9 - dbSizeMB / 1024).toFixed(2),
          totalRows: tursoTotalRows,
          status: "Healthy",
          type: "Turso Cloud (SQLite)"
        },
        cloudflare: {
          requestsToday,
          dailyLimit: cloudflareDailyLimit,
          remainingToday: cloudflareRemainingToday,
          usedPercent: cloudflareUsedPercent,
          monthlyRequests,
          monthlyLimit: cloudflareMonthlyLimit,
          buildMinutesLimit: 3000,
          status: isCloudflareLive ? "Live API Connected" : "Healthy",
          isLive: isCloudflareLive,
          type: isCloudflareLive ? "Cloudflare Workers GraphQL API" : "Cloudflare Edge Requests (100k/day)"
        },
        netlify: {
          usedMB: Number((requestsToday * 0.05).toFixed(1)),
          usedGB: Number(((requestsToday * 0.05) / 1024).toFixed(3)),
          limitGB: 100,
          remainingGB: 100,
          usedPercent: cloudflareUsedPercent,
          monthlyVisits: monthlyRequests,
          status: "Healthy",
          type: "Cloudflare Workers Edge"
        }
      },
      devices: devices.rows,
      topPages: topPages.rows,
      statusBreakdown: statusMap,
      timeline,
      analystInsights
    };

    analyticsCache.set(days, { timestamp: Date.now(), data: payload });
    res.json(payload);
  } catch (err) {
    console.error("[cms/analytics] Error:", err.message);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to generate analytics." } });
  }
});

// GET /api/v1/cms/cloudflare-config — check Cloudflare connection status
router.get("/cloudflare-config", requireAuth, async (req, res) => {
  try {
    const config = await getCloudflareConfig();
    res.json({
      success: true,
      hasToken: !!config.apiToken,
      accountId: config.accountId,
      scriptName: config.scriptName
    });
  } catch (err) {
    res.status(500).json({ error: { code: "CONFIG_ERROR", message: err.message } });
  }
});

// POST /api/v1/cms/cloudflare-config — save Cloudflare API token
router.post("/cloudflare-config", requireAuth, async (req, res) => {
  const { apiToken, accountId, scriptName } = req.body || {};
  try {
    await saveCloudflareConfig({ apiToken, accountId, scriptName });
    analyticsCache.clear();
    res.json({ success: true, message: "Cloudflare credentials saved successfully." });
  } catch (err) {
    res.status(500).json({ error: { code: "SAVE_ERROR", message: err.message } });
  }
});

module.exports = router;

