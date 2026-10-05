const path = require('path');
const { createClient } = require('@libsql/client');
const { db: tursoDb } = require('../backend/db');
const { DEFAULT_CATALOG } = require('../backend/seed-catalog');

const localDb = createClient({
  url: 'file:' + path.resolve(__dirname, '../data/omni.db')
});

const packagePrices = [
  { slug: 'basic-package', price: '$899.00', cents: 89900 },
  { slug: 'standard-package', price: '$1,599.00', cents: 159900 },
  { slug: 'advanced-package', price: '$4,999.00', cents: 499900 }
];

async function fixDb(target, name) {
  console.log(`\n--- Fixing prices in ${name} ---`);
  for (const item of packagePrices) {
    // 1. Update content_blocks for service.<slug>.price
    await target.execute({
      sql: `INSERT INTO content_blocks (block_key, block_type, label, value, updated_by)
            VALUES (?, 'text', 'Package Price', ?, 'system')
            ON CONFLICT(block_key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
      args: [`service.${item.slug}.price`, item.price]
    });
    console.log(`[${name}] Updated block service.${item.slug}.price -> ${item.price}`);

    // 2. Update services table
    await target.execute({
      sql: `UPDATE services SET price_display = ?, price_cents = ? WHERE slug = ?`,
      args: [item.price, item.cents, item.slug]
    });
  }

  // 3. Update catalog data in content_blocks
  const catalog = JSON.parse(JSON.stringify(DEFAULT_CATALOG));
  for (const cat of catalog) {
    for (const sub of (cat.subcategories || [])) {
      for (const s of (sub.services || [])) {
        const found = packagePrices.find(p => p.slug === s.slug);
        if (found) {
          s.price = found.price;
          s.price_display = found.price;
        }
      }
    }
  }

  await target.execute({
    sql: `UPDATE content_blocks SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE block_key = 'services.catalog.data'`,
    args: [JSON.stringify(catalog)]
  });
  console.log(`[${name}] ✅ Successfully updated catalog with prices`);
}

async function main() {
  await fixDb(tursoDb, 'Turso Cloud');
  try {
    await fixDb(localDb, 'Local SQLite');
  } catch (err) {
    console.log('Local db note:', err.message);
  }
}

main().catch(console.error);
