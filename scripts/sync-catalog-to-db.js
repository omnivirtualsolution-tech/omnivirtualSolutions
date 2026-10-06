// scripts/sync-catalog-to-db.js
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const fs = require('fs');
const { db } = require('../backend/db');

async function main() {
  const catalogPath = require('path').resolve(__dirname, '../frontend/src/data/catalog.json');
  const catalogData = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  const catalogJson = JSON.stringify(catalogData);

  console.log('Syncing catalog to Turso DB...');
  console.log(`Categories count: ${catalogData.length}`);
  const basicPkg = catalogData[0]?.subcategories[0]?.services?.find(s => s.slug === 'basic-package');
  console.log(`Basic package features count: ${basicPkg?.features?.length}`);

  const updateRes = await db.execute({
    sql: "UPDATE content_blocks SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE block_key = 'services.catalog.data'",
    args: [catalogJson]
  });

  console.log('Update result rows affected:', updateRes.rowsAffected);

  const verifyRes = await db.execute({
    sql: "SELECT value FROM content_blocks WHERE block_key = 'services.catalog.data' LIMIT 1",
    args: []
  });

  if (verifyRes.rows.length > 0) {
    const parsed = JSON.parse(verifyRes.rows[0].value);
    const dbBasic = parsed[0]?.subcategories[0]?.services?.find(s => s.slug === 'basic-package');
    console.log('Verified Basic package features in DB:', dbBasic?.features);
  }

  // Also broadcast live update via server if running or exit
  console.log('Sync completed successfully.');
  process.exit(0);
}

main().catch(err => {
  console.error('Sync failed:', err);
  process.exit(1);
});
