const fs = require('fs');
const path = require('path');
const { db } = require('../backend/db');

(async () => {
  try {
    const catalogPath = path.join(__dirname, '../frontend/src/data/catalog.json');
    const catalogJson = fs.readFileSync(catalogPath, 'utf8');
    const catalog = JSON.parse(catalogJson);

    console.log('Syncing catalog to Turso DB content_blocks...');
    console.log('Categories:', catalog.length);

    await db.execute({
      sql: `INSERT INTO content_blocks (block_key, block_type, value, updated_at)
            VALUES ('services.catalog.data', 'json', ?, CURRENT_TIMESTAMP)
            ON CONFLICT(block_key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
      args: [JSON.stringify(catalog)]
    });

    console.log('Successfully updated services.catalog.data in Turso DB!');
  } catch (err) {
    console.error('Failed to sync catalog to DB:', err);
  }
})();
