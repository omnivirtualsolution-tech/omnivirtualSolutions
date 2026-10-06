const fs = require('fs');
const path = require('path');

const jsxPath = path.join(__dirname, '../frontend/src/pages/ServicesPage.jsx');
const catalogPath = path.join(__dirname, '../frontend/src/data/catalog.json');
const servicesHtmlPath = path.join(__dirname, '../services.html');
const servicesDir = path.join(__dirname, '../services');

const jsx = fs.readFileSync(jsxPath, 'utf8');
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const servicesHtml = fs.readFileSync(servicesHtmlPath, 'utf8');
const servicesFiles = fs.readdirSync(servicesDir).filter(f => f.endsWith('.html') && f !== 'header.html' && f !== 'footer.html');

// 1. Extract slugs in ServicesPage.jsx
const jsxCustomSlugs = new Set();
const jsxSlugRegex = /selectedService\?\.slug === '([^']+)'/g;
let m;
while ((m = jsxSlugRegex.exec(jsx)) !== null) {
  jsxCustomSlugs.add(m[1]);
}

// Also check hasCustomDetailView in JSX
const hasCustomMatch = jsx.match(/hasCustomDetailView = useMemo\(\(\) => \{([\s\S]*?)\}, \[selectedService\]\);/);
const hasCustomSlugs = new Set();
if (hasCustomMatch) {
  const customBlock = hasCustomMatch[1];
  const customSlugRegex = /slug === '([^']+)'/g;
  let cm;
  while ((cm = customSlugRegex.exec(customBlock)) !== null) {
    hasCustomSlugs.add(cm[1]);
  }
}

// 2. Extract catalog categories, subcategories, services
const catalogCatMap = new Map();
const catalogSubMap = new Map();
const catalogServiceMap = new Map();

catalog.forEach(cat => {
  catalogCatMap.set(cat.id, cat);
  cat.subcategories.forEach(sub => {
    catalogSubMap.set(sub.id, { ...sub, catId: cat.id, catTitle: cat.title });
    sub.services.forEach(s => {
      catalogServiceMap.set(s.slug, { ...s, catId: cat.id, catTitle: cat.title, subId: sub.id, subTitle: sub.title });
    });
  });
});

console.log('=== SUMMARY OF CURRENT STATE ===');
console.log(`catalog.json categories: ${catalogCatMap.size}`);
console.log(`catalog.json subcategories: ${catalogSubMap.size}`);
console.log(`catalog.json total services: ${catalogServiceMap.size}`);
console.log(`ServicesPage.jsx custom detail templates: ${jsxCustomSlugs.size}`);
console.log(`Services in hasCustomDetailView list: ${hasCustomSlugs.size}`);
console.log(`Files in Omni/services/ folder: ${servicesFiles.length}`);

// 3. Inspect every file in Omni/services/ folder
const diskFilesMap = new Map();
servicesFiles.forEach(file => {
  const content = fs.readFileSync(path.join(servicesDir, file), 'utf8');
  const h1M = content.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const title = h1M ? h1M[1].replace(/<[^>]+>/g, '').trim() : file.replace('.html', '');
  
  // Extract paragraphs, lists, etc.
  const mainM = content.match(/<section id="main-content"[^>]*>([\s\S]*?)<\/section>/i) ||
                content.match(/<div class="container"[^>]*>([\s\S]*?)<\/div>/i);
  const mainContent = mainM ? mainM[1] : content;

  // Extract price
  const priceMatch = mainContent.match(/\$[\d,]+(\.\d{2})?/);

  // Extract bullets
  const bullets = [];
  const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  let lim;
  while ((lim = liRegex.exec(mainContent)) !== null) {
    const bText = lim[1].replace(/<[^>]+>/g, '').trim();
    if (bText && !bText.includes('Close') && !bText.includes('Services')) {
      bullets.push(bText);
    }
  }

  diskFilesMap.set(file, {
    file,
    title,
    price: priceMatch ? priceMatch[0] : '',
    bulletsCount: bullets.length,
    bullets: bullets.slice(0, 5),
    rawLength: content.length
  });
});

// Output services files that are NOT in catalog
console.log('\n=== DISK FILES NOT PRESENT IN catalog.json ===');
const missingInCatalog = [];
for (const [file, info] of diskFilesMap.entries()) {
  // Try to find match
  let matched = false;
  for (const [slug, svc] of catalogServiceMap.entries()) {
    const slugNorm = slug.toLowerCase().replace(/[^a-z0-9]/g, '');
    const fileNorm = file.replace('.html', '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const titleNorm = info.title.toLowerCase().replace(/[^a-z0-9]/g, '');
    const svcTitleNorm = svc.title.toLowerCase().replace(/[^a-z0-9]/g, '');

    if (slugNorm === fileNorm || titleNorm === svcTitleNorm || fileNorm.includes(slugNorm) || slugNorm.includes(fileNorm)) {
      matched = true;
      break;
    }
  }
  if (!matched) {
    missingInCatalog.push(info);
    console.log(`- File: ${info.file.padEnd(40)} | Title: "${info.title}" | Price: "${info.price}" | Bullets: ${info.bulletsCount}`);
  }
}

// Output services in catalog that DO NOT have custom detail views in ServicesPage.jsx
console.log('\n=== CATALOG SERVICES WITHOUT CUSTOM DETAIL VIEWS IN ServicesPage.jsx ===');
let genericCount = 0;
for (const [slug, svc] of catalogServiceMap.entries()) {
  if (!jsxCustomSlugs.has(slug) && !hasCustomSlugs.has(slug)) {
    genericCount++;
    console.log(`- [${slug}] "${svc.title}" (under ${svc.catTitle} > ${svc.subTitle})`);
  }
}
console.log(`Total catalog services using generic view: ${genericCount}`);

