// =================================================================
// backend/seed.js  —  Auto-seed the database from existing HTML files
// =================================================================
// Usage: node backend/seed.js
//
// This script:
//   1. Seeds company_profile, company_stats, media_assets, showcase_books
//   2. Seeds all service categories and subcategories from the sidebar
//   3. Reads ALL 131 service HTML files → services + service_features tables
//
// Safe to re-run: it clears and re-inserts data each time.
// =================================================================

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const fs      = require("fs");
const path    = require("path");
const cheerio = require("cheerio");
const { db }  = require("./db");

const SERVICES_DIR = path.resolve(__dirname, "../services");

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────
function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function parsePriceCents(priceStr) {
  if (!priceStr) return null;
  const cleaned = priceStr.replace(/[$,\s]/g, "");
  const num = parseFloat(cleaned);
  if (isNaN(num)) return null;
  return Math.round(num * 100);
}

function fileNameToSlug(filename) {
  return filename
    .replace(/\.html$/i, "")
    .replace(/([A-Z])/g, (m) => "-" + m.toLowerCase())
    .replace(/^-/, "")
    .replace(/-+/g, "-")
    .toLowerCase();
}

// ─────────────────────────────────────────────────────────────────
// 1. Company Profile
// ─────────────────────────────────────────────────────────────────
async function seedCompanyProfile() {
  console.log("🏢 Seeding company profile...");
  await db.execute("DELETE FROM company_profile");
  await db.execute({
    sql: `INSERT INTO company_profile
            (company_name, tagline, phone, email, address_line1, address_line2, city_state_zip, copyright_text)
          VALUES (?,?,?,?,?,?,?,?)`,
    args: [
      "Omni Virtual Solutions",
      "Empowering Individuals and Businesses — Balancing employee autonomy with expert oversight",
      "+1 315-915-4799",
      "admin@omnivirtualsolution.com",
      "1350 Ave of the Americas",
      "Fl 2 -1100",
      "New York, NY 10019",
      "© Copyright Omni Virtual Solutions. All Rights Reserved.",
    ],
  });
  console.log("  ✅ Company profile seeded.");
}

// ─────────────────────────────────────────────────────────────────
// 2. Company Stats
// ─────────────────────────────────────────────────────────────────
async function seedStats() {
  console.log("📊 Seeding company stats...");
  await db.execute("DELETE FROM company_stats");
  const stats = [
    { key: "clients",       value: 232,  label: "Clients",          order: 1 },
    { key: "projects",      value: 521,  label: "Projects",         order: 2 },
    { key: "support_hours", value: 1453, label: "Hours Of Support", order: 3 },
    { key: "workers",       value: 32,   label: "Workers",          order: 4 },
  ];
  for (const s of stats) {
    await db.execute({
      sql: "INSERT INTO company_stats (stat_key, stat_value, stat_label, display_order) VALUES (?,?,?,?)",
      args: [s.key, s.value, s.label, s.order],
    });
  }
  console.log("  ✅ Stats seeded (Clients, Projects, Support Hours, Workers).");
}

