const path = require('path');
const { createClient } = require('@libsql/client');
const { db: tursoDb } = require('../backend/db');
const { DEFAULT_CATALOG } = require('../backend/seed-catalog');

const localDb = createClient({
  url: 'file:' + path.resolve(__dirname, '../data/omni.db')
});

const pubPkg = DEFAULT_CATALOG[0].subcategories[0].services[0];

async function syncDb(target, name) {
  console.log(`\n--- Syncing ${name} ---`);
  const catalogJson = JSON.stringify(DEFAULT_CATALOG);

  // 1. Update services.catalog.data
  await target.execute({
    sql: `UPDATE content_blocks SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE block_key = 'services.catalog.data'`,
    args: [catalogJson]
  });
  console.log(`[${name}] Updated services.catalog.data with ${DEFAULT_CATALOG[0].subcategories[0].services.length} services in Publishing Options`);

  // 2. Ensure publishing-packages exists in services table
  const sExists = await target.execute({
    sql: `SELECT id FROM services WHERE slug = ? LIMIT 1`,
    args: [pubPkg.slug]
  });

  if (sExists.rows.length === 0) {
    const subRow = await target.execute({
      sql: `SELECT id FROM service_subcategories WHERE slug = 'publishing-options' LIMIT 1`,
      args: []
    });
    const subId = subRow.rows[0]?.id || 1;
    await target.execute({
      sql: `INSERT INTO services (subcategory_id, slug, title, lead_paragraph, is_featured, display_order) VALUES (?, ?, ?, ?, 1, 0)`,
      args: [subId, pubPkg.slug, pubPkg.title, pubPkg.lead]
    });
    console.log(`[${name}] Inserted publishing-packages into services table`);
  } else {
    await target.execute({
      sql: `UPDATE services SET lead_paragraph = ?, title = ? WHERE slug = ?`,
      args: [pubPkg.lead, pubPkg.title, pubPkg.slug]
    });
    console.log(`[${name}] Updated publishing-packages in services table`);
  }

  // 3. Update features in service_features table
  const svcRow = await target.execute({
    sql: `SELECT id FROM services WHERE slug = ? LIMIT 1`,
    args: [pubPkg.slug]
  });
  if (svcRow.rows.length > 0) {
    const sid = svcRow.rows[0].id;
    await target.execute({
      sql: `DELETE FROM service_features WHERE service_id = ?`,
      args: [sid]
    });
    for (let i = 0; i < pubPkg.features.length; i++) {
      await target.execute({
        sql: `INSERT INTO service_features (service_id, feature_text, display_order) VALUES (?, ?, ?)`,
        args: [sid, pubPkg.features[i], i + 1]
      });
    }
    console.log(`[${name}] Inserted ${pubPkg.features.length} features for publishing-packages`);
  }

  // 4. Update content_blocks for service.publishing-packages.lead
  await target.execute({
    sql: `INSERT INTO content_blocks (block_key, block_type, label, value, updated_by)
          VALUES (?, 'text', 'Publishing Packages Lead', ?, 'system')
          ON CONFLICT(block_key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
    args: [`service.${pubPkg.slug}.lead`, pubPkg.lead]
  });
  console.log(`[${name}] Updated service.${pubPkg.slug}.lead in content_blocks`);
}

async function main() {
  await syncDb(tursoDb, 'Turso Cloud');
  try {
    await syncDb(localDb, 'Local SQLite');
  } catch (err) {
    console.log('Local db note:', err.message);
  }
}

main().catch(console.error);
