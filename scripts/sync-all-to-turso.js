const path = require('path');
const { createClient } = require('@libsql/client');
const { db: tursoDb } = require('../backend/db');
const { DEFAULT_CATALOG } = require('../backend/seed-catalog');

const localDb = createClient({
  url: 'file:' + path.resolve(__dirname, '../data/omni.db')
});

async function syncDb(target, name) {
  console.log(`\n========================================`);
  console.log(`Syncing complete 8-category catalog to: ${name}`);
  console.log(`========================================`);

  const catalogJson = JSON.stringify(DEFAULT_CATALOG);

  // 1. Update services.catalog.data in content_blocks
  const catBlock = await target.execute({
    sql: `SELECT id FROM content_blocks WHERE block_key = 'services.catalog.data' LIMIT 1`,
    args: []
  });

  if (catBlock.rows.length === 0) {
    await target.execute({
      sql: `INSERT INTO content_blocks (block_key, block_type, label, value, updated_by) VALUES ('services.catalog.data', 'json', 'Live Services Catalog', ?, 'system')`,
      args: [catalogJson]
    });
  } else {
    await target.execute({
      sql: `UPDATE content_blocks SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE block_key = 'services.catalog.data'`,
      args: [catalogJson]
    });
  }
  console.log(`[${name}] ✅ Updated services.catalog.data with ${DEFAULT_CATALOG.length} categories.`);

  // 2. Clear & rebuild relational tables
  try {
    await target.execute('PRAGMA foreign_keys = OFF');
    await target.execute('DELETE FROM service_features');
    await target.execute('DELETE FROM services');
    await target.execute('DELETE FROM service_subcategories');
    await target.execute('DELETE FROM service_categories');

    let catOrder = 1;
    for (const cat of DEFAULT_CATALOG) {
      // Insert category
      const catRes = await target.execute({
        sql: `INSERT INTO service_categories (slug, title, icon_class, display_order) VALUES (?, ?, ?, ?) RETURNING id`,
        args: [cat.id, cat.title, cat.icon || 'bi-bookmark-star', catOrder++]
      });
      const catId = catRes.rows[0]?.id;

      let subOrder = 1;
      for (const sub of (cat.subcategories || [])) {
        const subRes = await target.execute({
          sql: `INSERT INTO service_subcategories (category_id, slug, title, display_order) VALUES (?, ?, ?, ?) RETURNING id`,
          args: [catId, sub.id, sub.title, subOrder++]
        });
        const subId = subRes.rows[0]?.id;

        let svcOrder = 1;
        for (const svc of (sub.services || [])) {
          const svcRes = await target.execute({
            sql: `INSERT INTO services (subcategory_id, slug, title, price_display, lead_paragraph, is_featured, display_order) VALUES (?, ?, ?, ?, ?, 1, ?) RETURNING id`,
            args: [subId, svc.slug, svc.title, svc.price || '', svc.lead || '', svcOrder++]
          });
          const svcId = svcRes.rows[0]?.id;

          let featOrder = 1;
          for (const feat of (svc.features || [])) {
            await target.execute({
              sql: `INSERT INTO service_features (service_id, feature_text, display_order) VALUES (?, ?, ?)`,
              args: [svcId, feat, featOrder++]
            });
          }

          // Also ensure service block keys exist in content_blocks
          if (svc.lead) {
            await target.execute({
              sql: `INSERT INTO content_blocks (block_key, block_type, label, value, updated_by)
                    VALUES (?, 'text', ?, ?, 'system')
                    ON CONFLICT(block_key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
              args: [`service.${svc.slug}.lead`, `${svc.title} Lead`, svc.lead]
            });
          }
          if (svc.price) {
            await target.execute({
              sql: `INSERT INTO content_blocks (block_key, block_type, label, value, updated_by)
                    VALUES (?, 'text', ?, ?, 'system')
                    ON CONFLICT(block_key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
              args: [`service.${svc.slug}.price`, `${svc.title} Price`, svc.price]
            });
          }
        }
      }
    }
    await target.execute('PRAGMA foreign_keys = ON');
    console.log(`[${name}] ✅ Rebuilt relational tables with categories, subcategories, services, and features.`);
  } catch (err) {
    console.error(`[${name}] Error syncing relational tables:`, err.message);
  }
}

async function main() {
  await syncDb(tursoDb, 'Turso Cloud');
  try {
    await syncDb(localDb, 'Local SQLite');
  } catch (err) {
    console.log('Local SQLite note:', err.message);
  }
}

main().catch(console.error);
