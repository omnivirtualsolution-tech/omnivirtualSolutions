const { db } = require('../backend/db');

async function run() {
  const blocks = await db.execute("SELECT block_key, value FROM content_blocks WHERE block_key LIKE '%price%'");
  console.log('Price in content_blocks:', blocks.rows);
  const svcs = await db.execute("SELECT slug, price_cents, price_display FROM services WHERE price_cents IS NOT NULL OR (price_display IS NOT NULL AND price_display != '')");
  console.log('Services with prices:', svcs.rows);
}
run().catch(console.error);
