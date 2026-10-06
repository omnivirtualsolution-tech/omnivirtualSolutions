const { db } = require('../backend/db');

async function run() {
  const r = await db.execute({
    sql: "SELECT block_key, value FROM content_blocks WHERE block_key LIKE 'service.%.features' OR block_key LIKE 'service.%.lead' OR block_key LIKE 'service.%.desc'"
  });
  console.log('Found service override blocks in Turso:', r.rows.length);
  r.rows.forEach(row => {
    const valStr = typeof row.value === 'string' ? row.value : JSON.stringify(row.value);
    console.log(`[${row.block_key}] -> ${valStr.substring(0, 90)}`);
  });
}

run().catch(console.error);
