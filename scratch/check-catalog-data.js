const { db } = require('../backend/db');

(async () => {
  try {
    const r = await db.execute({
      sql: "SELECT value FROM content_blocks WHERE block_key = 'services.catalog.data' LIMIT 1",
      args: []
    });
    if (r.rows.length > 0 && r.rows[0].value) {
      console.log('Found services.catalog.data, length:', r.rows[0].value.length);
      const cat = JSON.parse(r.rows[0].value);
      console.log('Categories count:', cat.length);
      const formatsCat = cat.find(c => c.id === 'formats');
      console.log('Formats lead:', formatsCat?.lead);
      const prices = [];
      cat.forEach(c => (c.subcategories || []).forEach(s => (s.services || []).forEach(v => {
        if (v.price || v.price_display) prices.push(v.slug + ': ' + (v.price || v.price_display));
      })));
      console.log('Services with prices:', prices.length, prices.slice(0, 5));
    } else {
      console.log('No services.catalog.data block in DB');
    }
  } catch (err) {
    console.error('Error:', err);
  }
})();
