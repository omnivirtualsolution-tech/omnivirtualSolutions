// =================================================================
// backend/seed-catalog.js
// Seeds the default rich services catalog into content_blocks table
// under the block_key 'services.catalog.data'
// =================================================================

const path = require('path');
const { db } = require('./db');

const DEFAULT_CATALOG = require(path.resolve(__dirname, '../data/full-catalog.json'));

async function seed() {
  const jsonStr = JSON.stringify(DEFAULT_CATALOG);
  const key = 'services.catalog.data';
  const label = 'Live Services Catalog';
  const editor = 'system-seed';

  const existing = await db.execute({
    sql: 'SELECT id FROM content_blocks WHERE block_key = ? LIMIT 1',
    args: [key]
  });

  if (existing.rows.length === 0) {
    await db.execute({
      sql: 'INSERT INTO content_blocks (block_key, block_type, label, value, updated_by) VALUES (?, ?, ?, ?, ?)',
      args: [key, 'json', label, jsonStr, editor]
    });
    console.log('✅ Seeded services.catalog.data into content_blocks table.');
  } else {
    await db.execute({
      sql: 'UPDATE content_blocks SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE block_key = ?',
      args: [jsonStr, key]
    });
    console.log('✅ Updated services.catalog.data with 8-category catalog.');
  }
}

if (require.main === module) {
  seed().catch(console.error);
}

module.exports = { DEFAULT_CATALOG, seed };
