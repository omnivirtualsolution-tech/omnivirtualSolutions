const fs = require('fs');
const path = require('path');

const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, '../frontend/src/data/catalog.json'), 'utf8'));

console.log('=== ALL SUBCATEGORIES IN CATALOG ===');
catalog.forEach(cat => {
  console.log(`\nCATEGORY: ${cat.id} (${cat.title})`);
  cat.subcategories.forEach(sub => {
    console.log(`   SUBCAT: id="${sub.id}" | title="${sub.title}" | servicesCount=${sub.services.length}`);
  });
});