// ─────────────────────────────────────────────────────────────────
// 3. Media Assets
// ─────────────────────────────────────────────────────────────────
async function seedMediaAssets() {
  console.log("🖼️  Seeding media assets...");
  await db.execute("DELETE FROM showcase_books");
  await db.execute("DELETE FROM media_assets");

  const assets = [
    // Logos
    { key: "logo_main",     path: "assets/img/OmniLogo2.png",     alt: "Omni Virtual Solutions Logo",              cat: "logo" },
    { key: "logo_alt",      path: "assets/img/OmniLogo.png",      alt: "Omni Virtual Solutions Logo (Alt)",        cat: "logo" },
    { key: "favicon",       path: "assets/img/favicon.png",       alt: "Omni Favicon",                             cat: "logo" },
    // Hero
    { key: "hero_bg",       path: "assets/img/hero-bg.png",       alt: "Hero Background",                          cat: "hero" },
    { key: "hero_books",    path: "assets/img/hero-books.jpg",     alt: "Books Hero Section",                       cat: "hero" },
    { key: "hero_img",      path: "assets/img/hero-img.png",       alt: "Hero Image",                               cat: "hero" },
    // About
    { key: "about_team",    path: "assets/img/about_team.jpg",    alt: "Omni Virtual Solutions Professional Team", cat: "team" },
    { key: "about_graphic", path: "assets/img/about.png",         alt: "About Section Graphic",                    cat: "team" },
    // Footer / HQ
    { key: "footer_hq",     path: "assets/img/footer-image.jpg",  alt: "Omni Virtual Solutions Headquarters",      cat: "footer" },
    // Services / Editorial
    { key: "illustration",  path: "assets/img/illustration.jpg",  alt: "Illustration Service",                     cat: "service" },
    { key: "colored",       path: "assets/img/colored.jpg",       alt: "Color Illustration Service",               cat: "service" },
    { key: "bookpic",       path: "assets/img/bookpic.png",       alt: "Book Visual",                              cat: "service" },
    { key: "services_img",  path: "assets/img/services.jpg",      alt: "Our Services",                             cat: "service" },
    // Hero showcase books
    { key: "book_1", path: "assets/img/books/book1.png", alt: "Atomic Habits - James Clear",                   cat: "book_cover" },
    { key: "book_2", path: "assets/img/books/book2.png", alt: "The Psychology of Money - Morgan Housel",       cat: "book_cover" },
    { key: "book_3", path: "assets/img/books/book3.png", alt: "Deep Work - Cal Newport",                       cat: "book_cover" },
    { key: "book_4", path: "assets/img/books/book4.png", alt: "The Lean Startup - Eric Ries",                  cat: "book_cover" },
    { key: "book_5", path: "assets/img/books/book5.png", alt: "Principles - Ray Dalio",                        cat: "book_cover" },
    { key: "book_6", path: "assets/img/books/book6.png", alt: "Rich Dad Poor Dad - Robert Kiyosaki",           cat: "book_cover" },
    { key: "book_7", path: "assets/img/books/book7.png", alt: "Start with Why - Simon Sinek",                  cat: "book_cover" },
    { key: "book_8", path: "assets/img/books/book8.png", alt: "Shoe Dog - Phil Knight",                        cat: "book_cover" },
    { key: "book_9", path: "assets/img/books/book9.png", alt: "Zero to One - Peter Thiel",                      cat: "book_cover" },
    { key: "book_10", path: "assets/img/books/book10.png", alt: "Good to Great - Jim Collins",                   cat: "book_cover" },
    { key: "book_11", path: "assets/img/books/book11.png", alt: "Thinking, Fast and Slow - Daniel Kahneman",     cat: "book_cover" },
    { key: "book_12", path: "assets/img/books/book12.png", alt: "The 7 Habits of Highly Effective People - Stephen R. Covey", cat: "book_cover" },
    { key: "book_13", path: "assets/img/books/book13.png", alt: "Rework - Jason Fried",                          cat: "book_cover" },
  ];

  for (const a of assets) {
    await db.execute({
      sql: "INSERT INTO media_assets (asset_key, file_path, alt_text, category) VALUES (?,?,?,?)",
      args: [a.key, a.path, a.alt, a.cat],
    });
  }
  console.log(`  ✅ ${assets.length} media assets seeded.`);
}

