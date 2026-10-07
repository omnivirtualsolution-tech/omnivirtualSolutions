const fs = require('fs');
const path = require('path');

const servicesDir = path.resolve(__dirname, '../services');
const servicesHtmlPath = path.resolve(__dirname, '../services.html');

function cleanText(txt) {
  if (!txt) return '';
  return txt
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"')
    .replace(/&ndash;/g, '-')
    .replace(/&mdash;/g, '--')
    .replace(/&bull;/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/['"’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseServiceFile(filePath, menuLabel) {
  if (!fs.existsSync(filePath)) {
    return {
      title: menuLabel,
      lead: `${menuLabel} provides tailored publishing, editorial, and author support designed to elevate your book's reach and impact.`,
      features: [
        'Dedicated expert consultation throughout the project',
        'Professional execution adhering to industry publishing standards',
        '100% author rights and royalty retention'
      ],
      price: ''
    };
  }

  let html = fs.readFileSync(filePath, 'utf8');

  // Check for uncommented price
  let price = '';
  // Look for active <p class="price">
  const cleanCommentsHtml = html.replace(/<!--[\s\S]*?-->/g, '');
  const activePriceMatch = cleanCommentsHtml.match(/class=["']price["'][^>]*>[\s\S]*?<strong>([\s\S]*?)<\/strong>/i);
  if (activePriceMatch) {
    price = cleanText(activePriceMatch[1]);
  }

  // Title: Use menuLabel as authoritative, or h1 if closely aligned
  let title = menuLabel;
  const h1Match = cleanCommentsHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1Match) {
    const rawH1 = cleanText(h1Match[1]);
    if (rawH1 && (rawH1.toLowerCase().includes(menuLabel.toLowerCase().slice(0, 8)) || menuLabel.toLowerCase().includes(rawH1.toLowerCase().slice(0, 8)))) {
      title = rawH1;
    }
  }

  // Extract main-content section from cleanCommentsHtml
  const mainMatch = cleanCommentsHtml.match(/<section[^>]*id=["']main-content["'][^>]*>([\s\S]*?)<\/section>/i);
  const contentScope = mainMatch ? mainMatch[1] : cleanCommentsHtml;

  // Extract features from <li> items in contentScope
  const features = [];
  const liMatches = [...contentScope.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)];
  for (const m of liMatches) {
    const feat = cleanText(m[1]);
    if (feat && feat.length > 5 && !feat.toLowerCase().includes('email admin@')) {
      features.push(feat);
    }
  }

  // Extract paragraphs for lead
  const pMatches = [...contentScope.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)];
  const paras = [];
  for (const p of pMatches) {
    const rawP = p[1];
    if (rawP.includes('class="price"') || rawP.includes('class=\'price\'')) continue;
    const cleaned = cleanText(rawP);
    if (!cleaned) continue;
    if (cleaned.toLowerCase().startsWith('email admin@')) continue;
    if (cleaned.toLowerCase().startsWith('disclaimer:')) continue;
    if (cleaned.toLowerCase().startsWith('what you get:')) continue;
    if (cleaned.toLowerCase().startsWith('how it works:')) continue;
    if (cleaned.includes('$1,299.00')) continue;
    paras.push(cleaned);
  }

  let lead = paras.length > 0 ? paras[0] : `${title} is a specialized author service from Omni Virtual Solution.`;
  if (lead.length < 50 && paras.length > 1) {
    lead = paras[0] + ' ' + paras[1];
  }

  // If no features found in <li>, make features from next paragraphs or defaults
  if (features.length === 0) {
    if (paras.length > 1) {
      for (let i = 1; i < Math.min(paras.length, 5); i++) {
        if (paras[i].length > 15 && !paras[i].startsWith('*')) {
          features.push(paras[i]);
        }
      }
    }
  }
  if (features.length === 0) {
    features.push('Complete project delivery with dedicated support');
    features.push('Full intellectual property and author royalty retention');
    features.push('Personalized publishing and marketing consultation');
  }

  return { title, lead, features, price };
}

// Parse the 8 categories from sidebar
const categoriesConfig = [
  {
    id: 'publishing-packages',
    title: 'Publishing Packages',
    tag: 'eval-services',
    icon: 'bi-book-half',
    subcats: [
      {
        id: 'publishing-options',
        title: 'Publishing Options',
        services: [
          {
            slug: 'publishing-packages',
            title: 'Publishing Packages',
            price: '',
            lead: "Our packages are designed to offer authors the support and tools they need to maximize their book's potential. Each package guarantees one-on-one author support for every step of the self-publishing journey. We offer unique packages, enabling authors to choose the package that best fits their book's needs.",
            features: [
              'One-on-one author support for every step of the self-publishing journey',
              "Unique packages enabling authors to choose the tier that best fits their book's needs",
              'Digital formatting and distribution for e-books, paperbacks, and hardcovers',
              'Custom cover layout and professional interior formatting',
              'Worldwide distribution across Amazon, Barnes & Noble, and Ingram',
              'ISBN assignment, US Copyright registration, and Library of Congress Control Number'
            ]
          },
          {
            slug: 'basic-package',
            title: 'Basic Package',
            price: '$899.00',
            lead: 'The Basic package is designed for authors seeking basic publishing needs. It includes digital formatting and distribution for e-books, paperback publishing, and customization options for the interior and cover.',
            features: [
              'Digital Formatting and Distribution (E-Book)',
              'Paperback Publishing',
              'Customization of Interior and Cover',
              'Image Insertions Up to 25',
              'Electronic Proofs of Your Book',
              'Interior Revisions – One Block of 50',
              'One-On-One Author Support',
              'West Harmony Bookstore Availability',
              'Online Distribution through Amazon, Barnes & Noble, and Other Book Retailers',
              'ISBN Assignment',
              'U.S. Copyright',
              'Library of Congress Control Number',
              '3 Paperback Copies',
              'Amazon Look Inside',
              'Google Preview',
              'Barnes & Noble Read Instantly',
              '12-Month Bookseller Return Program'
            ]
          },
          {
            slug: 'standard-package',
            title: 'Standard Package',
            price: '$1,599.00',
            lead: 'Building on the Basic, the Standard package adds hardcover publishing to the mix, enhancing the physical presence of your book. This package maintains all the services of the Basic package, including the customization, support, and online distribution features.',
            features: [
              'Digital Formatting and Distribution (E-Book)',
              'Paperback Publishing',
              'Hardcover Publishing',
              'Customization of Interior and Cover',
              'Image Insertions Up to 25',
              'Electronic Proofs of Your Book',
              'Interior Revisions – One Block of 50',
              'One-On-One Author Support',
              'West Harmony Bookstore Availability',
              'Online Distribution through Amazon, Barnes & Noble, and Other Book Retailers',
              'ISBN Assignment',
              'U.S. Copyright',
              'Library of Congress Control Number',
              '3 Paperback Copies',
              '1 Hardcover Copy',
              'Amazon Look Inside',
              'Google Preview',
              'Barnes & Noble Read Instantly',
              '36-Month Bookseller Return Program'
            ]
          },
          {
            slug: 'advanced-package',
            title: 'Advanced Package',
            price: '$4,999.00',
            lead: 'The Advanced package is the most comprehensive, designed for authors who want extensive support and marketing tools. It includes everything from the Standard package, but boosts the number of copies provided to 20 paperbacks and 5 hardcovers.',
            features: [
              'Digital Formatting and Distribution (E-Book)',
              'Paperback Publishing',
              'Hardcover Publishing',
              'Customization of Interior and Cover',
              'Image Insertions Up to 25',
              'Electronic Proofs of Your Book',
              'Interior Revisions – One Block of 50',
              'One-On-One Author Support',
              'West Harmony Bookstore Availability',
              'Online Distribution through Amazon, Barnes & Noble, and Other Book Retailers',
              'ISBN Assignment',
              'U.S. Copyright',
              'Library of Congress Control Number',
              'Amazon Look Inside',
              'Google Preview',
              'Barnes & Noble Read Instantly',
              '60-Month Bookseller Return Program',
              '20 Paperback Copies',
              '5 Hardcover Copies',
              'Online Book Ads via Google - 30 days Package',
              'Kirkus Book Review',
              'Deluxe Website Setup'
            ]
          }
        ]
      }
    ]
  },
  {
    id: 'evaluation-services',
    title: 'Evaluation Services',
    tag: 'editorial-services',
    icon: 'bi-journal-check',
    subcats: [
      {
        id: 'editorial-evaluation',
        title: 'Editorial Evaluation',
        items: [
          { file: 'editorial-Evaluation.html', label: 'Editorial Evaluation' }
        ]
      }
    ]
  },
  {
    id: 'editorial-services',
    title: 'Editorial Services',
    tag: 'combined-dropdown',
    icon: 'bi-pencil-square',
    subcats: [
      {
        id: 'advanced-editorial-services',
        title: 'Advanced Editorial Services',
        items: [
          { file: 'developmental-Editing.html', label: 'Developmental Editing' },
          { file: 'book-Doctor.html', label: 'Book Doctor' }
        ]
      },
      {
        id: 'author-assistance-editorial-services',
        title: 'Author Assistance Editorial Services',
        items: [
          { file: 'quality-Review-Copyediting.html', label: 'Quality Review - Copyediting' },
          { file: 'quality-Review-Line-Editing.html', label: 'Quality Review - Line Editing' },
          { file: 'quality-Review-Content-Editing.html', label: 'Quality Review - Content Editing' },
          { file: 'editorial-Assistant-Copyediting.html', label: 'Editorial Assistant - Copyediting' },
          { file: 'editorial-Assistant-Line-Edit.html', label: 'Editorial Assistant - Line Edit' },
          { file: 'editorial-Assistant-Content-Edit.html', label: 'Editorial Assistant - Content Edit' },
          { file: 'editorial-Assistant-Content-Edit-Plus.html', label: 'Editorial Assistant - Content Edit Plus' }
        ]
      },
      {
        id: 'core-editorial-services',
        title: 'Core Editorial Services',
        items: [
          { file: 'small-Book-Review-with-Editing.html', label: 'Small Book Review with Editing (Under 5,000 Words)' },
          { file: 'copyediting.html', label: 'Copyediting' },
          { file: 'line-editing.html', label: 'Line Editing' },
          { file: 'content-Editing.html', label: 'Content Editing' },
          { file: 'content-Editing-Plus.html', label: 'Content Editing Plus' }
        ]
      },
      {
        id: 'cover-copy-polish',
        title: 'Cover Copy Polish',
        items: [
          { file: 'cover-Copy-Polish.html', label: 'Cover Copy Polish' }
        ]
      },
      {
        id: 'indexing',
        title: 'Indexing',
        items: [
          { file: 'professional-Indexing.html', label: 'Professional Indexing' },
          { file: 'indexingsub1.html', label: 'Computer Generated Keyword Indexing - Up to 500 Entries' },
          { file: 'indexingsub2.html', label: 'Computer Generated Keyword Indexing - Up to 700 Entries' },
          { file: 'indexingsub3.html', label: 'Computer Generated Keyword Indexing - Up to 1,000 Entries' },
          { file: 'indexingsub4.html', label: 'Computer Generated Keyword Indexing - Custom Quote' }
        ]
      },
      {
        id: 'proofreading',
        title: 'Proofreading',
        items: [
          { file: 'proofreading.html', label: 'Proofreading' }
        ]
      }
    ]
  },
  {
    id: 'formats',
    title: 'Formats',
    tag: 'formats-dropdown',
    icon: 'bi-layers-fill',
    subcats: [
      {
        id: 'audiobook-publishing',
        title: 'AudioBook Publishing',
        items: [
          { file: 'do-It-Yourself-Audiobook.html', label: 'Do-It-Yourself Audiobook' },
          { file: 'professional-Audiobook-Package.html', label: 'Professional Audiobook Package' }
        ]
      },
      {
        id: 'print-formats',
        title: 'Print Formats',
        items: [
          { file: 'softcover-Publishing.html', label: 'Softcover Publishing' },
          { file: 'hardcover-Publishing.html', label: 'Hardcover Publishing' },
          { file: 'book-Binding-Sizes-and-Types.html', label: 'Book Binding Sizes and Types' }
        ]
      }
    ]
  },
  {
    id: 'design-services',
    title: 'Design Services',
    tag: 'design-dropdown',
    icon: 'bi-palette-fill',
    subcats: [
      {
        id: 'black-and-white-illustrations',
        title: 'Black-and-White Illustrations',
        items: [
          { file: 'fine-detail.html', label: 'Black-and-White Illustrations - Fine Detail' },
          { file: 'personalized.html', label: 'Black-and-White Illustrations - Personalized' }
        ]
      },
      {
        id: 'color-illustrations',
        title: 'Color Illustrations',
        items: [
          { file: 'intricate-Design.html', label: 'Color Illustrations - Intricate Design' },
          { file: 'color-Illustrations-Detail.html', label: 'Color Illustrations - Fine Detail' },
          { file: 'color-Illustrations-Personalized.html', label: 'Color Illustrations - Personalized' }
        ]
      },
      {
        id: 'cover-design',
        title: 'Cover Design',
        items: [
          { file: 'elite-Cover-Design.html', label: 'Elite Cover Design' },
          { file: 'custom-Cover-Illustration.html', label: 'Custom Cover Illustration' },
          { file: 'text.html', label: 'Cover Revisions (Text)' },
          { file: 'images-design.html', label: 'Cover Revisions (Images/Design)' }
        ]
      },
      {
        id: 'interior-page-layout',
        title: 'Interior Page Layout',
        items: [
          { file: 'elite-Interior-Design.html', label: 'Elite Interior Design' },
          { file: 'color-Image-Insertion.html', label: 'Color Image Insertion' },
          { file: 'custom-Layout-Tech.html', label: 'Custom Layout Tech' },
          { file: 'table-of-Contents.html', label: 'Table of Contents (Two or More)' },
          { file: 'table-Creation.html', label: 'Table Creation' },
          { file: 'footnote-Formatting.html', label: 'Footnote Formatting' },
          { file: 'custom-Headers.html', label: 'Custom Headers' },
          { file: 'bw-image-insertion.html', label: 'B&W Image Insertion' },
          { file: 'interior-Revisions.html', label: 'Interior Revisions (Block of 25)' }
        ]
      },
      {
        id: 'stock-images',
        title: 'Stock Images',
        items: [
          { file: 'stock-Image-Processing.html', label: 'Stock Image Processing' }
        ]
      }
    ]
  },
  {
    id: 'production',
    title: 'Production',
    tag: 'production-dropdown',
    icon: 'bi-gear-fill',
    subcats: [
      {
        id: 'post-page-layout-services',
        title: 'Post-Page Layout Services',
        items: [
          { file: 'retech.html', label: 'Retech' },
          { file: 'title-Change-After-Setup.html', label: 'Title Change After Setup' }
        ]
      },
      {
        id: 'pre-manuscript-services',
        title: 'Pre-Manuscript Services',
        items: [
          { file: 'color-Image-Scanning.html', label: 'Color Image Scanning' },
          { file: 'basic-Manuscript-Formatting-Corrections.html', label: 'Basic Manuscript Formatting Corrections' },
          { file: 'extensive-Customized-Formatting.html', label: 'Extensive Customized Formatting' },
          { file: 'data-entry-standard.html', label: 'Data Entry - Standard' },
          { file: 'spanish.html', label: 'Data Entry - Spanish' },
          { file: 'handwritten.html', label: 'Data Entry - Handwritten' },
          { file: 'large-Image-Scanning.html', label: 'Large Image Scanning' },
          { file: 'bw-image-scanning.html', label: 'B&W Image Scanning' },
          { file: 'manuscript-File-Conversion.html', label: 'Manuscript File Conversion' },
          { file: 'graphic-File-Conversions.html', label: 'Graphic File Conversions (Quantity: 25)' },
          { file: 'file-Merging.html', label: 'File Merging' },
          { file: 'image-Extraction.html', label: 'Image Extraction' }
        ]
      },
      {
        id: 'resubmission',
        title: 'Resubmission',
        items: [
          { file: 'one-version.html', label: 'Resubmission (One Version)' },
          { file: 'two-version.html', label: 'Resubmission (Two Version)' }
        ]
      }
    ]
  },
  {
    id: 'marketing-services',
    title: 'Marketing Services',
    tag: 'marketing-dropdown',
    icon: 'bi-megaphone-fill',
    subcats: [
      {
        id: 'video-book-trailer',
        title: 'Video Book Trailer',
        items: [
          { file: 'bookblast-Video-Marketing-Stand-alone.html', label: 'Bookblast Video Marketing - Stand-alone (30days)' },
          { file: 'standard-Book-Video.html', label: 'Standard Book Video' },
          { file: 'premium-Book-Video.html', label: 'Premium Book Video' },
          { file: 'bookblast-Video-Marketing-Standard.html', label: 'Bookblast Video Marketing - Standard' },
          { file: 'bookblast-Video-Marketing-Premium.html', label: 'Bookblast Video Marketing - Premium' },
          { file: 'video-Marketing.html', label: '15-sec Video Marketing' },
          { file: 'video-Book-Talk.html', label: 'Video Book Talk' }
        ]
      },
      {
        id: 'book-reviews',
        title: 'Book Reviews',
        items: [
          { file: 'indie-Book-Review-Bundle.html', label: 'Indie Book Review Bundle' },
          { file: 'literary-Gateway-Bundle.html', label: 'Literary Gateway Bundle' },
          { file: 'review-Duo.html', label: 'Review Duo' },
          { file: 'review-Duo-Plus.html', label: 'Review Duo Plus' },
          { file: 'the-Trifecta-Review-Service.html', label: 'The Trifecta Review Service' }
        ]
      },
      {
        id: 'book-signings-and-galleries',
        title: 'Book Signings and Galleries',
        items: [
          { file: 'join-the-LA-Times-Festival-of-Books-2025.html', label: 'Join the LA Times Festival of Books 2025!' }
        ]
      },
      {
        id: 'hollywood-book-to-screen',
        title: 'Hollywood Book-to-Screen',
        items: [
          { file: 'hollywood-Coverage.html', label: 'Hollywood Coverage' },
          { file: 'hollywood-Treatment.html', label: 'Hollywood Treatment' },
          { file: 'hollywood-Screenplay.html', label: 'Hollywood Screenplay' }
        ]
      },
      {
        id: 'internet-marketing',
        title: 'Internet Marketing',
        items: [
          { file: 'sem-1000-clicks.html', label: 'SEM - 1000 clicks' },
          { file: 'social-media-30-day-Content-Plan.html', label: 'Social Media 30-day Content Plan' },
          { file: 'social-Media-30-day-Strategy.html', label: 'Social Media 30-day Strategy' },
          { file: 'kirkus-Title-Express.html', label: 'Kirkus Title Express' },
          { file: 'online-Booksellers-Advertising.html', label: 'Online Booksellers Advertising' },
          { file: 'e-book-Promo-Venture-30-days.html', label: 'E-book Promo Venture - 30 days' },
          { file: 'e-book-Promo-Launcher.html', label: 'E-book Promo Launcher' },
          { file: 'social-Media-Advertising-Basic.html', label: 'Social Media Advertising Basic' },
          { file: 'social-Media-Advertising-Essential.html', label: 'Social Media Advertising Essential' },
          { file: 'social-Media-Advertising-Advanced.html', label: 'Social Media Advertising Advanced' },
          { file: 'display-Advertising-on-Google-30-days-Package.html', label: 'Display Advertising on Google - 30 days Package' },
          { file: 'sem-Advanced-Campaign.html', label: 'SEM - Advanced Campaign' },
          { file: 'sem-Specialist-Campaign.html', label: 'SEM - Specialist Campaign' },
          { file: 'author-Website-Setup.html', label: 'Author Website Setup' }
        ]
      },
      {
        id: 'publicity-services',
        title: 'Publicity Services',
        items: [
          { file: 'press-Release-Essential-Edition.html', label: 'Press Release - Essential Edition' },
          { file: 'press-Release-Web-Optimized-Edition.html', label: 'Press Release - Web Optimized Edition' }
        ]
      },
      {
        id: 'radio-services',
        title: 'Radio Services',
        items: [
          { file: 'radio-Book-Talk.html', label: 'Radio Book Talk' },
          { file: 'audio-Snip.html', label: 'Audio Snip' },
          { file: 'online-Interview.html', label: 'Online Interview' }
        ]
      }
    ]
  },
  {
    id: 'bookselling',
    title: 'Bookselling',
    tag: 'book-dropdown',
    icon: 'bi-shop',
    subcats: [
      {
        id: 'bookstore-essentials',
        title: 'Bookstore Essentials',
        items: [
          { file: 'set-Your-Own-Price.html', label: 'Set Your Own Price' },
          { file: 'author-Advantage-Royalty-Program.html', label: 'Author Advantage Royalty Program' },
          { file: 'retail-Focus.html', label: 'Retail Focus' },
          { file: 'retail-Focus-for-Children-Books.html', label: "Retail Focus for Children's Books" },
          { file: 'library-Focus.html', label: 'Library Focus' },
          { file: 'booksellers-Return-Program.html', label: 'Booksellers Return Program' },
          { file: 'booksellers-Return-Program-Renewal.html', label: 'Booksellers Return Program Renewal' }
        ]
      },
      {
        id: 'registration',
        title: 'Registration',
        items: [
          { file: 'uS-Copyright-Registration.html', label: 'US Copyright Registration' },
          { file: 'library-of-Congress-Control-Number.html', label: 'Library of Congress Control Number' }
        ]
      }
    ]
  }
];

// Build catalog
const fullCatalog = categoriesConfig.map((catConfig) => {
  const subcategories = catConfig.subcats.map((subConfig) => {
    let services = [];
    if (subConfig.services) {
      services = subConfig.services;
    } else if (subConfig.items) {
      services = subConfig.items.map((item) => {
        const filePath = path.join(servicesDir, item.file);
        const parsed = parseServiceFile(filePath, item.label);
        const slug = slugify(item.label);
        return {
          slug,
          title: item.label,
          price: parsed.price || '',
          lead: parsed.lead,
          features: parsed.features
        };
      });
    }
    return {
      id: subConfig.id,
      title: subConfig.title,
      services
    };
  });

  return {
    id: catConfig.id,
    title: catConfig.title,
    tag: catConfig.tag,
    icon: catConfig.icon,
    subcategories
  };
});

let totalCats = fullCatalog.length;
let totalSubcats = 0;
let totalServices = 0;

for (const c of fullCatalog) {
  totalSubcats += c.subcategories.length;
  for (const s of c.subcategories) {
    totalServices += s.services.length;
  }
}

console.log(`Generated catalog:`);
console.log(`- Categories: ${totalCats}`);
console.log(`- Subcategories: ${totalSubcats}`);
console.log(`- Total Services: ${totalServices}`);

fullCatalog.forEach(c => {
  const count = c.subcategories.reduce((a, sub) => a + sub.services.length, 0);
  console.log(`  * ${c.title} (${c.id}): ${c.subcategories.length} subcategories, ${count} services`);
});

fs.writeFileSync(path.resolve(__dirname, '../data/full-catalog.json'), JSON.stringify(fullCatalog, null, 2), 'utf8');
console.log(`Wrote full catalog to data/full-catalog.json`);
