const fs = require('fs');
const path = require('path');

const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, '../frontend/src/data/catalog.json'), 'utf8'));

console.log('=== CURRENT CATALOG IN catalog.json ===');
catalog.forEach(cat => {
  console.log(`\nCATEGORY: [${cat.id}] "${cat.title}" (tag: ${cat.tag})`);
  cat.subcategories.forEach(sub => {
    console.log(`  SUBCATEGORY: [${sub.id}] "${sub.title}" (${sub.services.length} services)`);
    sub.services.forEach(s => {
      console.log(`    - [${s.slug}] "${s.title}" | Price: "${s.price}" | Feats: ${(s.features || []).length}`);
    });
  });
});
