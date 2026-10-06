const fs = require('fs');
const path = require('path');

const jsx = fs.readFileSync(path.join(__dirname, '../frontend/src/pages/ServicesPage.jsx'), 'utf8');
const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, '../frontend/src/data/catalog.json'), 'utf8'));
const servicesHtml = fs.readFileSync(path.join(__dirname, '../services.html'), 'utf8');
const servicesDir = path.join(__dirname, '../services');
const servicesFiles = fs.readdirSync(servicesDir).filter(f => f.endsWith('.html') && f !== 'header.html' && f !== 'footer.html');

console.log('====================================================');
console.log('   FULL COMPARISON & AUDIT: services.html vs services/ vs ServicesPage.jsx');
console.log('====================================================\n');

// 1. Audit categories in services.html vs catalog.json
console.log('--- 1. CATEGORIES IN services.html ---');
const sidebarCatRegex = /<!--\s*([A-Za-z\s]+)\s*-->\s*<li>\s*<a href="([^"]*)"[^>]*data-target-section="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g;
let m;
const sidebarCats = [];
while ((m = sidebarCatRegex.exec(servicesHtml)) !== null) {
  const commentName = m[1].trim();
  const href = m[2];
  const sectionId = m[3];
  const title = m[4].replace(/<[^>]+>/g, '').trim();
  sidebarCats.push({ commentName, href, sectionId, title });
}
console.log('Parsed sidebar categories in services.html:');
sidebarCats.forEach(c => console.log(`  - [${c.sectionId}] ${c.title} (comment: ${c.commentName})`));

// 2. Audit subcategories in services.html (both active and commented-out!)
console.log('\n--- 2. ALL SUBCATEGORIES IN services.html (ACTIVE & COMMENTED-OUT) ---');
// Let's find all subcategory headers/links in services.html
const subcatMatches = [];
// Regex for dropdown <li> with content-link
const subcatRegex = /<li[^>]*>\s*<a href="([^"]*)"[^>]*class="content-link"[^>]*data-target-section="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g;
while ((m = subcatRegex.exec(servicesHtml)) !== null) {
  const href = m[1];
  const sec = m[2];
  const title = m[3].replace(/<[^>]+>/g, '').trim();
  subcatMatches.push({ href, sec, title });
}
console.log(`Found ${subcatMatches.length} subcategory links in sidebar:`);
subcatMatches.forEach(s => console.log(`  - Section: [${s.sec}] "${s.title}"`));

// Check commented out ones in sidebar:
console.log('\n--- Commented out in sidebar of services.html ---');
const commentedOutSubcats = [
  { id: 'advertising', title: 'Advertising', files: ['ingram-Media-Marketing.html', 'gift-Guide-Advertising-Holiday-Picks.html'], sectionId: 'advertising-item-section' },
  { id: 'book-exhibits', title: 'Book Exhibits and Conferences', files: ['national-Show.html', 'international-Show.html', 'nts.html', 'national.html', 'international.html'], sectionId: 'book-exhibits-item-section' },
  { id: 'genre-specific-marketing', title: 'Genre Specific Marketing', files: ['ingram-Supplement-Marketing.html'], sectionId: 'genre-specific-item-section' },
  { id: 'publicity-campaigns', title: 'Publicity Campaigns', files: ['publicity-News-Release.html', 'publicity-News-Release-Plus.html', 'social-Media.html', 'publicity.html', 'publicity-plus.html'], sectionId: 'publicity-campaigns-item-section' }
];
commentedOutSubcats.forEach(c => console.log(`  - ${c.title} (${c.files.length} services, section: ${c.sectionId})`));

// 3. Compare with catalog.json subcategories
console.log('\n--- 3. COMPARISON WITH catalog.json SUBCATEGORIES ---');
const catalogSubIds = new Set();
catalog.forEach(cat => cat.subcategories.forEach(sub => catalogSubIds.add(sub.id)));

commentedOutSubcats.forEach(c => {
  const exists = catalogSubIds.has(c.id);
  console.log(`  - "${c.title}" in catalog: ${exists ? 'YES' : 'MISSING!'}`);
});

// 4. Missing Services in catalog / ServicesPage
console.log('\n--- 4. DETAILED BREAKDOWN OF MISSING SERVICES/PAGES ---');

