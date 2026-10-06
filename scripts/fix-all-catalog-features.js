const fs = require('fs');
const path = require('path');

const catalogPath = path.join(__dirname, '../frontend/src/data/catalog.json');
const fullCatalogPath = path.join(__dirname, '../data/full-catalog.json');
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

// Helper to clean features:
// Turn a long sentence or paragraph into a concise bullet point (<= 85 chars)
// Strip quotes, attributions, unnecessary filler
function cleanBullet(str) {
  if (!str) return '';
  let s = str.trim();
  // If it's a quote or attribution, skip or transform
  if (s.startsWith('"') || s.startsWith('“') || s.startsWith('—') || s.startsWith('-') || s.includes('author of')) {
    return null;
  }
  // Remove markdown or html tags
  s = s.replace(/<[^>]+>/g, '').replace(/\*+/g, '').trim();

  // If already reasonable length
  if (s.length <= 95) return s;

  // If it contains a colon, take the prefix + concise summary
  if (s.includes(':')) {
    const parts = s.split(':');
    const label = parts[0].trim();
    const rest = parts.slice(1).join(':').trim();
    const firstSent = rest.split('.')[0].trim();
    const combined = `${label}: ${firstSent}`;
    if (combined.length <= 90) return combined;
    return label;
  }

  // Take the first sentence
  const firstSentence = s.split('.')[0].trim();
  if (firstSentence.length <= 95 && firstSentence.length > 15) {
    return firstSentence;
  }

  // Truncate cleanly at word boundary
  const words = s.split(/\s+/);
  let res = '';
  for (const w of words) {
    if ((res + ' ' + w).trim().length > 80) break;
    res = (res + ' ' + w).trim();
  }
  return res;
}

