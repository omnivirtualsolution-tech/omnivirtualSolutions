const fs = require('fs');
const path = require('path');

const fileDetails = JSON.parse(fs.readFileSync(path.join(__dirname, 'fileDetails.json'), 'utf8'));
const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, '../frontend/src/data/catalog.json'), 'utf8'));
const jsx = fs.readFileSync(path.join(__dirname, '../frontend/src/pages/ServicesPage.jsx'), 'utf8');

function extractObjectFromJsx(varName) {
  const match = jsx.match(new RegExp(`const ${varName} = ({[\\s\\S]*?});`));
  if (!match) return {};
  try {
    return eval('(' + match[1] + ')');
  } catch (e) {
    return {};
  }
}

const subcatDescs = extractObjectFromJsx('SUBCATEGORY_DESCRIPTIONS');
const subcatLeads = extractObjectFromJsx('SUBCATEGORY_LEADS');
const serviceSummaries = extractObjectFromJsx('AUTHENTIC_SERVICE_SUMMARIES');

// Define the comprehensive categories & subcategories tree including missing items
const masterCatalog = [
  {
    id: "publishing-packages",
    title: "Publishing Packages",
    tag: "eval-services",
    icon: "bi-book-half",
    categoryLead: "Our packages are designed to offer authors the support and tools they need to maximize their book's potential. Each package guarantees one-on-one author support for every step of the self-publishing journey.",
    subcategories: [
      {
        id: "publishing-options",
        title: "Publishing Options",
        lead: "Our packages offer various combinations of our publishing, editorial, and marketing services for a truly customized publishing experience. With Omni, you can choose the package that best suits your literary goals.",
        sideDesc: "Our packages offer various combinations of publishing, editorial, and marketing services for a truly customized publishing experience.",
        services: [
          { slug: "publishing-packages", title: "Publishing Packages Overview", price: "", file: null, inCurrentApp: true },
          { slug: "basic-package", title: "Basic Package", price: "$899.00", file: "basic.html", inCurrentApp: true },
          { slug: "standard-package", title: "Standard Package", price: "$1,599.00", file: "standard-package.html", inCurrentApp: true },
          { slug: "advanced-package", title: "Advanced Package", price: "$4,999.00", file: "advanced.html", inCurrentApp: true },
          { slug: "founder-package", title: "Founder Package", price: "$1,299.00", file: "founder-package.html", inCurrentApp: false, missingReason: "Present in services/Founder-Package.html with 11 features, missing from catalog & ServicesPage" },
          { slug: "pioneer-package", title: "Pioneer Package", price: "$250.00", file: "pioneer-package.html", inCurrentApp: false, missingReason: "Present in services/Pioneer-Package.html with 18 features, missing from catalog & ServicesPage" },
          { slug: "voyager-package", title: "Voyager Package", price: "$500.00", file: "voyager-package.html", inCurrentApp: false, missingReason: "Present in services/Voyager-Package.html with 26 features, missing from catalog & ServicesPage" },
          { slug: "navigator-package", title: "Navigator Package", price: "$1,299.00", file: "navigator-package.html", inCurrentApp: false, missingReason: "Referenced in services.html line 1135 and present in services/navigator-Package.html with 23 features, missing from catalog & ServicesPage" }
        ]
      }
    ]
  },
  {
    id: "evaluation-services",
    title: "Evaluation Services",
    tag: "editorial-services",
    icon: "bi-clipboard2-check",
    categoryLead: "One of the key features that makes an Omni book distinct from other self-published books is our professional editorial evaluation. The evaluation is included in certain publishing packages and is available to purchase separately as well.",
    subcategories: [
      {
        id: "editorial-evaluation",
        title: "Editorial Evaluation",
        lead: "The Editorial Evaluation is a manuscript checkup that assesses your work to be sure that it has fulfilled the basic requirements of a published book. The editorial evaluator will not only provide you with a general overview of your manuscript but will also educate you through constructive comments on how to write a better book.",
        sideDesc: "Manuscript diagnostic checkup, detailed observations report on narrative strengths, and $299 credit toward editorial services.",
        services: [
          { slug: "evaluation-services", title: "Evaluation Services Overview", price: "", file: null, inCurrentApp: true },
          { slug: "editorial-evaluation", title: "Editorial Evaluation", price: "$299.00 credit", file: "editorial-evaluation.html", inCurrentApp: true }
        ]
      }
    ]
  },
  {
    id: "editorial-services",
    title: "Editorial Services",
    tag: "combined-dropdown",
    icon: "bi-journal-check",
    categoryLead: "Regardless of your publishing goals, the quality of your work matters—no one wants to read a book that's riddled with typos and grammatical errors. However, even the best writers make mistakes. Omni provides editorial services that will help you make your book the best it can be.",
    subcategories: [
      {
        id: "advanced-editorial-services",
        title: "Advanced Editorial Services",
        lead: "Sometimes manuscripts need specialized attention that goes beyond detail work in grammar, spelling, and punctuation. Our experienced editors take an in-depth look at your book's content and other high-level stylistic considerations, including content, plot, and pace.",
        sideDesc: "Specialized attention beyond grammar: comprehensive developmental editing, story architecture, and book doctoring.",
        services: [
          { slug: "developmental-editing", title: "Developmental Editing", price: "Custom Quote", file: "developmental-editing.html", inCurrentApp: true },
          { slug: "book-doctor", title: "Book Doctor", price: "Custom Quote", file: "book-doctor.html", inCurrentApp: true }
        ]
      },
      {
        id: "author-assistance-editorial-services",
        title: "Author Assistance Editorial Services",
        lead: "While all of our Editorial Services aim to assist authors, this category of services takes an extra step, providing professional guidance to authors during the crucial revision stage following a core editorial service.",
        sideDesc: "Professional guidance during crucial revision stages, including Quality Reviews and dedicated Editorial Assistants.",
        services: [
          { slug: "quality-review-copyediting", title: "Quality Review - Copyediting", price: "Fraction of edit", file: "quality-review-copyediting.html", inCurrentApp: true },
          { slug: "quality-review-line-editing", title: "Quality Review - Line Editing", price: "Fraction of edit", file: "quality-review-line-editing.html", inCurrentApp: true },
          { slug: "quality-review-content-editing", title: "Quality Review - Content Editing", price: "Fraction of edit", file: "quality-review-content-editing.html", inCurrentApp: true },
          { slug: "quality-review-content-editing-plus", title: "Quality Review - Content Editing Plus", price: "Fraction of edit", file: "quality-review-content-editing-plus.html", inCurrentApp: true },
          { slug: "editorial-assistant-copyediting", title: "Editorial Assistant - Copyediting", price: "Hourly / Flat", file: "editorial-assistant-copyediting.html", inCurrentApp: true },
          { slug: "editorial-assistant-line-edit", title: "Editorial Assistant - Line Edit", price: "Hourly / Flat", file: "editorial-assistant-line-edit.html", inCurrentApp: true },
          { slug: "editorial-assistant-content-edit", title: "Editorial Assistant - Content Edit", price: "Hourly / Flat", file: "editorial-assistant-content-edit.html", inCurrentApp: true },
          { slug: "editorial-assistant-content-edit-plus", title: "Editorial Assistant - Content Edit Plus", price: "Hourly / Flat", file: "editorial-assistant-content-edit-plus.html", inCurrentApp: true }
        ]
      },
      {
        id: "core-editorial-services",
        title: "Core Editorial Services",
        lead: "Core editing services focus on improving the nuts and bolts of a book: grammar, spelling, punctuation, capitalization, and sentence structure.",
        sideDesc: "Focus on improving the nuts and bolts of your book: grammar, spelling, punctuation, capitalization, and sentence structure.",
        services: [
          { slug: "small-book-review-with-editing-under-5-000-words", title: "Small Book Review with Editing (Under 5,000 Words)", price: "Tiered", file: "small-book-review-with-editing.html", inCurrentApp: true },
          { slug: "copyediting", title: "Copyediting", price: "Per Word", file: "copyediting.html", inCurrentApp: true },
          { slug: "line-editing", title: "Line Editing", price: "Per Word", file: "line-editing.html", inCurrentApp: true },
          { slug: "content-editing", title: "Content Editing", price: "Per Word", file: "content-editing.html", inCurrentApp: true },
          { slug: "content-editing-plus", title: "Content Editing Plus", price: "Per Word", file: "content-editing-plus.html", inCurrentApp: true }
        ]
      },
      {
        id: "cover-copy-polish",
        title: "Cover Copy Polish",
        lead: "With Omni Cover Copy Polish, ideas you provide allow us to create intriguing copy that can help you clinch the sale.",
        sideDesc: "Compelling back cover copy and marketing descriptions crafted by experienced copywriters to clinch the sale.",
        services: [
          { slug: "cover-copy-polish", title: "Cover Copy Polish", price: "Flat Fee", file: "cover-copy-polish.html", inCurrentApp: true }
        ]
      },
      {
        id: "indexing",
        title: "Indexing",
        lead: "To maximize the usability of a nonfiction title, readers, book buyers, librarians, and reviewers will expect you to include an index in your book. You can even sell your book to readers by the index.",
        sideDesc: "Professional manual and keyword indexing to maximize reader usability and library adoption of nonfiction titles.",
        services: [
          { slug: "professional-indexing", title: "Professional Indexing", price: "Custom Quote", file: "professional-indexing.html", inCurrentApp: true },
          { slug: "computer-generated-keyword-indexing-up-to-500-entries", title: "Computer Generated Keyword Indexing - Up to 500 Entries", price: "Tiered", file: "indexingsub1.html", inCurrentApp: true },
          { slug: "computer-generated-keyword-indexing-up-to-700-entries", title: "Computer Generated Keyword Indexing - Up to 700 Entries", price: "Tiered", file: "indexingsub2.html", inCurrentApp: true },
          { slug: "computer-generated-keyword-indexing-up-to-1-000-entries", title: "Computer Generated Keyword Indexing - Up to 1,000 Entries", price: "Tiered", file: "indexingsub3.html", inCurrentApp: true },
          { slug: "computer-generated-keyword-indexing-custom-quote", title: "Computer Generated Keyword Indexing - Custom Quote", price: "Custom Quote", file: "indexingsub4.html", inCurrentApp: true }
        ]
      },
      {
        id: "proofreading",
        title: "Proofreading",
        lead: "Our proofreading and revisions services can help save you from embarrassment and costly corrections after publication.",
        sideDesc: "Final pre-publication review to catch lingering typos and layout glitches before your book goes to print.",
        services: [
          { slug: "proofreading", title: "Proofreading", price: "Per Word", file: "proofreading.html", inCurrentApp: true }
        ]
      }
    ]
  },
  {
    id: "formats",
    title: "Formats",
    tag: "formats-dropdown",
    icon: "bi-layers-half",
    categoryLead: "Through digital and print-on-demand (POD) technology, we can offer our authors these distinct formats for their books: Electronic Format, Audiobooks, and standard Print Formats.",
    subcategories: [
      {
        id: "electronic-format",
        title: "Electronic Format",
        lead: "With the increasing number of readers who prefer a digital format, it’s important that your book is accessible to these tech-savvy booklovers too. With our Digital Formatting and Distribution service, your book will be available for sale as an e-book across Amazon Kindle, Barnes & Noble Nook, and Apple Books.",
        sideDesc: "Flawless reflowable e-book conversion and worldwide digital distribution to Kindle, Apple Books, and Nook.",
        services: [
          { slug: "digital-formatting-and-distribution", title: "Digital Formatting and Distribution", price: "Included in pkgs / Ala Carte", file: null, inCurrentApp: false, missingReason: "In services.html section lines 1308-1309 and SUBCATEGORY_DESCRIPTIONS line 347, but missing from catalog subcategories" }
        ]
      },
      {
        id: "audiobook-publishing",
        title: "AudioBook Publishing",
        lead: "Over the years, the demand for audiobooks has significantly increased because readers are now able to easily download books and listen to them while they are on the move. Through audiobooks, stories are shared in a convenient way.",
        sideDesc: "Lift your story from its pages with Do-It-Yourself and full-cast Professional Audiobook production.",
        services: [
          { slug: "do-it-yourself-audiobook", title: "Do-It-Yourself Audiobook", price: "$499.00", file: "do-it-yourself-audiobook.html", inCurrentApp: true },
          { slug: "professional-audiobook-package", title: "Professional Audiobook Package", price: "$2,299.00+", file: "professional-audiobook-package.html", inCurrentApp: true }
        ]
      },
      {
        id: "print-formats",
        title: "Print Formats",
        lead: "All manuscripts submitted to Omni are formatted as trade paperbacks and printed on high-quality, acid-free, book-grade opaque paper stock.",
        sideDesc: "Trade softcover and deluxe cloth-bound hardcover publishing printed on acid-free, book-grade opaque stock.",
        services: [
          { slug: "softcover-publishing", title: "Softcover Publishing", price: "Standard", file: "softcover-publishing.html", inCurrentApp: true },
          { slug: "hardcover-publishing", title: "Hardcover Publishing", price: "Standard", file: "hardcover-publishing.html", inCurrentApp: true },
          { slug: "book-binding-sizes-and-types", title: "Book Binding Sizes and Types", price: "Specification", file: "book-binding-sizes-and-types.html", inCurrentApp: true }
        ]
      }
    ]
  },
  {
    id: "design-services",
    title: "Design Services",
    tag: "design-dropdown",
    icon: "bi-palette",
    categoryLead: "Our team will work with you—incorporating your photos, graphics, sketches, and ideas—to create a professional book cover and layout that beautifully represents your book's contents.",
    subcategories: [
      {
        id: "black-and-white-illustrations",
        title: "Black-and-White Illustrations",
        lead: "Elevate your book to the next creative level with custom artwork produced in our in-house art studio. Seasoned studio artists work with you to produce striking black-and-white illustrations.",
        sideDesc: "Custom black-and-white artwork created by seasoned in-house studio artists to enrich your text.",
        services: [
          { slug: "black-and-white-illustrations-fine-detail", title: "Black-and-White Illustrations - Fine Detail", price: "$120.00 / image", file: "fine-detail.html", inCurrentApp: true },
          { slug: "black-and-white-illustrations-personalized", title: "Black-and-White Illustrations - Personalized", price: "$90.00 / image", file: "personalized.html", inCurrentApp: true }
        ]
      },
      {
        id: "color-illustrations",
        title: "Color Illustrations",
        lead: "One of Omni's talented studio artists will use your descriptions and feedback to create custom color illustrations that reflect your book’s unique style.",
        sideDesc: "Vibrant, hand-crafted color illustrations tailored for children’s books, graphic novels, and memoirs.",
        services: [
          { slug: "color-illustrations-intricate-design", title: "Color Illustrations - Intricate Design", price: "$180.00 / image", file: "intricate-design.html", inCurrentApp: true },
          { slug: "color-illustrations-fine-detail", title: "Color Illustrations - Fine Detail", price: "$140.00 / image", file: "color-illustrations-detail.html", inCurrentApp: true },
          { slug: "color-illustrations-personalized", title: "Color Illustrations - Personalized", price: "$110.00 / image", file: "color-illustrations-personalized.html", inCurrentApp: true }
        ]
      },
      {
        id: "cover-design",
        title: "Cover Design",
        lead: "The cover is the first opportunity you have to connect with potential readers. That's why at Omni we make sure that your cover will meet the professional standards for commercially successful books.",
        sideDesc: "Commercial bookstore-grade full-color cover design, artwork revisions, and custom illustrations.",
        services: [
          { slug: "elite-cover-design", title: "Elite Cover Design", price: "Custom", file: "elite-cover-design.html", inCurrentApp: true },
          { slug: "custom-cover-illustration", title: "Custom Cover Illustration", price: "$399.00", file: "custom-cover-illustration.html", inCurrentApp: true },
          { slug: "cover-revisions-text", title: "Cover Revisions (Text)", price: "$99.00", file: "text.html", inCurrentApp: true },
          { slug: "cover-revisions-images-design", title: "Cover Revisions (Images/Design)", price: "$149.00", file: "images-design.html", inCurrentApp: true }
        ]
      },
      {
        id: "interior-page-layout",
        title: "Interior Page Layout",
        lead: "Careful planning and execution of the layout of your book is very important. Readers need to be able to easily follow the text of your book. Our professionals will help you create the best layout for your book.",
        sideDesc: "Elite typography, custom headers, image insertions, and Chicago Manual of Style citation formatting.",
        services: [
          { slug: "elite-interior-design", title: "Elite Interior Design", price: "$399.00", file: "elite-interior-design.html", inCurrentApp: true },
          { slug: "color-image-insertion", title: "Color Image Insertion", price: "$15.00 / image", file: "color-image-insertion.html", inCurrentApp: true },
          { slug: "custom-layout-tech", title: "Custom Layout Tech", price: "$199.00", file: "custom-layout-tech.html", inCurrentApp: true },
          { slug: "table-of-contents-two-or-more", title: "Table of Contents (Two or More)", price: "$49.00", file: "table-of-contents.html", inCurrentApp: true },
          { slug: "table-creation", title: "Table Creation", price: "$25.00 / table", file: "table-creation.html", inCurrentApp: true },
          { slug: "footnote-formatting", title: "Footnote Formatting", price: "$49.00", file: "footnote-formatting.html", inCurrentApp: true },
          { slug: "endnotes-formatting", title: "Endnotes (End of Chapter)", price: "$49.00", file: "endnotes-formatting.html", inCurrentApp: false, missingReason: "In services.html lines 1441-1443 and services/endnotes-Formatting.html, missing from catalog & ServicesPage" },
          { slug: "custom-headers", title: "Custom Headers", price: "$49.00", file: "custom-headers.html", inCurrentApp: true },
          { slug: "b-w-image-insertion", title: "B&W Image Insertion", price: "$10.00 / image", file: "bw-image-insertion.html", inCurrentApp: true },
          { slug: "interior-revisions-block-of-25", title: "Interior Revisions (Block of 25)", price: "$75.00", file: "interior-revisions.html", inCurrentApp: true }
        ]
      },
      {
        id: "stock-images",
        title: "Stock Images",
        lead: "All books published via the Omni standard publishing packages receive custom-designed covers, produced in full color. Within the realm of this custom-designed cover, you have the option to choose two images, free of charge, from the millions found through Getty Images.",
        sideDesc: "Access to millions of premium high-resolution images from Getty Images for your cover and interior.",
        services: [
          { slug: "stock-image-processing", title: "Stock Image Processing", price: "$15.00 / image", file: "stock-image-processing.html", inCurrentApp: true }
        ]
      }
    ]
  },
  {
    id: "production",
    title: "Production",
    tag: "production-dropdown",
    icon: "bi-gear-wide-connected",
    categoryLead: "Preparing your manuscript for submission and publishing is a whole lot easier when we do it for you. Omni handles everything from raw document conversion to post-layout revisions and catalog resubmissions.",
    subcategories: [
      {
        id: "post-page-layout-services",
        title: "Post-Page Layout Services",
        lead: "Omni allows you to make changes to your book after the manuscript has been laid out by our designers. Charges will be applied.",
        sideDesc: "Text changes, layout corrections, and interior revisions after initial book proofs are generated.",
        services: [
          { slug: "retech", title: "Retech", price: "Custom Quote", file: "retech.html", inCurrentApp: true },
          { slug: "title-change-after-setup", title: "Title Change After Setup", price: "$149.00", file: "title-change-after-setup.html", inCurrentApp: true }
        ]
      },
      {
        id: "pre-manuscript-services",
        title: "Pre-Manuscript Services",
        lead: "Preparing your manuscript for submission and for publishing is a whole lot easier when we do it for you. Omni can convert your typewritten manuscript, or previously published book, to a word-processed format.",
        sideDesc: "Data entry, manuscript file conversion, scanning, and structural formatting corrections prior to design.",
        services: [
          { slug: "color-image-scanning", title: "Color Image Scanning", price: "$15.00 / image", file: "color-image-scanning.html", inCurrentApp: true },
          { slug: "basic-manuscript-formatting-corrections", title: "Basic Manuscript Formatting Corrections", price: "$199.00", file: "basic-manuscript-formatting-corrections.html", inCurrentApp: true },
          { slug: "extensive-customized-formatting", title: "Extensive Customized Formatting", price: "$349.00", file: "extensive-customized-formatting.html", inCurrentApp: true },
          { slug: "data-entry-standard", title: "Data Entry - Standard", price: "$3.50 / page", file: "data-entry-standard.html", inCurrentApp: true },
          { slug: "data-entry-spanish", title: "Data Entry - Spanish", price: "$4.50 / page", file: "spanish.html", inCurrentApp: true },
          { slug: "data-entry-handwritten", title: "Data Entry - Handwritten", price: "$5.00 / page", file: "handwritten.html", inCurrentApp: true },
          { slug: "large-image-scanning", title: "Large Image Scanning", price: "$25.00 / image", file: "large-image-scanning.html", inCurrentApp: true },
          { slug: "b-w-image-scanning", title: "B&W Image Scanning", price: "$10.00 / image", file: "bw-image-scanning.html", inCurrentApp: true },
          { slug: "manuscript-file-conversion", title: "Manuscript File Conversion", price: "$99.00", file: "manuscript-file-conversion.html", inCurrentApp: true },
          { slug: "graphic-file-conversions-quantity-25", title: "Graphic File Conversions (Quantity: 25)", price: "$75.00", file: "graphic-file-conversions.html", inCurrentApp: true },
          { slug: "file-merging", title: "File Merging", price: "$49.00", file: "file-merging.html", inCurrentApp: true },
          { slug: "image-extraction", title: "Image Extraction", price: "$75.00", file: "image-extraction.html", inCurrentApp: true }
        ]
      },
      {
        id: "resubmission",
        title: "Resubmission",
        lead: "Once your book has gone live and is for sale, you can still correct errors or other issues that might have been missed. Resubmission services are available for a fee.",
        sideDesc: "Update editions, correct errors, and refresh files for live published books across global retail channels.",
        services: [
          { slug: "resubmission-one-version", title: "Resubmission (One Version)", price: "$199.00", file: "one-version.html", inCurrentApp: true },
          { slug: "resubmission-two-version", title: "Resubmission (Two Version)", price: "$299.00", file: "two-version.html", inCurrentApp: true }
        ]
      }
    ]
  },
  {
    id: "marketing-services",
    title: "Marketing Services",
    tag: "marketing-dropdown",
    icon: "bi-megaphone",
    categoryLead: "If you want your book to sell, you’ll want to do more than just hope for the best. Our selection of promotional products and services allows authors to build a dynamic platform from which they can effectively promote and sell their books.",
    subcategories: [
      {
        id: "advertising",
        title: "Advertising",
        lead: "Omni brings our authors together by genre to promote their books directly to their target readers in an effective, affordable co-op style.",
        sideDesc: "Targeted cooperative advertising campaigns across Ingram and holiday gift guides.",
        services: [
          { slug: "ingram-media-marketing", title: "Ingram Media Marketing", price: "$1,299.00", file: "ingram-media-marketing.html", inCurrentApp: false, missingReason: "In services.html lines 763 & 1599, services/ingram-Media-Marketing.html, missing from catalog & ServicesPage" },
          { slug: "gift-guide-advertising-holiday-picks", title: "Gift Guide Advertising - Holiday Picks", price: "$1,299.00", file: "gift-guide-advertising-holiday-picks.html", inCurrentApp: false, missingReason: "In services.html lines 764 & 1600, services/gift-Guide-Advertising-Holiday-Picks.html, missing from catalog & ServicesPage" }
        ]
      },
      {
        id: "video-book-trailer",
        title: "Video Book Trailer",
        lead: "A book video trailer combines visuals, text, music, and voiceovers, making it appealing to people who prefer video content over traditional text-based marketing. Videos rank well on search engines and social media platforms, increasing discoverability.",
        sideDesc: "Cinematic book video trailers and professional author interviews that captivate online audiences visually.",
        services: [
          { slug: "bookblast-video-marketing-stand-alone-30days", title: "Bookblast Video Marketing – Stand-alone (30days)", price: "$1,499.00", file: "bookblast-video-marketing-stand-alone.html", inCurrentApp: true },
          { slug: "standard-book-video", title: "Standard Book Video", price: "$1,999.00", file: "standard-book-video.html", inCurrentApp: true },
          { slug: "premium-book-video", title: "Premium Book Video", price: "$3,499.00", file: "premium-book-video.html", inCurrentApp: true },
          { slug: "bookblast-video-marketing-standard", title: "Bookblast Video Marketing – Standard", price: "$2,899.00", file: "bookblast-video-marketing-standard.html", inCurrentApp: true },
          { slug: "bookblast-video-marketing-premium", title: "Bookblast Video Marketing - Premium", price: "$4,299.00", file: "bookblast-video-marketing-premium.html", inCurrentApp: true },
          { slug: "15-sec-video-marketing", title: "15-sec Video Marketing", price: "$899.00", file: "video-marketing.html", inCurrentApp: true },
          { slug: "video-book-talk", title: "Video Book Talk", price: "$2,199.00", file: "video-book-talk.html", inCurrentApp: true }
        ]
      },
      {
        id: "book-exhibits-and-conferences",
        title: "Book Exhibits and Conferences",
        lead: "Omni is giving you the opening to boost your book’s promotions with its Book Exhibition marketing service. Exhibit your book in front of thousands of readers and major decision makers across national and international trade shows.",
        sideDesc: "Premier trade show exhibition space across national and international book fairs including NTS and national shows.",
        services: [
          { slug: "book-exhibit-national-show", title: "Book Exhibit – National Show", price: "$1,299.00", file: "national-show.html", inCurrentApp: false, missingReason: "In services.html lines 790 & 1656, services/national-Show.html, missing from catalog & ServicesPage" },
          { slug: "book-exhibit-international-show", title: "Book Exhibit – International Show", price: "$1,299.00", file: "international-show.html", inCurrentApp: false, missingReason: "In services.html lines 791 & 1657, services/international-Show.html, missing from catalog & ServicesPage" },
          { slug: "book-exhibit-nts", title: "Book Exhibit – NTS", price: "$1,299.00", file: "nts.html", inCurrentApp: false, missingReason: "In services.html lines 792 & 1658, services/nts.html, missing from catalog & ServicesPage" },
          { slug: "book-exhibit-plus-national", title: "Book Exhibit Plus – National", price: "$1,299.00", file: "national.html", inCurrentApp: false, missingReason: "In services.html lines 793 & 1659, services/national.html, missing from catalog & ServicesPage" },
          { slug: "book-exhibit-plus-international", title: "Book Exhibit Plus – International", price: "$1,299.00", file: "international.html", inCurrentApp: false, missingReason: "In services.html lines 794 & 1661, services/international.html, missing from catalog & ServicesPage" }
        ]
      },
      {
        id: "book-reviews",
        title: "Book Reviews",
        lead: "A book review is an excellent way to generate interest for your title. Book readers, buyers, and retailers rely on the opinion of experts when considering which titles are worth purchasing and reading.",
        sideDesc: "Elevate your credibility with authoritative reviews from respected literary reviewers that readers trust.",
        services: [
          { slug: "indie-book-review-bundle", title: "Indie Book Review Bundle", price: "$3,499.00", file: "indie-book-review-bundle.html", inCurrentApp: true },
          { slug: "literary-gateway-bundle", title: "Literary Gateway Bundle", price: "$1,999.00", file: "literary-gateway-bundle.html", inCurrentApp: true },
          { slug: "review-duo", title: "Review Duo", price: "$1,499.00", file: "review-duo.html", inCurrentApp: true },
          { slug: "review-duo-plus", title: "Review Duo Plus", price: "$2,299.00", file: "review-duo-plus.html", inCurrentApp: true },
          { slug: "the-trifecta-review-service", title: "The Trifecta Review Service", price: "$2,999.00", file: "the-trifecta-review-service.html", inCurrentApp: true }
        ]
      },
      {
        id: "book-signings-and-galleries",
        title: "Book Signings and Galleries",
        lead: "A book exhibition or book signing event can be a terrific way to create buzz around your book. As an exhibitor at many of the largest trade shows and book events, we've put our books in the hands of booklovers and industry insiders.",
        sideDesc: "Exhibition space at premier literary festivals including the LA Times Festival of Books and national shows.",
        services: [
          { slug: "join-the-la-times-festival-of-books-2025", title: "Join the LA Times Festival of Books 2025!", price: "$2,799.00", file: "join-the-la-times-festival-of-books-2025.html", inCurrentApp: true }
        ]
      },
      {
        id: "genre-specific-marketing",
        title: "Genre Specific Marketing",
        lead: "Reach out to readers of all genres with our targeted advertising campaigns. Get your book in front of librarians, retailers, and readers with our Ingram Marketing Supplement service.",
        sideDesc: "Targeted marketing outreach specifically designed for specialized genres and niche reader communities.",
        services: [
          { slug: "ingram-supplement-marketing", title: "Ingram Supplement Marketing", price: "$1,299.00", file: "ingram-supplement-marketing.html", inCurrentApp: false, missingReason: "In services.html lines 828 & 1770, services/ingram-Supplement-Marketing.html, missing from catalog & ServicesPage" }
        ]
      },
      {
        id: "hollywood-book-to-screen",
        title: "Hollywood Book-to-Screen",
        lead: "Have you ever considered for even a moment that your book could be adapted into a movie or television series? Omni can make your book available to agents, producers, directors, writers and actors.",
        sideDesc: "Professional coverage, treatments, and screenplays to position your book for film and television adaptation.",
        services: [
          { slug: "hollywood-coverage", title: "Hollywood Coverage", price: "$899.00", file: "hollywood-coverage.html", inCurrentApp: true },
          { slug: "hollywood-treatment", title: "Hollywood Treatment", price: "$2,499.00", file: "hollywood-treatment.html", inCurrentApp: true },
          { slug: "hollywood-screenplay", title: "Hollywood Screenplay", price: "$6,999.00", file: "hollywood-screenplay.html", inCurrentApp: true }
        ]
      },
      {
        id: "internet-marketing",
        title: "Internet Marketing",
        lead: "Having your own website, internet search, or preview tools are effective and economical ways to promote your book, enhance your image as an author, and communicate with prospective readers around the world.",
        sideDesc: "Search engine marketing (SEM), Google display ads, social media campaigns, and custom author websites.",
        services: [
          { slug: "sem-1000-clicks", title: "SEM - 1000 clicks", price: "$899.00", file: "sem-1000-clicks.html", inCurrentApp: true },
          { slug: "social-media-30-day-content-plan", title: "Social Media 30-day Content Plan", price: "$1,199.00", file: "social-media-30-day-content-plan.html", inCurrentApp: true },
          { slug: "social-media-30-day-strategy", title: "Social Media 30-day Strategy", price: "$1,499.00", file: "social-media-30-day-strategy.html", inCurrentApp: true },
          { slug: "kirkus-title-express", title: "Kirkus Title Express", price: "$1,899.00", file: "kirkus-title-express.html", inCurrentApp: true },
          { slug: "online-booksellers-advertising", title: "Online Booksellers Advertising", price: "$2,499.00", file: "online-booksellers-advertising.html", inCurrentApp: true },
          { slug: "e-book-promo-venture-30-days", title: "E-book Promo Venture - 30 days", price: "$1,699.00", file: "e-book-promo-venture-30-days.html", inCurrentApp: true },
          { slug: "e-book-promo-launcher", title: "E-book Promo Launcher", price: "$2,199.00", file: "e-book-promo-launcher.html", inCurrentApp: true },
          { slug: "social-media-advertising-basic", title: "Social Media Advertising Basic", price: "$1,299.00", file: "social-media-advertising-basic.html", inCurrentApp: true },
          { slug: "social-media-advertising-essential", title: "Social Media Advertising Essential", price: "$1,999.00", file: "social-media-advertising-essential.html", inCurrentApp: true },
          { slug: "social-media-advertising-advanced", title: "Social Media Advertising Advanced", price: "$2,999.00", file: "social-media-advertising-advanced.html", inCurrentApp: true },
          { slug: "display-advertising-on-google-30-days-package", title: "Display Advertising on Google - 30 days Package", price: "$1,599.00", file: "display-advertising-on-google-30-days-package.html", inCurrentApp: true },
          { slug: "sem-advanced-campaign", title: "SEM - Advanced Campaign", price: "$2,799.00", file: "sem-advanced-campaign.html", inCurrentApp: true },
          { slug: "sem-specialist-campaign", title: "SEM - Specialist Campaign", price: "$4,299.00", file: "sem-specialist-campaign.html", inCurrentApp: true },
          { slug: "author-website-setup", title: "Author Website Setup", price: "$1,499.00", file: "author-website-setup.html", inCurrentApp: true }
        ]
      },
      {
        id: "publicity-campaigns",
        title: "Publicity Campaigns",
        lead: "Our publicity campaign options pair you with a publicist dedicated to mapping and executing outreach that makes sense for you and your message.",
        sideDesc: "Dedicated literary publicist campaigns (6-week & 12-week options), news releases, and social media coaching.",
        services: [
          { slug: "publicity-news-release", title: "Publicity News Release", price: "$1,299.00", file: "publicity-news-release.html", inCurrentApp: false, missingReason: "In services.html lines 873 & 1885, services/publicity-News-Release.html, missing from catalog & ServicesPage" },
          { slug: "publicity-news-release-plus", title: "Publicity News Release Plus", price: "$1,299.00", file: "publicity-news-release-plus.html", inCurrentApp: false, missingReason: "In services.html lines 874 & 1887, services/publicity-News-Release-Plus.html, missing from catalog & ServicesPage" },
          { slug: "social-media", title: "Social Media (Publicity Campaign)", price: "$1,299.00", file: "social-media.html", inCurrentApp: false, missingReason: "In services.html lines 875 & 1889, services/social-Media.html, missing from catalog & ServicesPage" },
          { slug: "publicity", title: "Publicity (6-week campaign)", price: "$1,299.00", file: "publicity.html", inCurrentApp: false, missingReason: "In services.html lines 876 & 1891, services/publicity.html, missing from catalog & ServicesPage" },
          { slug: "publicity-plus", title: "Publicity Plus (12-week campaign)", price: "$1,299.00", file: "publicity-plus.html", inCurrentApp: false, missingReason: "In services.html lines 877 & 1893, services/publicity-plus.html, missing from catalog & ServicesPage" }
        ]
      },
      {
        id: "publicity-services",
        title: "Publicity Services",
        lead: "Get your book noticed from a unique platform created by our publicity and media services. When done right, a press release is an effective way to get publicity and build media relationships.",
        sideDesc: "Compelling press releases distributed to over 500 media outlets, opt-in journalists, and newsrooms.",
        services: [
          { slug: "press-release-essential-edition", title: "Press Release - Essential Edition", price: "$899.00", file: "press-release-essential-edition.html", inCurrentApp: true },
          { slug: "press-release-web-optimized-edition", title: "Press Release - Web Optimized Edition", price: "$1,399.00", file: "press-release-web-optimized-edition.html", inCurrentApp: true }
        ]
      },
      {
        id: "radio-services",
        title: "Radio Services",
        lead: "Have you ever considered how a radio interview might affect your book’s marketing plan? If the answer is yes, then Omni can make your voice available on the airwaves to help you reach new audiences and further your cause.",
        sideDesc: "Broadcast interviews with Emmy Award-winning host Kate Delaney and syndicated literary podcasts.",
        services: [
          { slug: "radio-book-talk", title: "Radio Book Talk", price: "$2,499.00", file: "radio-book-talk.html", inCurrentApp: true },
          { slug: "audio-snip", title: "Audio Snip", price: "$699.00", file: "audio-snip.html", inCurrentApp: true },
          { slug: "online-interview", title: "Online Interview", price: "$1,199.00", file: "online-interview.html", inCurrentApp: true }
        ]
      }
    ]
  },
  {
    id: "bookselling",
    title: "Bookselling",
    tag: "book-dropdown",
    icon: "bi-shop-window",
    categoryLead: "Once your book is published, we make it available for order online with retail outlets worldwide. Our bookselling promotional services provide you the opportunity to actively promote and protect your book.",
    subcategories: [
      {
        id: "bookstore-essentials",
        title: "Bookstore Essentials",
        lead: "Through Omni Bookstore Essentials, your book receives professional bookselling services that make your book even more attractive to bookstores.",
        sideDesc: "Make your book returnable for bookstores, set your own retail price and royalties, and access bookstore pitching.",
        services: [
          { slug: "set-your-own-price", title: "Set Your Own Price", price: "$249.00", file: "set-your-own-price.html", inCurrentApp: true },
          { slug: "author-advantage-royalty-program", title: "Author Advantage Royalty Program", price: "$999.00", file: "author-advantage-royalty-program.html", inCurrentApp: true },
          { slug: "retail-focus", title: "Retail Focus", price: "$1,899.00", file: "retail-focus.html", inCurrentApp: true },
          { slug: "retail-focus-for-childrens-books", title: "Retail Focus for Children's Books", price: "$1,899.00", file: "retail-focus-for-children-books.html", inCurrentApp: true },
          { slug: "library-focus", title: "Library Focus", price: "$1,899.00", file: "library-focus.html", inCurrentApp: true },
          { slug: "booksellers-return-program", title: "Booksellers Return Program", price: "$699.00", file: "booksellers-return-program.html", inCurrentApp: true },
          { slug: "booksellers-return-program-renewal", title: "Booksellers Return Program Renewal", price: "$399.00", file: "booksellers-return-program-renewal.html", inCurrentApp: true }
        ]
      },
      {
        id: "registration",
        title: "Registration",
        lead: "As you make your work available to the public, you want to make sure you have the appropriate protection. There are two ways we can help you with that.",
        sideDesc: "Protect your work with official U.S. Copyright Office registration and secure a Library of Congress Control Number.",
        services: [
          { slug: "us-copyright-registration", title: "US Copyright Registration", price: "$349.00", file: "us-copyright-registration.html", inCurrentApp: true },
          { slug: "library-of-congress-control-number", title: "Library of Congress Control Number", price: "$249.00", file: "library-of-congress-control-number.html", inCurrentApp: true }
        ]
      }
    ]
  }
];

