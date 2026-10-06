const { db } = require('../backend/db');

async function cleanPrices() {
  console.log('Clearing hardcoded prices in database as requested...');
  
  // 1. Clear prices from services table
  const svcRes = await db.execute("UPDATE services SET price_cents = NULL, price_display = ''");
  console.log('Services table rows updated:', svcRes.rowsAffected);
  
  // 2. Delete or empty price content_blocks
  const delBlocks = await db.execute("DELETE FROM content_blocks WHERE block_key LIKE '%price%'");
  console.log('Price content_blocks deleted:', delBlocks.rowsAffected);

  console.log('Finished clearing DB prices.');
}

cleanPrices().catch(console.error);
