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

// ── Image upload config (multer with memory buffer for optimization) ──
const UPLOADS_DIR = path.resolve(__dirname, "../../assets/uploads");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

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
    }

    if (existing.rows.length === 0) {
      // Auto-create block if it does not exist yet
      const inferredType = (key.includes('image') || key.includes('logo') || key.includes('img') || String(newValue).match(/\.(png|jpg|jpeg|webp|svg|gif)$/i)) ? 'image' : 'text';
      await db.execute({
        sql: "INSERT INTO content_blocks (block_key, block_type, label, value, updated_by) VALUES (?, ?, ?, ?, ?)",
        args: [key, inferredType, key, newValue, editor],
      });
      await db.execute({
        sql: "INSERT INTO content_block_revisions (block_key, old_value, new_value, changed_by) VALUES (?, '', ?, ?)",
        args: [key, newValue, editor],
      });

      console.log(`[cms] ${editor} created new block: ${key} (${inferredType})`);
      broadcast({ type: "cms_block_updated", key, value: newValue, blockType: inferredType, updatedBy: editor, table: "content_blocks" });
      return res.json({ success: true, block: { block_key: key, value: newValue, block_type: inferredType, updated_by: editor } });
    }

    const block    = existing.rows[0];
    const oldValue = block.value;

    // Write revision before overwriting
    await db.execute({
      sql: "INSERT INTO content_block_revisions (block_key, old_value, new_value, changed_by) VALUES (?,?,?,?)",
      args: [key, oldValue, newValue, editor],
    });

    // Update the block
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

    // 3. Record revision
    await db.execute({
      sql: "INSERT INTO content_block_revisions (block_key, old_value, new_value, changed_by) VALUES (?, ?, ?, ?)",
      args: [key, oldValue.slice(0, 5000), catalogJson.slice(0, 5000), editor],
    });

    // 4. Synchronize changed service prices & leads into services table if matching slugs exist
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
            console.warn(`[cms/services/catalog] Sync error for slug ${svc.slug}:`, syncErr.message);
          }
        }
      }
    }

    console.log(`[cms] ${editor} updated full services catalog (${syncedCount} services synced)`);

    // 5. Broadcast live SSE event to all open visitor tabs and editors
    broadcast({
      type: "cms_block_updated",
      key,
      value: catalogJson,
      blockType: "json",
      updatedBy: editor,
      table: "content_blocks",
    });

    res.json({ success: true, count: syncedCount, message: "Catalog updated successfully." });
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
// POST /api/v1/cms/upload
// Upload an image → saves to assets/uploads/ → returns URL
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

  if (!isSvg) {
    try {
      const optimized = await optimizeImage(req.file.buffer);
      finalBuffer   = optimized.buffer;
      optimizedSize = optimized.size;
      savings = ((1 - optimizedSize / originalSize) * 100).toFixed(1) + "%";
    } catch (optErr) {
      console.warn("[cms/upload] Optimization fallback to original:", optErr.message);
      const ext = path.extname(req.file.originalname).toLowerCase() || ".jpg";
      filename = `upload_${Date.now()}${ext}`;
    }
  }

  // Save the optimized file to assets/uploads/
  const fullFilePath = path.join(UPLOADS_DIR, filename);
  fs.writeFileSync(fullFilePath, finalBuffer);

  const relativePath = `assets/uploads/${filename}`;

  // Register in media_assets table
  try {
    await db.execute({
      sql: `INSERT OR IGNORE INTO media_assets (asset_key, file_path, alt_text, category)
            VALUES (?, ?, ?, 'upload')`,
      args: [`upload_${Date.now()}`, relativePath, req.file.originalname],
    });
  } catch (_) { /* non-critical */ }

  // If a block_key was supplied, auto-update that block with the new image path
  const blockKey = req.body.block_key;
  if (blockKey) {
    try {
      await db.execute({
        sql: "UPDATE content_blocks SET value = ?, updated_at = CURRENT_TIMESTAMP, updated_by = ? WHERE block_key = ?",
        args: [relativePath, editor, blockKey],
      });
      broadcast({ type: "cms_block_updated", key: blockKey, value: relativePath, blockType: "image", updatedBy: editor, table: "content_blocks" });
    } catch (_) { /* non-critical if block doesn't exist */ }
  }

  console.log(`[cms/upload] ${editor} uploaded: ${relativePath} | Original: ${(originalSize/1024).toFixed(1)}KB -> Saved: ${(optimizedSize/1024).toFixed(1)}KB (${savings} reduced)`);

  res.status(201).json({
    success: true,
    url: `/${relativePath}`,
    path: relativePath,
    filename,
    originalSize,
    optimizedSize,
    savings,
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
router.get("/analytics", requireAuth, async (req, res) => {
  const days = Math.min(Math.max(parseInt(req.query.days) || 14, 7), 60);

  try {
    // 1. Visits metrics
    const [
      visitsTotal,
      visitsUnique,
      devices,
      topPages,
      contactsTotal,
      contactsNew,
      contactsByStatus,
      repliesTotal,
      dailyVisits,
      dailyInquiries,
      dailyEmails
    ] = await Promise.all([
      db.execute({
        sql: "SELECT COUNT(*) AS count FROM page_visits WHERE visited_at >= datetime('now', '-' || ? || ' days')",
        args: [days]
      }),
      db.execute({
        sql: "SELECT COUNT(DISTINCT ip_hash) AS count FROM page_visits WHERE visited_at >= datetime('now', '-' || ? || ' days')",
        args: [days]
      }),
      db.execute({
        sql: "SELECT device, COUNT(*) AS count FROM page_visits WHERE visited_at >= datetime('now', '-' || ? || ' days') GROUP BY device ORDER BY count DESC",
        args: [days]
      }),
      db.execute({
        sql: "SELECT path, COUNT(*) AS count FROM page_visits WHERE visited_at >= datetime('now', '-' || ? || ' days') GROUP BY path ORDER BY count DESC LIMIT 5",
        args: [days]
      }),
      db.execute({
        sql: "SELECT COUNT(*) AS count FROM contact_submissions WHERE created_at >= datetime('now', '-' || ? || ' days')",
        args: [days]
      }),
      db.execute({
        sql: "SELECT COUNT(*) AS count FROM contact_submissions WHERE status = 'new' AND created_at >= datetime('now', '-' || ? || ' days')",
        args: [days]
      }),
      db.execute({
        sql: "SELECT status, COUNT(*) AS count FROM contact_submissions WHERE created_at >= datetime('now', '-' || ? || ' days') GROUP BY status",
        args: [days]
      }),
      db.execute({
        sql: "SELECT COUNT(*) AS count FROM contact_replies WHERE sent_at >= datetime('now', '-' || ? || ' days')",
        args: [days]
      }),
      db.execute({
        sql: `SELECT date(visited_at) AS day, COUNT(*) AS count, COUNT(DISTINCT ip_hash) AS unique_count
              FROM page_visits
              WHERE visited_at >= datetime('now', '-' || ? || ' days')
              GROUP BY date(visited_at)
              ORDER BY day ASC`,
        args: [days]
      }),
      db.execute({
        sql: `SELECT date(created_at) AS day, COUNT(*) AS count
              FROM contact_submissions
              WHERE created_at >= datetime('now', '-' || ? || ' days')
              GROUP BY date(created_at)
              ORDER BY day ASC`,
        args: [days]
      }),
      db.execute({
        sql: `SELECT date(sent_at) AS day, COUNT(*) AS count
              FROM email_log
              WHERE status = 'sent' AND sent_at >= datetime('now', '-' || ? || ' days')
              GROUP BY date(sent_at)
              ORDER BY day ASC`,
        args: [days]
      })
    ]);

    const totalVisitsCount = visitsTotal.rows[0]?.count || 0;
    const uniqueVisitsCount = visitsUnique.rows[0]?.count || 0;
    const totalInquiriesCount = contactsTotal.rows[0]?.count || 0;
    const newInquiriesCount = contactsNew.rows[0]?.count || 0;
    const repliesCount = repliesTotal.rows[0]?.count || 0;

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

    res.json({
      windowDays: days,
      summary: {
        totalVisits: totalVisitsCount,
        uniqueVisitors: uniqueVisitsCount,
        totalInquiries: totalInquiriesCount,
        newInquiries: newInquiriesCount,
        repliesSent: repliesCount,
        conversionRate,
        responseRate
      },
      devices: devices.rows,
      topPages: topPages.rows,
      statusBreakdown: statusMap,
      timeline,
      analystInsights
    });
  } catch (err) {
    console.error("[cms/analytics] Error:", err.message);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to generate analytics." } });
  }
});

module.exports = router;

