const fs = require('fs');
const path = require('path');

const catalogPath = path.join(__dirname, '../frontend/src/data/catalog.json');
const fullCatalogPath = path.join(__dirname, '../data/full-catalog.json');
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

const CATEGORY_OVERVIEWS = {
  'editorial-services': {
    slug: 'editorial-services',
    title: 'Editorial Services',
    price: '',
    lead: "Regardless of your publishing goals, the quality of your work matters—no one wants to read a book that's riddled with typos and grammatical errors. However, even the best writers make mistakes. Omni provides editorial services that will help you make your book the best it can be.",
    features: [
      'Comprehensive line-by-line grammar, spelling, and punctuation editing',
      'Advanced developmental and content evaluation for story and style',
      'Chicago Manual of Style compliant copyediting and proofreading',
      'Track changes markup in Microsoft Word for complete author transparency',
      'Dedicated editorial consultants guiding revisions at every stage',
      '100% author rights and royalty retention'
    ]
  },
  'formats': {
    slug: 'formats',
    title: 'Formats',
    price: '',
    lead: 'Omni offers versatile publishing formats designed to reach readers across print, digital, and audio landscapes with professional production standards.',
    features: [
      'Trade paperback publishing on acid-free, book-grade opaque stock',
      'Durable cloth-bound hardcover publishing with full-color dust jackets',
      'Reflowable and fixed-layout e-book formatting for Kindle, Apple, and Nook',
      'Professional and Do-It-Yourself audiobook production and distribution',
      'Global distribution across Amazon, Barnes & Noble, Ingram, and Kobo',
      '100% author rights and royalty retention'
    ]
  },
  'design-services': {
    slug: 'design-services',
    title: 'Design Services',
    price: '',
    lead: "Our team will work with you—incorporating your photos, graphics, sketches, and ideas—to create a professional book cover and interior layout that beautifully represents your book's contents.",
    features: [
      'Custom-designed full-color covers tailored to commercial bookstore standards',
      'Precision interior typesetting, typography, and page layout formatting',
      'Access to millions of high-resolution images via Getty Images',
      'Custom in-house black-and-white and color illustrations by studio artists',
      'Comprehensive design revisions and high-resolution electronic proofs',
      '100% author creative control and rights retention'
    ]
  },
  'production': {
    slug: 'production',
    title: 'Production Services',
    price: '',
    lead: 'Preparing your manuscript for submission and publishing is seamless when we do it for you. Omni handles everything from raw document conversion to post-layout revisions and catalog resubmissions.',
    features: [
      'Typewritten and handwritten manuscript data entry and transcription',
      'High-resolution image scanning, extraction, and digital graphic conversions',
      'Basic and extensive manuscript formatting corrections',
      'Post-layout text and image revisions during proofing stages',
      'Global title resubmission for live published books across retail channels',
      'Dedicated production specialists managing your book setup'
    ]
  },
  'marketing-services': {
    slug: 'marketing-services',
    title: 'Marketing Services',
    price: '',
    lead: 'If you want your book to sell, you’ll want to do more than just hope for the best. Our selection of promotional products and services allows authors to build a dynamic platform from which they can effectively promote and sell their books.',
    features: [
      'Cinematic book video trailers and professional author interview features',
      'Press release creation and distribution to 500+ media outlets and PRWeb',
      'Editorial book reviews from trusted industry reviewers (Kirkus, Indie)',
      'Exhibition space at major international book fairs and LA Times Festival',
      'Hollywood Book-to-Screen coverage, treatments, and screenplays',
      'Search engine marketing (SEM), Google display ads, and social media campaigns',
      'Syndicated radio book talk interviews and podcast broadcasting'
    ]
  },
  'bookselling': {
    slug: 'bookselling',
    title: 'Bookselling',
    price: '',
    lead: 'Once your book is published, we will make your book available for order online with retail outlets worldwide. Our bookselling promotional services provide you the opportunity to actively promote and protect your book.',
    features: [
      'Booksellers Return Program for risk-free physical bookstore stocking',
      'Custom retail pricing control through Set Your Own Price',
      'Author Advantage Royalty Program maximizing print earnings',
      'Targeted retail pitches to 25 independent bookstores and libraries',
      'Official U.S. Copyright Office registration and Certificate of Registration',
      'Library of Congress Control Number (LCCN) for national library indexing'
    ]
  }
};

catalog.forEach((cat) => {
  if (CATEGORY_OVERVIEWS[cat.id]) {
    const overview = CATEGORY_OVERVIEWS[cat.id];
    // Check if first subcategory already has it
    if (cat.subcategories && cat.subcategories.length > 0) {
      const firstSub = cat.subcategories[0];
      const existingIdx = firstSub.services.findIndex(s => s.slug === overview.slug);
      if (existingIdx >= 0) {
        firstSub.services[existingIdx] = overview;
      } else {
        // Prepend overview to first subcategory
        firstSub.services.unshift(overview);
      }
    }
  }
});

fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2), 'utf8');
fs.writeFileSync(fullCatalogPath, JSON.stringify(catalog, null, 2), 'utf8');

console.log('Category overviews successfully injected into catalog.json and full-catalog.json.');
