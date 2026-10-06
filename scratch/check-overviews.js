const fs = require('fs');
const path = require('path');

const jsx = fs.readFileSync(path.join(__dirname, '../frontend/src/pages/ServicesPage.jsx'), 'utf8');
const lines = jsx.split('\n');

lines.forEach((l, idx) => {
  if (l.includes('isCurrentSubcategoryOverview') || l.includes('isCurrentCategoryOverview') || l.includes('isSubcategoryOverview') || l.includes('isCategoryOverview')) {
    console.log(`${idx + 1}: ${l.trim()}`);
  }
});