// Let's generate a full Markdown report
let md = `# Complete Content & Services Audit: Old Site vs. Current React App\n\n`;
md += `This document provides the full, item-by-item content catalog for every category, subcategory, and service across:\n`;
md += `- **Original Master HTML Page**: [\`services.html\`](file:///c:/Users/crzyc/OneDrive/Desktop/star/My%20Document/OmniVirtualSolution/Omni/services.html)\n`;
md += `- **Original Individual Service Pages**: [\`Omni/services/*.html\`](file:///c:/Users/crzyc/OneDrive/Desktop/star/My%20Document/OmniVirtualSolution/Omni/services/)\n`;
md += `- **Current React Application**: [\`ServicesPage.jsx\`](file:///c:/Users/crzyc/OneDrive/Desktop/star/My%20Document/OmniVirtualSolution/Omni/frontend/src/pages/ServicesPage.jsx) & [\`catalog.json\`](file:///c:/Users/crzyc/OneDrive/Desktop/star/My%20Document/OmniVirtualSolution/Omni/frontend/src/data/catalog.json)\n\n`;

md += `## Architecture & Sidebar Description Mechanism\n\n`;
md += `### 1. How Descriptions Appear on the "Side" (Sidebar & Overview Cards)\n`;
md += `In [\`ServicesPage.jsx\`](file:///c:/Users/crzyc/OneDrive/Desktop/star/My%20Document/OmniVirtualSolution/Omni/frontend/src/pages/ServicesPage.jsx), content descriptions operate on **three synchronized levels**:\n\n`;
md += `1. **Category Overview Level (When selecting a Category header)**:\n`;
md += `   - Header Badge: "Omni Category Overview"\n`;
md += `   - Title: The Category Title (e.g., *Publishing Packages*, *Editorial Services*)\n`;
md += `   - Lead Text: The Category Lead paragraph\n`;
md += `   - Key Notes & Testimonials: Specific quotes (e.g. Carisia Switala for *Marketing Services*, Chicago Manual of Style notice for *Editorial Services*)\n`;
md += `   - Subcategory Cards Grid: Displays an interactive card for every subcategory containing its **Side Description** (\`SUBCATEGORY_DESCRIPTIONS[sub.id]\`) and the service count badge.\n\n`;
md += `2. **Subcategory Overview Level (When clicking a Subcategory header)**:\n`;
md += `   - Header Badge: "Omni Subcategory Overview"\n`;
md += `   - Title: The Subcategory Title (e.g., *Video Book Trailer*, *Bookstore Essentials*)\n`;
md += `   - Authentic Lead: The Subcategory Lead (\`SUBCATEGORY_LEADS[sub.id]\`)\n`;
md += `   - Callout Banners: Special benefit sections (e.g., *Reasons Why Video Book Trailers are Essential*, *Advantages of Hollywood Book-to-Screen*, *Bookstore Essentials Advantages*)\n`;
md += `   - Offering Cards: Displays a card for each service inside the subcategory showing the **Authentic Service Summary** (\`AUTHENTIC_SERVICE_SUMMARIES[svc.slug]\`) matching \`services.html\`.\n\n`;
md += `3. **Individual Service Level (When clicking a specific Service)**:\n`;
md += `   - Header Badge: "Omni Specialist Service"\n`;
md += `   - Title & Price: The specific service name and price point\n`;
md += `   - Overview Box: \`service-lead-box\` with authentic lead description\n`;
md += `   - Dedicated Detail View or Feature Checklist: In-depth editorial narrative, callout notes, and checklist items.\n\n`;