// ─────────────────────────────────────────────────────────────────
// 4. Showcase Books (Hero Swiper)
// ─────────────────────────────────────────────────────────────────
async function seedShowcaseBooks() {
  console.log("📚 Seeding hero showcase books...");
  await db.execute("DELETE FROM showcase_books");

  const books = [
    { title: "Atomic Habits",           author: "James Clear",       assetKey: "book_1", order: 1 },
    { title: "The Psychology of Money", author: "Morgan Housel",     assetKey: "book_2", order: 2 },
    { title: "Deep Work",               author: "Cal Newport",       assetKey: "book_3", order: 3 },
    { title: "The Lean Startup",        author: "Eric Ries",         assetKey: "book_4", order: 4 },
    { title: "Principles",              author: "Ray Dalio",         assetKey: "book_5", order: 5 },
    { title: "Rich Dad Poor Dad",       author: "Robert Kiyosaki",   assetKey: "book_6", order: 6 },
    { title: "Start with Why",          author: "Simon Sinek",       assetKey: "book_7", order: 7 },
    { title: "Shoe Dog",                author: "Phil Knight",       assetKey: "book_8", order: 8 },
    { title: "Zero to One",             author: "Peter Thiel",       assetKey: "book_9", order: 9 },
    { title: "Good to Great",           author: "Jim Collins",       assetKey: "book_10", order: 10 },
    { title: "Thinking, Fast and Slow", author: "Daniel Kahneman",   assetKey: "book_11", order: 11 },
    { title: "The 7 Habits of Highly Effective People", author: "Stephen R. Covey", assetKey: "book_12", order: 12 },
    { title: "Rework",                  author: "Jason Fried",       assetKey: "book_13", order: 13 },
  ];

  for (const b of books) {
    // Lookup asset ID
    const assetResult = await db.execute({
      sql: "SELECT id FROM media_assets WHERE asset_key = ?",
      args: [b.assetKey],
    });
    const assetId = assetResult.rows.length > 0 ? assetResult.rows[0].id : null;
    await db.execute({
      sql: `INSERT INTO showcase_books (title, author, image_asset_id, display_order, is_active)
            VALUES (?,?,?,?,1)`,
      args: [b.title, b.author, assetId, b.order],
    });
  }
  console.log("  ✅ 13 showcase books seeded.");
}

// ─────────────────────────────────────────────────────────────────
// 5. Service Categories & Subcategories
//    Mapped from services.html sidebar structure
// ─────────────────────────────────────────────────────────────────
async function seedCategoriesAndSubcategories() {
  console.log("🗂️  Seeding service categories and subcategories...");
  await db.execute("DELETE FROM service_subcategories");
  await db.execute("DELETE FROM service_categories");

  const categoryTree = [
    {
      slug: "publishing-packages", title: "Publishing Packages",
      icon: "bi-book-half", tagline: "End-to-End Support", order: 1,
      subcategories: [
        { slug: "publishing-options", title: "Publishing Options", order: 1 },
      ],
    },
    {
      slug: "evaluation-services", title: "Evaluation Services",
      icon: "bi-journal-check", tagline: "Professional Assessment", order: 2,
      subcategories: [
        { slug: "editorial-evaluation-group", title: "Editorial Evaluation", order: 1 },
      ],
    },
    {
      slug: "editorial-services", title: "Editorial Services",
      icon: "bi-pencil-square", tagline: "Author Assistance", order: 3,
      subcategories: [
        { slug: "advanced-editorial",         title: "Advanced Editorial Services",        order: 1 },
        { slug: "author-assistance",          title: "Author Assistance Editorial Services", order: 2 },
        { slug: "core-editorial",             title: "Core Editorial Services",             order: 3 },
        { slug: "cover-copy",                 title: "Cover Copy Polish",                   order: 4 },
        { slug: "indexing",                   title: "Indexing",                            order: 5 },
        { slug: "proofreading-group",         title: "Proofreading",                        order: 6 },
      ],
    },
    {
      slug: "formats", title: "Formats",
      icon: "bi-file-earmark-text", tagline: "Multi-Format Publishing", order: 4,
      subcategories: [
        { slug: "audiobook",            title: "AudioBook Publishing",      order: 1 },
        { slug: "print-formats",        title: "Print Formats",             order: 2 },
        { slug: "manuscript-formats",   title: "Manuscript & File Formats", order: 3 },
        { slug: "design-formats",       title: "Design & Production",       order: 4 },
        { slug: "legal-registration",   title: "Legal & Registration",      order: 5 },
      ],
    },
    {
      slug: "marketing-services", title: "Marketing Services",
      icon: "bi-megaphone-fill", tagline: "Specialized Strategy", order: 5,
      subcategories: [
        { slug: "video-marketing",      title: "Video Marketing",            order: 1 },
        { slug: "media-reviews",        title: "Media & Reviews",            order: 2 },
        { slug: "sem-advertising",      title: "SEM & Advertising",          order: 3 },
        { slug: "social-media",         title: "Social Media",               order: 4 },
        { slug: "book-shows",           title: "Book Shows & Events",        order: 5 },
        { slug: "pr-publicity",         title: "PR & Publicity",             order: 6 },
        { slug: "booksellers",          title: "Booksellers Programs",       order: 7 },
        { slug: "online-distribution",  title: "Online Distribution & Promo", order: 8 },
      ],
    },
  ];

  for (const cat of categoryTree) {
    await db.execute({
      sql: `INSERT INTO service_categories (slug, title, icon_class, tagline, display_order)
            VALUES (?,?,?,?,?)`,
      args: [cat.slug, cat.title, cat.icon, cat.tagline, cat.order],
    });
    const catResult = await db.execute({
      sql: "SELECT id FROM service_categories WHERE slug = ?",
      args: [cat.slug],
    });
    const catId = catResult.rows[0].id;

    for (const sub of cat.subcategories) {
      await db.execute({
        sql: `INSERT INTO service_subcategories (category_id, slug, title, display_order)
              VALUES (?,?,?,?)`,
        args: [catId, sub.slug, sub.title, sub.order],
      });
    }
  }
  console.log(`  ✅ ${categoryTree.length} categories and all subcategories seeded.`);
}

