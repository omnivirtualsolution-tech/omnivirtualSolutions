const fs = require('fs');
const path = require('path');

const catalogPath = path.resolve('Omni/frontend/src/data/catalog.json');
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

const CATEGORY_LEADS = {
  'publishing-packages': 'Our packages offer various combinations of our publishing, editorial, and marketing services for a truly customized publishing experience. With Omni, you can choose the package that best suits your literary goals.',
  'evaluation-services': 'Regardless of your publishing goals, the editorial quality of your work matters—no one wants to read a book that\'s riddled with typos and grammatical errors. Omni provides editorial evaluation services that will help you make your book the best it can be.',
  'editorial-services': 'Regardless of your publishing goals, the editorial quality of your work matters—no one wants to read a book that\'s riddled with typos and grammatical errors. Omni provides editorial services that will help you make your book the best it can be.',
  'formats': 'Through digital and print-on-demand (POD) technology, we can offer our authors these distinct formats for their books: Electronic Format, AudioBook Publishing, and Print Formats.',
  'design-services': 'Our team will work with you—incorporating your photos, graphics, sketches, and ideas—to create a professional book cover that beautifully represents your book\'s contents, and an interior page layout that is clean, clear, and easy to read.',
  'production': 'Preparing your manuscript for submission and for publishing is a whole lot easier when we do it for you. We provide these services to help ensure that your book is publishing-ready.',
  'marketing-services': 'If you want your book to sell, you’ll want to do more than just hope for the best. Our selection of promotional products and services allows authors to build a dynamic platform from which they can effectively promote and sell their books.',
  'bookselling': 'Once your book is published, we will make your book available for order online with online retail outlets worldwide. Our bookselling promotional services provide you the opportunity to actively promote your book.'
};

catalog.forEach(cat => {
  if (CATEGORY_LEADS[cat.id]) {
    cat.lead = CATEGORY_LEADS[cat.id];
    cat.description = CATEGORY_LEADS[cat.id];
  }
  (cat.subcategories || []).forEach(sub => {
    (sub.services || []).forEach(svc => {
      // Clear prices so user sets them in admin live edit
      svc.price = '';
      svc.price_display = '';
    });
  });
});

fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2), 'utf8');
console.log('Successfully updated catalog.json with category leads and cleared prices.');
