const fs = require('fs');
const html = fs.readFileSync('services.html', 'utf8');

// Match sections by ID
function extractSectionLead(id) {
  const re = new RegExp(`<section[^>]*id=["']${id}["'][^>]*>([\\s\\S]*?)<\\/section>`, 'i');
  const m = html.match(re);
  if (!m) return '';
  const content = m[1];
  const afterH2 = content.split(/<\/h2>/i)[1] || '';
  const firstH5 = afterH2.split(/<h5|<a\s+class=["']drop-down-links/i)[0];
  return firstH5.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

const SUBCAT_SECTION_MAPPING = {
  'publishing-options': 'publishing-Options-section',
  'editorial-evaluation': 'editorial-services-section',
  'advanced-editorial-services': 'advanced-services-item-section',
  'author-assistance-editorial-services': 'author-services-item-section',
  'core-editorial-services': 'core-editorial-item-section',
  'cover-copy-polish': 'cover-copy-item-section',
  'indexing': 'indexing-services-item-section',
  'proofreading': 'proofreading-services-item-section',
  'audiobook-publishing': 'audioBook-item-section',
  'print-formats': 'print-format-item-section',
  'black-and-white-illustrations': 'blacknWhite-item-section',
  'color-illustrations': 'color-illustrations-item-section',
  'cover-design': 'cover-design-item-section',
  'interior-page-layout': 'interior-page-item-section',
  'stock-images': 'stock-images-item-section',
  'post-page-layout-services': 'post-page-item-section',
  'pre-manuscript-services': 'pre-manuscript-item-section',
  'resubmission': 'resubmission-item-section',
  'video-book-trailer': 'authorNbook-item-section',
  'book-reviews': 'book-reviews-item-section',
  'book-signings-and-galleries': 'book-signings-item-section',
  'hollywood-book-to-screen': 'hollywood-book-item-section',
  'internet-marketing': 'internet-marketing-item-section',
  'publicity-services': 'publicityServices-item-section',
  'radio-services': 'radio-item-section',
  'bookstore-essentials': 'book-store-item-section',
  'registration': 'registration-item-section'
};

const leads = {};
for (const [subId, secId] of Object.entries(SUBCAT_SECTION_MAPPING)) {
  const lead = extractSectionLead(secId);
  leads[subId] = lead;
}

fs.writeFileSync('scripts/generated-subcat-leads.json', JSON.stringify(leads, null, 2), 'utf8');
console.log('Saved generated-subcat-leads.json with', Object.keys(leads).length, 'entries.');
