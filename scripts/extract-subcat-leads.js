const fs = require('fs');
const html = fs.readFileSync('services.html', 'utf8');

// Match sections by ID
function extractSection(id) {
  const re = new RegExp(`<section[^>]*id=["']${id}["'][^>]*>([\\s\\S]*?)<\\/section>`, 'i');
  const m = html.match(re);
  if (!m) return '';
  const content = m[1];
  const afterH2 = content.split(/<\/h2>/i)[1] || '';
  const firstH5 = afterH2.split(/<h5|<a\s+class=["']drop-down-links/i)[0];
  return firstH5.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

const map = {
  'publishing-options': extractSection('publishing-Options-section') || 'Our packages offer various combinations of our publishing, editorial, and marketing services for a truly customized publishing experience. With Omni, you can choose the package that best suits your literary goals.',
  'editorial-evaluation': extractSection('editorial-services-section') || "The Editorial Evaluation is a manuscript checkup that assesses your work to be sure that it has fulfilled the basic requirements of a published book. The editorial evaluator will not only provide you with a general overview of your manuscript but will also educate you through constructive comments on how to write a better book.",
  'advanced-editorial-services': extractSection('advanced-services-item-section'),
  'author-assistance-editorial-services': extractSection('author-services-item-section'),
  'core-editorial-services': extractSection('core-editorial-item-section'),
  'cover-copy-polish': extractSection('cover-copy-item-section'),
  'indexing': extractSection('indexing-services-item-section'),
  'proofreading': extractSection('proofreading-services-item-section'),
  'audiobook-publishing': extractSection('audioBook-item-section'),
  'print-formats': extractSection('print-format-item-section'),
  'black-and-white-illustrations': extractSection('blacknWhite-item-section'),
  'color-illustrations': extractSection('color-illustrations-item-section'),
  'cover-design': extractSection('cover-design-item-section'),
  'interior-page-layout': extractSection('interior-page-item-section'),
  'stock-images': extractSection('stock-images-item-section'),
  'post-page-layout-services': extractSection('post-page-item-section'),
  'pre-manuscript-services': extractSection('pre-manuscript-item-section'),
  'resubmission': extractSection('resubmission-item-section'),
  'video-book-trailer': extractSection('authorNbook-item-section'),
  'book-reviews': extractSection('book-reviews-item-section'),
  'book-signings-and-galleries': extractSection('book-signings-item-section'),
  'hollywood-book-to-screen': extractSection('hollywood-book-item-section'),
  'internet-marketing': extractSection('internet-marketing-item-section'),
  'publicity-services': extractSection('publicityServices-item-section'),
  'radio-services': extractSection('radio-item-section'),
  'bookstore-essentials': extractSection('book-store-item-section'),
  'registration': extractSection('registration-item-section')
};

console.log(JSON.stringify(map, null, 2));
