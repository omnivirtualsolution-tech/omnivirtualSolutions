const fs = require('fs');
const path = require('path');

const catalogPath = path.join(__dirname, '../frontend/src/data/catalog.json');
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

console.log('=== SERVICES WITH LONG / QUOTE FEATURES ===');
let total = 0;

catalog.forEach((cat) => {
  cat.subcategories.forEach((sub) => {
    sub.services.forEach((s) => {
      const feats = s.features || [];
      const bad = feats.filter(f => f.length > 110 || f.startsWith('—') || f.startsWith('-') || f.startsWith('"') || f.includes('author of'));
      if (bad.length > 0) {
        console.log(`\nService: ${s.slug} (${s.title}) in [${cat.title} > ${sub.title}]`);
        bad.forEach((b, i) => console.log(`   [${i+1}] (${b.length} chars) ${b.substring(0, 80)}...`));
        total++;
      }
    });
  });
});

console.log(`\nTotal services with bad features: ${total}`);