// ─────────────────────────────────────────────────────────────────
// 6. Parse one service HTML file → return structured data
// ─────────────────────────────────────────────────────────────────
function parseServiceHtml(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const $   = cheerio.load(raw);

  // Title: grab the <h1> inside main-content section (skip header h1s)
  let title = $("section#main-content h1, .main-content-section h1").first().text().trim();
  if (!title) title = $("h1").first().text().trim();

  // Price: check both commented-out and visible price tags
  let priceDisplay = null;
  const priceEl = $("p.price strong, .price strong").first();
  if (priceEl.length) {
    priceDisplay = priceEl.text().trim();
  } else {
    // Try to find a commented price: <!-- <p class="price"><strong>$X</strong> -->
    const match = raw.match(/<!--[^>]*<p[^>]*class="price"[^>]*><strong>([\s\S]*?)<\/strong>/i);
    if (match) priceDisplay = match[1].trim();
  }

  // Description paragraphs — all <p> inside main content (exclude CTA email line)
  const descParagraphs = [];
  $("section#main-content p, .main-content-section p").each((_, el) => {
    const text = $(el).text().trim();
    if (text && !text.toLowerCase().includes("email") && !text.toLowerCase().includes("to order")) {
      descParagraphs.push(text);
    }
  });

  // Features — all <li> items in the main content section
  const features = [];
  $("section#main-content li, .main-content-section li").each((_, el) => {
    const text = $(el).text().trim();
    if (text) features.push(text);
  });

  return {
    title,
    priceDisplay,
    priceCents: parsePriceCents(priceDisplay),
    leadParagraph: descParagraphs[0] || null,
    fullDescription: descParagraphs.join("\n\n") || null,
    features,
  };
}

