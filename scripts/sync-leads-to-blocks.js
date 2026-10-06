require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { db } = require('../backend/db');

async function syncLeads() {
  const catBlock = await db.execute({
    sql: "SELECT value FROM content_blocks WHERE block_key = 'services.catalog.data' LIMIT 1",
    args: []
  });
  if (!catBlock.rows.length) {
    console.log('No services.catalog.data found');
    return;
  }
  const catalog = JSON.parse(catBlock.rows[0].value);
  let count = 0;
  for (const cat of catalog) {
    for (const sub of (cat.subcategories || [])) {
      for (const s of (sub.services || [])) {
        if (!s.slug || (!s.lead && !s.lead_paragraph)) continue;
        const leadVal = s.lead || s.lead_paragraph;
        await db.execute({
          sql: `INSERT INTO content_blocks (block_key, block_type, label, value, updated_by)
                VALUES (?, 'textarea', 'Service Overview', ?, 'admin')
                ON CONFLICT(block_key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
          args: [`service.${s.slug}.lead`, leadVal]
        });
        await db.execute({
          sql: `INSERT INTO content_blocks (block_key, block_type, label, value, updated_by)
                VALUES (?, 'textarea', 'Service Summary', ?, 'admin')
                ON CONFLICT(block_key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
          args: [`service.${s.slug}.summary`, leadVal]
        });
        count++;
      }
    }
  }
  console.log(`✅ Synchronized lead and summary blocks for ${count} services in Turso Cloud.`);
}

syncLeads().catch(console.error);