// Specific curated fixes for corrupted or key services
const CURATED_SERVICES = {
  'developmental-editing': {
    title: 'Developmental Editing',
    lead: 'The Omni Developmental Editing service combines three editorial services into one package: First, a developmental editor evaluates the manuscript at the paragraph, chapter, and book levels to identify big-picture areas that need work. Second, a content editor checks for errors in grammar, spelling, and punctuation. And third, the manuscript receives a quality review before production.',
    features: [
      'Comprehensive paragraph, chapter, and manuscript-level evaluation',
      'Big-picture developmental guidance on plot, pace, and character arc',
      'Full line-by-line content edit covering grammar, spelling, and style',
      'Quality review ensuring manuscript is production-ready',
      'Track changes and editor commentary in Microsoft Word',
      '100% author rights and royalty retention'
    ]
  },
  'book-doctor': {
    title: 'Book Doctor',
    lead: 'Following the advice of a professional editor takes time and careful consideration. A book doctor makes the changes recommended by the developmental editor and approved by the author. Hiring a book doctor is the ideal choice for authors who want professional execution of big-picture revisions.',
    features: [
      'Professional rewriting and structural reorganization',
      'Execution of all approved developmental editor recommendations',
      'Subsequent Content Editing included at no extra cost',
      'Comprehensive Quality Review before final production',
      'Direct consultation with your assigned editorial team'
    ]
  },
  'set-your-own-price': {
    title: 'Set Your Own Price',
    lead: "Take control of your book's retail price and the royalties you earn. The Set Your Own Price service allows authors to establish custom retail pricing for paperback and hardcover editions, giving you complete flexibility to optimize book sales volume or royalty margins across global book distribution networks.",
    features: [
      'Custom retail pricing control for paperback and hardcover editions',
      'Flexibility to optimize author royalty margins or promotional volume',
      'Direct distribution updates across Ingram, Amazon, and global retailers',
      'Price modification support with guidance from your publishing consultant',
      '100% author rights and royalty retention'
    ]
  },
  'author-advantage-royalty-program': {
    title: 'Author Advantage Royalty Program',
    lead: 'The Author Advantage Royalty Program empowers you to earn substantial financial gains with every print book sold. This 3-year term program maximizes your profit margin on all retail distribution channels.',
    features: [
      '3-Year Term maximizing author royalty margins on print sales',
      'Substantially higher royalty payouts across global retailers',
      'Comprehensive sales and royalty reporting portal',
      'Eligible for softcover and hardcover retail editions',
      'Dedicated author account support'
    ]
  },
  'retail-focus': {
    title: 'Retail Focus',
    lead: 'Have your book pitched directly to 25 independent bookstores across the United States. Our retail sales specialists actively present your book to regional booksellers to secure shelf space and local bookstore stocking.',
    features: [
      'Direct pitch to 25 curated independent bookstores across the US',
      'Targeted regional focus tailored to your book genre and themes',
      'Guaranteed retailer evaluation and stocking consideration',
      'Professional sales sheet and sell-sheet distribution',
      'Follow-up reporting on bookseller interest and placement'
    ]
  },
  'retail-focus-for-childrens-books': {
    title: "Retail Focus for Children's Books",
    lead: "Targeted bookstore pitching specifically designed for children's picture books, middle grade, and young adult titles. We pitch directly to 25 independent children's book retailers and specialty stores nationwide.",
    features: [
      "Direct pitch to 25 specialty children's bookstores across the US",
      'Focus on independent children’s book buyers and school suppliers',
      'Customized sales presentation highlighting illustrations and age range',
      'Professional sell-sheet highlighting themes and reading level',
      'Detailed outreach reporting'
    ]
  },
  'library-focus': {
    title: 'Library Focus',
    lead: 'Get your book into the hands of librarians and acquisition specialists. Omni pitches your title directly to Collection Development Departments and Acquisition Librarians across public and academic library systems.',
    features: [
      'Direct pitch to Acquisition Librarians and Collection Development Departments',
      'Custom cataloging presentation compliant with library standards',
      'Wholesale availability verification via Ingram and Baker & Taylor',
      'Detailed library outreach and interest reporting',
      'Enhanced institutional discoverability'
    ]
  },
  'booksellers-return-program': {
    title: 'Booksellers Return Program',
    lead: "Bookstores are reluctant to stock titles from independent authors unless they are returnable. The Booksellers Return Program designates your book as 'Returnable' in Ingram and Baker & Taylor systems, eliminating risk for retail buyers.",
    features: [
      'Designated as "Returnable" in Ingram ipage ordering system',
      'Designated as "Returnable" in Baker & Taylor ordering system',
      'Removes financial risk for physical bookstore purchasing',
      '12-Month coverage period with automatic renewal options',
      'Dramatically increases probability of physical bookstore shelf stocking'
    ]
  },
  'booksellers-return-program-renewal': {
    title: 'Booksellers Return Program Renewal',
    lead: 'Renew your valuable Booksellers Return Program for an additional year to maintain active returnable status across Ingram and Baker & Taylor, ensuring bookstores continue stocking your book without hesitation.',
    features: [
      '12-Month extension of active returnable status',
      'Continuous uninterrupted listing in Ingram and Baker & Taylor',
      'Ongoing physical bookstore purchase eligibility',
      'Dedicated distribution account management',
      'Transparent inventory reporting'
    ]
  },
  'us-copyright-registration': {
    title: 'US Copyright Registration',
    lead: 'Protect your intellectual property by registering your copyright with the United States Copyright Office. Omni handles the entire application process, legal filing fees, and physical submission of required deposit copies.',
    features: [
      'Official application preparation and filing with the U.S. Copyright Office',
      'Submission of required physical deposit copies',
      'Official Certificate of Registration issued in your name',
      'Public legal record establishing your ownership and rights',
      'Comprehensive intellectual property protection'
    ]
  },
  'library-of-congress-control-number': {
    title: 'Library of Congress Control Number',
    lead: 'A Library of Congress Control Number (LCCN) makes your book accessible to librarians, bibliographic utilities, and book vendors worldwide. Omni secures this unique identifier and prints it inside your book title page.',
    features: [
      'Official LCCN application and assignment through the Library of Congress',
      'LCCN printed directly on the copyright/title page of your book',
      'Indexed in national library bibliographic databases',
      'Facilitates institutional acquisition by public and academic libraries',
      'Eligible for all qualifying trade publications'
    ]
  },
  'author-website-setup': {
    title: 'Author Website Setup',
    lead: 'A professional author website serves as your digital headquarters, portfolio, and central hub to connect with readers worldwide. Omni creates a modern, responsive, search-engine-optimized website tailored to your author brand.',
    features: [
      'Custom responsive design optimized for mobile, tablet, and desktop',
      'Up to 10 professionally formatted pages (Bio, Books, Blog, Contact, Events)',
      'Social media integration and direct newsletter signup forms',
      'Search engine optimization (SEO) setup for author discoverability',
      'Custom domain connection and 1 year of hosting included'
    ]
  },
  'press-release-essential-edition': {
    title: 'Press Release - Essential Edition',
    lead: 'Let a media expert craft a compelling press release that promotes your book and distribute it to at least 500 media outlets nationwide, complete with one full month of comprehensive news tracking and clip reporting.',
    features: [
      'Professionally written press release by an experienced publicist',
      'Targeted distribution to a minimum of 500 media outlets',
      'Targeting based on your book genre, subject, and geographic focus',
      'One month of comprehensive media tracking and clip monitoring',
      'Search engine indexing for immediate digital discoverability'
    ]
  },
  'press-release-web-optimized-edition': {
    title: 'Press Release - Web Optimized Edition',
    lead: 'A Web-optimized, professionally written press release distributed to as many as 30,000 opt-in journalists and more than 250,000 news subscribers through PRWeb, complete with permanent online archiving and news tracking.',
    features: [
      'Web-optimized press release infused with high-value search keywords',
      'Distribution to up to 30,000 opt-in journalists and newsrooms',
      'Exposure to over 250,000 RSS news subscribers via PRWeb',
      'Permanent hosting and high-domain-authority backlink generation',
      'Detailed analytics reporting on impressions, reads, and clicks'
    ]
  },
  'radio-book-talk': {
    title: 'Radio Book Talk',
    lead: 'Introduce your book to the literary world with Emmy Award-winning host Kate Delaney. Plus, reach thousands of engaged booklovers through two popular literary podcasts: Books on Air and Newsgram.',
    features: [
      '8 to 12-minute interview on America Tonight with Kate Delaney',
      '15-minute in-depth online interview featured on Books on Air',
      'Feature segment on WebTalkRadio’s syndicated Newsgram show',
      'Digital audio file provided for author promotional use',
      'Syndicated broadcast reaching nationwide listeners'
    ]
  },
  'audio-snip': {
    title: 'Audio Snip',
    lead: 'The Audio Snip service serves as a high-impact audio trailer of your book. With this service, you take your story directly to the airwaves with a professionally produced 30-second teaser talking about your work.',
    features: [
      '30-second professionally produced audio teaser commercial',
      'Broadcast on popular radio stations and digital streaming channels',
      'Direct purchase information and author website call-to-action',
      'Digital audio file provided for author social media promotion',
      'High-impact promotional reach'
    ]
  },
  'online-interview': {
    title: 'Online Interview',
    lead: 'Position yourself as an authority in your genre with a dedicated online radio interview. Digitally recorded and syndicated across podcast platforms, this interview provides evergreen marketing collateral.',
    features: [
      'In-depth recorded radio interview focused on you and your book',
      'Syndicated distribution across Apple Podcasts, Spotify, and Toginet',
      'Master digital audio copy provided for author website and marketing',
      'Social media promotional assets highlighting the broadcast',
      'Evergreen audio asset to build author credibility'
    ]
  },
  'professional-indexing': {
    title: 'Professional Indexing',
    lead: 'To maximize the usability of a nonfiction title, readers, book buyers, librarians, and reviewers expect a comprehensive index. An Omni professional indexer reads your manuscript thoroughly to create a complete alphabetical index.',
    features: [
      'Comprehensive manual indexing by an experienced professional indexer',
      'Thorough analysis of main topics, subtopics, and key conceptual terms',
      'Cross-referencing and see/see also locator entries',
      'Chicago Manual of Style compliant formatting',
      'Essential for academic, historical, and professional nonfiction works'
    ]
  },
  'small-book-review-with-editing': {
    title: 'Small Book Review with Editing (Under 5,000 Words)',
    lead: 'Tailored specifically for short stories, children’s book manuscripts, and chapbooks under 5,000 words. Combines an editorial evaluation with line-by-line editing to make your short manuscript shine.',
    features: [
      'Comprehensive review tailored for manuscripts under 5,000 words',
      'Line-by-line grammar, punctuation, spelling, and syntax check',
      'Evaluator feedback on pacing, character development, and theme',
      'Track changes and constructive notes in Microsoft Word',
      'Ideal for children’s books, essays, and short fiction'
    ]
  }
};

console.log('Applying fixes to catalog...');

// Update catalog
catalog.forEach((cat) => {
  cat.subcategories.forEach((sub) => {
    sub.services.forEach((s) => {
      // Check curated
      if (CURATED_SERVICES[s.slug]) {
        const cur = CURATED_SERVICES[s.slug];
        s.title = cur.title;
        s.lead = cur.lead;
        s.features = cur.features;
        return;
      }

      // Otherwise clean features
      if (Array.isArray(s.features)) {
        const cleaned = s.features
          .map(f => cleanBullet(f))
          .filter(f => f && f.length >= 10 && f.length <= 110);
        
        // If too few remain, supply good default features based on subcategory
        if (cleaned.length < 2) {
          s.features = [
            `Professional ${s.title} tailored to your publishing goals`,
            'Dedicated specialist consultation and project management',
            'Full compliance with industry publishing standards',
            '100% author rights and royalty retention'
          ];
        } else {
          s.features = cleaned.slice(0, 6);
        }
      }
    });
  });
});

fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2), 'utf8');
fs.writeFileSync(fullCatalogPath, JSON.stringify(catalog, null, 2), 'utf8');

console.log('Saved catalog.json and full-catalog.json successfully.');