const missingItems = [
  // A. Publishing Packages
  {
    group: 'Publishing Packages',
    items: [
      { slug: 'founder-package', file: 'Founder-Package.html', title: 'Founder Package', price: '$1,299.00', status: 'In services/ directory, not in catalog or ServicesPage' },
      { slug: 'pioneer-package', file: 'Pioneer-Package.html', title: 'Pioneer Package', price: '$250.00', status: 'In services/ directory, not in catalog or ServicesPage' },
      { slug: 'voyager-package', file: 'Voyager-Package.html', title: 'Voyager Package', price: '$500.00', status: 'In services/ directory, not in catalog or ServicesPage' },
      { slug: 'navigator-package', file: 'navigator-Package.html', title: 'Navigator Package', price: '$1,299.00', status: 'In services/ directory and referenced in services.html line 1135, not in catalog or ServicesPage' }
    ]
  },
  // B. Formats
  {
    group: 'Formats',
    items: [
      { slug: 'electronic-format', file: null, title: 'Electronic Format / Digital Formatting & Distribution', price: '', status: 'In services.html section (lines 1308-1309) and ServicesPage.jsx SUBCATEGORY_DESCRIPTIONS line 347, but missing from catalog subcategories/services' }
    ]
  },
  // C. Interior Page Layout
  {
    group: 'Design Services > Interior Page Layout',
    items: [
      { slug: 'endnotes-formatting', file: 'endnotes-Formatting.html', title: 'Endnotes (End of Chapter)', price: '', status: 'In services.html (lines 1441-1443) and services/ directory, missing from catalog & ServicesPage' }
    ]
  },
  // D. Advertising Subcategory
  {
    group: 'Marketing Services > Advertising',
    items: [
      { slug: 'ingram-media-marketing', file: 'ingram-Media-Marketing.html', title: 'Ingram Media Marketing', price: '', status: 'In services.html (lines 763 & 1599) and services/ directory, missing from catalog & ServicesPage' },
      { slug: 'gift-guide-advertising-holiday-picks', file: 'gift-Guide-Advertising-Holiday-Picks.html', title: 'Gift Guide Advertising - Holiday Picks', price: '', status: 'In services.html (lines 764 & 1600) and services/ directory, missing from catalog & ServicesPage' }
    ]
  },
  // E. Book Exhibits Subcategory
  {
    group: 'Marketing Services > Book Exhibits and Conferences',
    items: [
      { slug: 'book-exhibit-national-show', file: 'national-Show.html', title: 'Book Exhibit – National Show', price: '', status: 'In services.html (lines 790 & 1656) and services/ directory, missing from catalog & ServicesPage' },
      { slug: 'book-exhibit-international-show', file: 'international-Show.html', title: 'Book Exhibit – International Show', price: '', status: 'In services.html (lines 791 & 1657) and services/ directory, missing from catalog & ServicesPage' },
      { slug: 'book-exhibit-nts', file: 'nts.html', title: 'Book Exhibit – NTS', price: '', status: 'In services.html (lines 792 & 1658) and services/ directory, missing from catalog & ServicesPage' },
      { slug: 'book-exhibit-plus-national', file: 'national.html', title: 'Book Exhibit Plus – National', price: '', status: 'In services.html (lines 793 & 1659) and services/ directory, missing from catalog & ServicesPage' },
      { slug: 'book-exhibit-plus-international', file: 'international.html', title: 'Book Exhibit Plus – International', price: '', status: 'In services.html (lines 794 & 1661) and services/ directory, missing from catalog & ServicesPage' }
    ]
  },
  // F. Genre Specific Marketing Subcategory
  {
    group: 'Marketing Services > Genre Specific Marketing',
    items: [
      { slug: 'ingram-supplement-marketing', file: 'ingram-Supplement-Marketing.html', title: 'Ingram Supplement Marketing', price: '', status: 'In services.html (lines 828 & 1770) and services/ directory, missing from catalog & ServicesPage' }
    ]
  },
  // G. Publicity Campaigns Subcategory
  {
    group: 'Marketing Services > Publicity Campaigns',
    items: [
      { slug: 'publicity-news-release', file: 'publicity-News-Release.html', title: 'Publicity News Release', price: '', status: 'In services.html (lines 873 & 1885) and services/ directory, missing from catalog & ServicesPage' },
      { slug: 'publicity-news-release-plus', file: 'publicity-News-Release-Plus.html', title: 'Publicity News Release Plus', price: '', status: 'In services.html (lines 874 & 1887) and services/ directory, missing from catalog & ServicesPage' },
      { slug: 'social-media', file: 'social-Media.html', title: 'Social Media (Publicity Campaign)', price: '', status: 'In services.html (lines 875 & 1889) and services/ directory, missing from catalog & ServicesPage' },
      { slug: 'publicity', file: 'publicity.html', title: 'Publicity (6-week campaign)', price: '', status: 'In services.html (lines 876 & 1891) and services/ directory, missing from catalog & ServicesPage' },
      { slug: 'publicity-plus', file: 'publicity-plus.html', title: 'Publicity Plus (12-week campaign)', price: '', status: 'In services.html (lines 877 & 1893) and services/ directory, missing from catalog & ServicesPage' }
    ]
  }
];

missingItems.forEach(group => {
  console.log(`\nGroup: ${group.group} (${group.items.length} items):`);
  group.items.forEach(it => {
    console.log(`  * ${it.title} [slug: ${it.slug}] (${it.file || 'no file'})`);
    console.log(`    -> Status: ${it.status}`);
  });
});
