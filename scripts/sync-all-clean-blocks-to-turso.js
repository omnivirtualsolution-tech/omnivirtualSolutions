const fs = require('fs');
const path = require('path');
const { db } = require('../backend/db');

const catalogPath = path.join(__dirname, '../frontend/src/data/catalog.json');
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

async function syncAll() {
  console.log('=== SYNCING CLEAN CATALOG & BLOCKS TO TURSO ===');

  // 1. Update services.catalog.data
  const jsonStr = JSON.stringify(catalog);
  const catKey = 'services.catalog.data';
  const existingCat = await db.execute({
    sql: 'SELECT id FROM content_blocks WHERE block_key = ? LIMIT 1',
    args: [catKey]
  });

  if (existingCat.rows.length === 0) {
    await db.execute({
      sql: 'INSERT INTO content_blocks (block_key, block_type, label, value, updated_by) VALUES (?, ?, ?, ?, ?)',
      args: [catKey, 'json', 'Live Services Catalog', jsonStr, 'system-seed']
    });
  } else {
    await db.execute({
      sql: 'UPDATE content_blocks SET value = ?, updated_at = CURRENT_TIMESTAMP, updated_by = ? WHERE block_key = ?',
      args: [jsonStr, 'system-seed', catKey]
    });
  }
  console.log('✅ Updated services.catalog.data with 8 categories and overviews.');

  // 2. Iterate through all services and update individual block keys
  let updatedCount = 0;
  for (const cat of catalog) {
    for (const sub of cat.subcategories) {
      for (const s of sub.services) {
        if (!s.slug) continue;

        // Sync service lead
        const leadKey = `service.${s.slug}.lead`;
        if (s.lead) {
          const exLead = await db.execute({
            sql: 'SELECT id FROM content_blocks WHERE block_key = ? LIMIT 1',
            args: [leadKey]
          });
          if (exLead.rows.length > 0) {
            await db.execute({
              sql: 'UPDATE content_blocks SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE block_key = ?',
              args: [s.lead, leadKey]
            });
          } else {
            await db.execute({
              sql: 'INSERT INTO content_blocks (block_key, block_type, label, value, updated_by) VALUES (?, ?, ?, ?, ?)',
              args: [leadKey, 'text', `${s.title} Lead`, s.lead, 'system-seed']
            });
          }
          updatedCount++;
        }

        // Clean any corrupted features block
        const featKey = `service.${s.slug}.features`;
        const exFeat = await db.execute({
          sql: 'SELECT id, value FROM content_blocks WHERE block_key = ? LIMIT 1',
          args: [featKey]
        });
        if (exFeat.rows.length > 0) {
          // If the feature override had quotes or long paragraphs, update it with clean features
          await db.execute({
            sql: 'UPDATE content_blocks SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE block_key = ?',
            args: [JSON.stringify(s.features), featKey]
          });
        }
      }
    }
  }

  console.log(`✅ Synced individual content blocks for ${updatedCount} services.`);
}

syncAll().catch(console.error);