// ─────────────────────────────────────────────────────────────────
// 7. Map filename → subcategory slug
//    This is the manual mapping so every service lands in the right
//    category bucket. Based on the sidebar in services.html.
// ─────────────────────────────────────────────────────────────────
const FILE_TO_SUBCATEGORY = {
  // ── Publishing Options ──────────────────────────────────────────
  "basic":                          "publishing-options",
  "standard-package":               "publishing-options",
  "advanced":                       "publishing-options",
  "Explorer-Package":               "publishing-options",
  "navigator-package":              "publishing-options",
  // ── Evaluation Services ─────────────────────────────────────────
  "editorial-Evaluation":           "editorial-evaluation-group",
  "hollywood-Coverage":             "editorial-evaluation-group",
  // ── Advanced Editorial ──────────────────────────────────────────
  "developmental-Editing":          "advanced-editorial",
  "book-Doctor":                    "advanced-editorial",
  // ── Author Assistance ───────────────────────────────────────────
  "quality-Review-Copyediting":     "author-assistance",
  "quality-Review-Line-Editing":    "author-assistance",
  "quality-Review-Content-Editing": "author-assistance",
  "quality-Review-Content-Editing-Plus": "author-assistance",
  "editorial-Assistant-Copyediting":"author-assistance",
  "editorial-Assistant-Line-Edit":  "author-assistance",
  "editorial-Assistant-Content-Edit":    "author-assistance",
  "editorial-Assistant-Content-Edit-Plus":"author-assistance",
  // ── Core Editorial ──────────────────────────────────────────────
  "small-Book-Review-with-Editing": "core-editorial",
  "copyediting":                    "core-editorial",
  "line-editing":                   "core-editorial",
  "content-Editing":                "core-editorial",
  "content-Editing-Plus":           "core-editorial",
  // ── Cover Copy ──────────────────────────────────────────────────
  "cover-Copy-Polish":              "cover-copy",
  // ── Indexing ────────────────────────────────────────────────────
  "professional-Indexing":          "indexing",
  "indexingsub1":                   "indexing",
  "indexingsub2":                   "indexing",
  "indexingsub3":                   "indexing",
  "indexingsub4":                   "indexing",
  // ── Proofreading ────────────────────────────────────────────────
  "proofreading":                   "proofreading-group",
  // ── Audiobook ───────────────────────────────────────────────────
  "do-It-Yourself-Audiobook":       "audiobook",
  "professional-Audiobook-Package": "audiobook",
  "audio-Snip":                     "audiobook",
  // ── Print Formats ───────────────────────────────────────────────
  "softcover-Publishing":           "print-formats",
  "hardcover-Publishing":           "print-formats",
  "book-Binding-Sizes-and-Types":   "print-formats",
  "one-version":                    "print-formats",
  "two-version":                    "print-formats",
  // ── Manuscript & File Formats ───────────────────────────────────
  "manuscript-File-Conversion":     "manuscript-formats",
  "graphic-File-Conversions":       "manuscript-formats",
  "file-Merging":                   "manuscript-formats",
  "handwritten":                    "manuscript-formats",
  "data-entry-standard":            "manuscript-formats",
  "text":                           "manuscript-formats",
  "spanish":                        "manuscript-formats",
  // ── Design & Production ─────────────────────────────────────────
  "elite-Cover-Design":             "design-formats",
  "elite-Interior-Design":          "design-formats",
  "custom-Cover-Illustration":      "design-formats",
  "custom-Headers":                 "design-formats",
  "custom-Layout-Tech":             "design-formats",
  "images-design":                  "design-formats",
  "color-Illustrations-Detail":     "design-formats",
  "color-Illustrations-Personalized":"design-formats",
  "bw-image-insertion":             "design-formats",
  "bw-image-scanning":              "design-formats",
  "color-Image-Insertion":          "design-formats",
  "color-Image-Scanning":           "design-formats",
  "large-Image-Scanning":           "design-formats",
  "image-Extraction":               "design-formats",
  "stock-Image-Processing":         "design-formats",
  "interior-Revisions":             "design-formats",
  "extensive-Customized-Formatting":"design-formats",
  "endnotes-Formatting":            "design-formats",
  "footnote-Formatting":            "design-formats",
  "table-Creation":                 "design-formats",
  "table-of-Contents":              "design-formats",
  "fine-detail":                    "design-formats",
  "intricate-Design":               "design-formats",
  "personalized":                   "design-formats",
  "basic-Manuscript-Formatting-Corrections":"design-formats",
  "retech":                         "design-formats",
  // ── Legal & Registration ────────────────────────────────────────
  "uS-Copyright-Registration":      "legal-registration",
  "library-of-Congress-Control-Number":"legal-registration",
  // ── Video Marketing ─────────────────────────────────────────────
  "bookblast-Video-Marketing-Standard": "video-marketing",
  "bookblast-Video-Marketing-Stand-alone":"video-marketing",
  "bookblast-Video-Marketing-Premium":  "video-marketing",
  "standard-Book-Video":            "video-marketing",
  "premium-Book-Video":             "video-marketing",
  "video-Marketing":                "video-marketing",
  "video-Book-Talk":                "video-marketing",
  // ── Media & Reviews ─────────────────────────────────────────────
  "kirkus-Title-Express":           "media-reviews",
  "indie-Book-Review-Bundle":       "media-reviews",
  "the-Trifecta-Review-Service":    "media-reviews",
  "review-Duo":                     "media-reviews",
  "review-Duo-Plus":                "media-reviews",
  "radio-Book-Talk":                "media-reviews",
  "online-Interview":               "media-reviews",
  "hollywood-Screenplay":           "media-reviews",
  "hollywood-Treatment":            "media-reviews",
  "author-Advantage-Royalty-Program":"media-reviews",
  // ── SEM & Advertising ───────────────────────────────────────────
  "sem-1000-clicks":                "sem-advertising",
  "sem-Advanced-Campaign":          "sem-advertising",
  "sem-Specialist-Campaign":        "sem-advertising",
  "display-Advertising-on-Google-30-days-Package":"sem-advertising",
  "online-Booksellers-Advertising": "sem-advertising",
  // ── Social Media ────────────────────────────────────────────────
  "social-Media":                   "social-media",
  "social-Media-30-day-Strategy":   "social-media",
  "social-media-30-day-Content-Plan":"social-media",
  "social-Media-Advertising-Basic": "social-media",
  "social-Media-Advertising-Essential":"social-media",
  "social-Media-Advertising-Advanced":"social-media",
  "author-Website-Setup":           "social-media",
  // ── Book Shows & Events ─────────────────────────────────────────
  "join-the-LA-Times-Festival-of-Books-2025":"book-shows",
  "national":                       "book-shows",
  "national-Show":                  "book-shows",
  "international":                  "book-shows",
  "international-Show":             "book-shows",
  "nts":                            "book-shows",
  "set-Your-Own-Price":             "book-shows",
  // ── PR & Publicity ──────────────────────────────────────────────
  "press-Release-Essential-Edition":"pr-publicity",
  "press-Release-Web-Optimized-Edition":"pr-publicity",
  "publicity-News-Release":         "pr-publicity",
  "publicity-News-Release-Plus":    "pr-publicity",
  "publicity":                      "pr-publicity",
  "publicity-plus":                 "pr-publicity",
  "gift-Guide-Advertising-Holiday-Picks":"pr-publicity",
  // ── Booksellers ─────────────────────────────────────────────────
  "booksellers-Return-Program":     "booksellers",
  "booksellers-Return-Program-Renewal":"booksellers",
  "library-Focus":                  "booksellers",
  "retail-Focus":                   "booksellers",
  "retail-Focus-for-Children-Books":"booksellers",
  "ingram-Media-Marketing":         "booksellers",
  "ingram-Supplement-Marketing":    "booksellers",
  "ingram-Supplement-Marketing":    "booksellers",
  // ── Online Distribution & Promo ─────────────────────────────────
  "e-book-Promo-Launcher":          "online-distribution",
  "e-book-Promo-Venture-30-days":   "online-distribution",
  "literary-Gateway-Bundle":        "online-distribution",
};

