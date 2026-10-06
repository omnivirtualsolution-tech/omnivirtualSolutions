const fs = require('fs');
const catalog = require('../frontend/src/data/catalog.json');

console.log('--- INSPECTING SERVICES WITH PARAGRAPHS IN FEATURES ---');
catalog.forEach(cat => {
  cat.subcategories.forEach(sub => {
    sub.services.forEach(s => {
      const feats = s.features || [];
      const hasLong = feats.some(f => f.length > 150 || f.startsWith('"') || f.startsWith('—') || f.startsWith('-') || f.toLowerCase().includes('barbara wood') || f.toLowerCase().includes('michelle dixon'));
      if (hasLong) {
        console.log(`[${cat.id} > ${sub.id}] slug: ${s.slug} ("${s.title}"): ${feats.length} features`);
        feats.forEach((f, i) => {
          console.log(`   ${i + 1}. [len=${f.length}] ${f.slice(0, 80)}...`);
        });
      }
    });
  });
});