md += `---\n\n`;
md += `## Comprehensive Category-by-Category Content Registry\n\n`;

let totalServicesCount = 0;
let missingServicesCount = 0;
let totalSubcatsCount = 0;

masterCatalog.forEach((cat, catIdx) => {
  md += `### Category ${catIdx + 1}: ${cat.title} (\`${cat.id}\`)\n`;
  md += `- **Sidebar Icon**: \`${cat.icon}\`\n`;
  md += `- **Category Lead Text**: "${cat.categoryLead}"\n`;
  md += `- **Subcategories Count**: ${cat.subcategories.length}\n\n`;

  cat.subcategories.forEach((sub, subIdx) => {
    totalSubcatsCount++;
    md += `#### ${catIdx + 1}.${subIdx + 1} Subcategory: ${sub.title} (\`${sub.id}\`)\n`;
    md += `- **Side Description** (shown on Category Overview cards): \n  > *"${sub.sideDesc}"*\n`;
    md += `- **Subcategory Lead** (shown on Subcategory Overview header): \n  > *"${sub.lead}"*\n`;
    md += `- **Services in this Subcategory** (${sub.services.length} items):\n\n`;

    md += `| Service Title | Slug | Price | Old Source File | Status in Current App | Lead / Authentic Summary from Old Source |\n`;
    md += `| :--- | :--- | :--- | :--- | :---: | :--- |\n`;

    sub.services.forEach(svc => {
      totalServicesCount++;
      const fileKey = (svc.file || '').toLowerCase();
      const fileInfo = fileDetails[fileKey];
      const summaryText = serviceSummaries[svc.slug] || (fileInfo ? fileInfo.leadParagraph : '') || 'Included in category description.';
      const cleanSummary = summaryText.replace(/\|/g, '-').replace(/\n/g, ' ').substring(0, 160) + (summaryText.length > 160 ? '...' : '');

      let statusBadge = '✅ Matched';
      if (!svc.inCurrentApp) {
        missingServicesCount++;
        statusBadge = '❌ **MISSING**';
      }

      md += `| **${svc.title}** | \`${svc.slug}\` | ${svc.price || 'Included'} | ${svc.file ? `[\`${svc.file}\`](file:///c:/Users/crzyc/OneDrive/Desktop/star/My%20Document/OmniVirtualSolution/Omni/services/${svc.file})` : 'services.html'} | ${statusBadge} | ${cleanSummary} |\n`;
    });

    md += `\n`;
  });

  md += `---\n\n`;
});

md += `## Detailed Inventory of Missing Offerings with Complete Old Content\n\n`;
md += `Below is the exact text and specifications extracted from the old files for all missing items so you can review the complete content before coding:\n\n`;

// Detail each missing item
const missingFilesToDetail = [
  { slug: 'navigator-package', file: 'navigator-Package.html', title: 'Navigator Package', cat: 'Publishing Packages > Publishing Options' },
  { slug: 'founder-package', file: 'Founder-Package.html', title: 'Founder Package', cat: 'Publishing Packages > Publishing Options' },
  { slug: 'pioneer-package', file: 'Pioneer-Package.html', title: 'Pioneer Package', cat: 'Publishing Packages > Publishing Options' },
  { slug: 'voyager-package', file: 'Voyager-Package.html', title: 'Voyager Package', cat: 'Publishing Packages > Publishing Options' },
  { slug: 'endnotes-formatting', file: 'endnotes-Formatting.html', title: 'Endnotes (End of Chapter)', cat: 'Design Services > Interior Page Layout' },
  { slug: 'ingram-media-marketing', file: 'ingram-Media-Marketing.html', title: 'Ingram Media Marketing', cat: 'Marketing Services > Advertising' },
  { slug: 'gift-guide-advertising-holiday-picks', file: 'gift-Guide-Advertising-Holiday-Picks.html', title: 'Gift Guide Advertising - Holiday Picks', cat: 'Marketing Services > Advertising' },
  { slug: 'book-exhibit-national-show', file: 'national-Show.html', title: 'Book Exhibit – National Show', cat: 'Marketing Services > Book Exhibits and Conferences' },
  { slug: 'book-exhibit-international-show', file: 'international-Show.html', title: 'Book Exhibit – International Show', cat: 'Marketing Services > Book Exhibits and Conferences' },
  { slug: 'book-exhibit-nts', file: 'nts.html', title: 'Book Exhibit – NTS', cat: 'Marketing Services > Book Exhibits and Conferences' },
  { slug: 'book-exhibit-plus-national', file: 'national.html', title: 'Book Exhibit Plus – National', cat: 'Marketing Services > Book Exhibits and Conferences' },
  { slug: 'book-exhibit-plus-international', file: 'international.html', title: 'Book Exhibit Plus – International', cat: 'Marketing Services > Book Exhibits and Conferences' },
  { slug: 'ingram-supplement-marketing', file: 'ingram-Supplement-Marketing.html', title: 'Ingram Supplement Marketing', cat: 'Marketing Services > Genre Specific Marketing' },
  { slug: 'publicity-news-release', file: 'publicity-News-Release.html', title: 'Publicity News Release', cat: 'Marketing Services > Publicity Campaigns' },
  { slug: 'publicity-news-release-plus', file: 'publicity-News-Release-Plus.html', title: 'Publicity News Release Plus', cat: 'Marketing Services > Publicity Campaigns' },
  { slug: 'social-media', file: 'social-Media.html', title: 'Social Media', cat: 'Marketing Services > Publicity Campaigns' },
  { slug: 'publicity', file: 'publicity.html', title: 'Publicity', cat: 'Marketing Services > Publicity Campaigns' },
  { slug: 'publicity-plus', file: 'publicity-plus.html', title: 'Publicity Plus', cat: 'Marketing Services > Publicity Campaigns' }
];

missingFilesToDetail.forEach(item => {
  const info = fileDetails[item.file.toLowerCase()];
  if (!info) return;
  md += `### ${item.title} (\`${item.slug}\`)\n`;
  md += `- **Category**: ${item.cat}\n`;
  md += `- **Original File**: [\`${item.file}\`](file:///c:/Users/crzyc/OneDrive/Desktop/star/My%20Document/OmniVirtualSolution/Omni/services/${item.file})\n`;
  md += `- **Price**: ${info.price || 'Included / Custom Quote'}\n`;
  md += `- **Lead Paragraph**:\n  > "${info.leadParagraph}"\n\n`;
  if (info.bullets && info.bullets.length > 0) {
    md += `**Key Features / Inclusions** (${info.bullets.length} items):\n`;
    info.bullets.forEach(b => {
      md += `- ${b}\n`;
    });
    md += `\n`;
  }
});

// Write to artifact
const artifactPath = path.join('C:\\Users\\crzyc\\.gemini\\antigravity-ide\\brain\\645023a5-bfd8-4915-b9d4-ee4b38a5eefe', 'services_content_audit_and_comparison.md');
fs.writeFileSync(artifactPath, md, 'utf8');
console.log('Artifact successfully generated at:', artifactPath);
console.log('Total services cataloged:', totalServicesCount);
console.log('Total subcategories cataloged:', totalSubcatsCount);
console.log('Total missing services:', missingServicesCount);