// ─────────────────────────────────────────────────────────────────
// 8. Seed all 131 service HTML files
// ─────────────────────────────────────────────────────────────────
async function seedServices() {
  console.log("\n📄 Seeding services from 131 HTML files...\n");
  await db.execute("DELETE FROM service_features");
  await db.execute("DELETE FROM services");

  const files = fs.readdirSync(SERVICES_DIR).filter(
    (f) => f.endsWith(".html") && f !== "header.html" && f !== "footer.html"
  );

  // Preload subcategory lookup: slug → id
  const subResult = await db.execute("SELECT id, slug FROM service_subcategories");
  const subMap = {};
  for (const row of subResult.rows) subMap[row.slug] = row.id;

  // Fallback subcategory (publishing-options) for unmapped files
  const fallbackSubId = subMap["publishing-options"];

  let successCount = 0;
  let skipCount    = 0;
  let order        = 1;

  for (const file of files) {
    const baseName    = file.replace(/\.html$/i, "");
    const slug        = fileNameToSlug(baseName);
    const filePath    = path.join(SERVICES_DIR, file);

    // Resolve subcategory — try original filename first, then slugified
    const subSlug  = FILE_TO_SUBCATEGORY[baseName] || FILE_TO_SUBCATEGORY[slug] || null;
    const subcatId = (subSlug && subMap[subSlug]) ? subMap[subSlug] : fallbackSubId;

    let parsed;
    try {
      parsed = parseServiceHtml(filePath);
    } catch (err) {
      console.warn(`  ⚠️  Could not parse ${file}: ${err.message}`);
      skipCount++;
      continue;
    }

    if (!parsed.title) {
      console.warn(`  ⚠️  No title found in ${file} — skipping.`);
      skipCount++;
      continue;
    }

    try {
      await db.execute({
        sql: `INSERT INTO services
                (subcategory_id, slug, title, price_cents, price_display,
                 lead_paragraph, full_description, cta_email, is_featured, display_order)
              VALUES (?,?,?,?,?,?,?,?,?,?)`,
        args: [
          subcatId,
          slug,
          parsed.title,
          parsed.priceCents,
          parsed.priceDisplay,
          parsed.leadParagraph,
          parsed.fullDescription,
          "admin@omnivirtualsolution.com",
          0,
          order,
        ],
      });

      // Get the inserted service id
      const svcResult = await db.execute({
        sql: "SELECT id FROM services WHERE slug = ?",
        args: [slug],
      });
      const serviceId = svcResult.rows[0].id;

      // Insert feature bullets
      for (let i = 0; i < parsed.features.length; i++) {
        const feat = parsed.features[i].trim();
        if (feat) {
          await db.execute({
            sql: "INSERT INTO service_features (service_id, feature_text, display_order) VALUES (?,?,?)",
            args: [serviceId, feat, i + 1],
          });
        }
      }

      console.log(
        `  ✅ [${String(order).padStart(3, "0")}] ${parsed.title}` +
        (parsed.priceDisplay ? ` — ${parsed.priceDisplay}` : " — Contact for pricing") +
        ` (${parsed.features.length} features)`
      );
      order++;
      successCount++;
    } catch (err) {
      // Duplicate slug — update instead
      if (err.message && err.message.includes("UNIQUE")) {
        console.warn(`  ⚠️  Duplicate slug "${slug}" — skipping.`);
        skipCount++;
      } else {
        console.error(`  ❌ Error inserting ${file}:`, err.message);
        skipCount++;
      }
    }
  }

  console.log(`\n  ✅ ${successCount} services seeded, ${skipCount} skipped.\n`);
}

// ─────────────────────────────────────────────────────────────────
// Main — Run all seed functions in order
// ─────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n🌱 Starting Omni Virtual Solutions database seed...\n");
  console.log("=".repeat(60));

  await seedCompanyProfile();
  await seedStats();
  await seedMediaAssets();
  await seedShowcaseBooks();
  await seedCategoriesAndSubcategories();
  await seedServices();

  console.log("=".repeat(60));
  console.log("🎉 All data seeded successfully!\n");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
