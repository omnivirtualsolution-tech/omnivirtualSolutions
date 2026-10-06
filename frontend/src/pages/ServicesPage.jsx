import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useCms } from '../context/CmsContext';
import './ServicesPage.css';

import DEFAULT_CATALOG from '../data/catalog.json';

// Helper to normalize and ensure full property tree for catalog objects
function formatCatalog(rawList) {
  if (!Array.isArray(rawList)) return [];
  return rawList.map((cat) => ({
    id: cat.id || cat.slug || '',
    title: cat.title || '',
    lead: cat.lead || cat.description || '',
    description: cat.lead || cat.description || '',
    tag: cat.tag || cat.slug || '',
    icon: cat.icon || cat.icon_class || 'bi-bookmark-star',
    subcategories: (cat.subcategories || []).map((sub) => ({
      id: sub.id || sub.slug || '',
      title: sub.title || '',
      lead: sub.lead || sub.description || '',
      description: sub.lead || sub.description || '',
      services: (sub.services || []).map((s) => ({
        slug: s.slug || '',
        title: s.title || '',
        price: s.price || s.price_display || '',
        price_display: s.price || s.price_display || '',
        lead: s.lead || s.lead_paragraph || '',
        lead_paragraph: s.lead || s.lead_paragraph || '',
        features: Array.isArray(s.features) ? s.features : [],
      })),
    })),
  }));
}

export default function ServicesPage() {
  const [searchParams] = useSearchParams();
  const openParam = searchParams.get('open');
  const serviceParam = searchParams.get('service');
  const { t, blocks, company } = useCms();

  const [catalog, setCatalog] = useState(() => {
    if (blocks && blocks['services.catalog.data']) {
      try {
        const parsed = typeof blocks['services.catalog.data'] === 'string'
          ? JSON.parse(blocks['services.catalog.data'])
          : blocks['services.catalog.data'];
        const formatted = formatCatalog(parsed);
        if (formatted.length > 0) return formatted;
      } catch (_) {}
    }
    return DEFAULT_CATALOG;
  });

  const [selectedService, setSelectedService] = useState(null);
  const [activeCategoryTag, setActiveCategoryTag] = useState('all');
  const [expandedCategories, setExpandedCategories] = useState({ 'eval-services': true });
  const [expandedSubcategories, setExpandedSubcategories] = useState({});
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [emailCopied, setEmailCopied] = useState(false);

  // Toggle subcategory expansion accordion
  const toggleSubcategoryAccordion = (subId, e, defaultOpen = false) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setExpandedSubcategories((prev) => {
      const isCurrentOpen = prev[subId] !== undefined ? prev[subId] : defaultOpen;
      return { ...prev, [subId]: !isCurrentOpen };
    });
  };

  // Helper to synchronously update both catalog tree and currently selected service object
  const updateCatalogAndSelected = (rawCatalog) => {
    const formatted = formatCatalog(rawCatalog);
    if (!formatted.length) return;
    setCatalog(formatted);
    setSelectedService((current) => {
      if (!current) return formatted[0]?.subcategories?.[0]?.services?.[0] || null;
      for (const cat of formatted) {
        for (const sub of (cat.subcategories || [])) {
          for (const s of (sub.services || [])) {
            if (s.slug === current.slug) {
              return {
                ...s,
                categoryId: cat.id,
                categoryTitle: cat.title,
                subcategoryId: sub.id,
                subcategoryTitle: sub.title,
                categoryTag: cat.tag,
              };
            }
          }
        }
      }
      const fallback = formatted[0]?.subcategories?.[0]?.services?.[0];
      if (fallback) {
        return {
          ...fallback,
          categoryId: formatted[0].id,
          categoryTitle: formatted[0].title,
          subcategoryId: formatted[0].subcategories[0]?.id,
          subcategoryTitle: formatted[0].subcategories[0]?.title,
          categoryTag: formatted[0].tag,
        };
      }
      return null;
    });
  };

  // Sync whenever blocks['services.catalog.data'] updates from universal CmsContext
  useEffect(() => {
    if (blocks && blocks['services.catalog.data']) {
      try {
        const parsed = typeof blocks['services.catalog.data'] === 'string'
          ? JSON.parse(blocks['services.catalog.data'])
          : blocks['services.catalog.data'];
        if (Array.isArray(parsed) && parsed.length > 0) {
          updateCatalogAndSelected(parsed);
        }
      } catch (_) {}
    }
  }, [blocks ? blocks['services.catalog.data'] : null]);

  // Initial fetch of live catalog from backend API
  useEffect(() => {
    fetch('/api/v1/services')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.catalog && data.catalog.length > 0) {
          updateCatalogAndSelected(data.catalog);
        }
      })
      .catch(() => {});
  }, []);

  // Real-time SSE updates from CMS editor directly
  useEffect(() => {
    let es = null;
    try {
      es = new EventSource('/api/v1/live');
      es.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'cms_block_updated' && payload.key === 'services.catalog.data') {
            const rawCat = typeof payload.value === 'string' ? JSON.parse(payload.value) : payload.value;
            if (Array.isArray(rawCat) && rawCat.length > 0) {
              updateCatalogAndSelected(rawCat);
            }
          } else if (payload.type === 'service_updated' && payload.key && payload.value) {
            const slug = payload.key.replace(/^service\./, '');
            setSelectedService((current) => {
              if (!current || current.slug !== slug) return current;
              return {
                ...current,
                title: payload.value.title !== undefined ? payload.value.title : current.title,
                price: payload.value.price_display || payload.value.price || current.price,
                price_display: payload.value.price_display || payload.value.price || current.price,
                lead: payload.value.lead_paragraph || payload.value.lead || current.lead,
                lead_paragraph: payload.value.lead_paragraph || payload.value.lead || current.lead,
                features: Array.isArray(payload.value.features) ? payload.value.features : current.features,
              };
            });
            setCatalog((prev) =>
              prev.map((cat) => ({
                ...cat,
                subcategories: (cat.subcategories || []).map((sub) => ({
                  ...sub,
                  services: (sub.services || []).map((s) => {
                    if (s.slug !== slug) return s;
                    return {
                      ...s,
                      title: payload.value.title !== undefined ? payload.value.title : s.title,
                      price: payload.value.price_display || payload.value.price || s.price,
                      price_display: payload.value.price_display || payload.value.price || s.price,
                      lead: payload.value.lead_paragraph || payload.value.lead || s.lead,
                      lead_paragraph: payload.value.lead_paragraph || payload.value.lead || s.lead,
                      features: Array.isArray(payload.value.features) ? payload.value.features : s.features,
                    };
                  }),
                })),
              }))
            );
          }
        } catch (_) {}
      };
    } catch (_) {}

    return () => {
      if (es) es.close();
    };
  }, []);

  // Synchronize individual service block overrides in real-time only if catalog didn't already supply value
  useEffect(() => {
    setSelectedService((current) => {
      if (!current || !blocks) return current;
      const slug = current.slug;
      const titleOverride = blocks[`service.${slug}.title`];
      const priceOverride = blocks[`service.${slug}.price`] || blocks[`service.${slug}.price_display`];
      const leadOverride = blocks[`service.${slug}.desc`] || blocks[`service.${slug}.lead`];
      const featOverride = blocks[`service.${slug}.features`];

      let changed = false;
      const updated = { ...current };

      if (titleOverride && !current.title) {
        updated.title = titleOverride;
        changed = true;
      }
      if (priceOverride && !current.price) {
        updated.price = priceOverride;
        updated.price_display = priceOverride;
        changed = true;
      }
      if (leadOverride && !current.lead) {
        updated.lead = leadOverride;
        updated.lead_paragraph = leadOverride;
        changed = true;
      }
      if (featOverride !== undefined && (!current.features || current.features.length === 0)) {
        const parsedFeats = Array.isArray(featOverride)
          ? featOverride
          : (typeof featOverride === 'string' ? JSON.parse(featOverride) : null);
        if (Array.isArray(parsedFeats)) {
          updated.features = parsedFeats;
          changed = true;
        }
      }

      return changed ? updated : current;
    });
  }, [blocks]);

  // Flatten all services for quick lookup and navigation
  const allServicesList = useMemo(() => {
    const list = [];
    catalog.forEach((cat) => {
      list.push({
        slug: cat.id,
        title: cat.title,
        lead: cat.lead || cat.description || '',
        lead_paragraph: cat.lead || cat.description || '',
        categoryId: cat.id,
        categoryTitle: cat.title,
        categoryTag: cat.tag,
        isCategoryOverview: true,
      });
      cat.subcategories.forEach((sub) => {
        sub.services.forEach((s) => {
          list.push({ ...s, categoryId: cat.id, categoryTitle: cat.title, subcategoryId: sub.id, subcategoryTitle: sub.title, categoryTag: cat.tag });
        });
      });
    });
    return list;
  }, [catalog]);

  // Handle URL deep-linking or initial selection
  useEffect(() => {
    if (serviceParam && allServicesList.length > 0) {
      const found = allServicesList.find((s) => s.slug === serviceParam);
      if (found) {
        setSelectedService(found);
        setActiveCategoryTag(found.categoryTag);
        setExpandedCategories((prev) => ({ ...prev, [found.categoryTag]: true }));
        return;
      }
    }

    if (openParam) {
      setActiveCategoryTag(openParam);
      setExpandedCategories((prev) => ({ ...prev, [openParam]: true }));
      const catMatch = catalog.find((c) => c.tag === openParam);
      if (catMatch && catMatch.subcategories[0]?.services[0]) {
        setSelectedService({
          ...catMatch.subcategories[0].services[0],
          categoryId: catMatch.id,
          categoryTitle: catMatch.title,
          subcategoryId: catMatch.subcategories[0].id,
          subcategoryTitle: catMatch.subcategories[0].title,
          categoryTag: catMatch.tag,
        });
        return;
      }
    }

    if (!selectedService && allServicesList.length > 0) {
      setSelectedService(allServicesList[0]);
    } else if (selectedService) {
      const refreshed = allServicesList.find((s) => s.slug === selectedService.slug);
      if (refreshed) {
        setSelectedService(refreshed);
      }
    }
  }, [openParam, serviceParam, allServicesList, catalog]);

  // Scroll to top on initial page mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Dynamic header, labels, and CTA bound directly to CMS t()
  const headerTitle = t('services.header.title', 'Omni Services Catalog');
  const headerSubtitle = t('services.header.subtitle', 'Explore our full spectrum of publishing, editorial, and author marketing solutions.');
  const badgeText = t('services.badge.text', 'Omni Specialist Service');
  const priceSubText = t('services.price.sub', 'Transparent Pricing');
  const overviewHeading = t('services.overview.heading', 'Service Overview');
  const includedHeading = t('services.included.heading', 'Begin your publishing journey with the package that lets you take the extra mile.');
  const ctaSubtitle = t('services.cta.subtitle', 'Get a free consultation, custom quote, and turnaround timeline today.');
  const ctaBtnText = t('services.cta.btn_text', 'Inquire About This Service');
  const ctaEmail = t('services.cta.email', t('footer.email', company?.email || company?.recipient_email || 'admin@omnivirtualsolution.com'));

  const publishingOptionsTitle = t('service.publishing-options.title', 'Publishing Options');
  const publishingOptionsDesc = t('service.publishing-options.desc', 'Our packages offer various combinations of our publishing, editorial, and marketing services for a truly customized publishing experience. With Omni, you can choose the package that best suits your literary goals.');

  const publishingPackagesList = useMemo(() => {
    const defaultPkgs = [
      {
        slug: 'basic-package',
        title: 'Basic Package',
        price: '',
        summary: 'The Basic package is designed for authors seeking basic publishing needs. It includes digital formatting and distribution for e-books, paperback publishing, and customization options for the interior and cover.',
      },
      {
        slug: 'standard-package',
        title: 'Standard Package',
        price: '',
        summary: 'Building on the Basic, the Standard package adds hardcover publishing to the mix, enhancing the physical presence of your book. This package maintains all the services of the Basic package, including the customization, support, and online distribution features.',
      },
      {
        slug: 'advanced-package',
        title: 'Advanced Package',
        price: '',
        summary: 'The Advanced package is the most comprehensive, designed for authors who want extensive support and marketing tools. It includes everything from the Standard package, but boosts the number of copies provided to 20 paperbacks and 5 hardcovers.',
      },
    ];

    return defaultPkgs.map((dp) => {
      const liveSvc = allServicesList.find((s) => s.slug === dp.slug);
      return {
        slug: dp.slug,
        title: liveSvc?.title || t(`service.${dp.slug}.title`, dp.title),
        price: liveSvc?.price || liveSvc?.price_display || t(`service.${dp.slug}.price`, dp.price),
        summary: liveSvc?.lead || liveSvc?.lead_paragraph || t(`service.${dp.slug}.summary`, t(`service.${dp.slug}.lead`, dp.summary)),
      };
    });
  }, [allServicesList, t]);

// Descriptions for each subcategory shown on category overview cards
const SUBCATEGORY_DESCRIPTIONS = {
  'publishing-options': 'Our packages offer various combinations of publishing, editorial, and marketing services for a truly customized publishing experience.',
  'editorial-evaluation': 'Manuscript diagnostic checkup, detailed observations report on narrative strengths, and $299 credit toward editorial services.',
  'core-editorial-services': 'Focus on improving the nuts and bolts of your book: grammar, spelling, punctuation, capitalization, and sentence structure.',
  'advanced-editorial-services': 'Specialized attention beyond grammar: comprehensive developmental editing, story architecture, and book doctoring.',
  'author-assistance-editorial-services': 'Professional guidance during crucial revision stages, including Quality Reviews and dedicated Editorial Assistants.',
  'cover-copy-polish': 'Compelling back cover copy and marketing descriptions crafted by experienced copywriters to clinch the sale.',
  'proofreading': 'Final pre-publication review to catch lingering typos and layout glitches before your book goes to print.',
  'indexing': 'Professional manual and keyword indexing to maximize reader usability and library adoption of nonfiction titles.',
  'electronic-format': 'Flawless reflowable e-book conversion and worldwide digital distribution to Kindle, Apple Books, and Nook.',
  'audiobook-publishing': 'Lift your story from its pages with Do-It-Yourself and full-cast Professional Audiobook production.',
  'print-formats': 'Trade softcover and deluxe cloth-bound hardcover publishing printed on acid-free, book-grade opaque stock.',
  'interior-page-layout': 'Elite typography, custom headers, image insertions, and Chicago Manual of Style citation formatting.',
  'cover-design': 'Commercial bookstore-grade full-color cover design, artwork revisions, and custom illustrations.',
  'stock-images': 'Access to millions of premium high-resolution images from Getty Images for your cover and interior.',
  'black-and-white-illustrations': 'Custom black-and-white artwork created by seasoned in-house studio artists to enrich your text.',
  'color-illustrations': 'Vibrant, hand-crafted color illustrations tailored for children’s books, graphic novels, and memoirs.',
  'pre-manuscript-services': 'Data entry, manuscript file conversion, scanning, and structural formatting corrections prior to design.',
  'post-page-layout-services': 'Text changes, layout corrections, and interior revisions after initial book proofs are generated.',
  'resubmission': 'Update editions, correct errors, and refresh files for live published books across global retail channels.',
  'author-and-book-videos': 'Cinematic book video trailers and professional author interviews that captivate online audiences visually.',
  'publicity-services': 'Compelling press releases distributed to over 500 media outlets, opt-in journalists, and newsrooms.',
  'book-reviews': 'Elevate your credibility with authoritative reviews from respected literary reviewers that readers trust.',
  'book-signings-and-galleries': 'Exhibition space at premier literary festivals including the LA Times Festival of Books and national shows.',
  'hollywood-book-to-screen': 'Professional coverage, treatments, and screenplays to position your book for film and television adaptation.',
  'internet-marketing': 'Search engine marketing (SEM), Google display ads, social media campaigns, and custom author websites.',
  'radio-services': 'Broadcast interviews with Emmy Award-winning host Kate Delaney and syndicated literary podcasts.',
  'advertising': 'Targeted cooperative advertising campaigns across Ingram and holiday gift guides.',
  'genre-specific-marketing': 'Targeted marketing outreach specifically designed for specialized genres and niche reader communities.',
  'bookstore-essentials': 'Make your book returnable for bookstores, set your own retail price and royalties, and access bookstore pitching.',
  'registration': 'Protect your work with official U.S. Copyright Office registration and secure a Library of Congress Control Number.'
};

// Exact authentic subcategory leads from services.html
const SUBCATEGORY_LEADS = {
  'publishing-options': 'Our packages offer various combinations of our publishing, editorial, and marketing services for a truly customized publishing experience. With Omni, you can choose the package that best suits your literary goals.',
  'editorial-evaluation': 'The Editorial Evaluation is a manuscript checkup that assesses your work to be sure that it has fulfilled the basic requirements of a published book. The editorial evaluator will not only provide you with a general overview of your manuscript but will also educate you through constructive comments on how to write a better book.',
  'advanced-editorial-services': "Sometimes manuscripts need specialized attention that goes beyond detail work in grammar, spelling, and punctuation. Our experienced editors take an in-depth look at your book's content and other high-level stylistic considerations, including content, plot, and pace. Services include Developmental Editing, Book Doctoring, Ghostwriting, and Ghostwriting Estimate and Sample.",
  'author-assistance-editorial-services': 'While all of our Editorial Services aim to assist authors, this category of services takes an extra step, providing professional guidance to authors during the crucial revision stage following a core editorial service. Services include a Quality Review and an Editorial Assistant as an add-on to all of our Core and Advanced Editorial Services. Plus, Researching is available to those authors who need help gathering facts, such as for historical works or memoirs. For more information on Author Assistance Editorial Services, refer to the following form, which is used to provide additional information for the Editorial Assistant before work can begin on your manuscript: Editorial Assistant Form (.doc, 93KB)',
  'core-editorial-services': 'Core editing services focus on improving the nuts and bolts of a book: grammar, spelling, punctuation, capitalization, and sentence structure. Services include Copyediting, Line Editing, Content Editing, and Content Editing Plus.',
  'cover-copy-polish': 'With Omni Cover Copy Polish, ideas you provide allow us to create intriguing copy that can help you clinch the sale.',
  'indexing': 'To maximize the usability of a nonfiction title, readers, book buyers, librarians, and reviewers will expect you to include an index in your book. You can even sell your book to readers by the index.',
  'proofreading': 'Our proofreading and revisions services can help save you from embarrassment and costly corrections after publication.',
  'audiobook-publishing': 'Over the years, the demand for audiobooks has significantly increased because readers are now able to easily download books and listen to them while they are on the move. Through audiobooks, stories are shared in a convenient way. Let your words unfold in your readers’ imagination through Omni audiobook publishing. Lift your story from its pages and let your readers listen to it.',
  'print-formats': 'All manuscripts submitted to Omni are formatted as trade paperbacks and printed on high-quality, acid-free, book-grade opaque paper stock.',
  'black-and-white-illustrations': 'Elevate your book to the next creative level with custom artwork produced in our in-house art studio. The Omni team of seasoned studio artists will work with you to produce striking black-and-white illustrations that add visual interest to your book’s content.',
  'color-illustrations': "One of Omni's talented studio artists will use your descriptions and feedback to create custom color illustrations that reflect your book’s unique style.",
  'cover-design': "The cover is the first opportunity you have to connect with potential readers. That's why at Omni we make sure that your cover will meet the professional standards for commercially successful books. After all, when a book is sitting on the shelf, potential readers don't look to see how a book is published. They only know whether the cover image draws their attention or the back cover copy makes them want to read more. These elements make a great cover, and that is why we pay attention to these details when we are publishing your book.",
  'interior-page-layout': 'Careful planning and execution of the layout of your book is very important. Readers need to be able to easily follow the text of your book. Our professionals will help you create the best layout for your book.',
  'stock-images': 'All books published via the Omni standard publishing packages receive custom-designed covers, produced in full color. Within the realm of this custom-designed cover, you have the option to choose two images, free of charge, from the millions found through Getty Images. If you wish to include more than two images on your cover, a Stock Image Processing fee will be assessed.',
  'post-page-layout-services': 'Omni allows you to make changes to your book after the manuscript has been laid out by our designers. Charges will be applied.',
  'pre-manuscript-services': 'Preparing your manuscript for submission and for publishing is a whole lot easier when we do it for you. Omni can convert your typewritten manuscript, or previously published book, to a word-processed format.',
  'resubmission': 'Once your book has gone live and is for sale, you can still correct errors or other issues that might have been missed. Resubmission services are available for a fee.',
  'video-book-trailer': 'REASONS WHY VIDEO BOOK TRAILERS ARE ESSENTIAL: A book video trailer combines visuals, text, music, and voiceovers, making it appealing to people who prefer video content over traditional text-based marketing. Videos rank well on search engines and social media platforms, increasing discoverability.',
  'book-reviews': 'A book review is an excellent way to generate interest for your title. Book readers, buyers, and retailers rely on the opinion of experts when considering which titles are worth purchasing and reading. Omni offers four distinct review services to help you elevate your book’s credibility and raise its marketing potential.',
  'book-signings-and-galleries': "A book exhibition or book signing event can be a terrific way to create buzz around your book. As an exhibitor at many of the largest trade shows and book events, we've put our books in the hands of booklovers and industry insiders through Omni book exhibition services.",
  'hollywood-book-to-screen': 'Have you ever considered for even a moment that your book could be adapted into a movie or television series? If the answer is yes, then Omni can make your book available to agents, producers, directors, writers, and actors through multiple services available to our authors.',
  'internet-marketing': 'Having your own website, internet search, or preview tools are effective and economical ways to promote your book, enhance your image as an author, and communicate with prospective readers around the world.',
  'publicity-services': 'Get your book noticed from a unique platform created by our publicity and media services. When done right, a press release is an effective way to get publicity and build media relationships.',
  'radio-services': 'Have you ever considered how a radio interview might affect your book’s marketing plan? If the answer is yes, then Omni can make your voice available on the airwaves to help you reach new audiences and further your cause.',
  'bookstore-essentials': 'Through Omni Bookstore Essentials, your book receives professional bookselling services that make your book even more attractive to bookstores. By making your book returnable or adding preview services to your book, bookstores and other book buyers receive additional incentives to stock or purchase your book.',
  'registration': 'As you make your work available to the public, you want to make sure you have the appropriate protection. There are two ways we can help you with that. The first is registering your copyright with the U.S. Copyright Office. Second, a Library of Congress Control Number makes your book more accessible to librarians and book vendors.'
};

// Authentic service summaries when displayed inside a subcategory overview (matching services.html)
const AUTHENTIC_SERVICE_SUMMARIES = {
  'developmental-editing': 'The Omni Developmental Editing service combines three editorial services into one package: First, a developmental editor evaluates the manuscript at the paragraph, chapter, and book levels and makes suggestions throughout the manuscript to identify big-picture areas that need work. Second, the content editor will check the manuscript for errors in grammar, spelling, and punctuation. And third, the manuscript will receive a quality review to ensure the manuscript is editorially sound before it goes into production.',
  'book-doctor': 'A book doctor makes the changes recommended by an Omni developmental editor after you approve the suggested revisions.',
  'small-book-review-with-editing-under-5-000-words': 'Our editors carefully review your full manuscript (under 5,000 words) and provide you with the edits best suited to your book. This all-inclusive service is a combination of our Editorial Assessment, Line Editing and Content Editing services.',
  'copyediting': 'An experienced editor will correct errors in spelling, grammar, and punctuation in your manuscript.',
  'line-editing': 'An editorial specialist will not only check your manuscript for more pervasive errors in spelling, grammar and punctuation, but also will make suggestions regarding sentence structure and word choice.',
  'content-editing': 'The Content Editing service provides extensive restructuring for manuscripts that need more attention than Line Editing provides.',
  'content-editing-plus': 'This service is ideal for manuscripts that need more work on sentence structure and grammar than basic Content Editing can provide.',
  'cover-copy-polish': 'With Omni Cover Copy Polish, ideas you provide allow us to create intriguing copy that can help you clinch the sale.',
  'professional-indexing': "Our professional indexers will provide you with an industry-standard, two-level topical index that is personalized to provide maximum usability for the book's target audience. The professional indexer analyzes your entire book, anticipating line items your reader will most likely want to find and listing them in an intuitive, accessible manner. This high-quality index is the standard found throughout the publishing industry.",
  'computer-generated-keyword-indexing-up-to-500-entries': 'A computer-generated keyword index lists a page number for a key term each time it occurs in the book (up to 500 entries).',
  'computer-generated-keyword-indexing-up-to-700-entries': 'A computer-generated keyword index lists a page number for a key term each time it occurs in the book (up to 700 entries).',
  'computer-generated-keyword-indexing-up-to-1-000-entries': 'A computer-generated keyword index lists a page number for a key term each time it occurs in the book (up to 1,000 entries).',
  'computer-generated-keyword-indexing-custom-quote': 'A computer-generated keyword index for over 1,000 entries requiring a custom quotation.',
  'proofreading': 'As any publishing professional knows, the process of converting a manuscript into a published book is not 100 percent foolproof. Even manuscripts that have undergone a Quality Review can have the occasional remaining error, as even the best copyeditor in the business or the most careful author can inadvertently overlook or create a few mistakes. In fact, for this reason, traditional publishers usually proofread a manuscript twice. This final polish is highly recommended.',
  'do-it-yourself-audiobook': 'Expand your audience and reach with the power of audiobooks, an increasingly popular and preferred format. Effortlessly transform your written words into an immersive audiobook using our partner DIY Audiobook platform, Myaudiobookrecorder.com.',
  'professional-audiobook-package': 'Readers have spoken—and we have listened. These days, they prefer books in a format that will easily fit their busy lifestyle. This is why Omni offers you a solution that allows you to tap into your readers’ multitasking ways: audiobooks. Now they can “read” your book while they commute, work out or even as they do their chores.',
  'softcover-publishing': 'Omni softcover books are formatted as trade paperbacks meeting high production standards and printed on high-quality, acid-free, book-grade opaque paper stock with full-color covers.',
  'hardcover-publishing': 'For durability and class, black & white hardcover publishing is available in glossy casebound or cloth with a full-color dust jacket, creating an enduring keepsake for generations.',
  'book-binding-sizes-and-types': 'Omni publishes softcover books in perfect-bound format and hardcover books in standard trim sizes with industry-grade, acid-free, lignin-free paper stock.',
  'black-and-white-illustrations-fine-detail': 'With Omni’s Fine Detail custom black-and-white illustrations, basic highlights and shadows add depth and dimension to objects and sceneries.',
  'black-and-white-illustrations-personalized': 'Clean lines and uniform shading provide a simple, classic look across various styles from whimsical to technical drawings.',
  'color-illustrations-intricate-design': 'Handcrafted illustrations with defining outlines, varying line details, and greater shading to create stunning three-dimensional full-color artwork.',
  'color-illustrations-fine-detail': 'Drawn by hand and colored digitally with basic shadows and highlights to give artwork greater depth and dimension.',
  'color-illustrations-personalized': 'Drawn by hand and colored digitally with clean lines and uniform colors for a simple, classic full-color presentation.',
  'elite-cover-design': 'When you choose Elite Cover Design, you will have more creative options than if you stay with our Custom Cover Design service.',
  'custom-cover-illustration': 'Our team of experienced in-house artists will work with you to produce a striking custom cover illustration that will help your book stand out.',
  'cover-revisions-text': 'Text changes range from replacing a few words, correcting punctuation, adding additional quotes and other information, to completely replacing sections of cover text.',
  'cover-revisions-images-design': 'Changes to imagery and design elements on the cover layout that are not text changes can be completed through this service.',
  'elite-interior-design': "Hold a one-on-one consultation with an Omni book layout specialist who has special training in designing for your book's genre.",
  'color-image-insertion': 'If you want to include color graphics in your book, please follow our guidelines.',
  'custom-layout-tech': 'An Omni layout specialist will help customize your book.',
  'table-of-contents-two-or-more': 'At times, to better organize your work, multiple tables of contents are needed. After the first free table of contents, Omni can create your additional tables of contents with this service.',
  'table-creation': 'An Omni layout specialist can create tables needed to convey information to readers.',
  'footnote-formatting': 'Most often, footnotes are used as a replacement for long, explanatory notes. Omni follows the Chicago Manual of Style citation guidelines when formatting and inserting footnotes for you.',
  'custom-headers': 'If at any time during the submission process you would like to change a header within your work, you simply need to purchase our Custom Headers service.',
  'b-w-image-insertion': 'If you want to include graphics in your book, please follow our guidelines.',
  'interior-revisions-block-of-25': 'Omni gives you one opportunity to examine your book proofs and make up to 50 corrections for free. If you wish to make further proofreading corrections after the initial free 50, there is a charge for every group of 25 changes.',
  'stock-image-processing': 'If you wish to include more than two images on your cover, a Stock Image Processing fee will be assessed. This fee will also be placed on any images found through Getty Images you wish to use in the interior of your book.',
  'retech': 'If there are a significant number of author errors in the first galley, then you can supply us with a revised manuscript that we can reformat into a new galley through this service.',
  'title-change-after-setup': 'Changing the title of your book impacts many elements within the book. This service deals with handling those elements across production, catalog registration, and distribution.',
  'color-image-scanning': 'Authors who send in hard copies of original color images can have them scanned and placed into the correct place in your work.',
  'basic-manuscript-formatting-corrections': 'Necessary corrections will be made before the manuscript can be put through the editorial and layout processes.',
  'extensive-customized-formatting': 'More extensive corrections will be made before the manuscript is put through the editorial and layout processes.',
  'data-entry-standard': 'With Standard Data Entry, you can send us your printed manuscript and we will convert it into a working digital file. This excludes any handwritten documents or newspaper-type articles.',
  'data-entry-spanish': 'Spanish-language materials you provide are converted into an electronic format for publication with our Spanish Data Entry service.',
  'data-entry-handwritten': 'Relieve yourself from the tedious task of encoding multiple pages and let us do all the manual encoding for you. This service is only applicable to handwritten documents.',
  'large-image-scanning': 'Images larger than 11" x 17" can be scanned by Omni and placed in your book.',
  'b-w-image-scanning': 'Authors who send in hard copies of original black and white images can have them scanned and placed into the correct place in your work.',
  'manuscript-file-conversion': 'If this service is chosen, Omni will make every effort to work with manuscripts created using any of a wide variety of software packages.',
  'graphic-file-conversions-quantity-25': 'When authors send in graphic files, they sometimes require an extensive amount of work. With this service, Omni will work to ensure graphics appear correctly in the final product.',
  'file-merging': 'If the standard manuscript submission process of sending one file is not followed, files must be merged or combined in order to ensure a correct outcome.',
  'image-extraction': 'If you choose to submit your manuscript with the images included in the body of your work, Omni must extract these images to properly create a professional layout of your book. This service will cover the cost of extracting the images to ensure proper interior layout.',
  'resubmission-one-version': 'Once your book has gone live and is for sale, you can still correct errors or other issues that might have been missed. Choose this service if you only have either a softcover or a hardcover that needs to be updated.',
  'resubmission-two-version': 'Choose this service if you have a softcover and hardcover book that needs to be updated.',
  'bookblast-video-marketing-stand-alone-30days': 'Seize the opportunity to have your book video introduced as an advertising break before or between YouTube videos, complete with purchase details.',
  'standard-book-video': 'Create a meaningful 45-60 second online presence with custom 2-D visuals, YouTube distribution, and Hollywood TV/movie consideration.',
  'premium-book-video': 'Give fans a sensational 60-90 second cinematic preview featuring professional voiceover acting, 3-D visual effects, live-action clips, and Hollywood consideration.',
  'bookblast-video-marketing-standard': 'Combines a custom Standard Book Video with a 30-second campaign cut and 30-day targeted ad placement on YouTube.',
  'bookblast-video-marketing-premium': 'Combines a cinematic Premium Book Video with voiceover narration, a 30-second campaign cut, and a targeted 30-day YouTube ad campaign.',
  '15-sec-video-marketing': 'Get your book in front of huge, engaged audiences with a 15-second uninterrupted ad shown 350,000 times on YouTube, plus companion desktop banners.',
  'video-book-talk': 'Stream your 15-20 minute author interview with JT Crowley across Roku, Amazon Fire TV, YouTube, plus major podcast networks like Apple and Spotify.',
  'indie-book-review-bundle': 'Comprehensive BookLife (Publishers Weekly) review with comp titles and letter grades, plus digital banner ads and a PW print supplement ad slot.',
  'literary-gateway-bundle': 'Combines 6 months of Awards Finder platform matching with an objective BlueInk Review, BookMad feature eligibility, and cover resubmission.',
  'review-duo': 'Receive dual respected reviews from Pacific Book Review (PBR) and The US Review of Books (USRB), plus entry into Eric Hoffer and Pacific Book Awards.',
  'review-duo-plus': 'Everything in Review Duo (PBR + USRB + Hoffer & Pacific awards) plus a syndicated 10-15 minute online radio interview and 1-month featured placement.',
  'the-trifecta-review-service': 'Triple professional critique package featuring Kirkus Indie, Clarion Review (ForeWord), and BlueInk Review, plus an ad in Kirkus Reviews magazine.',
  'join-the-la-times-festival-of-books-2025': 'Exhibit your book in the Author Solutions Bookstore Gallery or host your own live book signing at the 30th anniversary LA Times Festival of Books.',
  'hollywood-coverage': 'Independent studio reader coverage with synopsis and screen adaptation analysis, reviewed by 5 More Minutes and archived in the Hollywood Database.',
  'hollywood-treatment': 'A 5-to-10 page professional adaptation blueprint crafted by an industry screenwriter, considered for production by 5 More Minutes.',
  'hollywood-screenplay': 'A full-length adapted screenplay complete with character dialogue and scene action, reviewed by Lionsgate veteran John Sacchi at 5 More Minutes.',
  'sem-1000-clicks': 'Guaranteed 1,000 visitors to your website via strategic Google search ad placement with up to 20 tracked keywords and analytics reporting.',
  'social-media-30-day-content-plan': 'Turnkey 30-day social media launch schedule including daily graphics, engaging post captions, snippets, hashtags, and engagement methods.',
  'social-media-30-day-strategy': 'Step-by-step weekly social plan with daily theme ideas, curated hashtags, and community engagement tactics for an impactful book launch.',
  'kirkus-title-express': 'Two-week Kirkus online giveaway with 100 digital BookStub™ download codes, homepage side box ad, and Critic’s Picks newsletter inclusion.',
  'online-booksellers-advertising': 'Dual-platform banner ad campaigns delivering 500,000 guaranteed impressions on Amazon and targeted visibility to 50,000 retailers on Ingram ipage.',
  'e-book-promo-venture-30-days': 'Limited-time 99¢ Kindle markdown promoted for 30 days across BookBub’s daily email blasts and targeted Facebook genre banner ads.',
  'e-book-promo-launcher': 'Triple-channel bargain campaign pairing a limited-time 99¢ Kindle markdown with 30 days of ads across BookBub, Facebook, and Amazon.com.',
  'social-media-advertising-basic': 'Targeted Facebook and Instagram newsfeed image ad campaign delivering at least 1 million guaranteed impressions to prospective readers.',
  'social-media-advertising-essential': 'Expanded campaign featuring image and video ads displayed at least 2 million times across Facebook and Instagram feeds.',
  'social-media-advertising-advanced': 'Multi-format campaign with image, video, and interactive mobile ads displayed at least 4 million times across Facebook, Instagram, and Audience Network.',
  'display-advertising-on-google-30-days-package': '30-day display ad placement across Google’s 2-million partner site network including YouTube, Blogger, Gmail, and Google Finance.',
  'sem-advanced-campaign': 'Three-month Google search campaign with first-page ad placement, up to 30 tracked keywords, monthly reporting, and a deluxe author website.',
  'sem-specialist-campaign': 'Five-month premier Google search marketing featuring first-page ad placement, up to 50 keywords, bi-weekly reporting, and a website with an author blog.',
  'author-website-setup': 'Custom responsive author website with up to 10 tailored pages, professional HTML design, and 1 full year of free domain registration and web hosting.',
  'press-release-essential-edition': 'Expertly crafted one-page press release distributed to 500+ targeted media outlets with one month of media tracking via Meltwater.',
  'press-release-web-optimized-edition': 'SEO-optimized press release distributed to 30,000 opt-in journalists and 250,000 news subscribers via PRWeb with full tracking.',
  'radio-book-talk': 'Multi-platform broadcast package featuring an 8–12 min interview with Emmy-winner Kate Delaney on America Tonight, plus interviews on Books on Air and Newsgram.',
  'audio-snip': 'A 30-second professionally produced audio teaser commercial about your book, perfect for radio broadcast, podcast spots, and social media campaigns.',
  'online-interview': 'A 10–15 min phone-recorded radio interview on Omni Radio with broadcast veteran J. Douglas Barker, syndicated via iTunes and Toginet.com.',
  'set-your-own-price': 'Flexibility to adjust the retail price of your hardcover and paperback formats to optimize royalty earnings or sales volume.',
  'author-advantage-royalty-program': '3-year program maximizing print royalties (up to 60% on Omni Bookstore, 15% through channel retailers) plus deeply discounted author copies.',
  'retail-focus': 'Direct pitch to 25 independent bookstores across the US over 3 months, print ads in Advance Catalog and ForeWord Magazine, with 12 months returnability.',
  'retail-focus-for-childrens-books': 'Direct pitch to 25 children’s specialty bookstores, print ads in Children’s Advance Catalog and ForeWord Magazine, with 12 months returnability.',
  'library-focus': 'Direct pitch to Collection Development & Acquisition Librarians of 25 public libraries, print ads in Forecast Catalog and ForeWord Magazine, with returnability.',
  'booksellers-return-program': 'Designates your book as "Returnable" in Ingram ipage and Baker & Taylor systems for 12 months with no royalty chargebacks on returned copies.',
  'booksellers-return-program-renewal': '1-year annual extension of active "Returnable" status across Ingram and Baker & Taylor systems, protecting retail stocking eligibility.',
};

  // Active selected service display values: catalog data is source of truth, fallback to CMS t()
  const displayTitle = selectedService ? (selectedService.title || t(`service.${selectedService.slug}.title`, '')) : '';
  const displayPrice = selectedService ? (selectedService.price || selectedService.price_display || t(`service.${selectedService.slug}.price`, '')) : '';
  const displayLead = selectedService ? (selectedService.lead || selectedService.lead_paragraph || t(`service.${selectedService.slug}.lead`, '')) : '';
  const ctaHeading = t('services.cta.heading', selectedService ? `Ready to start with ${displayTitle}?` : 'Ready to get started?');

  // Find the parent category for the current selected service
  const selectedCategory = useMemo(() => {
    if (!selectedService) return null;
    return catalog.find((c) => c.id === selectedService.slug || c.id === selectedService.categoryId || c.tag === selectedService.categoryTag) || null;
  }, [selectedService, catalog]);

  // Determine if currently selected item is a Category Overview
  const isCurrentCategoryOverview = useMemo(() => {
    if (!selectedService || !selectedCategory) return false;
    return selectedService.slug === selectedCategory.id || Boolean(selectedService.isCategoryOverview);
  }, [selectedService, selectedCategory]);

  // Find the current subcategory
  const currentSubcategory = useMemo(() => {
    if (!selectedService || !selectedCategory) return null;
    return (selectedCategory.subcategories || []).find((sub) => sub.id === selectedService.slug || sub.id === selectedService.subcategoryId) || null;
  }, [selectedService, selectedCategory]);

  // Determine if currently selected item is a Subcategory Overview
  const isCurrentSubcategoryOverview = useMemo(() => {
    if (!selectedService || !currentSubcategory) return false;
    if (selectedService.isSubcategoryOverview !== undefined) {
      return Boolean(selectedService.isSubcategoryOverview);
    }
    return Boolean(selectedService.slug === currentSubcategory.id && selectedService.slug !== selectedCategory?.id);
  }, [selectedService, selectedCategory, currentSubcategory]);

  // Determine if currently selected service has a custom tailored editorial layout
  const hasCustomDetailView = useMemo(() => {
    if (!selectedService) return false;
    const slug = selectedService.slug;
    return Boolean(
      slug === 'editorial-evaluation' ||
      slug === 'developmental-editing' ||
      slug === 'book-doctor' ||
      slug?.startsWith('quality-review-') ||
      slug?.startsWith('editorial-assistant-') ||
      slug === 'small-book-review-with-editing-under-5-000-words' ||
      slug === 'copyediting' ||
      slug === 'line-editing' ||
      slug === 'content-editing' ||
      slug === 'content-editing-plus' ||
      (slug === 'cover-copy-polish' && !selectedService.isSubcategoryOverview) ||
      slug === 'professional-indexing' ||
      slug === 'computer-generated-keyword-indexing-up-to-500-entries' ||
      slug === 'computer-generated-keyword-indexing-up-to-700-entries' ||
      slug === 'computer-generated-keyword-indexing-up-to-1-000-entries' ||
      slug === 'computer-generated-keyword-indexing-custom-quote' ||
      (slug === 'proofreading' && !selectedService.isSubcategoryOverview) ||
      slug === 'do-it-yourself-audiobook' ||
      slug === 'professional-audiobook-package' ||
      slug === 'softcover-publishing' ||
      slug === 'hardcover-publishing' ||
      slug === 'book-binding-sizes-and-types' ||
      slug === 'black-and-white-illustrations-fine-detail' ||
      slug === 'black-and-white-illustrations-personalized' ||
      slug === 'color-illustrations-intricate-design' ||
      slug === 'color-illustrations-fine-detail' ||
      slug === 'color-illustrations-personalized' ||
      slug === 'elite-cover-design' ||
      slug === 'custom-cover-illustration' ||
      slug === 'cover-revisions-text' ||
      slug === 'cover-revisions-images-design' ||
      slug === 'elite-interior-design' ||
      slug === 'color-image-insertion' ||
      slug === 'custom-layout-tech' ||
      slug === 'table-of-contents-two-or-more' ||
      slug === 'table-creation' ||
      slug === 'footnote-formatting' ||
      slug === 'custom-headers' ||
      slug === 'b-w-image-insertion' ||
      slug === 'interior-revisions-block-of-25' ||
      slug === 'stock-image-processing' ||
      slug === 'retech' ||
      slug === 'title-change-after-setup' ||
      slug === 'color-image-scanning' ||
      slug === 'basic-manuscript-formatting-corrections' ||
      slug === 'extensive-customized-formatting' ||
      slug === 'data-entry-standard' ||
      slug === 'data-entry-spanish' ||
      slug === 'data-entry-handwritten' ||
      slug === 'large-image-scanning' ||
      slug === 'b-w-image-scanning' ||
      slug === 'manuscript-file-conversion' ||
      slug === 'graphic-file-conversions-quantity-25' ||
      slug === 'file-merging' ||
      slug === 'image-extraction' ||
      slug === 'resubmission-one-version' ||
      slug === 'resubmission-two-version' ||
      slug === 'bookblast-video-marketing-stand-alone-30days' ||
      slug === 'standard-book-video' ||
      slug === 'premium-book-video' ||
      slug === 'bookblast-video-marketing-standard' ||
      slug === 'bookblast-video-marketing-premium' ||
      slug === '15-sec-video-marketing' ||
      slug === 'video-book-talk' ||
      slug === 'indie-book-review-bundle' ||
      slug === 'literary-gateway-bundle' ||
      slug === 'review-duo' ||
      slug === 'review-duo-plus' ||
      slug === 'the-trifecta-review-service' ||
      slug === 'join-the-la-times-festival-of-books-2025' ||
      slug === 'hollywood-coverage' ||
      slug === 'hollywood-treatment' ||
      slug === 'hollywood-screenplay' ||
      slug === 'sem-1000-clicks' ||
      slug === 'social-media-30-day-content-plan' ||
      slug === 'social-media-30-day-strategy' ||
      slug === 'kirkus-title-express' ||
      slug === 'online-booksellers-advertising' ||
      slug === 'e-book-promo-venture-30-days' ||
      slug === 'e-book-promo-launcher' ||
      slug === 'social-media-advertising-basic' ||
      slug === 'social-media-advertising-essential' ||
      slug === 'social-media-advertising-advanced' ||
      slug === 'display-advertising-on-google-30-days-package' ||
      slug === 'sem-advanced-campaign' ||
      slug === 'sem-specialist-campaign' ||
      slug === 'author-website-setup' ||
      slug === 'press-release-essential-edition' ||
      slug === 'press-release-web-optimized-edition' ||
      slug === 'radio-book-talk' ||
      slug === 'audio-snip' ||
      slug === 'online-interview' ||
      slug === 'set-your-own-price' ||
      slug === 'author-advantage-royalty-program' ||
      slug === 'retail-focus' ||
      slug === 'retail-focus-for-childrens-books' ||
      slug === 'library-focus' ||
      slug === 'booksellers-return-program' ||
      slug === 'booksellers-return-program-renewal'
    );
  }, [selectedService]);

  const displayFeatures = useMemo(() => {
    if (!selectedService) return [];
    let feats = selectedService.features || [];
    const override = blocks ? blocks[`service.${selectedService.slug}.features`] : null;
    if (Array.isArray(override)) feats = override;
    else if (typeof override === 'string') {
      try {
        const parsed = JSON.parse(override);
        if (Array.isArray(parsed)) feats = parsed;
      } catch (_) {}
    }
    // Clean and sanitize checklist bullets: never allow full paragraphs, quotes, or author attributions inside feature check boxes
    return feats.filter((f) => {
      if (!f || typeof f !== 'string') return false;
      const trimmed = f.trim();
      if (trimmed.startsWith('—') || trimmed.startsWith('-') || trimmed.startsWith('"') || trimmed.startsWith('“')) return false;
      if (trimmed.toLowerCase().includes('author of')) return false;
      if (trimmed.length > 130) return false;
      return true;
    });
  }, [selectedService, blocks]);

  // Global helper for jumping to subcategories from custom HTML blocks
  useEffect(() => {
    window.omniJumpToSubcategory = (catId, subId) => {
      const cat = catalog.find(c => c.id === catId);
      const sub = cat?.subcategories?.find(s => s.id === subId);
      if (cat && sub) {
        handleSelectSubcategory(cat, sub);
      }
    };
    return () => {
      delete window.omniJumpToSubcategory;
    };
  }, [catalog]);

  // Select a subcategory overview
  const handleSelectSubcategory = (cat, sub) => {
    setExpandedCategories((prev) => ({ ...prev, [cat.tag]: true, [cat.id]: true }));
    setExpandedSubcategories((prev) => ({ ...prev, [sub.id]: true }));

    const subLead = SUBCATEGORY_LEADS[sub.id] || SUBCATEGORY_DESCRIPTIONS[sub.id] || sub.lead || `Explore all specialized services under ${sub.title}.`;
    const subServices = (sub.services || []).filter(s => s.slug !== cat.id);

    setSelectedService({
      slug: sub.id,
      title: sub.title,
      isSubcategoryOverview: true,
      categoryId: cat.id,
      categoryTitle: cat.title,
      subcategoryId: sub.id,
      subcategoryTitle: sub.title,
      categoryTag: cat.tag,
      lead: subLead,
      services: subServices,
      features: []
    });

    setDrawerOpen(false);
    window.scrollTo({ top: 120, behavior: 'smooth' });
  };

  // Jump from category overview card into a specific subcategory
  const handleJumpToSubcategory = (targetCat, targetSub) => {
    handleSelectSubcategory(targetCat, targetSub);
  };

  // Copy email
  const handleCopyEmail = (e) => {
    e?.preventDefault?.();
    const email = ctaEmail || 'admin@omnivirtualsolution.com';
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(email);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = email;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
      } catch (err) {}
      document.body.removeChild(textarea);
    }
    setEmailCopied(true);
    setTimeout(() => setEmailCopied(false), 2200);
  };

  // Toggle category expansion
  const toggleCategoryAccordion = (catId, catTag, e) => {
    if (e) {
      e.stopPropagation();
    }
    setExpandedCategories((prev) => {
      const isExplicit = prev[catId] !== undefined ? prev[catId] : prev[catTag];
      const isCurrentlyOpen = isExplicit !== undefined ? Boolean(isExplicit) : false;
      const nextVal = !isCurrentlyOpen;
      const updated = { ...prev };
      if (catId) updated[catId] = nextVal;
      if (catTag) updated[catTag] = nextVal;
      return updated;
    });
  };

  const handleSelectService = (service, cat, sub, keepCategoryAccordionState = false) => {
    if (service.slug === 'basic-package' || service.slug === 'standard-package' || service.slug === 'advanced-package') {
      const pubCat = catalog.find(c => c.id === 'publishing-packages') || cat;
      const pubSub = pubCat?.subcategories?.find(s => s.id === 'publishing-options') || sub;
      if (pubCat && pubSub) {
        handleSelectSubcategory(pubCat, pubSub);
        return;
      }
    }
    const subId = sub?.id || service.subcategoryId;
    if (subId) {
      setExpandedSubcategories((prev) => ({ ...prev, [subId]: true }));
    }
    const catId = cat?.id || service.categoryId;
    const catTag = cat?.tag || service.categoryTag;
    if (catTag && !keepCategoryAccordionState) {
      setExpandedCategories((prev) => ({ ...prev, [catTag]: true, [catId]: true }));
    }
    setSelectedService({
      ...service,
      isSubcategoryOverview: false,
      categoryId: catId,
      categoryTitle: cat?.title || service.categoryTitle,
      subcategoryId: subId,
      subcategoryTitle: sub?.title || service.subcategoryTitle,
      categoryTag: catTag,
    });
    setDrawerOpen(false);
    window.scrollTo({ top: 120, behavior: 'smooth' });
  };

  // Find previous & next services for convenient mobile navigation
  const currentIndex = useMemo(() => {
    if (!selectedService) return -1;
    return allServicesList.findIndex((s) => s.slug === selectedService.slug);
  }, [selectedService, allServicesList]);

  const prevService = currentIndex > 0 ? allServicesList[currentIndex - 1] : null;
  const nextService = currentIndex < allServicesList.length - 1 ? allServicesList[currentIndex + 1] : null;

  // Filter catalog based on active category pill and search query
  const filteredCatalog = useMemo(() => {
    return catalog
      .filter((cat) => activeCategoryTag === 'all' || cat.tag === activeCategoryTag)
      .map((cat) => ({
        ...cat,
        subcategories: cat.subcategories
          .map((sub) => ({
            ...sub,
            services: sub.services.filter(
              (s) =>
                s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                s.lead.toLowerCase().includes(searchQuery.toLowerCase())
            ),
          }))
          .filter((sub) => sub.services.length > 0),
      }))
      .filter((cat) => cat.subcategories.length > 0);
  }, [catalog, activeCategoryTag, searchQuery]);

  return (
    <div className="services-page-wrapper">
      <main className="main services-catalog-page">
        <div className="container" style={{ maxWidth: '1240px', margin: '0 auto', padding: '0 clamp(16px, 3vw, 24px)' }}>
          
          {/* Top Header Bar (Centered) */}
          <div className="services-top-bar text-center">
            <h1 className="services-main-title text-center" data-block-key="services.header.title">
              {headerTitle}
            </h1>
            <p className="services-subtitle text-center mx-auto" style={{ maxWidth: '640px' }} data-block-key="services.header.subtitle">
              {headerSubtitle}
            </p>

            {/* Search & Mobile Drawer Trigger Bar */}
            <div className="services-control-bar">
              <div className="services-search-wrap">
                <i className="bi bi-search services-search-icon"></i>
                <input
                  type="text"
                  className="services-search-input"
                  placeholder="Search all services, packages, editorial..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label="Search services"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'transparent',
                      border: 'none',
                      color: '#8a827a',
                      cursor: 'pointer',
                    }}
                  >
                    <i className="bi bi-x-circle-fill"></i>
                  </button>
                )}
              </div>

              {/* Mobile Categories Button */}
              <button
                type="button"
                className="drawer-trigger-btn d-lg-none"
                onClick={() => setDrawerOpen(true)}
                aria-label="Open categories menu"
              >
                <i className="bi bi-grid-fill"></i>
                <span>Categories</span>
              </button>
            </div>
          </div>

          {/* Main Grid: Desktop Sidebar + Right Detail Card */}
          <div className="row g-4">
            
            {/* Desktop Persistent Sidebar */}
            <div className="col-lg-4 d-none d-lg-block">
              <div className="desktop-services-sidebar">
                <div className="sidebar-brand-box d-flex align-items-center justify-content-between">
                  <span className="fw-bold">
                    <i className="bi bi-folder2-open me-2" style={{ color: '#d8aa71' }}></i>
                    All Categories ({catalog.length})
                  </span>
                  <span className="badge rounded-pill bg-dark text-warning border border-warning" style={{ fontSize: '0.72rem' }}>
                    Live Catalog
                  </span>
                </div>

                <div>
                  {catalog.map((cat) => {
                    const isExplicit = expandedCategories[cat.id] !== undefined
                      ? expandedCategories[cat.id]
                      : expandedCategories[cat.tag];
                    const isExpanded = isExplicit !== undefined
                      ? Boolean(isExplicit)
                      : (searchQuery.length > 0 || (selectedCategory && (selectedCategory.id === cat.id || selectedCategory.tag === cat.tag)));
                    const totalCount = cat.subcategories.reduce(
                      (acc, sub) => acc + (sub.services || []).filter((s) => s.slug !== cat.id).length,
                      0
                    );
                    const catTitle = t(`service.${cat.id}.title`, cat.title);
                    const isCatOverviewSelected = selectedService?.slug === cat.id;

                    return (
                      <div key={cat.id} className="sidebar-category-group">
                        <div className="d-flex align-items-center justify-content-between category-header-row">
                          <button
                            type="button"
                            className={`category-accordion-btn ${isExpanded ? 'expanded' : ''} ${isCatOverviewSelected ? 'active-category' : ''}`}
                            onClick={() => {
                              if (isExpanded) {
                                // Close the category!
                                setExpandedCategories((prev) => ({
                                  ...prev,
                                  [cat.id]: false,
                                  [cat.tag]: false,
                                }));
                                return;
                              }
                              // Open category and select category overview
                              setExpandedCategories((prev) => ({
                                ...prev,
                                [cat.id]: true,
                                [cat.tag]: true,
                              }));
                              const catOverviewSvc = allServicesList.find((s) => s.slug === cat.id) || {
                                slug: cat.id,
                                title: cat.title,
                                lead: cat.lead || cat.description || '',
                                categoryId: cat.id,
                                categoryTitle: cat.title,
                                categoryTag: cat.tag,
                                isCategoryOverview: true
                              };
                              handleSelectService(
                                {
                                  ...catOverviewSvc,
                                  title: catOverviewSvc.title || t(`service.${catOverviewSvc.slug}.title`, cat.title),
                                  lead: catOverviewSvc.lead || catOverviewSvc.lead_paragraph || t(`service.${catOverviewSvc.slug}.lead`, ''),
                                },
                                cat,
                                cat.subcategories[0],
                                true
                              );
                            }}
                          >
                            <span className="d-flex align-items-center gap-2">
                              <i className={`bi ${cat.icon}`} style={{ color: '#ad7d42' }}></i>
                              <span className="cat-title-text" data-block-key={`service.${cat.id}.title`}>
                                {catTitle}
                              </span>
                            </span>
                            <span className="d-flex align-items-center gap-2">
                              <span className="badge bg-light text-muted border" style={{ fontSize: '0.7rem' }}>
                                {totalCount}
                              </span>
                              <span
                                className="cat-toggle-chevron-btn"
                                title={isExpanded ? "Collapse category" : "Expand category"}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedCategories((prev) => ({
                                    ...prev,
                                    [cat.id]: !isExpanded,
                                    [cat.tag]: !isExpanded,
                                  }));
                                }}
                              >
                                <i className={`bi bi-chevron-${isExpanded ? 'down' : 'right'} small`}></i>
                              </span>
                            </span>
                          </button>
                        </div>

                        {isExpanded && (
                          <div className="subcategories-list">
                            {cat.subcategories.map((sub) => {
                              const subTitle = t(`service.${sub.id}.title`, sub.title);

                              if (cat.id === 'publishing-packages') {
                                const isSubOverviewSelected = Boolean(selectedService?.slug === sub.id || (selectedService?.isSubcategoryOverview && selectedService?.slug === sub.id));
                                return (
                                  <div key={sub.id} className="subcategory-group mb-2">
                                    <button
                                      type="button"
                                      className={`subcategory-dropdown-btn ${isSubOverviewSelected ? 'active-subcategory' : ''}`}
                                      onClick={() => handleSelectSubcategory(cat, sub)}
                                    >
                                      <span className="subcategory-label-text" data-block-key={`service.${sub.id}.title`}>
                                        {subTitle}
                                      </span>
                                    </button>
                                  </div>
                                );
                              }

                              const filteredServices = (sub.services || []).filter(
                                (svc) => svc.slug !== cat.id
                              );
                              if (filteredServices.length === 0) return null;

                              const defaultSubOpen =
                                selectedService?.subcategoryId === sub.id ||
                                filteredServices.some((s) => s.slug === selectedService?.slug) ||
                                cat.subcategories.length === 1 ||
                                searchQuery.length > 0;

                              const isSubExpanded =
                                expandedSubcategories[sub.id] !== undefined
                                  ? expandedSubcategories[sub.id]
                                  : defaultSubOpen;

                              const isSubOverviewSelected = Boolean(selectedService?.isSubcategoryOverview && selectedService?.slug === sub.id);

                              return (
                                <div key={sub.id} className="subcategory-group mb-2">
                                  <button
                                    type="button"
                                    className={`subcategory-dropdown-btn ${isSubExpanded ? 'expanded' : ''} ${isSubOverviewSelected ? 'active-subcategory' : ''}`}
                                    onClick={() => handleSelectSubcategory(cat, sub)}
                                    aria-expanded={isSubExpanded}
                                  >
                                    <span className="subcategory-label-text" data-block-key={`service.${sub.id}.title`}>
                                      {subTitle}
                                    </span>
                                    <span className="d-flex align-items-center gap-1">
                                      <span className="subcat-count-badge">
                                        {filteredServices.length}
                                      </span>
                                      <span
                                        className="subcat-toggle-chevron-btn"
                                        title={isSubExpanded ? "Collapse" : "Expand"}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          toggleSubcategoryAccordion(sub.id, e, defaultSubOpen);
                                        }}
                                      >
                                        <i className={`bi bi-chevron-${isSubExpanded ? 'down' : 'right'} subcat-chevron`}></i>
                                      </span>
                                    </span>
                                  </button>

                                  {isSubExpanded && (
                                    <div className="subcategory-services-list">
                                      {filteredServices.map((svc) => {
                                        const isSelected = !selectedService?.isSubcategoryOverview && selectedService?.slug === svc.slug;
                                        const svcTitle = t(`service.${svc.slug}.title`, svc.title);
                                        return (
                                          <button
                                            key={svc.slug}
                                            type="button"
                                            className={`service-nav-item ${isSelected ? 'active' : ''}`}
                                            onClick={() => handleSelectService({ ...svc, title: svcTitle }, cat, sub)}
                                          >
                                            <span className="text-truncate" data-block-key={`service.${svc.slug}.title`}>{svcTitle}</span>
                                            {isSelected && <i className="bi bi-check2"></i>}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right Presentation Detail Column */}
            <div className="col-lg-8">
              {selectedService ? (
                <div className="service-detail-card">
                  {/* Breadcrumbs */}
                  <div className="service-breadcrumb">
                    <span>Services</span>
                    <i className="bi bi-chevron-right" style={{ fontSize: '0.65rem' }}></i>
                    <span 
                      style={{ cursor: selectedCategory ? 'pointer' : 'default' }}
                      onClick={() => {
                        if (selectedCategory) {
                          const catOverviewSvc = allServicesList.find((s) => s.slug === selectedCategory.id) || {
                            slug: selectedCategory.id,
                            title: selectedCategory.title,
                            lead: selectedCategory.lead || selectedCategory.description || '',
                            categoryId: selectedCategory.id,
                            categoryTitle: selectedCategory.title,
                            categoryTag: selectedCategory.tag,
                            isCategoryOverview: true
                          };
                          handleSelectService(
                            {
                              ...catOverviewSvc,
                              title: catOverviewSvc.title || t(`service.${catOverviewSvc.slug}.title`, selectedCategory.title),
                              lead: catOverviewSvc.lead || catOverviewSvc.lead_paragraph || t(`service.${catOverviewSvc.slug}.lead`, ''),
                            },
                            selectedCategory,
                            selectedCategory.subcategories?.[0]
                          );
                        }
                      }}
                    >
                      {selectedCategory?.title || selectedService.categoryTitle || 'Publishing'}
                    </span>
                    {isCurrentSubcategoryOverview && (
                      <>
                        <i className="bi bi-chevron-right" style={{ fontSize: '0.65rem' }}></i>
                        <span className="text-dark fw-semibold" data-block-key={selectedService ? `service.${selectedService.slug}.title` : undefined}>{displayTitle}</span>
                      </>
                    )}
                    {!isCurrentCategoryOverview && !isCurrentSubcategoryOverview && (
                      <>
                        {currentSubcategory && (
                          <>
                            <i className="bi bi-chevron-right" style={{ fontSize: '0.65rem' }}></i>
                            <span 
                              style={{ cursor: 'pointer' }}
                              onClick={() => selectedCategory && handleSelectSubcategory(selectedCategory, currentSubcategory)}
                            >
                              {currentSubcategory.title}
                            </span>
                          </>
                        )}
                        <i className="bi bi-chevron-right" style={{ fontSize: '0.65rem' }}></i>
                        <span className="text-dark fw-semibold" data-block-key={selectedService ? `service.${selectedService.slug}.title` : undefined}>{displayTitle}</span>
                      </>
                    )}
                  </div>

                  {/* Header row: Badge, Title & Price */}
                  <div>
                    <div className="service-tag-badge">
                      <i className="bi bi-award-fill"></i>
                      <span data-block-key={(isCurrentCategoryOverview || isCurrentSubcategoryOverview) ? undefined : "services.badge.text"}>
                        {isCurrentCategoryOverview ? 'Omni Category Overview' : isCurrentSubcategoryOverview ? 'Omni Subcategory Overview' : badgeText}
                      </span>
                    </div>
                    <div className="d-flex align-items-baseline gap-3 flex-wrap">
                      <h2 className="service-title m-0" data-block-key={selectedService ? `service.${selectedService.slug}.title` : undefined}>
                        {displayTitle}
                      </h2>
                      {displayPrice && (
                        <div className="service-package-price-display m-0">
                          <span 
                            className="service-price-amount"
                            data-block-key={selectedService ? `service.${selectedService.slug}.price` : undefined}
                            style={{ display: 'inline-block', minWidth: '50px' }}
                          >
                            {displayPrice}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <hr className="service-divider" />

                  {/* Service Overview Box (Only shown if NOT a custom layout and NOT publishing packages / evaluation-services overview) */}
                  {!hasCustomDetailView && selectedService?.slug !== 'publishing-packages' && selectedService?.slug !== 'publishing-options' && selectedService?.slug !== 'evaluation-services' && (
                    <div className="service-lead-box">
                      <h5 data-block-key={isCurrentCategoryOverview ? `service.${selectedService?.slug}.overview_heading` : "services.overview.heading"}>
                        {isCurrentCategoryOverview ? t(`service.${selectedService?.slug}.overview_heading`, 'Category Overview') : overviewHeading}
                      </h5>
                      <p className="service-lead-text" data-block-key={selectedService ? `service.${selectedService.slug}.lead` : undefined}>
                        {displayLead}
                      </p>
                    </div>
                  )}

                  {/* Bottom section: Specific layout for Publishing Packages, Publishing Options, Evaluation Services, Editorial Evaluation, or What's Included */}
                  {blocks && blocks[`service.${selectedService?.slug}.custom_html`] ? (
                    <div dangerouslySetInnerHTML={{ __html: blocks[`service.${selectedService?.slug}.custom_html`] }} />
                  ) : selectedService?.slug === 'publishing-packages' ? (
                    /* Category Publishing Packages: Overview and Publishing Options card (NO Basic, Standard, or Advanced Package here!) */
                    <div className="publishing-options-section mb-4">
                      <div className="publishing-packages-container">
                        <div 
                          className="publishing-package-card"
                          onClick={() => {
                            const sub = selectedCategory?.subcategories?.find(s => s.id === 'publishing-options');
                            if (sub) handleSelectSubcategory(selectedCategory, sub);
                          }}
                          role="button"
                          tabIndex={0}
                        >
                          <div className="publishing-package-card-header">
                            <h5 
                              className="publishing-package-card-title m-0" 
                              data-block-key="service.publishing-options.title"
                            >
                              {publishingOptionsTitle}
                            </h5>
                            <span className="publishing-package-arrow-badge"><i className="bi bi-arrow-right-short"></i></span>
                          </div>
                          <p 
                            className="publishing-package-card-summary mb-0" 
                            data-block-key="service.publishing-options.desc"
                          >
                            {publishingOptionsDesc}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'publishing-options' ? (
                    /* Subcategory Publishing Options Page: Full Details of Basic, Standard, and Advanced Package */
                    <div className="publishing-options-section">
                      <div className="package-card-block mb-4">
                        <h5 
                          className="fw-bold mb-2" 
                          style={{ color: '#d9534f', fontSize: '1.25rem' }}
                          data-block-key="service.basic-package.title"
                        >
                          {t('service.basic-package.title', 'Basic Package')}
                        </h5>
                        <p 
                          className="mb-0" 
                          style={{ color: '#57534e', fontSize: '0.96rem', lineHeight: '1.72' }}
                          data-block-key="service.basic-package.desc"
                        >
                          {t('service.basic-package.desc', 'The Basic package is designed for authors seeking basic publishing needs. It includes digital formatting and distribution for e-books, paperback publishing, and customization options for the interior and cover. This package supports up to 25 image insertions and provides one block of 50 interior revisions. Authors receive electronic proofs, one-on-one support, and distribution across major online retailers like Amazon and Barnes & Noble. The package also features ISBN assignment, U.S. Copyright registration, a Library of Congress Control Number, and three paperback copies. Additional perks include Amazon Look Inside, Google Preview, Barnes & Noble Read Instantly, and a 12-month bookseller return program.')}
                        </p>
                      </div>

                      <div className="package-card-block mb-4">
                        <h5 
                          className="fw-bold mb-2" 
                          style={{ color: '#d9534f', fontSize: '1.25rem' }}
                          data-block-key="service.standard-package.title"
                        >
                          {t('service.standard-package.title', 'Standard Package')}
                        </h5>
                        <p 
                          className="mb-0" 
                          style={{ color: '#57534e', fontSize: '0.96rem', lineHeight: '1.72' }}
                          data-block-key="service.standard-package.desc"
                        >
                          {t('service.standard-package.desc', 'Building on the Basic, the Standard package adds hardcover publishing to the mix, enhancing the physical presence of your book. This package maintains all the services of the Basic package, including the customization, support, and online distribution features. In addition to the three paperback copies, it also includes one hardcover copy. The bookseller return program is extended to 36 months, providing additional flexibility and support for bookstores to manage inventory.')}
                        </p>
                      </div>

                      <div className="package-card-block mb-4">
                        <h5 
                          className="fw-bold mb-2" 
                          style={{ color: '#d9534f', fontSize: '1.25rem' }}
                          data-block-key="service.advanced-package.title"
                        >
                          {t('service.advanced-package.title', 'Advanced Package')}
                        </h5>
                        <p 
                          className="mb-0" 
                          style={{ color: '#57534e', fontSize: '0.96rem', lineHeight: '1.72' }}
                          data-block-key="service.advanced-package.desc"
                        >
                          {t('service.advanced-package.desc', 'The Advanced package is the most comprehensive, designed for authors who want extensive support and marketing tools. It includes everything from the Standard package, but boosts the number of copies provided to 20 paperbacks and 5 hardcovers. This package distinguishes itself with marketing enhancements such as 30 days of online book ads via Google and a professional book review from Kirkus Reviews. Additionally, it includes a deluxe website setup to further promote the book. The return program is extended to 60 months, offering the maximum return flexibility for retailers.')}
                        </p>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'evaluation-services' ? (
                    /* Evaluation Services Overview Content (Image 1) */
                    <div className="evaluation-services-overview-content">
                      {/* Section 1: Editorial Rx Referral */}
                      <div className="evaluation-section-block mb-4">
                        <h4 
                          className="editorial-accent-title fw-bold mb-2" 
                          style={{ color: '#d9534f', fontSize: '1.25rem' }}
                          data-block-key="service.evaluation-services.rx_title"
                        >
                          {t('service.evaluation-services.rx_title', 'Editorial Rx Referral')}
                        </h4>
                        <p 
                          className="editorial-section-p mb-3" 
                          style={{ color: '#57534e', fontSize: '0.98rem', lineHeight: '1.7' }}
                          data-block-key="service.evaluation-services.rx_desc"
                        >
                          {t('service.evaluation-services.rx_desc', 'Through this service, an evaluator will recommend the services of an appropriate editorial specialist—from a copyeditor or content editor to a developmental editor or book doctor.')}
                        </p>
                        
                        {/* Quote Block */}
                        <blockquote 
                          className="editorial-testimonial-quote"
                          style={{
                            margin: '18px 0',
                            padding: '16px 20px',
                            borderLeft: '4px solid #d9534f',
                            background: 'rgba(217, 83, 79, 0.04)',
                            borderRadius: '0 8px 8px 0',
                            fontStyle: 'italic',
                            color: '#444'
                          }}
                        >
                          <p className="mb-2" style={{ fontSize: '0.95rem', lineHeight: '1.6' }} data-block-key="service.evaluation-services.rx_quote">
                            {t('service.evaluation-services.rx_quote', '"With the various points to examine and adjust in mind, I re-read This Golden Land and made changes along the way. These were excellent points, by the way, and very helpful to me for cleaning up the manuscript."')}
                          </p>
                          <footer 
                            className="editorial-quote-author" 
                            style={{ fontStyle: 'normal', fontWeight: '600', color: '#666', fontSize: '0.88rem' }}
                            data-block-key="service.evaluation-services.rx_author"
                          >
                            {t('service.evaluation-services.rx_author', '-Barbara Wood, author of This Golden Land')}
                          </footer>
                        </blockquote>
                      </div>

                      {/* Section 2: Editorial Evaluation Services */}
                      <div className="evaluation-section-block mb-4">
                        <h4 
                          className="editorial-accent-title fw-bold mb-2" 
                          style={{ color: '#d9534f', fontSize: '1.25rem' }}
                          data-block-key="service.evaluation-services.eval_title"
                        >
                          {t('service.evaluation-services.eval_title', 'Editorial Evaluation Services')}
                        </h4>
                        <p 
                          className="editorial-section-p mb-0" 
                          style={{ color: '#57534e', fontSize: '0.98rem', lineHeight: '1.7' }}
                          data-block-key="service.evaluation-services.eval_desc"
                        >
                          {t('service.evaluation-services.eval_desc', "Regardless of your publishing goals, the editorial quality of your work matters—no one wants to read a book that's riddled with typos and grammatical errors. However, even the best writers make occasional mistakes. Omni provides editorial services that will help you make your book the best it can be.")}
                        </p>
                      </div>

                      {/* Direct Interactive Card to Explore Editorial Evaluation */}
                      <div className="publishing-packages-container mt-4">
                        <div 
                          className="publishing-package-card"
                          onClick={() => {
                            const ee = allServicesList.find(s => s.slug === 'editorial-evaluation');
                            if (ee) setSelectedService(ee);
                          }}
                          style={{ cursor: 'pointer' }}
                        >
                          <div className="publishing-package-card-header">
                            <h5 className="publishing-package-card-title m-0">
                              Editorial Evaluation
                            </h5>
                            <span className="publishing-package-arrow-badge">
                              <i className="bi bi-arrow-right-short"></i>
                            </span>
                          </div>
                          <p className="publishing-package-card-summary">
                            Explore our complete manuscript diagnostic checkup, detailed observations report, and $299 credit toward professional editorial services.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'editorial-evaluation' ? (
                    /* Editorial Evaluation Detail Content (Image 2) */
                    <div className="editorial-evaluation-detail-content">
                      {/* Narrative Paragraphs */}
                      <div className="editorial-evaluation-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3" data-block-key="service.editorial-evaluation.p1">
                          {t('service.editorial-evaluation.p1', "The Editorial Evaluation is a manuscript checkup that assesses your work to be sure that it has fulfilled the basic requirements of a published book. The editorial evaluator will not only provide you with a general overview of your manuscript but will also educate you through constructive comments on how to write a better book.")}
                        </p>
                        <p className="mb-3" data-block-key="service.editorial-evaluation.p2">
                          {t('service.editorial-evaluation.p2', "The Editorial Evaluation is a detailed report on the observations of an evaluator about the strengths and weaknesses of your manuscript (rather than an editing of your manuscript). At the end of the evaluation, an Editorial Rx Referral will recommend the services of an appropriate editorial specialist—from a copyeditor or content editor to a developmental editor. You may then choose to purchase those services from Omni. If you do choose to purchase an editorial service, our staff will assign your book to a specialist who will address the issues raised in the Editorial Evaluation and give your manuscript the professional attention that it would receive at a traditional publishing house. You may also choose to use your own freelance editor or make the recommended changes yourself.")}
                        </p>

                        {/* Quote Block */}
                        <blockquote 
                          className="editorial-testimonial-quote"
                          style={{
                            margin: '22px 0',
                            padding: '16px 22px',
                            borderLeft: '4px solid #ad7d42',
                            background: 'rgba(173, 125, 66, 0.05)',
                            borderRadius: '0 8px 8px 0',
                            fontStyle: 'italic',
                            color: '#333'
                          }}
                        >
                          <p className="mb-2" style={{ fontSize: '0.95rem', lineHeight: '1.6' }} data-block-key="service.editorial-evaluation.quote">
                            {t('service.editorial-evaluation.quote', '"I appreciate all the editorial work that went into the analysis – I was very impressed with the job Omni did with my book. The analysis was thorough, clear, and very helpful. Thank you again for all your assistance on making his Golden LandT even better!"')}
                          </p>
                          <footer 
                            className="editorial-quote-author" 
                            style={{ fontStyle: 'normal', fontWeight: '600', color: '#78716c', fontSize: '0.88rem' }}
                            data-block-key="service.editorial-evaluation.quote_author"
                          >
                            {t('service.editorial-evaluation.quote_author', '—Barbara Wood, author of This Golden Land')}
                          </footer>
                        </blockquote>

                        <p className="mb-3" data-block-key="service.editorial-evaluation.p3">
                          {t('service.editorial-evaluation.p3', "The Editorial Evaluation also qualifies you for possible selection to our prestigious Editor's Choice program.")}
                        </p>
                        <p className="mb-3" data-block-key="service.editorial-evaluation.p4">
                          {t('service.editorial-evaluation.p4', "Here are a few examples of questions that are answered in Editorial Evaluations depending on your book's genre.")}
                        </p>
                        <p className="mb-3" data-block-key="service.editorial-evaluation.p5">
                          {t('service.editorial-evaluation.p5', "Please note: The Editorial Evaluation is not a replacement for Omni's editorial services. Rather, it is a preliminary diagnostic tool, examining several sections of the manuscript in detail, to pinpoint areas in need of improvement. Evaluators offer examples of items that could be strengthened and give critique and commentary across a range of topics.")}
                        </p>
                        <p className="mb-4" data-block-key="service.editorial-evaluation.p6">
                          {t('service.editorial-evaluation.p6', "The Editorial Evaluation fee is based on industry standard manuscript word count of 100,000 words or less. For manuscripts above 100,000 words, the author may choose to have approximately the first 100,000 words assessed during the Editorial Evaluation. If the author wishes to have the full manuscript evaluated, an additional fee for each 50,000 words over 100,000 will be required. Should the author purchase one of our editing services, the full manuscript will be edited line by line.")}
                        </p>
                      </div>

                      {/* Note & Credit Box */}
                      <div 
                        className="editorial-note-callout p-3 mb-4 rounded-3"
                        style={{
                          background: '#faf6f0',
                          border: '1px solid rgba(173, 125, 66, 0.3)',
                          borderLeft: '5px solid #ad7d42'
                        }}
                      >
                        <div className="fw-bold mb-1" style={{ color: '#2b2219', fontSize: '0.95rem' }}>Note:</div>
                        <p className="fst-italic mb-2" style={{ color: '#57534e', fontSize: '0.92rem', lineHeight: '1.6' }} data-block-key="service.editorial-evaluation.credit_note">
                          {t('service.editorial-evaluation.credit_note', 'You have the option to work with your editor or make changes yourself. However, should you decide to purchase any of our Editorial Services, you will receive a $299 credit which will be deducted from the overall editing cost.')}
                        </p>
                        <div className="fw-bold" style={{ color: '#ad7d42', fontSize: '0.92rem' }} data-block-key="service.editorial-evaluation.duration">
                          {t('service.editorial-evaluation.duration', 'Duration: 2-3 Weeks')}
                        </div>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'developmental-editing' ? (
                    /* Developmental Editing (Matching Screenshot 1 - NO PRICE) */
                    <div className="developmental-editing-detail-content">
                      <div className="editorial-callout-notice p-3 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                        <p className="fst-italic mb-1 fw-medium" style={{ color: '#57534e', fontSize: '0.92rem' }}>
                          Prescribed by Editorial Evaluation only. Please speak with your editorial consultant for more information.
                        </p>
                        <p className="fst-italic mb-0 fw-semibold" style={{ color: '#ad7d42', fontSize: '0.92rem' }}>
                          Please Note: A Developmental Edit includes FREE Content Editing and Quality Review.
                        </p>
                      </div>

                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          The Omni Developmental Editing service combines three editorial services into one package: First, a developmental editor evaluates the manuscript at the paragraph, chapter, and book levels and makes suggestions throughout the manuscript to identify big-picture areas that need work.
                        </p>

                        <div className="p-3 mb-3 rounded-3" style={{ background: '#fcfbf9', border: '1px solid #ebd9c4' }}>
                          <ul className="mb-0 ps-3 d-flex flex-column gap-2" style={{ color: '#44403c', fontSize: '0.94rem' }}>
                            <li>
                              <strong>For fiction works</strong>, the editor will analyze the readership and genre to determine whether the content is appropriate. He will then examine essential considerations such as plot, pace, characterization and dialogue.
                            </li>
                            <li>
                              <strong>For nonfiction titles</strong>, the editor will analyze the readership, purpose, and possible uses of the work to determine that the content is complete and appropriate; that concepts are developed adequately; that material is well organized; and that illustrations, tables, and lists are used effectively throughout.
                            </li>
                          </ul>
                        </div>

                        <p className="mb-3">
                          Authors can choose to make improvements suggested by the developmental editor themselves or purchase the services of a Book Doctor to help them make alterations. (If applicable, a price estimate for book doctoring is included with the completed developmental edit.) Once big-picture changes have been made, the second step, a free Content Edit, begins; the content editor will check the manuscript for errors in grammar, spelling, and punctuation. And third, the manuscript will receive a quality review to ensure the manuscript is editorially sound before it goes into production.
                        </p>

                        <blockquote 
                          className="editorial-testimonial-quote"
                          style={{
                            margin: '22px 0',
                            padding: '16px 22px',
                            borderLeft: '4px solid #ad7d42',
                            background: 'rgba(173, 125, 66, 0.05)',
                            borderRadius: '0 8px 8px 0',
                            fontStyle: 'italic',
                            color: '#333'
                          }}
                        >
                          <p className="mb-2" style={{ fontSize: '0.95rem', lineHeight: '1.6' }}>
                            "I am THRILLED with the edit so far! I've never had a developmental edit, and it's so cool to 'hear' someone else's voice regarding the material. What's more, the editor has targeted areas that I subconsciously knew needed work, but just didn't hear my conscious voice telling me how to correct. Please let her know how excited I am and how far her input had surpassed what I thought I was paying for."
                          </p>
                          <footer style={{ fontStyle: 'normal', fontWeight: '600', color: '#78716c', fontSize: '0.88rem' }}>
                            — Eric Rankin, author of <em>The Aquarians</em>
                          </footer>
                        </blockquote>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'book-doctor' ? (
                    /* Book Doctor (Matching Screenshot 2 - NO PRICE) */
                    <div className="book-doctor-detail-content">
                      <div className="editorial-callout-notice p-3 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                        <p className="fst-italic mb-0 fw-medium" style={{ color: '#57534e', fontSize: '0.92rem' }}>
                          Prerequisite: Omni Developmental Edit. Please speak with your editorial consultant for more information.
                        </p>
                      </div>

                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          Following the advice of a professional editor takes time and careful consideration. Developmental Editing, in particular, often requires the author to rewrite or reorganize the manuscript to enhance material. Hiring a book doctor may be the best choice for authors who don't have the time or ability to make the big-picture changes recommended by a developmental editor.
                        </p>
                        <p className="mb-3">
                          A book doctor makes the changes recommended by the developmental editor and approved by the author. A price quote for the book doctor will be provided with the completed developmental edit.
                        </p>
                        <p className="mb-3 fw-medium" style={{ color: '#2b2219' }}>
                          After completion of Book Doctoring, Content Editing and a Quality Review will be provided at no extra cost.
                        </p>

                        <div className="p-3 mb-3 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                          <span className="fw-bold" style={{ color: '#ad7d42' }}>Duration: </span>
                          <span style={{ color: '#57534e' }}>Estimate based on work required and detailed through the Developmental Edit.</span>
                        </div>
                      </div>
                    </div>
                  ) : selectedService?.slug?.startsWith('quality-review-') ? (
                    /* Quality Review Series (Matching Screenshots 3, 4, 5 - NO PRICE, NO CHECKLIST) */
                    <div className="quality-review-detail-content">
                      <div className="editorial-callout-notice p-3 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                        <p className="fst-italic mb-0 fw-medium" style={{ color: '#57534e', fontSize: '0.92rem' }}>
                          Prerequisite: Omni {selectedService.title.replace('Quality Review - ', '')}. Please speak with your editorial consultant for more information.
                        </p>
                      </div>

                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          Our {selectedService.title} service provides a final check to make sure your revised manuscript is sound before it goes into production—for a fraction of the price of your original edit.
                        </p>
                        <p className="mb-3">
                          After you review and revise your edited manuscript, you may want an editor to check your work to ensure that you've done it correctly and haven't created new errors in the process.
                        </p>

                        {selectedService.slug === 'quality-review-copyediting' && (
                          <blockquote 
                            className="editorial-testimonial-quote"
                            style={{
                              margin: '22px 0',
                              padding: '16px 22px',
                              borderLeft: '4px solid #ad7d42',
                              background: 'rgba(173, 125, 66, 0.05)',
                              borderRadius: '0 8px 8px 0',
                              fontStyle: 'italic',
                              color: '#333'
                            }}
                          >
                            <p className="mb-2" style={{ fontSize: '0.95rem', lineHeight: '1.6' }}>
                              "I am really impressed by [the editor's] incredible attention to detail, and I am just so grateful there are people like her who can subject my writing to such close critical analysis."
                            </p>
                            <footer style={{ fontStyle: 'normal', fontWeight: '600', color: '#78716c', fontSize: '0.88rem' }}>
                              — Michelle Dixon, author of <em>The Disappearance of Lilya Bekirova</em>
                            </footer>
                          </blockquote>
                        )}

                        {(selectedService.slug === 'quality-review-content-editing' || selectedService.slug === 'quality-review-content-editing-plus') ? (
                          <p className="mb-3">
                            Content Editing, by its very nature, involves extensive revisions to your manuscript — for example, restructuring sentences and adding material. With the Quality Review, an editor will not only review the work you've done on the manuscript in response to the editing, but ensure that you've adequately addressed all of the queries and comments.
                          </p>
                        ) : (
                          <p className="mb-3">
                            With the Quality Review, an editor will not only review the work you've done on the manuscript in response to the editing, but ensure that you've adequately addressed all of the queries and comments.
                          </p>
                        )}

                        <p className="fst-italic mb-0 text-muted" style={{ fontSize: '0.9rem' }}>
                          *There is a 5,000-word minimum charge for all editing services.
                        </p>
                      </div>
                    </div>
                  ) : selectedService?.slug?.startsWith('editorial-assistant-') ? (
                    /* Editorial Assistant Series (Matching Screenshots - NO PRICE, NO CHECKLIST) */
                    <div className="editorial-assistant-detail-content">
                      <div className="editorial-callout-notice p-3 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                        <p className="fst-italic mb-0 fw-medium" style={{ color: '#57534e', fontSize: '0.92rem' }}>
                          Prerequisite: Omni {selectedService.title.replace('Editorial Assistant - ', '')}. Please speak with your editorial consultant for more information.
                        </p>
                      </div>

                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          Your editorial assistant will review each change and suggestion given during the {selectedService.title.replace('Editorial Assistant - ', '')} service and take action on each one.
                        </p>
                        <p className="mb-3">
                          Going through an edited manuscript can sometimes be a time-consuming process for even the most experienced author, as it requires decisions be made regarding each of the revisions, comments, and recommendations. For our busiest authors and for authors who may be unsure of their own ability to make the needed changes, Omni offers the Editorial Assistant service, in which a professional editor handles the editing work for the author.
                        </p>

                        {selectedService.slug === 'editorial-assistant-copyediting' && (
                          <>
                            <p className="mb-3">
                              Your editorial assistant will review each change and suggestion given during the copyediting and take action on each one, accepting changes, rewriting sentences, resolving queries and handling other revisions suggested by the original copyeditor. This service is ideal for authors who approve of most of the editor's work on their manuscript and do not wish to work with tracked changes in their manuscript.
                            </p>
                            <p className="mb-3 fw-medium" style={{ color: '#2b2219' }}>
                              Estimate of cost is provided with your completed Copyedit.
                            </p>
                          </>
                        )}

                        {selectedService.slug === 'editorial-assistant-line-edit' && (
                          <>
                            <p className="mb-3">
                              Your editorial assistant will review each change and suggestion given during the line edit and take action on each one, accepting changes, rewriting sentences, resolving queries and handling other revisions as suggested by the line editor. This service is ideal for authors who approve of most of the editor's work on their manuscript and do not wish to work with tracked changes in their manuscript.
                            </p>
                            <div className="p-3 mb-3 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                              <p className="mb-1"><strong style={{ color: '#ad7d42' }}>Duration: </strong> 2-3 weeks</p>
                              <p className="mb-0"><strong style={{ color: '#ad7d42' }}>Cost: </strong> Estimate provided with your completed Line Edit.</p>
                            </div>
                          </>
                        )}

                        {selectedService.slug === 'editorial-assistant-content-edit' && (
                          <>
                            <p className="mb-3">
                              Your editorial assistant will review each change and suggestion given during the Content Edit and take action on each one, accepting changes, rewriting sentences, resolving queries and handling other revisions as suggested by the content editor. This service is ideal for authors who approve of most of the editor's work on their manuscript and do not wish to work with tracked changes in their manuscript.
                            </p>
                            <div className="p-3 mb-3 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                              <p className="mb-1"><strong style={{ color: '#ad7d42' }}>Duration: </strong> 2-3 weeks</p>
                              <p className="mb-0"><strong style={{ color: '#ad7d42' }}>Cost: </strong> Estimate provided with your completed content edit.</p>
                            </div>
                          </>
                        )}

                        {selectedService.slug === 'editorial-assistant-content-edit-plus' && (
                          <>
                            <p className="mb-3">
                              Your editorial assistant will review each change and suggestion given during the Content Editor Plus service and take action on each one, accepting changes, rewriting sentences, resolving queries ,and handling other revisions as suggested by the Content Editor Plus service. This service is ideal for authors who approve of most of the editor's work on their manuscript and do not wish to work with tracked changes in their manuscript.
                            </p>
                            <div className="p-3 mb-3 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                              <p className="mb-1"><strong style={{ color: '#ad7d42' }}>Duration: </strong> 2-3 weeks</p>
                              <p className="mb-0"><strong style={{ color: '#ad7d42' }}>Cost: </strong> Estimate provided with your completed content edit plus.</p>
                            </div>
                          </>
                        )}

                        <p className="fst-italic mb-0 text-muted" style={{ fontSize: '0.9rem' }}>
                          Please note: There may be some questions or comments from the editor that you, the author, will need to address before moving forward with this service.
                        </p>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'small-book-review-with-editing-under-5-000-words' ? (
                    /* Small Book Review with Editing (Matching Screenshot 1 - NO PRICE, NO CHECKLIST) */
                    <div className="small-book-review-detail-content">
                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          We know you’ve put a lot of energy and dedication into your manuscript, but even experienced authors overlook their own mistakes sometimes. Since the editorial quality of your book will have an impact on your readers and its ultimate success, it’s important to have another set of professional eyes look over your book before it’s published.
                        </p>
                        <p className="mb-3">
                          The Omni editors carefully review your full manuscript (under 5,000 words) and provide you with the edits best suited to your book. This all-inclusive service is an excellent option for children’s books. We won’t just point out what’s not working; we can help you decide exactly how to fix it.
                        </p>

                        <p className="fw-semibold mb-2" style={{ color: '#2b2219' }}>
                          Here’s what to expect:
                        </p>
                        <ul className="mb-4 ps-3 d-flex flex-column gap-2" style={{ color: '#44403c', fontSize: '0.95rem' }}>
                          <li>
                            <strong>Line Editing: </strong>We perfect your spelling, punctuation, capitalization, grammar, and syntax. And we’ll provide recommendations for word choice and improving overall readability.
                          </li>
                          <li>
                            <strong>Content Editing: </strong>We confirm the consistency of information and ideas throughout the whole book, and we also focus on more extensive sentence restructuring.
                          </li>
                          <li>
                            Our editors use Microsoft Word® to track their changes, so you always <strong>retain control over final edits.</strong>
                          </li>
                          <li>
                            Our editors typically turn your manuscript around in <strong>three to four weeks.</strong> After that time, your editor will reach out with their edits and suggestions for improvement.
                          </li>
                        </ul>

                        <div className="editorial-callout-notice p-3 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                          <p className="fst-italic mb-0" style={{ color: '#57534e', fontSize: '0.92rem' }}>
                            <strong>Please Note: </strong>This service does not include our advanced editorial services, such as Developmental Editing. Rather, it is a combination of our Line Editing and Content Editing services with a report from the editor.
                          </p>
                        </div>

                        <h5 className="fw-bold mb-3" style={{ color: '#2b2219', fontSize: '1.1rem' }}>
                          More About | Small Book Review with Editing (Under 5,000 Words)
                        </h5>

                        <p className="mb-3">
                          Almost nothing compares to publishing a book that is polished and clear. Choose to make your book the best it can be with our combined review and editing service. The typical timeline for this service is <strong>three to four weeks</strong>, depending on the work queue and the complexity of your manuscript. Call <strong>1-800-AUTHORS (288-4677)</strong> for more information, or to purchase this service.
                        </p>

                        <div className="p-3 mb-3 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                          <p className="fst-italic fw-medium mb-2" style={{ color: '#78716c', fontSize: '0.92rem' }}>
                            *Please note:
                          </p>
                          <ul className="mb-0 ps-3 d-flex flex-column gap-2 fst-italic" style={{ color: '#57534e', fontSize: '0.9rem' }}>
                            <li>
                              Omni accepts a very low margin of error in each completed edit. Our professional in-house editorial staff reviews each editorial service for quality assurance – an edit won’t be returned to an author until fewer than three percent of the original errors remain.
                            </li>
                            <li>
                              Upon reviewing your edited manuscript, if you believe that an unsatisfactory number of errors have been addressed, please create a list of the errors and the page numbers on which they appear and email it to <a href="mailto:editorial@omnivirtualsolution.com" style={{ color: '#ad7d42', textDecoration: 'underline' }}>editorial@omnivirtualsolution.com</a>. We will review the list with you and address your concern.
                            </li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'copyediting' ? (
                    /* Copyediting (Matching Screenshot 2 - NO PRICE, NO CHECKLIST) */
                    <div className="copyediting-detail-content">
                      <div className="editorial-callout-notice p-3 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                        <p className="fst-italic mb-0 fw-medium" style={{ color: '#57534e', fontSize: '0.92rem' }}>
                          Prescribed by Editorial Evaluation only. Please do not order without first speaking with your editorial consultant.
                        </p>
                      </div>

                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          An experienced copyeditor will check your manuscript carefully, correcting errors in spelling, grammar, and punctuation. In addition, the copyeditor will verify cross-references and impose an industry-standard style.
                        </p>

                        <blockquote 
                          className="editorial-testimonial-quote"
                          style={{
                            margin: '22px 0',
                            padding: '16px 22px',
                            borderLeft: '4px solid #ad7d42',
                            background: 'rgba(173, 125, 66, 0.05)',
                            borderRadius: '0 8px 8px 0',
                            fontStyle: 'italic',
                            color: '#333'
                          }}
                        >
                          <p className="mb-2" style={{ fontSize: '0.95rem', lineHeight: '1.6' }}>
                            "I took my editorial consultant's comment to heart that regardless of the quality of the book's content and message, grammatical errors will cause the public to lose respect for it. As a structural engineer, I can appreciate that since I regularly submit documents and have them submitted to me. The presentation is as important as the content. The editor's contribution has greatly enhanced my manuscript and was well worth the cost. I would recommend the use of an editor to any serious author."
                          </p>
                          <footer style={{ fontStyle: 'normal', fontWeight: '600', color: '#78716c', fontSize: '0.88rem' }}>
                            - Bill Stahl, author of <em>The Bible's Story of Salvation</em>
                          </footer>
                        </blockquote>

                        <p className="fst-italic mb-0 text-muted" style={{ fontSize: '0.9rem' }}>
                          *There is a 5,000-word minimum charge for all editing services.
                        </p>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'line-editing' ? (
                    /* Line Editing (Matching Screenshot 3 - NO PRICE, NO CHECKLIST) */
                    <div className="line-editing-detail-content">
                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          Some manuscripts simply require more work than others. When heavy copyediting is required, an editor will check the manuscript for more pervasive errors in spelling, grammar, and punctuation. The editor will also address syntax and word choice and make light recommendations for improving the overall readability of the work.
                        </p>

                        <blockquote 
                          className="editorial-testimonial-quote"
                          style={{
                            margin: '22px 0',
                            padding: '16px 22px',
                            borderLeft: '4px solid #ad7d42',
                            background: 'rgba(173, 125, 66, 0.05)',
                            borderRadius: '0 8px 8px 0',
                            fontStyle: 'italic',
                            color: '#333'
                          }}
                        >
                          <p className="mb-2" style={{ fontSize: '0.95rem', lineHeight: '1.6' }}>
                            "I would like to thank the editor for a heroic job. My mother was apprehensive ... her book is intended to convey the thoughts of a child. The quirky language reflects this, and she was afraid the child's \"voice\" might be lost in the editing. I read the first few chapters of the edited manuscript to her. She was delighted! It is clear that this is a very conscientious editor and one to be trusted."
                          </p>
                          <footer style={{ fontStyle: 'normal', fontWeight: '600', color: '#78716c', fontSize: '0.88rem' }}>
                            Virginia Merrill, author of <em>Believe in Guardian Angels</em>
                          </footer>
                        </blockquote>

                        <p className="fst-italic mb-2" style={{ color: '#57534e', fontSize: '0.92rem' }}>
                          * Note: Line Editing is also available in Spanish. For more information, speak with your publishing consultant.
                        </p>

                        <p className="fst-italic mb-3 text-muted" style={{ fontSize: '0.9rem' }}>
                          *There is a 5,000-word minimum charge for all editing services.
                        </p>

                        <p className="mb-4" style={{ fontSize: '0.95rem' }}>
                          Leave it to our editorial specialists to take your book to the next level. The typical timeline for this service is <strong>six to eight weeks</strong>, depending on our queue and the complexity of your work.
                        </p>

                        <p className="fst-italic text-muted mb-0" style={{ fontSize: '0.82rem', lineHeight: '1.6' }}>
                          Disclaimer: Prices listed do not include applicable taxes (such as sales, use, excise, value-added, goods and services, or other tax), which will be added to the total at the time of purchase. Prices listed do include the copies of the book; the cost of shipping and handling will be calculated and charged after your book is made available for sale.
                        </p>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'content-editing' ? (
                    /* Content Editing (Matching authentic catalog - NO PRICE, NO CHECKLIST) */
                    <div className="content-editing-detail-content">
                      <div className="editorial-callout-notice p-3 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                        <p className="fst-italic mb-0 fw-medium" style={{ color: '#57534e', fontSize: '0.92rem' }}>
                          Prescribed by Editorial Evaluation only. Please do not order without first speaking with your editorial consultant.
                        </p>
                      </div>

                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          In addition to performing the functions of a line edit, a content editor will work to ensure the general accuracy and consistency of content and focus on more extensive restructuring of sentences.
                        </p>

                        <div className="p-3 mb-3 rounded-3" style={{ background: '#fcfbf9', border: '1px solid #ebd9c4' }}>
                          <ul className="mb-0 ps-3 d-flex flex-column gap-2" style={{ color: '#44403c', fontSize: '0.94rem' }}>
                            <li>
                              <strong>For fiction titles, </strong>the editor will focus on maintaining consistency of details in the plot, characters and setting.
                            </li>
                            <li>
                              <strong>For nonfiction titles, </strong>the editor will monitor consistency of information and ideas.
                            </li>
                          </ul>
                        </div>

                        <p className="fst-italic mb-3 text-muted" style={{ fontSize: '0.9rem' }}>
                          *There is a 5,000-word minimum charge for all editing services.
                        </p>

                        <p className="mb-0" style={{ fontSize: '0.95rem' }}>
                          Leave it to our editorial specialists to take your book to the next level. The typical timeline for this service is <strong>six to eight weeks</strong>, depending on our queue and the complexity of your work.
                        </p>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'content-editing-plus' ? (
                    /* Content Editing Plus (Matching Screenshot 4 - NO PRICE, NO CHECKLIST) */
                    <div className="content-editing-plus-detail-content">
                      <div className="editorial-callout-notice p-3 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                        <p className="fst-italic mb-0 fw-medium" style={{ color: '#57534e', fontSize: '0.92rem' }}>
                          Prescribed by Editorial Evaluation only. Please do not order without first speaking with your editorial consultant.
                        </p>
                      </div>

                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          This service is ideal for manuscripts that need more work on sentence structure and grammar than basic Content Editing can provide. Content Editing Plus is especially suitable for translations or manuscripts written by authors whose second language is English.
                        </p>

                        <blockquote 
                          className="editorial-testimonial-quote"
                          style={{
                            margin: '22px 0',
                            padding: '16px 22px',
                            borderLeft: '4px solid #ad7d42',
                            background: 'rgba(173, 125, 66, 0.05)',
                            borderRadius: '0 8px 8px 0',
                            fontStyle: 'italic',
                            color: '#333'
                          }}
                        >
                          <p className="mb-2" style={{ fontSize: '0.95rem', lineHeight: '1.6' }}>
                            "It is difficult to imagine the best editor at HarperCollins doing a better job than my Omni editor. Editing services through Omni are equal to the finest brick and mortar publishing houses and far more timely."
                          </p>
                          <footer style={{ fontStyle: 'normal', fontWeight: '600', color: '#78716c', fontSize: '0.88rem' }}>
                            -Michael R Zomber, author of <em>Shogun Iemitsu</em>
                          </footer>
                        </blockquote>

                        <p className="fst-italic mb-3 text-muted" style={{ fontSize: '0.9rem' }}>
                          *There is a 5,000-word minimum charge for all editing services.
                        </p>

                        <p className="mb-0" style={{ fontSize: '0.95rem' }}>
                          Leave it to our editorial specialists to take your book to the next level. The typical timeline for this service is <strong>six to eight weeks</strong>, depending on our queue and the complexity of your work.
                        </p>
                      </div>
                    </div>
                  ) : (selectedService?.slug === 'cover-copy-polish' && !isCurrentSubcategoryOverview) ? (
                    /* Cover Copy Polish Service (Matching Screenshot 5 - NO PRICE, NO CHECKLIST) */
                    <div className="cover-copy-polish-detail-content">
                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          With Omni Cover Copy Polishing, the ideas you provide will allow us to create intriguing copy that can help you clinch the sale. Our professional copywriting staff will mold the text that you provide into marketable material by polishing the hardcover flaps, back cover copy, author bio and keynote, in addition to any other cover material you have submitted.
                        </p>

                        <p className="mb-0">
                          Create intriguing cover text and catch the attention of book buyers with this professional copywriting service. The typical timeline for this service is <strong>one week</strong>, depending on our queue and the complexity of your work.
                        </p>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'professional-indexing' ? (
                    /* Professional Indexing (Matching Screenshot 1 - NO PRICE, NO CHECKLIST) */
                    <div className="professional-indexing-detail-content">
                      <div className="editorial-callout-notice p-3 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                        <p className="fst-italic mb-0 fw-medium" style={{ color: '#57534e', fontSize: '0.92rem' }}>
                          Please speak with your editorial consultant for more information.
                        </p>
                      </div>

                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          Our professional indexers will provide you with an industry-standard, two-level topical index that is personalized to provide maximum usability for the book's target audience.
                        </p>
                        <p className="mb-3">
                          The professional indexer analyzes your entire book, anticipating line items your reader will most likely want to find and listing them in an intuitive, accessible manner.
                        </p>
                        <p className="mb-2">
                          Before handcrafting your one-of-a-kind index, our professional indexer considers the following four elements that make your book unique:
                        </p>

                        <ul className="mb-4 ps-3 d-flex flex-column gap-1" style={{ color: '#44403c', fontSize: '0.95rem' }}>
                          <li>Focus</li>
                          <li>Purpose</li>
                          <li>Audience</li>
                          <li>Organization</li>
                        </ul>

                        <p className="mb-3">
                          The resulting high-quality index is the standard found throughout the publishing industry.
                        </p>

                        <p className="fst-italic mb-3 text-muted" style={{ fontSize: '0.9rem' }}>
                          *There is a 5,000-word minimum charge for all editing services.
                        </p>

                        <p className="fst-italic text-muted mb-0" style={{ fontSize: '0.9rem', lineHeight: '1.65' }}>
                          Please note: We craft indexes from the final, formatted, author-approved pages. Changes made after indexing may alter the pagination and detract from the index's usability or may lead to additional charges to correct the index.
                        </p>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'computer-generated-keyword-indexing-up-to-500-entries' ? (
                    /* Computer Generated Keyword Indexing - Up to 500 Entries (Matching Screenshot 2 - NO PRICE, NO CHECKLIST) */
                    <div className="keyword-indexing-500-detail-content">
                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          A computer-generated keyword index lists a page number for a key term each time it occurs in the book. You simply provide Omni with a list of words that you want to appear in the index. Omni will create an index by tagging the selected words during the production process. The resulting alphabetical list of keywords gives the page numbers for each occurrence of the word.
                        </p>
                        <p className="mb-3">
                          The success of this type of index depends entirely on the key words you chose. The choice of words needs to be carefully thought through. Do not use simple words or words that repeat constantly throughout the text. For example, if you are writing a cookbook, do not index the word egg. Every time the word "egg" is mentioned, the computer will index that page. We presume that egg would show up on many recipe pages. If words are not chosen carefully, the resulting index can be overly long and unusable.
                        </p>

                        <p className="fst-italic mb-3" style={{ color: '#57534e', fontSize: '0.92rem' }}>
                          Please note: a concordance-type index has no logical organization other than alphabetization, and only exact word matches can be indexed using the approach.
                        </p>

                        <p className="mb-3" style={{ fontSize: '0.93rem', lineHeight: '1.68' }}>
                          *We highly recommend our Professional Index service if you require an industry-standard index. A computer cannot do what a professional, human indexer can—evaluate the significance of each occurrence of a word and whether it's really important to list, develop appropriate cross references and sub-entries, phrase entries in the most useful way, and more.
                        </p>

                        <div className="p-3 mb-0 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                          <span className="fw-bold" style={{ color: '#ad7d42' }}>Timing: </span>
                          <span style={{ color: '#57534e' }}>Adds two weeks to the design process</span>
                        </div>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'computer-generated-keyword-indexing-up-to-700-entries' ? (
                    /* Computer Generated Keyword Indexing - Up to 700 Entries (Matching Screenshot 3 - NO PRICE, NO CHECKLIST) */
                    <div className="keyword-indexing-700-detail-content">
                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          A computer-generated keyword index lists a page number for a key term each time it occurs in the book. You simply provide Omni with a list of words that you want to appear in the index. Omni will create an index by tagging the selected words during the production process. The resulting alphabetical list of keywords gives the page numbers for each occurrence of the word.
                        </p>
                        <p className="mb-3">
                          The success of this type of index depends entirely on the key words you chose. The choice of words needs to be carefully thought through. Do not use simple words or words that repeat constantly throughout the text. For example, if you are writing a cookbook, do not index the word egg. Every time the word "egg" is mentioned, the computer will index that page. We presume that egg would show up on many recipe pages. If words are not chosen carefully, the resulting index can be overly long and unusable.
                        </p>

                        <p className="fst-italic mb-3" style={{ color: '#57534e', fontSize: '0.92rem' }}>
                          Please note: a concordance-type index has no logical organization other than alphabetization, and only exact word matches can be indexed using the approach.
                        </p>

                        <p className="mb-3" style={{ fontSize: '0.93rem', lineHeight: '1.68' }}>
                          *We highly recommend our Professional Index service if you require an industry-standard index. A computer cannot do what a professional, human indexer can—evaluate the significance of each occurrence of a word and whether it's really important to list, develop appropriate cross references and sub-entries, phrase entries in the most useful way, and more. Librarians and reviewers consider a computer-generated word list not simply less useful but a liability to a book.
                        </p>

                        <div className="p-3 mb-0 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                          <span className="fw-bold" style={{ color: '#ad7d42' }}>Timing: </span>
                          <span style={{ color: '#57534e' }}>Adds two weeks to the design process</span>
                        </div>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'computer-generated-keyword-indexing-up-to-1-000-entries' ? (
                    /* Computer Generated Keyword Indexing - Up to 1,000 Entries (Matching Screenshot 4 - NO PRICE, NO CHECKLIST) */
                    <div className="keyword-indexing-1000-detail-content">
                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          A computer-generated keyword index lists a page number for a key term each time it occurs in the book. You simply provide Omni with a list of words that you want to appear in the index. Omni will create an index by tagging the selected words during the production process. The resulting alphabetical list of keywords gives the page numbers for each occurrence of the word.
                        </p>
                        <p className="mb-3">
                          The success of this type of index depends entirely on the key words you chose. The choice of words needs to be carefully thought through. Do not use simple words or words that repeat constantly throughout the text. For example, if you are writing a cookbook, do not index the word egg. Every time the word "egg" is mentioned, the computer will index that page. We presume that egg would show up on many recipe pages. If words are not chosen carefully, the resulting index can be overly long and unusable.
                        </p>

                        <p className="fst-italic mb-3" style={{ color: '#57534e', fontSize: '0.92rem' }}>
                          Please note: a concordance-type index has no logical organization other than alphabetization, and only exact word matches can be indexed using the approach.
                        </p>

                        <p className="mb-3" style={{ fontSize: '0.93rem', lineHeight: '1.68' }}>
                          *We highly recommend our Professional Index service if you require an industry-standard index. A computer cannot do what a professional, human indexer can—evaluate the significance of each occurrence of a word and whether it's really important to list, develop appropriate cross references and sub-entries, phrase entries in the most useful way, and more. Librarians and reviewers consider a computer-generated word list not simply less useful but a liability to a book.
                        </p>

                        <div className="p-3 mb-0 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                          <span className="fw-bold" style={{ color: '#ad7d42' }}>Timing: </span>
                          <span style={{ color: '#57534e' }}>Adds two weeks to the design process</span>
                        </div>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'computer-generated-keyword-indexing-custom-quote' ? (
                    /* Computer Generated Keyword Indexing - Custom Quote (Matching Screenshot 5 - NO PRICE, NO CHECKLIST) */
                    <div className="keyword-indexing-custom-detail-content">
                      <div className="editorial-callout-notice p-3 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                        <p className="fst-italic mb-0 fw-medium" style={{ color: '#57534e', fontSize: '0.92rem' }}>
                          An index of over 1,000 will require a custom quote. Contact your PSA for more information.
                        </p>
                      </div>

                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          A computer-generated keyword index lists a page number for a key term each time it occurs in the book. You simply provide Omni with a list of words that you want to appear in the index. Omni will create an index by tagging the selected words during the production process. The resulting alphabetical list of keywords gives the page numbers for each occurrence of the word.
                        </p>
                        <p className="mb-3">
                          The success of this type of index depends entirely on the key words you chose. The choice of words needs to be carefully thought through. Do not use simple words or words that repeat constantly throughout the text. For example, if you are writing a cookbook, do not index the word egg. Every time the word "egg" is mentioned, the computer will index that page. We presume that egg would show up on many recipe pages. If words are not chosen carefully, the resulting index can be overly long and unusable.
                        </p>

                        <p className="fst-italic mb-3" style={{ color: '#57534e', fontSize: '0.92rem' }}>
                          Please note: a concordance-type index has no logical organization other than alphabetization, and only exact word matches can be indexed using the approach.
                        </p>

                        <p className="mb-3" style={{ fontSize: '0.93rem', lineHeight: '1.68' }}>
                          *We highly recommend our Professional Index service if you require an industry-standard index. A computer cannot do what a professional, human indexer can—evaluate the significance of each occurrence of a word and whether it's really important to list, develop appropriate cross references and sub-entries, phrase entries in the most useful way, and more. Librarians and reviewers consider a computer-generated word list not simply less useful but a liability to a book.
                        </p>

                        <div className="p-3 mb-0 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                          <span className="fw-bold" style={{ color: '#ad7d42' }}>Timing: </span>
                          <span style={{ color: '#57534e' }}>Adds two weeks to the design process</span>
                        </div>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'proofreading' && !selectedService?.isSubcategoryOverview ? (
                    /* Proofreading (Matching Screenshot 1 - NO PRICE, NO CHECKLIST) */
                    <div className="proofreading-detail-content">
                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="fst-italic mb-3" style={{ color: '#57534e', fontSize: '0.94rem' }}>
                          Prerequisite: An Omni core editorial service, as recommended. Please speak with your editorial consultant for more information.
                        </p>

                        <p className="mb-4">
                          As any publishing professional knows, the process of converting a manuscript into a published book is not 100 percent foolproof. Even manuscripts that have undergone a Quality Review can have the occasional remaining error, as even the best copyeditor in the business or the most careful author can inadvertently overlook or create a few mistakes. In fact, for this reason, traditional publishers usually proofread a manuscript twice. This final polish is highly recommended.
                        </p>

                        <p className="fst-italic mb-2" style={{ color: '#44403c', fontSize: '0.95rem' }}>
                          "I must comment on the meticulous job done by all the editors, including the last. She found things that we all had missed ... It's downright scary that I teach ENGLISH!"
                        </p>

                        <p className="mb-0" style={{ color: '#57534e', fontSize: '0.92rem' }}>
                          -Robin M. Berard, author of King Tut and the Girl Who Loved Him
                        </p>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'do-it-yourself-audiobook' ? (
                    /* Do-It-Yourself Audiobook (Matching Screenshot 2 - NO PRICE, NO CHECKLIST) */
                    <div className="diy-audiobook-detail-content">
                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          Expand your audience and reach with the power of audiobooks, an increasingly popular and preferred format.
                        </p>
                        <p className="mb-3">
                          Now you can bring your book to life with your own voice.
                        </p>
                        <p className="mb-3">
                          Effortlessly transform your written words into an immersive audiobook using our partner DIY Audiobook platform,{' '}
                          <a 
                            href="https://myaudiobookrecorder.com/" 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            style={{ color: '#ad7d42', fontWeight: '600', textDecoration: 'underline' }}
                          >
                            Myaudiobookrecorder.com.
                          </a>
                        </p>
                        <p className="mb-4">
                          This service empowers you to record and produce your audiobook, without needing any audio editing experience.
                        </p>

                        <h5 className="fw-bold mb-3" style={{ color: '#2b2219', fontSize: '1.05rem' }}>
                          Key Features:
                        </h5>

                        <ul className="mb-4 ps-3 d-flex flex-column gap-2" style={{ color: '#44403c', fontSize: '0.95rem' }}>
                          <li>Easy-to-use recording and editing tools</li>
                          <li>Six months of access to the virtual recording studio</li>
                          <li>Availability of your audiobook through Overdrive, Audible.com, Amazon.com, and iTunes</li>
                          <li>ISBN registration</li>
                        </ul>

                        <p className="fst-italic mb-0" style={{ color: '#57534e', fontSize: '0.91rem' }}>
                          *Audiobook distribution partners require that the e-book version is in distribution and available for sale.
                        </p>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'professional-audiobook-package' ? (
                    /* Professional Audiobook Package (Matching authentic page - NO PRICE, NO CHECKLIST) */
                    <div className="professional-audiobook-detail-content">
                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          Readers have spoken—and we have listened. These days, they prefer books in a format that will easily fit their busy lifestyle. This is why Omni offers you a solution that allows you to tap into your readers’ multitasking ways: audiobooks. Now they can “read” your book while they commute, work out or even as they do their chores.
                        </p>
                        <p className="mb-4">
                          But exactly how popular are audiobooks among readers? The growing demand is evidently seen the rise of daily downloads of audiobooks year after year. Tap into that market by having your book available in audio format with our help.
                        </p>

                        <h5 className="fw-bold mb-3" style={{ color: '#2b2219', fontSize: '1.05rem' }}>
                          The Professional Audiobook service includes:
                        </h5>

                        <ul className="mb-4 ps-3 d-flex flex-column gap-2" style={{ color: '#44403c', fontSize: '0.95rem' }}>
                          <li>Audiobook conversion of up to 5,000 words</li>
                          <li>Narration by a professional voice-over actor</li>
                          <li>Your own digital copy of the audiobook</li>
                          <li>Intro, beginning and end background music for your audiobook</li>
                          <li>Availability of your audiobook through Overdrive, Audible.com, Amazon.com and iTunes</li>
                          <li>ISBN Registration</li>
                        </ul>

                        {/* Audio Samples Section */}
                        <div className="audio-samples-card p-4 mb-4 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                          <div className="mb-4">
                            <h5 className="fw-bold mb-2 d-flex align-items-center gap-2" style={{ color: '#2b2219', fontSize: '1.05rem' }}>
                              <i className="bi bi-volume-up-fill" style={{ color: '#ad7d42' }}></i>
                              Audiobook Sample: Male
                            </h5>
                            <audio controls className="w-100" style={{ maxWidth: '480px', height: '42px' }}>
                              <source src="/assets/audio/Jewel in the Wake_Male.mp3" type="audio/mpeg" />
                              Your browser does not support the audio element.
                            </audio>
                          </div>

                          <div className="mb-2">
                            <h5 className="fw-bold mb-2 d-flex align-items-center gap-2" style={{ color: '#2b2219', fontSize: '1.05rem' }}>
                              <i className="bi bi-volume-up-fill" style={{ color: '#ad7d42' }}></i>
                              Audiobook Sample: Female
                            </h5>
                            <audio controls className="w-100" style={{ maxWidth: '480px', height: '42px' }}>
                              <source src="/assets/audio/Mask Weavers for Hire_Female.mp3" type="audio/mpeg" />
                              Your browser does not support the audio element.
                            </audio>
                          </div>
                        </div>

                        <p className="fst-italic mb-3" style={{ color: '#57534e', fontSize: '0.92rem', lineHeight: '1.68' }}>
                          The default retail price set will be $9.99 minimum. Please take note that other distributors and resellers have the sole discretion to set the price of the audiobooks they sell.
                        </p>

                        <div className="p-3 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42', padding: '16px 20px' }}>
                          <p className="fw-semibold fst-italic mb-2" style={{ color: '#ad7d42', fontSize: '0.96rem' }}>
                            Is your book more than 5,000 words?
                          </p>
                          <p className="fw-semibold fst-italic mb-2" style={{ color: '#ad7d42', fontSize: '0.96rem' }}>
                            Need your audiobook converted right away?
                          </p>
                          <p className="mb-2" style={{ color: '#44403c', fontSize: '0.93rem', lineHeight: '1.65' }}>
                            We can send you your audiobook in 30 days with our Rapid Release Audiobook service for an additional fee of $500. Please take note of the following conditions:
                          </p>
                          <ul className="mb-0 ps-3 d-flex flex-column gap-1" style={{ color: '#57534e', fontSize: '0.9rem' }}>
                            <li>Your manuscript should only have a maximum of 30,000 words.</li>
                            <li>You need to approve the audiobook sample we will send you before we can get started on your audiobook. Your 30-day countdown will start from the day we receive your demo approval.</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'softcover-publishing' ? (
                    /* Softcover Publishing (NO PRICE, NO CHECKLIST) */
                    <div className="softcover-publishing-detail-content">
                      <div className="editorial-callout-notice p-3 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                        <p className="fst-italic mb-0 fw-medium" style={{ color: '#57534e', fontSize: '0.92rem' }}>
                          Softcover Format is already included in select publishing packages and cannot be purchased separately. This page is designed to give you more information about the service and why it’s important for your book.
                        </p>
                      </div>

                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          Omni softcover books are formatted as trade paperbacks. Trade paperback is an industry term that describes a book that is of better production quality. These books are produced in a larger size and offered at a higher price than a mass-market paperback format. Mass-market paperbacks are generally cheaply made and printed on newsprint or other low-quality paper, which will discolor and disintegrate over time. Trade paperbacks, on the other hand, meet a higher standard and are printed on high-quality paper.
                        </p>
                        <p className="mb-4">
                          Omni offers trade paperbacks in the following trim sizes:
                        </p>

                        <div className="row g-4 mb-4">
                          <div className="col-12 col-md-6">
                            <div className="p-3.5 rounded-3 h-100" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                              <h5 className="fw-bold mb-3 d-flex align-items-center gap-2" style={{ color: '#2b2219', fontSize: '1.05rem' }}>
                                <i className="bi bi-book-half" style={{ color: '#ad7d42' }}></i>
                                Black & White Trim sizes
                              </h5>
                              <ul className="mb-0 ps-3 d-flex flex-column gap-1.5" style={{ color: '#44403c', fontSize: '0.95rem' }}>
                                <li>5" x 8"</li>
                                <li>5.5" x 8.5"</li>
                                <li>6" x 9"</li>
                                <li>7.5" x 9.25"</li>
                                <li>8.25" x 11"</li>
                              </ul>
                            </div>
                          </div>
                          <div className="col-12 col-md-6">
                            <div className="p-3.5 rounded-3 h-100" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                              <h5 className="fw-bold mb-3 d-flex align-items-center gap-2" style={{ color: '#2b2219', fontSize: '1.05rem' }}>
                                <i className="bi bi-palette-fill" style={{ color: '#ad7d42' }}></i>
                                Color Trim Sizes
                              </h5>
                              <ul className="mb-0 ps-3 d-flex flex-column gap-1.5" style={{ color: '#44403c', fontSize: '0.95rem' }}>
                                <li>8.5" x 8.5"</li>
                                <li>8.5" x 11"</li>
                              </ul>
                            </div>
                          </div>
                        </div>

                        <p className="mb-3">
                          Omni softcover books are printed on high-quality, acid-free, book-grade opaque paper stock in black and white or grayscale halftones. Softcovers are printed on a bright white cover stock in full color.
                        </p>

                        <p className="fst-italic mb-0" style={{ color: '#57534e', fontSize: '0.91rem' }}>
                          *Books included in publishing packages will be shipped at standard shipping rates.
                        </p>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'hardcover-publishing' ? (
                    /* Hardcover Publishing (NO PRICE, NO CHECKLIST) */
                    <div className="hardcover-publishing-detail-content">
                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-4">
                          For durability and class, our black & white hardcover publishing is available in your choice of two formats: glossy casebound or dust jacket. The casebound option features a full-color glossy cover image adhered directly to the cover. The dust jacket option features a blue digital cloth cover with a digitally printed non-metallic gold-colored ink onto the spine and a full-color dust jacket with flaps. The full-color dust jacket allows us to print your author biography and a description of your book on the inside flaps, freeing up the back cover to print reviews and endorsements. Your hardcover edition will also be assigned a unique ISBN. In addition to the paperback copies included in your publishing package, you will receive one free author copy of your hardcover edition.
                        </p>

                        <div className="p-3.5 mb-4 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                          <h5 className="fw-bold mb-3 d-flex align-items-center gap-2" style={{ color: '#2b2219', fontSize: '1.05rem' }}>
                            <i className="bi bi-journal-bookmark-fill" style={{ color: '#ad7d42' }}></i>
                            Black & White Specifications
                          </h5>
                          <ul className="mb-0 ps-3 d-flex flex-column gap-2" style={{ color: '#44403c', fontSize: '0.95rem' }}>
                            <li>Page count range of 108-800</li>
                            <li>
                              You can choose between these two trim sizes:
                              <ul className="ps-3 mt-1 d-flex flex-column gap-1">
                                <li>5.5” × 8.5”</li>
                                <li>6” × 9”</li>
                              </ul>
                            </li>
                          </ul>
                        </div>

                        <div className="p-3.5 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                          <h6 className="fw-bold fst-italic mb-2" style={{ color: '#ad7d42', fontSize: '0.95rem' }}>
                            Please note:
                          </h6>
                          <ul className="fst-italic mb-0 ps-3 d-flex flex-column gap-1.5" style={{ color: '#57534e', fontSize: '0.91rem', lineHeight: '1.6' }}>
                            <li>When publishing a hardcover book, the softcover trim size must match that of the hardcover.</li>
                            <li>You can provide additional text for the interior flaps of the case-laminated cover, such as an excerpt of a book review or endorsement.</li>
                            <li>During book production, you will be given the opportunity to proof both the softcover and hardcover editions of your cover and suggest changes as appropriate.</li>
                            <li>Due to the higher production costs, the retail price for hardcover books may be more than softcover books.</li>
                            <li>The delivery time for hardcover book orders is about seven days longer than for softcover books.</li>
                            <li>Author pen name must not exceed 38 characters.</li>
                            <li>Prices are subject to change without prior notice. Some restrictions may apply.</li>
                          </ul>
                        </div>

                        <p className="mb-0 fw-medium" style={{ color: '#2b2219' }}>
                          Your book will be a keepsake for generations to come when you choose to preserve your book in long-lasting hardcover format.
                        </p>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'book-binding-sizes-and-types' ? (
                    /* Book Binding Sizes and Types (NO PRICE, NO CHECKLIST) */
                    <div className="book-binding-detail-content">
                      <div className="editorial-callout-notice p-3 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                        <p className="fst-italic mb-0 fw-medium" style={{ color: '#57534e', fontSize: '0.92rem' }}>
                          Please note: These binding and paper options cannot be purchased separately. This page is designed to give you more information about the service and why it’s important for your book.
                        </p>
                      </div>

                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          Omni publishes softcover books in perfect-bound format, a type of book binding that uses glue to hold the pages and cover together (typical of most professional books found in stores). We also publish hardcover books in two trim sizes: 5.5" x 8.5" or 6" x 9". We do not publish wire-o, plasticomb, three-ring, nor spiral-bound books.
                        </p>
                        <p className="mb-4">
                          The chart below lists the binding and paper options available to you at Omni:
                        </p>

                        <div className="mb-4">
                          <h5 className="fw-bold mb-3" style={{ color: '#2b2219', fontSize: '1.05rem' }}>
                            Softcover Sizes and Options
                          </h5>
                          <div className="table-responsive rounded-3 border" style={{ borderColor: '#ebd9c4' }}>
                            <table className="table table-hover mb-0" style={{ fontSize: '0.92rem' }}>
                              <thead style={{ background: '#f8f4ee', color: '#2b2219' }}>
                                <tr>
                                  <th className="py-2.5 px-3">Trim Size</th>
                                  <th className="py-2.5 px-3">Paper Specifications</th>
                                  <th className="py-2.5 px-3">Paper Color</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr><td className="py-2.5 px-3 fw-medium">5" × 8"</td><td className="py-2.5 px-3">50 lb, acid-free, lignin-free</td><td className="py-2.5 px-3">White or Crème</td></tr>
                                <tr><td className="py-2.5 px-3 fw-medium">5.5" × 8.5"</td><td className="py-2.5 px-3">50 lb, acid-free, lignin-free</td><td className="py-2.5 px-3">White or Crème</td></tr>
                                <tr><td className="py-2.5 px-3 fw-medium">6" × 9"</td><td className="py-2.5 px-3">50 lb, acid-free, lignin-free</td><td className="py-2.5 px-3">White or Crème</td></tr>
                                <tr><td className="py-2.5 px-3 fw-medium">7.5" × 9.25"</td><td className="py-2.5 px-3">50 lb, acid-free, lignin-free</td><td className="py-2.5 px-3">White</td></tr>
                                <tr><td className="py-2.5 px-3 fw-medium">8.25" × 11"</td><td className="py-2.5 px-3">50 lb, acid-free, lignin-free</td><td className="py-2.5 px-3">White</td></tr>
                              </tbody>
                            </table>
                          </div>
                        </div>

                        <div className="mb-4">
                          <h5 className="fw-bold mb-3" style={{ color: '#2b2219', fontSize: '1.05rem' }}>
                            Color Softcover Sizes and Options
                          </h5>
                          <div className="table-responsive rounded-3 border" style={{ borderColor: '#ebd9c4' }}>
                            <table className="table table-hover mb-0" style={{ fontSize: '0.92rem' }}>
                              <thead style={{ background: '#f8f4ee', color: '#2b2219' }}>
                                <tr>
                                  <th className="py-2.5 px-3">Trim Size</th>
                                  <th className="py-2.5 px-3">Paper Specifications</th>
                                  <th className="py-2.5 px-3">Paper Color</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr><td className="py-2.5 px-3 fw-medium">8.5" × 8.5"</td><td className="py-2.5 px-3">70 lb, acid-free</td><td className="py-2.5 px-3">White</td></tr>
                                <tr><td className="py-2.5 px-3 fw-medium">8.5" × 11"</td><td className="py-2.5 px-3">70 lb, acid-free</td><td className="py-2.5 px-3">White</td></tr>
                              </tbody>
                            </table>
                          </div>
                        </div>

                        <div className="mb-3">
                          <h5 className="fw-bold mb-3" style={{ color: '#2b2219', fontSize: '1.05rem' }}>
                            Hardcover Sizes and Options
                          </h5>
                          <div className="table-responsive rounded-3 border" style={{ borderColor: '#ebd9c4' }}>
                            <table className="table table-hover mb-0" style={{ fontSize: '0.92rem' }}>
                              <thead style={{ background: '#f8f4ee', color: '#2b2219' }}>
                                <tr>
                                  <th className="py-2.5 px-3">Trim Size</th>
                                  <th className="py-2.5 px-3">Paper Specifications</th>
                                  <th className="py-2.5 px-3">Paper Color</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr><td className="py-2.5 px-3 fw-medium">5.5" × 8.5"</td><td className="py-2.5 px-3">50 lb, acid-free, lignin-free</td><td className="py-2.5 px-3">Crème</td></tr>
                                <tr><td className="py-2.5 px-3 fw-medium">6" × 9"</td><td className="py-2.5 px-3">50 lb, acid-free, lignin-free</td><td className="py-2.5 px-3">Crème</td></tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'black-and-white-illustrations-fine-detail' ? (
                    /* Black-and-White Illustrations - Fine Detail (NO PRICE, NO CHECKLIST) */
                    <div className="illustration-fine-detail-content">
                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          Introduce a new level of artistry to your book by including beautiful black-and-white imagery that will enhance your readers’ experience of your book. With Omni's Fine Detail line of custom black-and-white illustrations, basic highlights and shadows will be added to illustrated objects and sceneries to add a greater level of depth and dimension. Our talented team of in-house studio artists will use your ideas and creative direction to produce images that can help strengthen both your book’s message and marketability.
                        </p>
                        
                        <h5 className="fw-bold mb-3" style={{ color: '#2b2219', fontSize: '1.05rem' }}>
                          Your black-and-white illustrations can be produced in the following styles:
                        </h5>
                        <ul className="mb-4 ps-3 d-flex flex-column gap-1.5" style={{ color: '#44403c', fontSize: '0.95rem' }}>
                          <li>Juvenile/Whimsical (a sweet, cute style)</li>
                          <li>Cartoon/Humor (a humorous, funny style)</li>
                          <li>Fantasy (a comic-book or mythical style)</li>
                          <li>Science Fiction (a futuristic or technological style)</li>
                          <li>Naturalistic (a true-to-life style)</li>
                        </ul>

                        <div className="text-center my-4">
                          <img src="/assets/img/illustration.jpg" alt="Fine Detail Illustration Sample" className="img-fluid rounded-3 shadow-sm" style={{ maxHeight: '380px' }} />
                        </div>

                        <div className="p-3 mb-0 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                          <span className="fw-bold" style={{ color: '#ad7d42' }}>Timeline: </span>
                          <span style={{ color: '#57534e' }}>Six to 12 weeks depending on work queue and project complexity</span>
                        </div>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'black-and-white-illustrations-personalized' ? (
                    /* Black-and-White Illustrations - Personalized (NO PRICE, NO CHECKLIST) */
                    <div className="illustration-personalized-content">
                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          You already did the impressive work of writing a book. Now let Omni help you enhance it with custom black-and-white illustrations. Our talented artists will use your ideas and creative direction to create unique illustrations that will fit perfectly with your book. The clean lines and uniform shading used in creating Personalized illustrations are perfect for a simple, classic look. These black-and-white illustrations can be created in a wide variety of styles and subject matter, from people and landscapes to technical drawings and maps.
                        </p>

                        <h5 className="fw-bold mb-3" style={{ color: '#2b2219', fontSize: '1.05rem' }}>
                          Your black-and-white illustrations can be produced in the following styles:
                        </h5>
                        <ul className="mb-3 ps-3 d-flex flex-column gap-1.5" style={{ color: '#44403c', fontSize: '0.95rem' }}>
                          <li>Juvenile/Whimsical (a sweet, cute style)</li>
                          <li>Cartoon/Humor (a humorous, funny style)</li>
                          <li>Fantasy (a comic-book or mythical style)</li>
                          <li>Science Fiction (a futuristic or technological style)</li>
                        </ul>

                        <p className="fst-italic mb-3" style={{ color: '#57534e', fontSize: '0.92rem' }}>
                          Our artists can also create illustrations in a realistic style; however, you'll need to select our Fine Detail illustration service.
                        </p>

                        <div className="text-center my-4">
                          <img src="/assets/img/illustration.jpg" alt="Personalized Illustration Sample" className="img-fluid rounded-3 shadow-sm" style={{ maxHeight: '380px' }} />
                        </div>

                        <div className="p-3 mb-0 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                          <span className="fw-bold" style={{ color: '#ad7d42' }}>Timeline: </span>
                          <span style={{ color: '#57534e' }}>Six to 12 weeks depending on work queue and project complexity</span>
                        </div>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'color-illustrations-intricate-design' ? (
                    /* Color Illustrations - Intricate Design (NO PRICE, NO CHECKLIST) */
                    <div className="color-illustrations-intricate-content">
                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          Intricate Design color illustrations are created by hand and still consist of defining outlines but with varying degrees of line details. By giving greater levels of shading and highlights within the line art, the artist creates more three-dimensional illustrations. This is the only level where the art can be colored digitally or by hand.
                        </p>
                        <p className="mb-3">
                          By adding details and textures and varying color values, your illustrator will add a high level of 3-dimensionality to your color illustrations. Omni's in-house studio artists will use your ideas and description of your characters and storyline to create unique artwork that is appropriate your book and its target audience.
                        </p>

                        <h5 className="fw-bold mb-3" style={{ color: '#2b2219', fontSize: '1.05rem' }}>
                          Your full-color illustrations can be produced in the following styles:
                        </h5>
                        <ul className="mb-4 ps-3 d-flex flex-column gap-1.5" style={{ color: '#44403c', fontSize: '0.95rem' }}>
                          <li>Juvenile/Whimsical (a sweet, cute style)</li>
                          <li>Cartoon/Humor (a humorous, funny style)</li>
                          <li>Fantasy (a comic-book or mythical style)</li>
                          <li>Science Fiction (a futuristic or technological style)</li>
                          <li>Naturalistic (a true-to-life style)</li>
                        </ul>

                        <div className="text-center my-4">
                          <img src="/assets/img/colored.jpg" alt="Intricate Color Illustration Sample" className="img-fluid rounded-3 shadow-sm" style={{ maxHeight: '380px' }} />
                        </div>

                        <div className="p-3 mb-0 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                          <span className="fw-bold" style={{ color: '#ad7d42' }}>Timeline: </span>
                          <span style={{ color: '#57534e' }}>Six to 12 weeks depending on work queue and project complexity</span>
                        </div>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'color-illustrations-fine-detail' ? (
                    /* Color Illustrations - Fine Detail (NO PRICE, NO CHECKLIST) */
                    <div className="color-illustrations-fine-detail-content">
                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          Enhance your readers' experience with detailed and vibrant illustrations. The Fine Detail illustrations created for your book will be drawn by hand and colored digitally. At this level of artistry, your Omni illustrator will add basic shadows and highlights to objects and scenery, giving your book’s artwork a greater level of depth and dimension.
                        </p>

                        <h5 className="fw-bold mb-3" style={{ color: '#2b2219', fontSize: '1.05rem' }}>
                          Your full-color illustrations can be produced in the following styles:
                        </h5>
                        <ul className="mb-4 ps-3 d-flex flex-column gap-1.5" style={{ color: '#44403c', fontSize: '0.95rem' }}>
                          <li>Juvenile/Whimsical (a sweet, cute style)</li>
                          <li>Cartoon/Humor (a humorous, funny style)</li>
                          <li>Fantasy (a comic-book or mythical style)</li>
                          <li>Science Fiction (a futuristic or technological style)</li>
                          <li>Naturalistic (a true-to-life style)</li>
                        </ul>

                        <div className="text-center my-4">
                          <img src="/assets/img/colored.jpg" alt="Fine Detail Color Illustration Sample" className="img-fluid rounded-3 shadow-sm" style={{ maxHeight: '380px' }} />
                        </div>

                        <div className="p-3 mb-0 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                          <span className="fw-bold" style={{ color: '#ad7d42' }}>Timeline: </span>
                          <span style={{ color: '#57534e' }}>Six to 12 weeks depending on work queue and project complexity</span>
                        </div>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'color-illustrations-personalized' ? (
                    /* Color Illustrations - Personalized (NO PRICE, NO CHECKLIST) */
                    <div className="color-illustrations-personalized-content">
                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          Elevate your book to the next creative level with artwork produced by our talented illustration team. Omni's in-house studio artists will follow your ideas and direction to produce striking artwork that accentuates your carefully crafted book.
                        </p>
                        <p className="mb-3">
                          With Personalized illustrations, art is drawn by hand and colored digitally. The clean lines and uniform colors create a simple style that will add a classic look to your book. These full-color illustrations can be created in a wide variety of styles and subject matter, from people and landscapes to technical drawings and maps.
                        </p>

                        <h5 className="fw-bold mb-3" style={{ color: '#2b2219', fontSize: '1.05rem' }}>
                          Your full-color illustrations can be produced in the following styles:
                        </h5>
                        <ul className="mb-3 ps-3 d-flex flex-column gap-1.5" style={{ color: '#44403c', fontSize: '0.95rem' }}>
                          <li>Juvenile/Whimsical (a sweet, cute style)</li>
                          <li>Cartoon/Humor (a humorous, funny style)</li>
                          <li>Fantasy (a comic-book or mythical style)</li>
                          <li>Science Fiction (a futuristic or technological style)</li>
                        </ul>

                        <p className="fst-italic mb-3" style={{ color: '#57534e', fontSize: '0.92rem' }}>
                          Our artists can also create illustrations in a more realistic style; however, you'll need to select our Fine Detail or Intricate Design illustrations.
                        </p>

                        <div className="text-center my-4">
                          <img src="/assets/img/colored.jpg" alt="Personalized Color Illustration Sample" className="img-fluid rounded-3 shadow-sm" style={{ maxHeight: '380px' }} />
                        </div>

                        <div className="p-3 mb-0 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                          <span className="fw-bold" style={{ color: '#ad7d42' }}>Timeline: </span>
                          <span style={{ color: '#57534e' }}>Six to 12 weeks depending on work queue and project complexity</span>
                        </div>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'elite-cover-design' ? (
                    /* Elite Cover Design (NO PRICE, NO CHECKLIST) */
                    <div className="elite-cover-design-detail-content">
                      <div className="editorial-callout-notice p-3 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                        <p className="fst-italic mb-0 fw-medium" style={{ color: '#57534e', fontSize: '0.92rem' }}>
                          Please Note: Elite Cover Design is included in select publishing packages and cannot be purchased separately. This page is designed to give you more information about the service and why it is important for your book.
                        </p>
                      </div>

                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          A potential reader’s decision to learn more about your book is often determined by the appeal of your book’s cover. Although we’ve all been told to “never judge a book by its cover,” it’s hard not to let a book’s visual appearance sway our judgment when there are so many books to choose from. One of the primary ways to entice readers to discover and purchase your book over thousands of other books is by capturing their interest with a compelling cover design.
                        </p>
                        <p className="mb-4">
                          With Omni’s Elite Cover Design, you will work one-on-one with a professional cover designer who will be committed to creating a cover that compliments your written work and gives your book its best shot at success in today’s competitive market.
                        </p>

                        <h5 className="fw-bold mb-3" style={{ color: '#2b2219', fontSize: '1.05rem' }}>
                          The Elite Difference:
                        </h5>
                        <ul className="mb-0 ps-3 d-flex flex-column gap-2" style={{ color: '#44403c', fontSize: '0.95rem' }}>
                          <li>Your Omni cover designer will conduct creative research on genre-specific cover trends to determine which design will maximize your book's impact in the marketplace.</li>
                          <li>Your designer will propose three front cover concepts that reflect the feel of your book.</li>
                          <li>Once you choose your favorite concept, you and your designer will confirm the details about the design elements.</li>
                          <li>You will receive the first draft of the cover and have one free round of corrections.</li>
                          <li>After your designer incorporates any changes per your request to your design, you’ll receive your final cover as a PDF (Please note: any changes requested after the initial round of free corrections will incur a fee).</li>
                        </ul>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'custom-cover-illustration' ? (
                    /* Custom Cover Illustration (NO PRICE, NO CHECKLIST) */
                    <div className="custom-cover-illustration-detail-content">
                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-4">
                          If you want your idea translated into an original piece of art, you've come to the right place. Our team of experienced in-house artists will work with you to produce a striking custom cover illustration that will help your book stand out.
                        </p>

                        <div className="p-3.5 mb-4 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                          <h5 className="fw-bold mb-3" style={{ color: '#2b2219', fontSize: '1.05rem' }}>
                            How Does a Custom Cover Illustration Benefit You and Your Book?
                          </h5>
                          <ul className="mb-0 ps-3 d-flex flex-column gap-2" style={{ color: '#44403c', fontSize: '0.95rem' }}>
                            <li>People really do judge a book by its cover—first and foremost, the purpose of your book cover is to make people pick up your book, or click on the virtual version.</li>
                            <li>The artwork created is unique to your book, which both readers and booksellers will notice.</li>
                            <li>Artwork can be created in a variety of mediums depending on what you think will enhance your book.</li>
                          </ul>
                        </div>

                        <div className="p-3.5 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                          <h5 className="fw-bold mb-3" style={{ color: '#2b2219', fontSize: '1.05rem' }}>
                            How Does the Process Work?
                          </h5>
                          <ol className="mb-0 ps-3 d-flex flex-column gap-2" style={{ color: '#44403c', fontSize: '0.95rem' }}>
                            <li>You’ll connect with our art team to discuss the initial book cover concept and timelines.</li>
                            <li>They’ll create a sketch from your instructions and work with you through two free rounds of revisions if necessary to create a final illustration to your specifications.</li>
                            <li>You’ll work with our design team to create a finished book cover using the final artwork.</li>
                          </ol>
                        </div>

                        <div className="p-3.5 mb-4 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                          <h5 className="fw-bold mb-2" style={{ color: '#2b2219', fontSize: '1.05rem' }}>
                            More About | Custom Cover Illustration
                          </h5>
                          <p className="mb-0" style={{ color: '#57534e', fontSize: '0.95rem', lineHeight: '1.65' }}>
                            Illustrations usually take <strong>6 to 12 weeks</strong> to complete depending on our work queue and the complexity of your project.
                          </p>
                        </div>

                        <div className="text-center my-4">
                          <img src="/assets/img/colored.jpg" alt="Cover Illustration Sample" className="img-fluid rounded-3 shadow-sm" style={{ maxHeight: '380px' }} />
                        </div>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'cover-revisions-text' ? (
                    /* Cover Revisions (Text) (NO PRICE, NO CHECKLIST) */
                    <div className="cover-revisions-text-detail-content">
                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          Cover Revisions (Text) are corrections that are made to the text on the cover layout. During your publication process, you are given one round of revisions to the cover at no charge. If after this initial round of edits you would like some additional modifications, this design service enables you to make text changes to your cover for a fee.
                        </p>

                        <h5 className="fw-bold mb-3" style={{ color: '#2b2219', fontSize: '1.05rem' }}>
                          Text adjustments range from:
                        </h5>
                        <ul className="mb-4 ps-3 d-flex flex-column gap-1.5" style={{ color: '#44403c', fontSize: '0.95rem' }}>
                          <li>replacing a few words</li>
                          <li>correcting punctuation</li>
                          <li>adding additional quotes and other information</li>
                          <li>completely replacing sections of cover text</li>
                        </ul>

                        <div className="p-3 mb-0 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                          <p className="mb-0" style={{ color: '#57534e', fontSize: '0.92rem', lineHeight: '1.65' }}>
                            It is the author's responsibility to supply Omni with the exact changes, location, and phrases that they would like to change or replace. It is also the responsibility of the author to proofread or edit these changes.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'cover-revisions-images-design' ? (
                    /* Cover Revisions (Images/Design) (NO PRICE, NO CHECKLIST) */
                    <div className="cover-revisions-images-detail-content">
                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          Cover Revisions (Images/Design) are changes to imagery and design elements on the cover layout that are NOT text changes. The following services are just a few of many that Omni can complete for an author:
                        </p>

                        <ul className="mb-0 ps-3 d-flex flex-column gap-2" style={{ color: '#44403c', fontSize: '0.95rem' }}>
                          <li>Touch-up photographs</li>
                          <li>Blend several images together</li>
                          <li>Remove components of an image</li>
                          <li>Combine elements from several different images into one scene</li>
                          <li>Changing/manipulating skin color, eye color, scene color</li>
                          <li>Red-eye reduction</li>
                        </ul>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'elite-interior-design' ? (
                    /* Elite Interior Design (NO PRICE, NO CHECKLIST) */
                    <div className="elite-interior-design-detail-content">
                      <div className="editorial-callout-notice p-3 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                        <p className="fst-italic mb-0 fw-medium" style={{ color: '#57534e', fontSize: '0.92rem' }}>
                          Please Note: Elite Interior Design is included in select publishing packages and cannot be purchased separately. This page is designed to give you more information about the service and why it’s important for your book.
                        </p>
                      </div>

                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          With Elite Interior Design, you will hold a one-on-one consultation with an Omni book layout specialist who has special training in designing for your book’s genre. Using your ideas and input, your designer will create the interior page layout your book needs.
                        </p>
                        <p className="mb-4">
                          This interior will include chapter titles, headings, page numbers and other layout details that will allow for easy reading and ensure your book meets industry standards. The layout designer will also insert photos or graphics and conduct minimal manuscript cleanup.
                        </p>

                        <h5 className="fw-bold mb-3" style={{ color: '#2b2219', fontSize: '1.05rem' }}>
                          Here’s how it works:
                        </h5>
                        <ul className="mb-4 ps-3 d-flex flex-column gap-2" style={{ color: '#44403c', fontSize: '0.95rem' }}>
                          <li>Your Omni designer will conduct creative research on genre-specific book layout trends to determine which design will maximize your book's impact in the marketplace.</li>
                          <li>Your designer will discuss concepts that reflect the feel of your book (such as fonts, chapter starts, title page design, etc.).</li>
                          <li>Your designer will then create three mock-ups of the front matter, including the first few pages of the first chapter.</li>
                          <li>Once you choose your favorite concept, we will confirm the details about the design elements.</li>
                          <li>You will receive the first draft of the completed layout as a PDF and have one round of 50 free corrections.</li>
                          <li>After your designer incorporates any changes, you’ll receive your final galley as a PDF (Please Note: Any changes requested after the initial round of free corrections will incur a fee).</li>
                        </ul>

                        <div className="p-3.5 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                          <h6 className="fw-bold mb-1" style={{ color: '#2b2219' }}>
                            Margin Guidance:
                          </h6>
                          <p className="mb-0" style={{ color: '#57534e', fontSize: '0.92rem', lineHeight: '1.68' }}>
                            During this process, the designer will change your manuscript’s margins to fit your chosen book size. We strongly recommend changing the margins yourself so you can see how the text will look in your book’s final dimensions. This will help you catch any formatting errors caused by text shifts or line breaks that might otherwise result in a delay in your book’s production.
                          </p>
                        </div>

                        <div className="p-3.5 mb-4 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                          <h6 className="fw-bold mb-2" style={{ color: '#2b2219' }}>
                            Image and Non-Text Submission Requirements:
                          </h6>
                          <ul className="mb-2 ps-3 d-flex flex-column gap-1.5" style={{ color: '#57534e', fontSize: '0.92rem' }}>
                            <li>Submitted separately from your manuscript as a TIFF (.tif) file format</li>
                            <li>CMYK colorspace</li>
                            <li>300-dpi resolution</li>
                            <li>Written copyright permission from the creator (artist, photographer, etc.) to use the work in your book</li>
                          </ul>
                          <p className="fst-italic mb-0" style={{ color: '#78716c', fontSize: '0.86rem' }}>
                            Exception: Sample graphics and other illustrations used only as ideas or guidelines for the design team can be submitted in any format.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'color-image-insertion' ? (
                    /* Color Image Insertion (NO PRICE, NO CHECKLIST) */
                    <div className="color-image-insertion-detail-content">
                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          If you want to insert additional graphics beyond the allotted number of image insertions of your chosen package, follow the guidelines below. Note that images refer to color photos, tables, charts, diagrams, etc.
                        </p>

                        <h5 className="fw-bold mb-3" style={{ color: '#2b2219', fontSize: '1.05rem' }}>
                          Submission Guidelines for Inserting Color Graphics into the Interior of Your Book:
                        </h5>
                        <ul className="mb-4 ps-3 d-flex flex-column gap-2" style={{ color: '#44403c', fontSize: '0.95rem' }}>
                          <li>All interior color graphics (including photos, tables, charts, diagrams, drawings, foreign fonts, and anything else that is not text or would be considered a graphic) should be submitted as individual TIFF (.tif) files.</li>
                          <li>The manuscript should identify placeholders for each of the interior graphics.</li>
                          <li>There is a fee for each additional image inserted into the manuscript.</li>
                          <li>The book cover does not "count" as a graphic. It is in full color for no additional charge.</li>
                          <li>Printer slang for "full color" is "four color"; this means the full range of colors, not literally just four colors.</li>
                        </ul>

                        <div className="p-3 mb-0 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                          <span className="fw-bold" style={{ color: '#ad7d42' }}>Duration: </span>
                          <span style={{ color: '#57534e' }}>During design process</span>
                        </div>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'custom-layout-tech' ? (
                    /* Custom Layout Tech (NO PRICE, NO CHECKLIST) */
                    <div className="custom-layout-tech-detail-content">
                      <div className="editorial-callout-notice p-3 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                        <p className="fst-italic mb-0 fw-medium" style={{ color: '#57534e', fontSize: '0.92rem' }}>
                          Please speak with your publishing services associate for more information.
                        </p>
                      </div>

                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          Certain books may require a specialized layout technician to work with you on your specific custom layout requirements.
                        </p>

                        <div className="p-3 mb-0 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                          <span className="fw-bold" style={{ color: '#ad7d42' }}>Duration & Cost: </span>
                          <span style={{ color: '#57534e' }}>Dependent on complexity</span>
                        </div>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'table-of-contents-two-or-more' ? (
                    /* Table of Contents (Two or More) (NO PRICE, NO CHECKLIST) */
                    <div className="toc-detail-content">
                      <div className="editorial-callout-notice p-3 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                        <p className="fst-italic mb-0 fw-medium" style={{ color: '#57534e', fontSize: '0.92rem' }}>
                          Please speak to your publishing services associate for more information.
                        </p>
                      </div>

                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          Creating a table of contents for your work will demonstrate to your reader how the information has been organized. In order to better organize your work, multiple tables of contents might be necessary. After the first free table of contents, Omni can create your additional tables of contents with this service.
                        </p>

                        <div className="p-3 mb-0 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                          <span className="fw-bold" style={{ color: '#ad7d42' }}>Duration: </span>
                          <span style={{ color: '#57534e' }}>Dependent on quantity and complexity</span>
                        </div>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'table-creation' ? (
                    /* Table Creation (NO PRICE, NO CHECKLIST) */
                    <div className="table-creation-detail-content">
                      <div className="editorial-callout-notice p-3 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                        <p className="fst-italic mb-0 fw-medium" style={{ color: '#57534e', fontSize: '0.92rem' }}>
                          Please do not order without first speaking with your publishing services associate.
                        </p>
                      </div>

                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          Our designers can create and format professional tables to be inserted into your manuscript as needed.
                        </p>

                        <div className="p-3 mb-0 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                          <span className="fw-bold" style={{ color: '#ad7d42' }}>Duration & Cost: </span>
                          <span style={{ color: '#57534e' }}>Dependent on quantity and complexity</span>
                        </div>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'footnote-formatting' ? (
                    /* Footnote Formatting (NO PRICE, NO CHECKLIST) */
                    <div className="footnote-formatting-detail-content">
                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          Adding footnotes to your manuscript can be very useful. Omni follows the Chicago Manual of Style citation guidelines when inserting footnotes for you. Most often, footnotes are used as a replacement for long, explanatory notes. They can also be used for other various reasons:
                        </p>

                        <ul className="mb-3 ps-3 d-flex flex-column gap-1.5" style={{ color: '#44403c', fontSize: '0.95rem' }}>
                          <li>To direct the reader to more information pertaining to the subject in the main text;</li>
                          <li>To reference a quote or viewpoint; or</li>
                          <li>To use as an alternative to parenthetical references.</li>
                        </ul>

                        <p className="mb-3" style={{ fontSize: '0.93rem', lineHeight: '1.68' }}>
                          Footnotes are indicated by a superscript number that corresponds to a note at the bottom of the page that is written in a smaller font and labeled with the same number. It also includes the citation number in superscript and contains the full citation the first time the source is cited. Every subsequent citation of the source only requires an abbreviated citation. The first line of all footnotes is indented, single spaced, and without extra space between references.
                        </p>

                        <div className="p-3 mb-0 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                          <span className="fw-bold" style={{ color: '#ad7d42' }}>Duration: </span>
                          <span style={{ color: '#57534e' }}>During design process</span>
                        </div>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'custom-headers' ? (
                    /* Custom Headers (NO PRICE, NO CHECKLIST) */
                    <div className="custom-headers-detail-content">
                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          You may find it important to create custom headers within your book. If at any time during the submission process you would like to change a header within your work, you simply need to purchase our Custom Header service.
                        </p>

                        <div className="p-3 mb-0 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                          <span className="fw-bold" style={{ color: '#ad7d42' }}>Duration: </span>
                          <span style={{ color: '#57534e' }}>During design process</span>
                        </div>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'b-w-image-insertion' ? (
                    /* B&W Image Insertion (NO PRICE, NO CHECKLIST) */
                    <div className="bw-image-insertion-detail-content">
                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          If you want to insert additional graphics beyond the allotted number of image insertions of your chosen package, follow the guidelines below. Note that images refer to photos, tables, charts, diagrams, etc.
                        </p>

                        <h5 className="fw-bold mb-3" style={{ color: '#2b2219', fontSize: '1.05rem' }}>
                          Submission Guidelines for Inserting Graphics into the Interior of Your Book:
                        </h5>
                        <ul className="mb-4 ps-3 d-flex flex-column gap-2" style={{ color: '#44403c', fontSize: '0.95rem' }}>
                          <li>All interior graphics (including photos, tables, charts, diagrams, drawings, foreign fonts, and anything else that is not text or would be considered a graphic) should be submitted as individual TIFF (.tif) files.</li>
                          <li>The manuscript should identify placeholders for each of the interior graphics.</li>
                          <li>There is a fee per additional image inserted into the manuscript.</li>
                          <li>All illustrations are produced in black and white or grayscale; we cannot process color inside the manuscript.</li>
                          <li>The book cover does not "count" as a graphic. It is in full color for no additional charge.</li>
                          <li>Printer slang for "full color" is "four color"; this means the full range of colors, not literally just four colors.</li>
                        </ul>

                        <div className="p-3 mb-0 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                          <div className="mb-2">
                            <span className="fw-bold" style={{ color: '#ad7d42' }}>Duration: </span>
                            <span style={{ color: '#57534e' }}>During design process</span>
                          </div>
                          <p className="fst-italic mb-0" style={{ color: '#78716c', fontSize: '0.86rem', lineHeight: '1.6' }}>
                            Disclaimer: Prices listed do not include applicable taxes, which will be added at the time of purchase. Shipping and handling will be calculated and charged after your book is made available for sale.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'interior-revisions-block-of-25' ? (
                    /* Interior Revisions (Block of 25) (NO PRICE, NO CHECKLIST) */
                    <div className="interior-revisions-detail-content">
                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          Omni gives you one opportunity to examine your book proofs and make up to 50 corrections for free. It is imperative that you list these corrections on the proof form provided in order for the changes to be made. Publisher errors such as hyphenation errors, formatting issues or misplaced graphics which occurred during production must also be noted on the proof from, but will not count against the first free 50 corrections.
                        </p>
                        <p className="mb-3">
                          Remember to carefully review each page of your proofs for any formatting or typographical errors that were created by either you or Omni. Our proofing process is designed to give you the final say about your book’s appearance by allowing you to rectify any remaining problems or errors.
                        </p>
                        <p className="mb-3" style={{ color: '#57534e', fontSize: '0.94rem' }}>
                          If you wish to make further proofreading corrections after the initial free 50, there is a charge for every group of 25 changes.
                        </p>

                        <div className="p-3 mb-0 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                          <span className="fw-bold" style={{ color: '#ad7d42' }}>Duration: </span>
                          <span style={{ color: '#57534e' }}>7-10 Business days</span>
                        </div>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'stock-image-processing' ? (
                    /* Stock Image Processing (NO PRICE, NO CHECKLIST) */
                    <div className="stock-image-processing-detail-content">
                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          All books published via the Omni standard publishing packages receive custom-designed covers, produced in full color. Within the realm of this custom-designed cover, you have the option to choose two images, free of charge, from the millions found through Getty Images. If you wish to include more than two images on your cover, a Stock Image Processing fee will be assessed.
                        </p>
                        <p className="mb-3">
                          This fee will also be placed on any images found through Getty Images you wish to use in the interior of your book.
                        </p>

                        <div className="p-3 mb-0 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                          <p className="mb-2" style={{ color: '#57534e', fontSize: '0.92rem', lineHeight: '1.65' }}>
                            To avoid these fees please adhere to the manuscript submission guidelines. Speak to an Omni team member for more information about this service.
                          </p>
                          <p className="fst-italic mb-0" style={{ color: '#78716c', fontSize: '0.86rem', lineHeight: '1.6' }}>
                            Disclaimer: Prices listed do not include applicable taxes, which will be added at the time of purchase. Shipping and handling will be calculated and charged after your book is made available for sale.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'retech' ? (
                    /* Retech (NO PRICE, NO CHECKLIST) */
                    <div className="retech-detail-content">
                      <div className="editorial-callout-notice p-3 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                        <p className="fst-italic mb-0 fw-medium" style={{ color: '#57534e', fontSize: '0.92rem' }}>
                          Please speak with your publishing services associate for more information.
                        </p>
                      </div>

                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          Once you have received your first interior proof from your design team, it is possible that the number of errors (usually more than 100 corrections) is such that it's in your best interest to supply us with a revised manuscript to reformat into a new interior proof for you to review. If the retech service is done at your request, there is an initial charge for the retech service and any applicable special formatting fees will need to be paid again (indexing, tables, etc.). Please contact your Publishing Services Associate for a complete quote.
                        </p>

                        <p className="mb-4">
                          In addition to providing a new manuscript, you will also have another opportunity to re-select your book’s trim size and provide revised formatting suggestions to your Publishing Services Associate. This includes changes of typeface, type size, image treatments, and the overall style in which your book was formatted. It is important that you express these types of formatting requests to your Publishing Services Associate, or supply an interior proof form, along with your newly revised manuscript. If we do not receive revised formatting requests, then the design team will utilize the same styling as the first proof you received from us.
                        </p>

                        <div className="p-3.5 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                          <h6 className="fw-bold mb-1" style={{ color: '#2b2219' }}>
                            Resubmission Discount:
                          </h6>
                          <p className="mb-0" style={{ color: '#57534e', fontSize: '0.92rem', lineHeight: '1.68' }}>
                            Please Note: If you are resubmitting to do a retech then the price of the retech is reduced when purchased with the resubmission.
                          </p>
                        </div>

                        <div className="p-3.5 mb-0 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                          <h6 className="fw-bold mb-1" style={{ color: '#2b2219' }}>
                            More About | Retech
                          </h6>
                          <p className="mb-0" style={{ color: '#57534e', fontSize: '0.92rem', lineHeight: '1.68' }}>
                            If additional revisions are needed, this is the perfect opportunity to make your book shine.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'title-change-after-setup' ? (
                    /* Title Change After Setup (NO PRICE, NO CHECKLIST) */
                    <div className="title-change-after-setup-detail-content">
                      <div className="editorial-callout-notice p-3 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                        <p className="fst-italic mb-0 fw-medium" style={{ color: '#57534e', fontSize: '0.92rem' }}>
                          Please speak with your publishing services associate for more information.
                        </p>
                      </div>

                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          If an author wants to make changes to the title it impacts many elements within the book and through the registration and marketing of the book.
                        </p>

                        <div className="p-3 mb-0 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                          <p className="mb-0" style={{ color: '#57534e', fontSize: '0.92rem', lineHeight: '1.68' }}>
                            Changing the title of your book impacts the cover design, interior layout, ISBN assignment, copyright records, and metadata across worldwide retail channels. Contact your Publishing Services Associate to coordinate a seamless title update.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'color-image-scanning' ? (
                    /* Color Image Scanning (NO PRICE, NO CHECKLIST) */
                    <div className="color-image-scanning-detail-content">
                      <div className="editorial-callout-notice p-3 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                        <p className="fst-italic mb-0 fw-medium" style={{ color: '#57534e', fontSize: '0.92rem' }}>
                          Authors who send in hard copies of original color images can have them scanned and placed into the correct place in your work.
                        </p>
                      </div>

                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          Omni allows usage of original color art to be placed within a manuscript. Authors who send in hard copies may purchase the Color Image Scanning service. Omni will take the original image and scan it into the correct place in your work.
                        </p>

                        <div className="p-3 mb-0 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                          <p className="mb-0" style={{ color: '#57534e', fontSize: '0.92rem', lineHeight: '1.68' }}>
                            <strong style={{ color: '#2b2219' }}>Duration:</strong> 1-2 Weeks dependent on quantity
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'basic-manuscript-formatting-corrections' ? (
                    /* Basic Manuscript Formatting Corrections (NO PRICE, NO CHECKLIST) */
                    <div className="basic-manuscript-formatting-corrections-detail-content">
                      <div className="editorial-callout-notice p-3 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                        <p className="fst-italic mb-0 fw-medium" style={{ color: '#57534e', fontSize: '0.92rem' }}>
                          Please speak with your publishing services associate for more information.
                        </p>
                      </div>

                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          We often receive manuscripts that require formatting corrections before we can start the editorial and layout processes. These include:
                        </p>

                        <ul className="mb-4 ps-3" style={{ color: '#57534e', fontSize: '0.94rem', lineHeight: '1.8' }}>
                          <li>Removing headers, footers, page numbering, etc.</li>
                          <li>Inserting page breaks appropriately</li>
                          <li>Correcting soft and hard returns</li>
                          <li>Correcting line and paragraph formatting</li>
                        </ul>

                        <div className="p-3 mb-0 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                          <p className="mb-0" style={{ color: '#57534e', fontSize: '0.92rem', lineHeight: '1.68' }}>
                            <strong style={{ color: '#2b2219' }}>Submission Tip:</strong> To avoid these fees please adhere to the manuscript submission guidelines.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'extensive-customized-formatting' ? (
                    /* Extensive Customized Formatting (NO PRICE, NO CHECKLIST) */
                    <div className="extensive-customized-formatting-detail-content">
                      <div className="editorial-callout-notice p-3 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                        <p className="fst-italic mb-0 fw-medium" style={{ color: '#57534e', fontSize: '0.92rem' }}>
                          Please speak with your publishing services associate for more information.
                        </p>
                      </div>

                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          Occasionally we receive manuscripts that require an extensive amount of formatting before we can start the editorial and layout process.
                        </p>

                        <p className="fw-semibold mb-2" style={{ color: '#2b2219', fontSize: '0.95rem' }}>
                          This includes:
                        </p>
                        <ul className="mb-4 ps-3" style={{ color: '#57534e', fontSize: '0.94rem', lineHeight: '1.8' }}>
                          <li>Removing text boxes</li>
                          <li>Removing embedded graphics</li>
                          <li>Removing wrapped text, etc.</li>
                        </ul>

                        <div className="p-3 mb-3 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                          <p className="mb-0" style={{ color: '#57534e', fontSize: '0.92rem', lineHeight: '1.68' }}>
                            <strong style={{ color: '#2b2219' }}>Submission Tip:</strong> To avoid these fees please adhere to the manuscript submission guidelines.
                          </p>
                        </div>

                        <div className="p-3 mb-0 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                          <p className="mb-0" style={{ color: '#57534e', fontSize: '0.92rem', lineHeight: '1.68' }}>
                            <strong style={{ color: '#2b2219' }}>Duration & Scope:</strong> Duration and cost are dependent on quantity and complexity.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'data-entry-standard' ? (
                    /* Data Entry - Standard (NO PRICE, NO CHECKLIST) */
                    <div className="data-entry-standard-detail-content">
                      <div className="editorial-callout-notice p-3 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                        <p className="fst-italic mb-0 fw-medium" style={{ color: '#57534e', fontSize: '0.92rem' }}>
                          With Standard Data Entry, you can send us your printed manuscript and we will convert it into a working digital file. This excludes any handwritten documents or newspaper-type articles.
                        </p>
                      </div>

                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          In order for our professional staff to efficiently work on your manuscript, Omni must have a digital file to manipulate. Leave it to the Omni team of professionals to convert your printed document.
                        </p>

                        <div className="p-3 mb-3 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                          <p className="mb-0" style={{ color: '#57534e', fontSize: '0.92rem', lineHeight: '1.68' }}>
                            <strong style={{ color: '#2b2219' }}>Notice:</strong> This excludes any handwritten documents or newspaper-type articles. For handwritten works, please select our Data Entry - Handwritten service.
                          </p>
                        </div>

                        <div className="p-3 mb-0 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                          <p className="mb-0" style={{ color: '#57534e', fontSize: '0.92rem', lineHeight: '1.68' }}>
                            <strong style={{ color: '#2b2219' }}>Duration:</strong> 30-45 business days dependent on page count
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'data-entry-spanish' ? (
                    /* Data Entry - Spanish (NO PRICE, NO CHECKLIST) */
                    <div className="data-entry-spanish-detail-content">
                      <div className="editorial-callout-notice p-3 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                        <p className="fst-italic mb-0 fw-medium" style={{ color: '#57534e', fontSize: '0.92rem' }}>
                          Spanish-language materials you provide are converted into an electronic format for publication with our Spanish Data Entry service.
                        </p>
                      </div>

                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          In order for our professional staff to efficiently work on your manuscript, Omni must have a digital file to manipulate. The Data Entry - Spanish service will convert typed Spanish-language material that you have provided into an electronic format for publication.
                        </p>

                        <div className="p-3 mb-3 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                          <p className="mb-0" style={{ color: '#57534e', fontSize: '0.92rem', lineHeight: '1.68' }}>
                            <strong style={{ color: '#2b2219' }}>Notice:</strong> This excludes any handwritten documents or newspaper-type articles.
                          </p>
                        </div>

                        <div className="p-3 mb-0 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                          <p className="mb-0" style={{ color: '#57534e', fontSize: '0.92rem', lineHeight: '1.68' }}>
                            <strong style={{ color: '#2b2219' }}>Duration:</strong> 60-75 days
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'data-entry-handwritten' ? (
                    /* Data Entry - Handwritten (NO PRICE, NO CHECKLIST) */
                    <div className="data-entry-handwritten-detail-content">
                      <div className="editorial-callout-notice p-3 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                        <p className="fst-italic mb-0 fw-medium" style={{ color: '#57534e', fontSize: '0.92rem' }}>
                          Relieve yourself from the tedious task of encoding multiple pages and let us do all the manual encoding for you. This service is only applicable to handwritten documents.
                        </p>
                      </div>

                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          Is your manuscript handwritten? Now you have the option to have your book converted into a digital file. In order for our professional staff to efficiently work on your manuscript, Omni must have a digital file to manipulate. Leave it to the Omni team of professionals to manually type and convert your document.
                        </p>

                        <div className="p-3 mb-0 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                          <p className="mb-0" style={{ color: '#57534e', fontSize: '0.92rem', lineHeight: '1.68' }}>
                            <strong style={{ color: '#2b2219' }}>Service Note:</strong> This service will only be applied to handwritten documents.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'large-image-scanning' ? (
                    /* Large Image Scanning (NO PRICE, NO CHECKLIST) */
                    <div className="large-image-scanning-detail-content">
                      <div className="editorial-callout-notice p-3 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                        <p className="fst-italic mb-0 fw-medium" style={{ color: '#57534e', fontSize: '0.92rem' }}>
                          Please contact your publishing services consultant for more information.
                        </p>
                      </div>

                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          The Large Image Scanning services include images that are larger than 11" x 17". Omni will professionally scan your oversized artwork and visuals to ensure crystal clarity when printed in your book.
                        </p>

                        <div className="p-3 mb-0 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                          <p className="mb-0" style={{ color: '#57534e', fontSize: '0.92rem', lineHeight: '1.68' }}>
                            <strong style={{ color: '#2b2219' }}>Duration:</strong> 2-3 weeks
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'b-w-image-scanning' ? (
                    /* B&W Image Scanning (NO PRICE, NO CHECKLIST) */
                    <div className="b-w-image-scanning-detail-content">
                      <div className="editorial-callout-notice p-3 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                        <p className="fst-italic mb-0 fw-medium" style={{ color: '#57534e', fontSize: '0.92rem' }}>
                          Authors who send in hard copies of original black and white images can have them scanned and placed into the correct place in your work.
                        </p>
                      </div>

                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          Omni allows usage of original black and white art to be placed within a manuscript. Authors who send in hard copies may purchase the Black and White Image Scanning service. Omni will take the original image and scan it into the correct place in your work.
                        </p>

                        <div className="p-3 mb-0 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                          <p className="mb-0" style={{ color: '#57534e', fontSize: '0.92rem', lineHeight: '1.68' }}>
                            <strong style={{ color: '#2b2219' }}>Duration:</strong> 1-2 Weeks dependent on quantity
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'manuscript-file-conversion' ? (
                    /* Manuscript File Conversion (NO PRICE, NO CHECKLIST) */
                    <div className="manuscript-file-conversion-detail-content">
                      <div className="editorial-callout-notice p-3 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                        <p className="fst-italic mb-0 fw-medium" style={{ color: '#57534e', fontSize: '0.92rem' }}>
                          Please speak with your publishing services associate for more information.
                        </p>
                      </div>

                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          Omni will make every effort to work with manuscripts created using a wide variety of software packages. We will charge a small conversion fee for documents created under such formats as WordPerfect, WordPad, and Microsoft Works.
                        </p>

                        <div className="p-3 mb-3 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                          <p className="mb-0" style={{ color: '#57534e', fontSize: '0.92rem', lineHeight: '1.68' }}>
                            <strong style={{ color: '#2b2219' }}>Submission Tip:</strong> To avoid these fees please adhere to the manuscript submission guidelines.
                          </p>
                        </div>

                        <div className="p-3 mb-0 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                          <p className="mb-0" style={{ color: '#57534e', fontSize: '0.92rem', lineHeight: '1.68' }}>
                            <strong style={{ color: '#2b2219' }}>Duration:</strong> 1 week
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'graphic-file-conversions-quantity-25' ? (
                    /* Graphic File Conversions (Quantity: 25) (NO PRICE, NO CHECKLIST) */
                    <div className="graphic-file-conversions-detail-content">
                      <div className="editorial-callout-notice p-3 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                        <p className="fst-italic mb-0 fw-medium" style={{ color: '#57534e', fontSize: '0.92rem' }}>
                          Please speak with your publishing services associate for more information.
                        </p>
                      </div>

                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          Authors often send in graphic files (these include graphics, tables, text boxes) that require an extensive amount of work. These include:
                        </p>

                        <ul className="mb-3 ps-3" style={{ color: '#57534e', fontSize: '0.94rem', lineHeight: '1.8' }}>
                          <li>Cropping graphics as requested by the author</li>
                          <li>Extracting graphics from the manuscript</li>
                          <li>Converting line art to TIFF (.tif) files</li>
                        </ul>

                        <p className="mb-3" style={{ color: '#44403c', fontSize: '0.95rem' }}>
                          Your graphic files will be reviewed and a price quoted based on a price per block of 25 graphic files. The author will have the option of making the changes themselves or paying for Omni staff to make the changes.
                        </p>

                        <div className="p-3 mb-3 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                          <p className="mb-0" style={{ color: '#57534e', fontSize: '0.92rem', lineHeight: '1.68' }}>
                            <strong style={{ color: '#2b2219' }}>Submission Tip:</strong> To avoid these fees please adhere to the image submission guidelines.
                          </p>
                        </div>

                        <div className="p-3 mb-0 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                          <p className="mb-0" style={{ color: '#57534e', fontSize: '0.92rem', lineHeight: '1.68' }}>
                            <strong style={{ color: '#2b2219' }}>Duration:</strong> 1-2 weeks
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'file-merging' ? (
                    /* File Merging (NO PRICE, NO CHECKLIST) */
                    <div className="file-merging-detail-content">
                      <div className="editorial-callout-notice p-3 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                        <p className="fst-italic mb-0 fw-medium" style={{ color: '#57534e', fontSize: '0.92rem' }}>
                          Please speak with your publishing services associate for more information.
                        </p>
                      </div>

                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          The standard manuscript submission process is based around Omni receiving the manuscript as one file. Some authors may choose to send their manuscript to Omni in several files. The File Merging service is used to merge these files into one document for both editorial services and layout.
                        </p>

                        <div className="p-3 mb-3 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                          <p className="mb-0" style={{ color: '#57534e', fontSize: '0.92rem', lineHeight: '1.68' }}>
                            <strong style={{ color: '#2b2219' }}>Submission Tip:</strong> To avoid these fees please adhere to the manuscript submission guidelines.
                          </p>
                        </div>

                        <div className="p-3 mb-0 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                          <p className="mb-0" style={{ color: '#57534e', fontSize: '0.92rem', lineHeight: '1.68' }}>
                            <strong style={{ color: '#2b2219' }}>Duration:</strong> 1 week
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'image-extraction' ? (
                    /* Image Extraction (NO PRICE, NO CHECKLIST) */
                    <div className="image-extraction-detail-content">
                      <div className="editorial-callout-notice p-3 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                        <p className="fst-italic mb-0 fw-medium" style={{ color: '#57534e', fontSize: '0.92rem' }}>
                          Please speak with your publishing services associate for more information.
                        </p>
                      </div>

                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          If you choose to submit your manuscript with the images included in the body of your work, Omni must extract these images to properly create a professional layout of your book. The images will be placed back into the manuscript once the layout is complete.
                        </p>

                        <div className="p-3 mb-3 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                          <p className="mb-0" style={{ color: '#57534e', fontSize: '0.92rem', lineHeight: '1.68' }}>
                            <strong style={{ color: '#2b2219' }}>Interior Layout Protection:</strong> This service will cover the cost of extracting the images to ensure proper interior layout.
                          </p>
                        </div>

                        <div className="p-3 mb-0 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                          <p className="mb-0" style={{ color: '#57534e', fontSize: '0.92rem', lineHeight: '1.68' }}>
                            <strong style={{ color: '#2b2219' }}>Duration:</strong> 1-2 weeks
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'resubmission-one-version' ? (
                    /* Resubmission (One Version) (NO PRICE, NO CHECKLIST) */
                    <div className="resubmission-one-version-detail-content">
                      <div className="editorial-callout-notice p-3 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                        <p className="fst-italic mb-0 fw-medium" style={{ color: '#57534e', fontSize: '0.92rem' }}>
                          Once your book has gone live and is for sale, you can still correct errors or other issues that might have been missed. Choose this service if you only have either a softcover or a hardcover that needs to be updated.
                        </p>
                      </div>

                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          When a book has gone live and the author finds problems, errors, or other issues that need to be corrected, we can re-submit the file to the printer to update future copies.
                        </p>

                        <div className="p-3 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                          <h6 className="fw-bold mb-1" style={{ color: '#2b2219' }}>
                            Resubmission Discount:
                          </h6>
                          <p className="mb-0" style={{ color: '#57534e', fontSize: '0.92rem', lineHeight: '1.68' }}>
                            If the author is resubmitting to do a retech, then the price of the retech is reduced when purchased with the resubmission.
                          </p>
                        </div>

                        <div className="p-3.5 mb-4 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                          <h6 className="fw-bold mb-2" style={{ color: '#2b2219', fontSize: '0.96rem' }}>
                            Permitted Resubmission Changes:
                          </h6>
                          <p className="mb-2" style={{ color: '#57534e', fontSize: '0.92rem' }}>
                            Authors are able to:
                          </p>
                          <ul className="mb-0 ps-3" style={{ color: '#57534e', fontSize: '0.92rem', lineHeight: '1.75' }}>
                            <li>Make changes to text in galley</li>
                            <li>Make changes to cover text or design</li>
                            <li>Change subtitle</li>
                          </ul>
                        </div>

                        <div className="p-3 mb-3 rounded-3" style={{ background: '#fff9f0', border: '1px solid #f0dfc8' }}>
                          <p className="mb-0" style={{ color: '#7c5e2a', fontSize: '0.9rem', lineHeight: '1.65' }}>
                            <strong style={{ color: '#5c431b' }}>Important Policy Notice:</strong> Please remember that the title and the price (Omni bookstore or retail) for a book going through resubmission cannot be changed after it has gone live.
                          </p>
                        </div>

                        <div className="p-3 mb-0 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                          <p className="mb-0" style={{ color: '#57534e', fontSize: '0.92rem', lineHeight: '1.68' }}>
                            <strong style={{ color: '#2b2219' }}>Multiple Formats?</strong> If you have both a paperback and a hardcover version you want to update, please explore our service for <strong>Resubmission (Two Versions)</strong>.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'resubmission-two-version' ? (
                    /* Resubmission (Two Version) (NO PRICE, NO CHECKLIST) */
                    <div className="resubmission-two-version-detail-content">
                      <div className="editorial-callout-notice p-3 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                        <p className="fst-italic mb-0 fw-medium" style={{ color: '#57534e', fontSize: '0.92rem' }}>
                          Choose this service if you have a softcover and hardcover book that needs to be updated.
                        </p>
                      </div>

                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          When a book has gone live and the author finds problems, errors, or other issues that need to be corrected, we can re-submit the file to the printer to update future copies.
                        </p>

                        <div className="p-3 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                          <h6 className="fw-bold mb-1" style={{ color: '#2b2219' }}>
                            Resubmission Discount:
                          </h6>
                          <p className="mb-0" style={{ color: '#57534e', fontSize: '0.92rem', lineHeight: '1.68' }}>
                            If the author is resubmitting to do a retech, then the price of the retech is reduced when purchased with the resubmission.
                          </p>
                        </div>

                        <div className="p-3.5 mb-4 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                          <h6 className="fw-bold mb-2" style={{ color: '#2b2219', fontSize: '0.96rem' }}>
                            Permitted Resubmission Changes:
                          </h6>
                          <p className="mb-2" style={{ color: '#57534e', fontSize: '0.92rem' }}>
                            Authors are able to:
                          </p>
                          <ul className="mb-0 ps-3" style={{ color: '#57534e', fontSize: '0.92rem', lineHeight: '1.75' }}>
                            <li>Make changes to text in galley</li>
                            <li>Make changes to cover text or design</li>
                            <li>Change subtitle</li>
                          </ul>
                        </div>

                        <div className="p-3 mb-3 rounded-3" style={{ background: '#fff9f0', border: '1px solid #f0dfc8' }}>
                          <p className="mb-0" style={{ color: '#7c5e2a', fontSize: '0.9rem', lineHeight: '1.65' }}>
                            <strong style={{ color: '#5c431b' }}>Important Policy Notice:</strong> Please remember that the title and the price (Omni bookstore or retail) for a book going through resubmission cannot be changed after it has gone live.
                          </p>
                        </div>

                        <div className="p-3 mb-0 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                          <p className="mb-0" style={{ color: '#57534e', fontSize: '0.92rem', lineHeight: '1.68' }}>
                            <strong style={{ color: '#2b2219' }}>Single Format?</strong> If your book is available in only one format, such as paperback only or hardcover only, please select our service for <strong>Resubmission (One Version)</strong>.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'bookblast-video-marketing-stand-alone-30days' ? (
                    /* Bookblast Video Marketing - Stand-alone (30days) (NO PRICE, NO CHECKLIST) */
                    <div className="bookblast-video-marketing-stand-alone-detail-content">
                      <div className="editorial-callout-notice p-3 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                        <p className="fst-italic mb-0 fw-medium" style={{ color: '#57534e', fontSize: '0.92rem' }}>
                          Go the extra mile with your marketing campaign, and place your video as an ad on YouTube. Seize the opportunity to have your book video introduced as an advertising break before, or in between, YouTube videos.
                        </p>
                      </div>

                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          Catch the curiosity and interest of YouTube viewers to increase your reach – and potential book sales. Your book information, purchase, and availability details are displayed directly when the ad is clicked.
                        </p>

                        <div className="p-3.5 mb-4 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                          <h6 className="fw-bold mb-2" style={{ color: '#2b2219', fontSize: '0.96rem' }}>
                            What You Get:
                          </h6>
                          <ul className="mb-0 ps-3" style={{ color: '#57534e', fontSize: '0.92rem', lineHeight: '1.75' }}>
                            <li>
                              A 30-day ad placement campaign on YouTube that gives viewers a preview of your book. Your ad will appear at the beginning of a YouTube video, or in between videos.
                            </li>
                            <li>
                              Interactive viewer engagement: Viewers can get more information about your book by clicking on the video, which redirects them to either your book’s online bookstore page or your personal author website.
                            </li>
                          </ul>
                        </div>

                        <div className="p-3.5 mb-3 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                          <h6 className="fw-bold mb-1" style={{ color: '#2b2219', fontSize: '0.92rem' }}>
                            Prerequisite Notice:
                          </h6>
                          <p className="mb-0" style={{ color: '#57534e', fontSize: '0.9rem', lineHeight: '1.65' }}>
                            Please note that you may sign up for this package only if you have purchased either the <strong>Standard Book Video</strong> or <strong>Premium Book Video</strong> service.
                          </p>
                        </div>

                        <div className="p-3 mb-0 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                          <p className="mb-0" style={{ color: '#57534e', fontSize: '0.9rem', lineHeight: '1.65' }}>
                            <em>*Want to have a longer campaign period? Contact your marketing consultant to get a custom campaign schedule for your video.</em>
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'standard-book-video' ? (
                    /* Standard Book Video (NO PRICE, NO CHECKLIST) */
                    <div className="standard-book-video-detail-content">
                      <div className="editorial-callout-notice p-3 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                        <p className="fst-italic mb-0 fw-medium" style={{ color: '#57534e', fontSize: '0.92rem' }}>
                          A Standard Book Video helps you create and maintain a meaningful presence online in the competitive marketplace. Video book trailers are an excellent addition to your press releases, social media sites, and author website.
                        </p>
                      </div>

                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          By posting your video on social media channels and personal websites, you can reach an influential audience of online video viewers and attract potential readers. Video marketing helps you engage your audience on a visual and emotional level they cannot ignore.
                        </p>

                        <div className="p-3.5 mb-4 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                          <h6 className="fw-bold mb-2" style={{ color: '#2b2219', fontSize: '0.96rem' }}>
                            Standard Video Inclusions:
                          </h6>
                          <ul className="mb-0 ps-3" style={{ color: '#57534e', fontSize: '0.92rem', lineHeight: '1.75' }}>
                            <li>Creation of a custom-made video book trailer, approximately 45 to 60 seconds in length</li>
                            <li>Storytelling through text, 2-D graphics, motion typography, and high-resolution imagery</li>
                            <li>Distribution of your video to YouTube in order to maximize exposure</li>
                            <li>Full web streaming capability and downloadable master file</li>
                            <li>100% author rights retention to share with readers, media, friends, and family</li>
                            <li>Review of your video for TV and film consideration by 5 More Minutes</li>
                          </ul>
                        </div>

                        <div className="p-3.5 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                          <h6 className="fw-bold mb-1" style={{ color: '#2b2219', fontSize: '0.92rem' }}>
                            Revisions Policy:
                          </h6>
                          <p className="mb-2" style={{ color: '#57534e', fontSize: '0.9rem', lineHeight: '1.65' }}>
                            You will be able to make one round of revisions to your video at no additional cost. Acceptable changes include:
                          </p>
                          <ul className="mb-0 ps-3" style={{ color: '#57534e', fontSize: '0.88rem', lineHeight: '1.65' }}>
                            <li>Simple text changes and font size adjustments</li>
                            <li>Corrections or additions to book and author information</li>
                            <li>Audio level balances and soundtrack adjustments</li>
                            <li>Author-provided image adjustments</li>
                          </ul>
                        </div>

                        <div className="p-3.5 mb-0 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                          <h6 className="fw-bold mb-1" style={{ color: '#2b2219', fontSize: '0.94rem' }}>
                            Hollywood TV & Film Consideration (5 More Minutes):
                          </h6>
                          <p className="mb-0" style={{ color: '#57534e', fontSize: '0.9rem', lineHeight: '1.65' }}>
                            Once your video is completed, it will be evaluated for television or feature film adaptation by 5 More Minutes, headed by veteran Hollywood executive John Sacchi (former Senior VP at Lionsgate Films). If not selected for immediate production, it is archived into our exclusive Hollywood Database for registered industry producers and directors.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'premium-book-video' ? (
                    /* Premium Book Video (NO PRICE, NO CHECKLIST) */
                    <div className="premium-book-video-detail-content">
                      <div className="editorial-callout-notice p-3 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                        <p className="fst-italic mb-0 fw-medium" style={{ color: '#57534e', fontSize: '0.92rem' }}>
                          Give your fans a sensational preview of your book with the Premium Book Video. Complete with professional voiceover, your custom video will enhance your book marketing efforts and make your work stand out.
                        </p>
                      </div>

                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          A Premium Book Video provides a cinematic experience that captivates prospective readers. Combining expert narration, sophisticated visual effects, and live-action cinematography, your trailer becomes a cornerstone of your digital marketing.
                        </p>

                        <div className="p-3.5 mb-4 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                          <h6 className="fw-bold mb-2" style={{ color: '#2b2219', fontSize: '0.96rem' }}>
                            Premium Video Inclusions:
                          </h6>
                          <ul className="mb-0 ps-3" style={{ color: '#57534e', fontSize: '0.92rem', lineHeight: '1.75' }}>
                            <li>Creation of an expanded cinematic video book trailer, approximately 60 to 90 seconds in length</li>
                            <li>Audible storytelling through voiceover narration by a professional voice actor</li>
                            <li>Complex visual design, including 3-D spatial effects, lighting effects, visual filters, and advanced motion graphics</li>
                            <li>Two live-action video clips integrated seamlessly into the trailer</li>
                            <li>Distribution of your video to YouTube to maximize global exposure</li>
                            <li>Web streaming capability with complete author ownership and master file delivery</li>
                            <li>Review of your video for TV and feature film consideration by 5 More Minutes</li>
                          </ul>
                        </div>

                        <div className="p-3.5 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                          <h6 className="fw-bold mb-1" style={{ color: '#2b2219', fontSize: '0.92rem' }}>
                            Revisions Policy:
                          </h6>
                          <p className="mb-2" style={{ color: '#57534e', fontSize: '0.9rem', lineHeight: '1.65' }}>
                            One round of complimentary revisions is included to ensure complete satisfaction. Acceptable adjustments include:
                          </p>
                          <ul className="mb-0 ps-3" style={{ color: '#57534e', fontSize: '0.88rem', lineHeight: '1.65' }}>
                            <li>Text corrections and typography refinements</li>
                            <li>Updates to book specifications, awards, and author credentials</li>
                            <li>Soundtrack and narration audio mixing adjustments</li>
                            <li>Image updates and asset replacements</li>
                          </ul>
                        </div>

                        <div className="p-3.5 mb-0 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                          <h6 className="fw-bold mb-1" style={{ color: '#2b2219', fontSize: '0.94rem' }}>
                            Hollywood TV & Film Consideration:
                          </h6>
                          <p className="mb-0" style={{ color: '#57534e', fontSize: '0.9rem', lineHeight: '1.65' }}>
                            Your finished trailer is submitted directly to Hollywood production company 5 More Minutes for development consideration, and indexed in our Hollywood Database accessible by entertainment industry decision-makers.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'bookblast-video-marketing-standard' ? (
                    /* Bookblast Video Marketing - Standard (NO PRICE, NO CHECKLIST) */
                    <div className="bookblast-video-marketing-standard-detail-content">
                      <div className="editorial-callout-notice p-3 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                        <p className="fst-italic mb-0 fw-medium" style={{ color: '#57534e', fontSize: '0.92rem' }}>
                          The appeal of a book video is undeniable. Make sure your book catches the attention of an engaged audience of online video viewers with the creation of your book video and your YouTube advertising campaign.
                        </p>
                      </div>

                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          YouTube has over a billion active video viewers watching hundreds of millions of hours of content daily. Bookblast Video Marketing - Standard pairs trailer production with strategic promotion, driving viewers straight to your purchase channels.
                        </p>

                        <div className="p-3.5 mb-0 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                          <h6 className="fw-bold mb-2" style={{ color: '#2b2219', fontSize: '0.96rem' }}>
                            What You Get:
                          </h6>
                          <ul className="mb-0 ps-3" style={{ color: '#57534e', fontSize: '0.92rem', lineHeight: '1.75' }}>
                            <li>One complete Standard Book Video marketing production</li>
                            <li>A dedicated 30-second campaign version of the Standard Book Video optimized for YouTube advertising</li>
                            <li>A 30-day ad placement campaign on YouTube that gives viewers a compelling preview of your book</li>
                            <li>Direct click-through link redirecting viewers to your book’s online bookstore page or personal website</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'bookblast-video-marketing-premium' ? (
                    /* Bookblast Video Marketing - Premium (NO PRICE, NO CHECKLIST) */
                    <div className="bookblast-video-marketing-premium-detail-content">
                      <div className="editorial-callout-notice p-3 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                        <p className="fst-italic mb-0 fw-medium" style={{ color: '#57534e', fontSize: '0.92rem' }}>
                          Strengthen your book’s presence in the marketplace and boost its selling potential by showcasing it on YouTube with a professional voice-narrated video advertising campaign.
                        </p>
                      </div>

                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          Capture reader curiosity by combining high-end cinematic narration with targeted online advertising. Your campaign reaches audiences with keen interest in your book's genre, turning viewers into active buyers.
                        </p>

                        <div className="p-3.5 mb-0 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                          <h6 className="fw-bold mb-2" style={{ color: '#2b2219', fontSize: '0.96rem' }}>
                            What You Get:
                          </h6>
                          <ul className="mb-0 ps-3" style={{ color: '#57534e', fontSize: '0.92rem', lineHeight: '1.75' }}>
                            <li>One complete Premium Book Video marketing production featuring professional voiceover acting and live-action clips</li>
                            <li>A specialized 30-second version of your Premium Book Video formatted specifically for YouTube pre-roll and mid-roll placement</li>
                            <li>A 30-day targeted ad placement campaign on YouTube introducing your book to prospective readers</li>
                            <li>Seamless interactive click redirection directly to your book’s retail ordering page or author website</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  ) : selectedService?.slug === '15-sec-video-marketing' ? (
                    /* 15-sec Video Marketing (NO PRICE, NO CHECKLIST) */
                    <div className="fifteen-sec-video-marketing-detail-content">
                      <div className="editorial-callout-notice p-3 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                        <p className="fst-italic mb-0 fw-medium" style={{ color: '#57534e', fontSize: '0.92rem' }}>
                          Advertise your book on a widely-used platform. Get it in front of a huge and engaged audience with uninterrupted short ads on YouTube.
                        </p>
                      </div>

                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          With over two billion monthly visitors, YouTube is an unrivaled venue for digital marketing. Short-form video advertising delivers immediate impact, ensuring your book's message is delivered completely before viewers skip.
                        </p>

                        <div className="p-3.5 mb-3 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                          <h6 className="fw-bold mb-2" style={{ color: '#2b2219', fontSize: '0.96rem' }}>
                            15-Sec Video Marketing Inclusions:
                          </h6>
                          <ul className="mb-0 ps-3" style={{ color: '#57534e', fontSize: '0.92rem', lineHeight: '1.75' }}>
                            <li>A 15-second custom-made video ad of your book with professional voiceover narration</li>
                            <li>Your video ad shown 350,000 times on YouTube</li>
                            <li>Uninterrupted delivery: Your entire ad plays at the start, midway, or toward the end before the main video continues</li>
                            <li>Custom companion banner of your book linking directly to your ordering page, displayed alongside your video ad on desktop</li>
                          </ul>
                        </div>

                        <div className="p-3 mb-0 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                          <p className="mb-0" style={{ color: '#57534e', fontSize: '0.9rem', lineHeight: '1.65' }}>
                            <strong style={{ color: '#2b2219' }}>Guaranteed Visibility:</strong> Non-skippable short-form placement ensures 100% of your message reaches readers every time.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'video-book-talk' ? (
                    /* Video Book Talk / Video Marketing (NO PRICE, NO CHECKLIST) */
                    <div className="video-book-talk-detail-content">
                      <div className="editorial-callout-notice p-3 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                        <p className="fst-italic mb-0 fw-medium" style={{ color: '#57534e', fontSize: '0.92rem' }}>
                          Benefit from the rise of online streaming services with a video interview about your book and writing process, streamed on Roku, Amazon Fire TV, and top podcast networks.
                        </p>
                      </div>

                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          Your book shouldn't be confined to a box, whether that's your bookshelf, a storage container, or the four walls of traditional media. Ride the streaming wave with Roku's 70M+ users, Amazon Fire TV's 50M+ users, and YouTube's 1B+ audience to connect with readers in a fresh, conversational format.
                        </p>

                        <div className="p-3.5 mb-4 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                          <h6 className="fw-bold mb-2" style={{ color: '#2b2219', fontSize: '0.96rem' }}>
                            Video Book Talk Inclusions:
                          </h6>
                          <ul className="mb-0 ps-3" style={{ color: '#57534e', fontSize: '0.92rem', lineHeight: '1.75' }}>
                            <li>
                              <strong>Video Interview on the <em>Talking Books</em> Show:</strong> A pre-recorded 15-20 minute in-depth interview with British author and host JT Crowley. Streamed across top platforms including Roku, Amazon Fire TV, YouTube, ExpertsandAuthors.tv, and WebTalkRadio.net.
                            </li>
                            <li>
                              <strong>Audio Podcast Distribution:</strong> An audio-only podcast version available on Apple Podcasts, Spotify, iHeartRadio, and major aggregators worldwide.
                            </li>
                            <li>
                              <strong>Social Media Promotion:</strong> Dedicated social media spotlight featuring your interview across active community channels.
                            </li>
                            <li>
                              <strong>Promotional Asset Delivery:</strong> A shareable link and video asset to embed on your website and use throughout your promotional campaigns.
                            </li>
                          </ul>
                        </div>

                        <div className="p-3.5 mb-0 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                          <h6 className="fw-bold mb-1" style={{ color: '#2b2219', fontSize: '0.92rem' }}>
                            About Host JT Crowley:
                          </h6>
                          <p className="mb-0" style={{ color: '#57534e', fontSize: '0.9rem', lineHeight: '1.65' }}>
                            JT Crowley is a British author whose global adventures and storytelling passion shape every interview. Join him on <em>Talking Books</em> as he dives deep with authors into the inspiration and craft behind their stories.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'indie-book-review-bundle' ? (
                    /* Indie Book Review Bundle (NO PRICE, NO CHECKLIST) */
                    <div className="indie-book-review-bundle-detail-content">
                      <div className="editorial-callout-notice p-3 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                        <p className="fst-italic mb-0 fw-medium" style={{ color: '#57534e', fontSize: '0.92rem' }}>
                          As a self-published author in the competitive literary industry, securing as many book reviews as you can get helps you stand out. Partner with the pros at BookLife by Publishers Weekly.
                        </p>
                      </div>

                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          BookLife is a website created by <em>Publishers Weekly</em> that focuses on supporting independent authors. The Indie Book Review Bundle gives you a comprehensive review crafted by professional <em>Publishers Weekly</em> reviewers under the BookLife Reviews brand, paired with high-impact industry marketing campaigns.
                        </p>

                        <div className="p-3.5 mb-4 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                          <h6 className="fw-bold mb-2" style={{ color: '#2b2219', fontSize: '0.96rem' }}>
                            Extensive BookLife Review Inclusions:
                          </h6>
                          <ul className="mb-0 ps-3" style={{ color: '#57534e', fontSize: '0.92rem', lineHeight: '1.75' }}>
                            <li>
                              <strong>Comprehensive 300-Word Review:</strong> Covers plot summary, critique, and in-depth analysis of your book, including an assessment of target readership.
                            </li>
                            <li>
                              <strong>One-Sentence Takeaway:</strong> An honest, positive headline takeaway summarizing the reviewer's opinion of your book's best aspects.
                            </li>
                            <li>
                              <strong>Comparison (Comp) Titles & Authors:</strong> Strategic list of comparable books and authors for commercial positioning.
                            </li>
                            <li>
                              <strong>Production Letter Grades (A+ to C):</strong> Objective grading across five production elements: cover art, interior design and typography, illustrations, editing, and marketing copy.
                            </li>
                          </ul>
                        </div>

                        <div className="p-3.5 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                          <h6 className="fw-bold mb-2" style={{ color: '#2b2219', fontSize: '0.96rem' }}>
                            Digital & Print Advertising Campaigns:
                          </h6>
                          <ul className="mb-0 ps-3" style={{ color: '#57534e', fontSize: '0.92rem', lineHeight: '1.75' }}>
                            <li>
                              <strong>PublishersWeekly.com Banner Ad:</strong> 10,000 guaranteed impressions across PublishersWeekly.com, which reaches over 14 million annual unique visitors.
                            </li>
                            <li>
                              <strong>Publishers Weekly Supplement Ad (1 of 8 slot):</strong> Your book ad appears in an official stand-alone conference supplement (e.g. Winter Institute, Children’s Institute, Star Watch, or AAR & SBL) and is center-stitched to the print magazine reaching 68,000 subscribers.
                            </li>
                            <li>
                              <strong>Database Archiving:</strong> Review submitted to major book trade databases including EBSCO, Ingram, and ProQuest, accessible to bookstores and libraries globally.
                            </li>
                          </ul>
                        </div>

                        <div className="p-3 mb-0 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                          <p className="mb-0" style={{ color: '#57534e', fontSize: '0.88rem', lineHeight: '1.65' }}>
                            <em>*Guidelines: Suitable for English-language books up to 150,000 words that are commercially available in the US. Author maintains complete publishing control on BookLife.com.</em>
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'literary-gateway-bundle' ? (
                    /* Literary Gateway Bundle (NO PRICE, NO CHECKLIST) */
                    <div className="literary-gateway-bundle-detail-content">
                      <div className="editorial-callout-notice p-3 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                        <p className="fst-italic mb-0 fw-medium" style={{ color: '#57534e', fontSize: '0.92rem' }}>
                          With Literary Gateway, get a mix of services designed to put you at the forefront of award opportunities to help build your author brand.
                        </p>
                      </div>

                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          A book award is more than a feather in your cap—it makes books noticeably more valuable in the eyes of consumers, media, and retailers. Omni simplifies award matching and submission while securing professional editorial praise for your title.
                        </p>

                        <div className="p-3.5 mb-4 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                          <h6 className="fw-bold mb-2" style={{ color: '#2b2219', fontSize: '0.96rem' }}>
                            Literary Gateway Inclusions:
                          </h6>
                          <ul className="mb-0 ps-3" style={{ color: '#57534e', fontSize: '0.92rem', lineHeight: '1.75' }}>
                            <li>
                              <strong>6 Months Access to Awards Finder:</strong> Intelligent award-matching platform identifying 1 award opportunity weekly (24+ opportunities). Each month, Awards Finder selects the best match, prepares your nomination package, and handles entry submission on your behalf.
                            </li>
                            <li>
                              <strong>Objective BlueInk Review:</strong> A 250–300 word professional critique by BlueInk Review—founded by an internationally known literary agent and an award-winning review editor to celebrate the best of independent publishing.
                            </li>
                            <li>
                              <strong>BookMad Magazine Feature Eligibility:</strong> Award-winning titles are eligible for a spotlight feature in BookMad Magazine and announced across official social media pages.
                            </li>
                            <li>
                              <strong>Cover Resubmission Included:</strong> Free cover revision to proudly integrate your review pull quotes and/or official award seals.
                            </li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'review-duo' ? (
                    /* Review Duo (NO PRICE, NO CHECKLIST) */
                    <div className="review-duo-detail-content">
                      <div className="editorial-callout-notice p-3 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                        <p className="fst-italic mb-0 fw-medium" style={{ color: '#57534e', fontSize: '0.92rem' }}>
                          Spark readers’ interest and build credibility for your book with the Review Duo service. Receive professional, unbiased assessments from two esteemed industry review platforms.
                        </p>
                      </div>

                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          Reviews from trusted industry professionals establish essential social proof for your title across retail and distribution channels.
                        </p>

                        <div className="p-3.5 mb-4 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                          <h6 className="fw-bold mb-2" style={{ color: '#2b2219', fontSize: '0.96rem' }}>
                            Review Duo Package Inclusions:
                          </h6>
                          <ul className="mb-0 ps-3" style={{ color: '#57534e', fontSize: '0.92rem', lineHeight: '1.75' }}>
                            <li>
                              <strong>Pacific Book Review (PBR):</strong> Authoritative, objective critique written by specialists selected for their genre expertise, circulated to industry professionals via monthly newsletter and social networks.
                            </li>
                            <li>
                              <strong>The US Review of Books (USRB):</strong> Professional review introduced to more than 14,000 subscribers in the USRB monthly newsletter and showcased on their website.
                            </li>
                            <li>
                              <strong>Entry to the Eric Hoffer Award:</strong> Entry to one of the most prestigious independent book awards recognizing salient writing and small-publisher spirit.
                            </li>
                            <li>
                              <strong>Entry to the Pacific Book Awards:</strong> Celebrates outstanding excellence across print and electronic literature.
                            </li>
                            <li>
                              <strong>Free Cover Revision Option:</strong> Update your cover layout to incorporate excerpted review quotes at no additional charge.
                            </li>
                          </ul>
                        </div>

                        <div className="p-3 mb-0 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                          <p className="mb-0" style={{ color: '#57534e', fontSize: '0.88rem', lineHeight: '1.65' }}>
                            <em>Please Note: If a returned review is unfavorable, you may choose not to use it in your promotional materials; review service fees are non-refundable.</em>
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'review-duo-plus' ? (
                    /* Review Duo Plus (NO PRICE, NO CHECKLIST) */
                    <div className="review-duo-plus-detail-content">
                      <div className="editorial-callout-notice p-3 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                        <p className="fst-italic mb-0 fw-medium" style={{ color: '#57534e', fontSize: '0.92rem' }}>
                          Spark readers’ interest and build credibility for your book with the Review Duo Plus service, featuring dual authoritative reviews, two award entries, and a syndicated radio broadcast.
                        </p>
                      </div>

                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          Review Duo Plus builds upon our popular review package by adding premier digital visibility and syndicated audio broadcast reach.
                        </p>

                        <div className="p-3.5 mb-4 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                          <h6 className="fw-bold mb-2" style={{ color: '#2b2219', fontSize: '0.96rem' }}>
                            Review Duo Plus Inclusions:
                          </h6>
                          <ul className="mb-0 ps-3" style={{ color: '#57534e', fontSize: '0.92rem', lineHeight: '1.75' }}>
                            <li>
                              <strong>Pacific Book Review (PBR):</strong> Objective, specialist review promoted across industry networks and monthly newsletters.
                            </li>
                            <li>
                              <strong>The US Review of Books (USRB):</strong> Review sent to 14,000+ newsletter subscribers plus <strong>one month featured placement</strong> in the Featured Book Reviews section of USRB.
                            </li>
                            <li>
                              <strong>10-15 Minute Online Radio Interview:</strong> Syndicated broadcast via iTunes and Toginet.com, available for download on mobile devices and repurposing across your author marketing.
                            </li>
                            <li>
                              <strong>Entry to the Eric Hoffer Award:</strong> Official nomination for the prestigious Hoffer Award.
                            </li>
                            <li>
                              <strong>Entry to the Pacific Book Awards:</strong> Official nomination celebrating excellence in modern publishing.
                            </li>
                            <li>
                              <strong>Free Cover Revision:</strong> Complimentary cover redesign to include review pull quotes and award honors.
                            </li>
                          </ul>
                        </div>

                        <div className="p-3 mb-0 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                          <p className="mb-0" style={{ color: '#57534e', fontSize: '0.88rem', lineHeight: '1.65' }}>
                            <em>Please Note: If a returned review is unfavorable, you may choose not to use it in your promotional materials; review service fees are non-refundable.</em>
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'the-trifecta-review-service' ? (
                    /* The Trifecta Review Service (NO PRICE, NO CHECKLIST) */
                    <div className="the-trifecta-review-service-detail-content">
                      <div className="editorial-callout-notice p-3 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                        <p className="fst-italic mb-0 fw-medium" style={{ color: '#57534e', fontSize: '0.92rem' }}>
                          Get unbiased and professional reviews from three esteemed publications. With the Omni Trifecta Review Service, your marketing efforts receive an elite boost in the competitive marketplace.
                        </p>
                      </div>

                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          A review can profoundly influence the market’s awareness toward your book. The Trifecta Review Service brings together three of the most influential authorities in the literary review landscape.
                        </p>

                        <div className="p-3.5 mb-4 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                          <h6 className="fw-bold mb-2" style={{ color: '#2b2219', fontSize: '0.96rem' }}>
                            The Three Esteemed Reviews:
                          </h6>
                          <ul className="mb-0 ps-3" style={{ color: '#57534e', fontSize: '0.92rem', lineHeight: '1.75' }}>
                            <li>
                              <strong>Kirkus Indie:</strong> Among the world’s most acclaimed and authoritative book review providers, delivering honest, fair, and respected critiques that open doors to bookstore shelves and media attention.
                            </li>
                            <li>
                              <strong>Clarion Review-for-Fee:</strong> ForeWord Magazine’s prestigious review service that heavily influences buying decisions of booksellers and public librarians across the country.
                            </li>
                            <li>
                              <strong>BlueInk Review:</strong> Founded by an internationally respected literary agent and an award-winning book review editor to provide honest, vetting-driven reviews exclusively for independent authors.
                            </li>
                          </ul>
                        </div>

                        <div className="p-3.5 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                          <h6 className="fw-bold mb-2" style={{ color: '#2b2219', fontSize: '0.96rem' }}>
                            Print Magazine Placement & Cover Update:
                          </h6>
                          <ul className="mb-0 ps-3" style={{ color: '#57534e', fontSize: '0.92rem', lineHeight: '1.75' }}>
                            <li>
                              <strong>Kirkus Reviews Magazine (1 of 8 slot):</strong> National print visibility with a black-and-white advertisement inside the pages of <em>Kirkus Reviews</em> magazine.
                            </li>
                            <li>
                              <strong>Complimentary Cover Revision:</strong> Update your cover layout to feature excerpts from your reviews at no additional cost.
                            </li>
                          </ul>
                        </div>

                        <div className="p-3 mb-0 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                          <p className="mb-0" style={{ color: '#57534e', fontSize: '0.88rem', lineHeight: '1.65' }}>
                            <em>Please Note: If a returned review is unfavorable, the author can choose not to use it in marketing efforts; review fees are non-refundable.</em>
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'join-the-la-times-festival-of-books-2025' ? (
                    /* Join the LA Times Festival of Books 2025! (NO PRICE, NO CHECKLIST) */
                    <div className="la-times-festival-detail-content">
                      <div className="editorial-callout-notice p-3 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                        <p className="fst-italic mb-0 fw-medium" style={{ color: '#57534e', fontSize: '0.92rem' }}>
                          Get ready to celebrate the 30th anniversary of the L.A. Times Festival of Books on April 26–27, 2025 at the University of Southern California campus in Los Angeles.
                        </p>
                      </div>

                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          The Los Angeles Times Festival of Books is one of the largest and most prestigious book festivals in the United States, attracting more than 150,000 booklovers and media members each year. Since its debut in 1996, the festival has joined literature lovers with hundreds of booksellers, publishers, and literary organizations. The LA Times Festival of Books 2025 is your chance to meet face-to-face with potential readers and promote your book at this major industry event.
                        </p>

                        <div className="row g-3 mb-4">
                          <div className="col-md-6">
                            <div className="p-3 rounded-3 h-100" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                              <h6 className="fw-bold mb-2" style={{ color: '#2b2219', fontSize: '0.94rem' }}>
                                <i className="bi bi-calendar-event me-2 text-warning"></i>Event Information
                              </h6>
                              <ul className="mb-0 ps-3" style={{ color: '#57534e', fontSize: '0.88rem', lineHeight: '1.65' }}>
                                <li><strong>Occasion:</strong> 30th Anniversary Celebration</li>
                                <li><strong>Dates:</strong> April 26–27, 2025</li>
                                <li><strong>Location:</strong> University of Southern California (USC) Campus, Los Angeles, CA</li>
                                <li><strong>Audience:</strong> 150,000+ avid readers, authors, publishers, and media members</li>
                              </ul>
                            </div>
                          </div>
                          <div className="col-md-6">
                            <div className="p-3 rounded-3 h-100" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                              <h6 className="fw-bold mb-2" style={{ color: '#2b2219', fontSize: '0.94rem' }}>
                                <i className="bi bi-geo-alt me-2 text-warning"></i>Major Industry Event
                              </h6>
                              <p className="mb-0" style={{ color: '#57534e', fontSize: '0.88rem', lineHeight: '1.65' }}>
                                A premier cultural gathering since 1996, uniting readers, independent authors, national retailers, and literary tastemakers in the heart of Southern California.
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="p-3.5 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                          <h6 className="fw-bold mb-2" style={{ color: '#2b2219', fontSize: '0.96rem' }}>
                            Participation Options Available:
                          </h6>
                          <div className="d-flex flex-column gap-3">
                            <div className="p-3 rounded-2" style={{ background: '#ffffff', border: '1px solid #ebd9c4' }}>
                              <strong className="d-block mb-1" style={{ color: '#2b2219', fontSize: '0.92rem' }}>
                                <i className="bi bi-book me-2 text-warning"></i>Author Solutions Bookstore Gallery
                              </strong>
                              <p className="mb-0" style={{ color: '#57534e', fontSize: '0.88rem', lineHeight: '1.6' }}>
                                Showcase your book for crowds of avid readers to discover by displaying it in the official Bookstore Gallery throughout the two-day festival. Attendees can browse, examine your book, and purchase copies on-site.
                              </p>
                            </div>

                            <div className="p-3 rounded-2" style={{ background: '#ffffff', border: '1px solid #ebd9c4' }}>
                              <strong className="d-block mb-1" style={{ color: '#2b2219', fontSize: '0.92rem' }}>
                                <i className="bi bi-pen me-2 text-warning"></i>Live Author Book Signing
                              </strong>
                              <p className="mb-0" style={{ color: '#57534e', fontSize: '0.88rem', lineHeight: '1.6' }}>
                                Be the star of your own book signing at the Author Solutions booth. Engage directly with book lovers, answer questions, pose for photos, and personalize autographs for your readers.
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="p-3 mb-0 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                          <p className="mb-0" style={{ color: '#57534e', fontSize: '0.88rem', lineHeight: '1.65' }}>
                            <em>*Notice: Contact your marketing consultant to find out more about these options. Spots will be filled on a first-come, first-served basis, so don't wait.</em>
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'hollywood-coverage' ? (
                    /* Hollywood Coverage (NO PRICE, NO CHECKLIST) */
                    <div className="hollywood-coverage-detail-content">
                      <div className="editorial-callout-notice p-3 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                        <p className="fst-italic mb-0 fw-medium" style={{ color: '#57534e', fontSize: '0.92rem' }}>
                          If you’ve ever wondered—even for a moment—if your book could be turned into a movie, Hollywood Coverage is the most cost-effective service that will help you answer that question.
                        </p>
                      </div>

                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          A professional reader will develop your book’s coverage, the standard evaluation format used across the movie and television industry. Coverage provides studio executives, producers, and literary agents with a clear, concise appraisal of your story’s cinematic viability.
                        </p>

                        <div className="p-3.5 mb-4 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                          <h6 className="fw-bold mb-2" style={{ color: '#2b2219', fontSize: '0.96rem' }}>
                            Your Hollywood Coverage Elements:
                          </h6>
                          <ul className="mb-0 ps-3" style={{ color: '#57534e', fontSize: '0.92rem', lineHeight: '1.75' }}>
                            <li>
                              <strong>Thorough Synopsis:</strong> Highlights the main characters, pivotal plot points, dramatic arc, and major events in your story.
                            </li>
                            <li>
                              <strong>Critical Analysis:</strong> Professional evaluation addressing key story mechanics, thematic resonance, character development, and specific recommendations on how your manuscript can be adapted for the screen.
                            </li>
                          </ul>
                        </div>

                        <div className="p-3.5 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                          <h6 className="fw-bold mb-2" style={{ color: '#2b2219', fontSize: '0.96rem' }}>
                            Studio Consideration & Database Placement:
                          </h6>
                          <ul className="mb-0 ps-3" style={{ color: '#57534e', fontSize: '0.92rem', lineHeight: '1.75' }}>
                            <li>
                              <strong>5 More Minutes First-Look Consideration:</strong> Once completed, your coverage is submitted to our first-look production partner, 5 More Minutes, led by veteran studio executive John Sacchi. If interested, they will reach out directly to discuss potential adaptation.
                            </li>
                            <li>
                              <strong>Hollywood Database Access:</strong> If 5 More Minutes chooses not to option your project, your coverage is archived into our exclusive Hollywood Database where certified directors, producers, actors, and agents actively scout for fresh literary concepts.
                            </li>
                          </ul>
                        </div>

                        <div className="p-3 mb-4 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                          <h6 className="fw-bold mb-1" style={{ color: '#2b2219', fontSize: '0.92rem' }}>
                            About 5 More Minutes & John Sacchi:
                          </h6>
                          <p className="mb-0" style={{ color: '#57534e', fontSize: '0.88rem', lineHeight: '1.65' }}>
                            5 More Minutes is a full-service production shingle run by veteran Hollywood executive John Sacchi, who spent 15 years as a senior production and development executive at Lionsgate Films. His career credits include <em>Akeelah and the Bee</em>, <em>Confidence</em>, <em>Employee of the Month</em>, <em>The Possession</em>, <em>Punisher</em>, as well as current adaptations like Lionsgate’s <em>Dork Diaries</em> and <em>Rogues Gallery</em>.
                          </p>
                        </div>

                        <div className="p-3 mb-0 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                          <p className="mb-0" style={{ color: '#57534e', fontSize: '0.88rem', lineHeight: '1.65' }}>
                            <em>*Your Hollywood Coverage will be fulfilled by an independent industry professional who conducts evaluations for major agencies and studios. Omni Virtual Solutions has no input regarding the critical analysis and cannot guarantee specific option results.</em>
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'hollywood-treatment' ? (
                    /* Hollywood Treatment (NO PRICE, NO CHECKLIST) */
                    <div className="hollywood-treatment-detail-content">
                      <div className="editorial-callout-notice p-3 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                        <p className="fst-italic mb-0 fw-medium" style={{ color: '#57534e', fontSize: '0.92rem' }}>
                          Your book has all the elements Hollywood wants—an exciting plot, well-developed characters, and fresh content—yet there’s still a crucial piece you need in order to be taken seriously by established entertainment executives: a professional treatment.
                        </p>
                      </div>

                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          A treatment is a thoroughly developed guide that outlines how a screenwriter would adapt your book into a fully-developed screenplay. As the framework used to transform your work into another medium, Hollywood Treatment is the essential first step to drafting a screenplay. By defining exactly how a screenwriter will approach the adaptation, you give agents, studios, and producers a direct shortcut to the cinematic essence of your book.
                        </p>

                        <div className="p-3.5 mb-4 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                          <h6 className="fw-bold mb-2" style={{ color: '#2b2219', fontSize: '0.96rem' }}>
                            How Hollywood Treatment Works:
                          </h6>
                          <ul className="mb-0 ps-3" style={{ color: '#57534e', fontSize: '0.92rem', lineHeight: '1.75' }}>
                            <li>
                              <strong>Screenwriter Matching:</strong> We match you with an experienced professional screenwriter from our industry network whose background best complements your book’s genre and voice.
                            </li>
                            <li>
                              <strong>Comprehensive 5 to 10-Page Treatment:</strong> Your screenwriter crafts a detailed treatment outlining the three-act structure, scene progressions, and character dynamics tailored for feature film or television.
                            </li>
                            <li>
                              <strong>100% Rights & Story Ownership:</strong> The screenwriter waives all rights to the treatment, ensuring you maintain full, complete ownership of your story and conceptual property.
                            </li>
                          </ul>
                        </div>

                        <div className="p-3.5 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                          <h6 className="fw-bold mb-2" style={{ color: '#2b2219', fontSize: '0.96rem' }}>
                            Studio Consideration & Database Placement:
                          </h6>
                          <ul className="mb-0 ps-3" style={{ color: '#57534e', fontSize: '0.92rem', lineHeight: '1.75' }}>
                            <li>
                              <strong>5 More Minutes First Look:</strong> Upon completion, your treatment is submitted to our first-look partner, 5 More Minutes (headed by veteran Lionsgate executive John Sacchi), for TV or film adaptation consideration.
                            </li>
                            <li>
                              <strong>Exclusive Hollywood Database:</strong> If 5 More Minutes does not engage with your concept, your treatment is uploaded to our secure Hollywood Database accessible by entertainment industry producers, directors, agents, and writers.
                            </li>
                          </ul>
                        </div>

                        <div className="p-3 mb-0 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                          <p className="mb-0" style={{ color: '#57534e', fontSize: '0.88rem', lineHeight: '1.65' }}>
                            <em>*Please Note: Hollywood Treatment provides an adaptation blueprint based on your book. Details in plot, pacing, and characters may be adjusted to fit cinematic storytelling. Please do not attempt to contact 5 More Minutes directly, as unauthorized inquiries will result in immediate disqualification from consideration.</em>
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'hollywood-screenplay' ? (
                    /* Hollywood Screenplay (NO PRICE, NO CHECKLIST) */
                    <div className="hollywood-screenplay-detail-content">
                      <div className="editorial-callout-notice p-3 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                        <p className="fst-italic mb-0 fw-medium" style={{ color: '#57534e', fontSize: '0.92rem' }}>
                          Don't just dream about it—take action. If you’re determined to turn your book into a movie or television series, a screenplay is the way to get noticed by Hollywood executives.
                        </p>
                      </div>

                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          A screenplay is a fully fleshed out script that television and movie producers use to evaluate whether an adaptation of your book is something they want to produce. With a professionally adapted screenplay, you make the ultimate marketing push into the entertainment business and demonstrate that your story is production-ready.
                        </p>

                        <div className="p-3.5 mb-4 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                          <h6 className="fw-bold mb-2" style={{ color: '#2b2219', fontSize: '0.96rem' }}>
                            Full Screenplay Adaptation Inclusions:
                          </h6>
                          <ul className="mb-0 ps-3" style={{ color: '#57534e', fontSize: '0.92rem', lineHeight: '1.75' }}>
                            <li>
                              <strong>Script Adapted from Approved Treatment:</strong> A seasoned industry screenwriter crafts a feature-length or television pilot script adhering strictly to your approved Hollywood Treatment.
                            </li>
                            <li>
                              <strong>Dialogue & Dramatic Action:</strong> Fully formatted script with authentic character dialogue, scene transitions, dramatic tension, and atmospheric scene descriptions meeting Hollywood studio standards.
                            </li>
                            <li>
                              <strong>Complete Author Ownership:</strong> The screenwriter waives all copyright and writing rights to the screenplay; you retain 100% intellectual property ownership.
                            </li>
                          </ul>
                        </div>

                        <div className="p-3.5 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                          <h6 className="fw-bold mb-2" style={{ color: '#2b2219', fontSize: '0.96rem' }}>
                            Hollywood Studio Evaluation & Database Inclusions:
                          </h6>
                          <ul className="mb-0 ps-3" style={{ color: '#57534e', fontSize: '0.92rem', lineHeight: '1.75' }}>
                            <li>
                              <strong>5 More Minutes First Look:</strong> Your completed script is delivered directly to John Sacchi’s production shingle, 5 More Minutes, for adaptation consideration.
                            </li>
                            <li>
                              <strong>Exclusive Hollywood Database:</strong> If 5 More Minutes decides not to acquire your screenplay, it is entered into our industry database accessible to verified producers, directors, agents, and studio representatives.
                            </li>
                          </ul>
                        </div>

                        <div className="p-3 mb-0 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                          <p className="mb-0" style={{ color: '#57534e', fontSize: '0.88rem', lineHeight: '1.65' }}>
                            <em>*Prerequisite Notice: An approved Hollywood Treatment is a required prerequisite for Hollywood Screenplay. Please speak with your consultant if you have not yet completed a treatment. Please do not attempt to contact 5 More Minutes directly.</em>
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'sem-1000-clicks' ? (
                    /* SEM - 1000 clicks (NO PRICE, NO CHECKLIST) */
                    <div className="sem-1000-clicks-detail-content">
                      <div className="editorial-callout-notice p-3 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                        <p className="fst-italic mb-0 fw-medium" style={{ color: '#57534e', fontSize: '0.92rem' }}>
                          The digital age gives you the power of immediate connection. Attract potential readers and drive guaranteed visitors directly to your website with Google Search Engine Marketing.
                        </p>
                      </div>

                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          With our SEM service, you can attract potential readers and drive high-intent traffic to your website with the help of the world's leading search engine. Your ad will be strategically placed on Google search result pages when readers query words and phrases related to your book's themes and genre.
                        </p>

                        <div className="p-3.5 mb-4 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                          <h6 className="fw-bold mb-2" style={{ color: '#2b2219', fontSize: '0.96rem' }}>
                            Campaign Inclusions:
                          </h6>
                          <ul className="mb-0 ps-3" style={{ color: '#57534e', fontSize: '0.92rem', lineHeight: '1.75' }}>
                            <li>
                              <strong>1,000 Guaranteed Clicks:</strong> High-intent web users delivered directly to the author landing page or retail website of your choice.
                            </li>
                            <li>
                              <strong>Up to 20 Tailored Keywords:</strong> Selection of up to 20 strategic search keywords and phrases aligned with your book’s genre and audience.
                            </li>
                            <li>
                              <strong>Comprehensive Analytics Reporting:</strong> Detailed post-campaign reporting showing individual keyword performance, click-through metrics, and traffic volume to inform future marketing.
                            </li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'social-media-30-day-content-plan' ? (
                    /* Social Media 30-day Content Plan (NO PRICE, NO CHECKLIST) */
                    <div className="social-content-plan-detail-content">
                      <div className="editorial-callout-notice p-3 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                        <p className="fst-italic mb-0 fw-medium" style={{ color: '#57534e', fontSize: '0.92rem' }}>
                          Ready to ignite a dynamic conversation about your book's release? Our 30-Day Social Media Content Schedule provides turnkey collateral for each day leading up to your big launch.
                        </p>
                      </div>

                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          Building a social media identity that encapsulates your book demands both time and expertise. This service delivers ready-made visual assets, compelling captions, and strategic roadmaps so you can focus entirely on your writing.
                        </p>

                        <div className="p-3.5 mb-4 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                          <h6 className="fw-bold mb-2" style={{ color: '#2b2219', fontSize: '0.96rem' }}>
                            Content Schedule Inclusions:
                          </h6>
                          <ul className="mb-0 ps-3" style={{ color: '#57534e', fontSize: '0.92rem', lineHeight: '1.75' }}>
                            <li>
                              <strong>Weekly Goals:</strong> Scheduled milestones that dovetail with your promotional timeline to generate escalating curiosity.
                            </li>
                            <li>
                              <strong>Daily Visuals & Graphics:</strong> Professionally designed custom graphics for all 30 days capturing your book’s unique branding.
                            </li>
                            <li>
                              <strong>Engaging Captions:</strong> Compelling post copy with intuitive calls-to-action crafted to spark comments, shares, and reader connections.
                            </li>
                            <li>
                              <strong>Book Snippets & Teasers:</strong> Highlight the most enticing passages of your story paired with striking visual cards.
                            </li>
                            <li>
                              <strong>Hashtag Selection & Caption Guidance:</strong> Curated hashtag recommendations and personalization advice to expand discoverability.
                            </li>
                            <li>
                              <strong>Engagement Strategies:</strong> Proven conversational prompts and community-building techniques.
                            </li>
                          </ul>
                        </div>

                        <div className="p-3 mb-0 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                          <p className="mb-0" style={{ color: '#57534e', fontSize: '0.88rem', lineHeight: '1.65' }}>
                            <em>*Note: This service delivers complete creative collateral and scheduling; it does not cover manual account posting or daily management.</em>
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'social-media-30-day-strategy' ? (
                    /* Social Media 30-day Strategy (NO PRICE, NO CHECKLIST) */
                    <div className="social-strategy-detail-content">
                      <div className="editorial-callout-notice p-3 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                        <p className="fst-italic mb-0 fw-medium" style={{ color: '#57534e', fontSize: '0.92rem' }}>
                          Maximize the impact and visibility of your book with our 30-Day Social Media Strategy—a step-by-step weekly plan rich with creative content suggestions and hashtags.
                        </p>
                      </div>

                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          Ideal for authors launching a debut novel, revitalizing a backlist title, or preparing a sequel. We equip you with a magnetic content roadmap reflecting the latest social media trends.
                        </p>

                        <div className="p-3.5 mb-4 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                          <h6 className="fw-bold mb-2" style={{ color: '#2b2219', fontSize: '0.96rem' }}>
                            Strategic Framework Elements:
                          </h6>
                          <ul className="mb-0 ps-3" style={{ color: '#57534e', fontSize: '0.92rem', lineHeight: '1.75' }}>
                            <li>
                              <strong>Targeted Weekly Goals:</strong> Structured roadmap setting early anticipation and accelerating reader interest toward launch day.
                            </li>
                            <li>
                              <strong>Daily Content Ideas:</strong> Individually crafted concepts showcasing story themes, character backstories, and behind-the-scenes insights.
                            </li>
                            <li>
                              <strong>Bespoke Hashtag Guidance:</strong> Genre-specific hashtag recommendations to reach enthusiastic reader demographics across platforms.
                            </li>
                            <li>
                              <strong>Audience Engagement Techniques:</strong> Practical techniques to cultivate conversations and convert casual followers into loyal readers.
                            </li>
                          </ul>
                        </div>

                        <div className="p-3 mb-0 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                          <p className="mb-0" style={{ color: '#57534e', fontSize: '0.88rem', lineHeight: '1.65' }}>
                            <em>*Note: This strategy provides planning, calendars, and textual prompts; graphical design and individual post uploads are not included.</em>
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'kirkus-title-express' ? (
                    /* Kirkus Title Express (NO PRICE, NO CHECKLIST) */
                    <div className="kirkus-title-express-detail-content">
                      <div className="editorial-callout-notice p-3 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                        <p className="fst-italic mb-0 fw-medium" style={{ color: '#57534e', fontSize: '0.92rem' }}>
                          Collaborating with a revered literary authority like Kirkus Reviews provides instant credibility and global reach for your online giveaway campaign.
                        </p>
                      </div>

                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          Founded in 1933, Kirkus Reviews garners 2.6 million monthly website impressions and 65,000 email subscribers. Kirkus Title Express embeds your book into an official Kirkus online giveaway with full promotional support.
                        </p>

                        <div className="p-3.5 mb-4 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                          <h6 className="fw-bold mb-2" style={{ color: '#2b2219', fontSize: '0.96rem' }}>
                            Service Inclusions:
                          </h6>
                          <ul className="mb-0 ps-3" style={{ color: '#57534e', fontSize: '0.92rem', lineHeight: '1.75' }}>
                            <li>
                              <strong>Two-Week Online Giveaway:</strong> Prominent listing inside Kirkus’s curated Online Giveaways section.
                            </li>
                            <li>
                              <strong>100 Digital BookStub™ Codes:</strong> Secure download codes allowing 100 readers to claim a complimentary digital copy of your e-book.
                            </li>
                            <li>
                              <strong>Homepage & Newsletter Ad:</strong> Standard side box advertisement on the Kirkus.com homepage and featured in one issue of Kirkus's <em>Critic’s Picks</em> email newsletter.
                            </li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'online-booksellers-advertising' ? (
                    /* Online Booksellers Advertising (NO PRICE, NO CHECKLIST) */
                    <div className="online-booksellers-advertising-detail-content">
                      <div className="editorial-callout-notice p-3 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                        <p className="fst-italic mb-0 fw-medium" style={{ color: '#57534e', fontSize: '0.92rem' }}>
                          Put your book in front of consumer readers on Amazon and professional trade buyers on Ingram's ipage platform.
                        </p>
                      </div>

                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          Cover the most critical book-marketing ground by advertising across both consumer and trade retail hubs. Amazon reaches 181 million monthly unique visitors, while Ingram's ipage is accessed daily by over 50,000 retailers, librarians, and educators.
                        </p>

                        <div className="p-3.5 mb-4 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                          <h6 className="fw-bold mb-2" style={{ color: '#2b2219', fontSize: '0.96rem' }}>
                            Dual-Channel Advertising Elements:
                          </h6>
                          <ul className="mb-0 ps-3" style={{ color: '#57534e', fontSize: '0.92rem', lineHeight: '1.75' }}>
                            <li>
                              <strong>Banner Ad Campaign on Amazon:</strong> Showcase your book cover in a targeted banner ad delivering 500,000 guaranteed impressions across Amazon.
                            </li>
                            <li>
                              <strong>Banner Ad Campaign on Ingram’s ipage:</strong> Featured cover placement on a specialized title landing page with a two-week accompanying banner ad on ipage, directly reaching retail booksellers and institutional acquisitions staff.
                            </li>
                          </ul>
                        </div>

                        <div className="p-3 mb-0 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                          <p className="mb-0" style={{ color: '#57534e', fontSize: '0.88rem', lineHeight: '1.65' }}>
                            <em>*Requirements: Best suited for books available in both paperback and ebook formats; title must be listed as returnable in the Ingram distribution catalog.</em>
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'e-book-promo-venture-30-days' ? (
                    /* E-book Promo Venture - 30 days (NO PRICE, NO CHECKLIST) */
                    <div className="ebook-promo-venture-detail-content">
                      <div className="editorial-callout-notice p-3 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                        <p className="fst-italic mb-0 fw-medium" style={{ color: '#57534e', fontSize: '0.92rem' }}>
                          Tap into the excitement of bargain book sales. Mark down your Kindle edition for a limited promotional window and amplify discoverability with BookBub and Facebook.
                        </p>
                      </div>

                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          Discount promotions trigger massive downloading velocity and improve sales ranking. We coordinate the price adjustment and deliver 30 days of continuous exposure to enthusiastic readers.
                        </p>

                        <div className="p-3.5 mb-4 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                          <h6 className="fw-bold mb-2" style={{ color: '#2b2219', fontSize: '0.96rem' }}>
                            Venture Package Inclusions:
                          </h6>
                          <ul className="mb-0 ps-3" style={{ color: '#57534e', fontSize: '0.92rem', lineHeight: '1.75' }}>
                            <li>
                              <strong>Kindle Promotional Price Markdown:</strong> Coordinated limited-time discount on Amazon to drive rapid reader adoption.
                            </li>
                            <li>
                              <strong>BookBub Daily Email Campaign (30 Days):</strong> Placement of your book ad in BookBub’s daily recommendation blasts reaching millions of subscriber inboxes.
                            </li>
                            <li>
                              <strong>Facebook Genre Ad Campaign (30 Days):</strong> Your ebook ad featured alongside genre titles on Facebook for 30 consecutive days.
                            </li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'e-book-promo-launcher' ? (
                    /* E-book Promo Launcher (NO PRICE, NO CHECKLIST) */
                    <div className="ebook-promo-launcher-detail-content">
                      <div className="editorial-callout-notice p-3 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                        <p className="fst-italic mb-0 fw-medium" style={{ color: '#57534e', fontSize: '0.92rem' }}>
                          Triple-channel promotional power: combine a limited-time Kindle markdown with 30 days of continuous advertising across BookBub, Facebook, and Amazon.com.
                        </p>
                      </div>

                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          The Launcher package expands on our popular promo venture by putting your promotional bargain ad directly on the storefront of the world's largest online bookseller.
                        </p>

                        <div className="p-3.5 mb-4 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                          <h6 className="fw-bold mb-2" style={{ color: '#2b2219', fontSize: '0.96rem' }}>
                            Launcher Package Inclusions:
                          </h6>
                          <ul className="mb-0 ps-3" style={{ color: '#57534e', fontSize: '0.92rem', lineHeight: '1.75' }}>
                            <li>
                              <strong>Kindle Promotional Markdown:</strong> Coordinated limited-time promotional pricing on Amazon.
                            </li>
                            <li>
                              <strong>BookBub Daily Email Campaign (30 Days):</strong> Featured ad placement in BookBub's daily email blasts.
                            </li>
                            <li>
                              <strong>Facebook Targeted Ad Campaign (30 Days):</strong> Genre-targeted ad rotation reaching active mobile and desktop readers.
                            </li>
                            <li>
                              <strong>Amazon.com Direct Ad Placement (30 Days):</strong> Premium banner ad placement running natively on Amazon.com for 30 full days.
                            </li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'social-media-advertising-basic' ? (
                    /* Social Media Advertising Basic (NO PRICE, NO CHECKLIST) */
                    <div className="social-ad-basic-detail-content">
                      <div className="editorial-callout-notice p-3 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                        <p className="fst-italic mb-0 fw-medium" style={{ color: '#57534e', fontSize: '0.92rem' }}>
                          Put your book directly in front of targeted readers on Facebook and Instagram with at least 1 million guaranteed impressions.
                        </p>
                      </div>

                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          Cut through online clutter with precise demographic and interest targeting across the world's most engaged social networks.
                        </p>

                        <div className="p-3.5 mb-4 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                          <h6 className="fw-bold mb-2" style={{ color: '#2b2219', fontSize: '0.96rem' }}>
                            Basic Package Inclusions:
                          </h6>
                          <ul className="mb-0 ps-3" style={{ color: '#57534e', fontSize: '0.92rem', lineHeight: '1.75' }}>
                            <li>
                              <strong>Custom Target Audience:</strong> Tailored segmentation identifying potential readers interested in your genre, comparable authors, and subject matter.
                            </li>
                            <li>
                              <strong>At Least 1 Million Impressions:</strong> Image ad displayed over 1,000,000 times in newsfeeds across Facebook and Instagram mobile.
                            </li>
                            <li>
                              <strong>Campaign Monitoring & Optimization:</strong> Ongoing monitoring and campaign management by Omni digital marketing specialists.
                            </li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'social-media-advertising-essential' ? (
                    /* Social Media Advertising Essential (NO PRICE, NO CHECKLIST) */
                    <div className="social-ad-essential-detail-content">
                      <div className="editorial-callout-notice p-3 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                        <p className="fst-italic mb-0 fw-medium" style={{ color: '#57534e', fontSize: '0.92rem' }}>
                          Double your reach with multimedia storytelling: image and short video ads displayed at least 2 million times across Facebook and Instagram.
                        </p>
                      </div>

                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          Video content evokes emotion and drives significantly higher engagement rates. The Essential package combines high-converting image creatives with dynamic video ads.
                        </p>

                        <div className="p-3.5 mb-4 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                          <h6 className="fw-bold mb-2" style={{ color: '#2b2219', fontSize: '0.96rem' }}>
                            Essential Package Inclusions:
                          </h6>
                          <ul className="mb-0 ps-3" style={{ color: '#57534e', fontSize: '0.92rem', lineHeight: '1.75' }}>
                            <li>
                              <strong>Custom Targeted Audience:</strong> Granular audience curation tailored to match readers seeking new books in your genre.
                            </li>
                            <li>
                              <strong>Dual Creative Formats:</strong> Both a custom image ad and a dynamic short video ad created for your book.
                            </li>
                            <li>
                              <strong>At Least 2 Million Impressions:</strong> Minimum 2,000,000 verified impressions across Facebook and Instagram feeds.
                            </li>
                            <li>
                              <strong>End-to-End Ad Campaign Management:</strong> Complete budget optimization, delivery tracking, and campaign oversight.
                            </li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'social-media-advertising-advanced' ? (
                    /* Social Media Advertising Advanced (NO PRICE, NO CHECKLIST) */
                    <div className="social-ad-advanced-detail-content">
                      <div className="editorial-callout-notice p-3 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                        <p className="fst-italic mb-0 fw-medium" style={{ color: '#57534e', fontSize: '0.92rem' }}>
                          Our most robust social advertising campaign: image, video, and interactive mobile ads delivered at least 4 million times across Facebook, Instagram, and the Audience Network.
                        </p>
                      </div>

                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          Expand beyond traditional newsfeeds into thousands of high-traffic mobile applications via Facebook’s Audience Network, surrounding your audience with engaging multi-format creatives.
                        </p>

                        <div className="p-3.5 mb-4 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                          <h6 className="fw-bold mb-2" style={{ color: '#2b2219', fontSize: '0.96rem' }}>
                            Advanced Package Inclusions:
                          </h6>
                          <ul className="mb-0 ps-3" style={{ color: '#57534e', fontSize: '0.92rem', lineHeight: '1.75' }}>
                            <li>
                              <strong>Custom Reader Audience:</strong> Deep-level behavioral and interest targeting to reach passionate book buyers.
                            </li>
                            <li>
                              <strong>Three High-Impact Ad Formats:</strong> Custom image ad, engaging short video ad, and interactive mobile canvas ad.
                            </li>
                            <li>
                              <strong>At Least 4 Million Impressions:</strong> Massive distribution across Facebook, Instagram, and Facebook Audience Network apps.
                            </li>
                            <li>
                              <strong>Dedicated Management & Monitoring:</strong> Professional ad management from setup to campaign completion.
                            </li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'display-advertising-on-google-30-days-package' ? (
                    /* Display Advertising on Google - 30 days Package (NO PRICE, NO CHECKLIST) */
                    <div className="google-display-detail-content">
                      <div className="editorial-callout-notice p-3 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                        <p className="fst-italic mb-0 fw-medium" style={{ color: '#57534e', fontSize: '0.92rem' }}>
                          Consumers spend 95% of their online time exploring websites and content that interest them. Put your book on the Google Display Network across up to 2 million partner sites.
                        </p>
                      </div>

                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          Your book ad is showcased across high-authority websites including YouTube, Gmail, Blogger, and Google Finance, as well as literary blogs and news outlets.
                        </p>

                        <div className="p-3.5 mb-4 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                          <h6 className="fw-bold mb-2" style={{ color: '#2b2219', fontSize: '0.96rem' }}>
                            Display Package Inclusions:
                          </h6>
                          <ul className="mb-0 ps-3" style={{ color: '#57534e', fontSize: '0.92rem', lineHeight: '1.75' }}>
                            <li>
                              <strong>Choice of Ad Formats:</strong> Responsive image with text, text-only, or multi-format display creatives.
                            </li>
                            <li>
                              <strong>30-Day Targeted Placement:</strong> Continuous ad presence across partner websites on the vast Google Display Network.
                            </li>
                            <li>
                              <strong>Precision Demographic Targeting:</strong> Filter by geographic location, age, language, audience interests, reading topics, and relevant keywords.
                            </li>
                            <li>
                              <strong>Bandwidth Coverage Included:</strong> Up to 10 GB of excess monthly bandwidth supported when using your Omni-designed author website as the destination landing page.
                            </li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'sem-advanced-campaign' ? (
                    /* SEM - Advanced Campaign (NO PRICE, NO CHECKLIST) */
                    <div className="sem-advanced-detail-content">
                      <div className="editorial-callout-notice p-3 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                        <p className="fst-italic mb-0 fw-medium" style={{ color: '#57534e', fontSize: '0.92rem' }}>
                          With millions of Google searches made every minute, seize the opportunity to capture high-intent readers with 3 months of premium first-page search ad placement.
                        </p>
                      </div>

                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          When readers search for themes, topics, and genres related to your book, your ad appears prominently on the first page of Google search results—driving visitors directly to your custom author website.
                        </p>

                        <div className="p-3.5 mb-4 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                          <h6 className="fw-bold mb-2" style={{ color: '#2b2219', fontSize: '0.96rem' }}>
                            Advanced Campaign Inclusions:
                          </h6>
                          <ul className="mb-0 ps-3" style={{ color: '#57534e', fontSize: '0.92rem', lineHeight: '1.75' }}>
                            <li>
                              <strong>3 Months Online Ad Presence:</strong> Sustained quarterly campaign driving steady organic-quality visitors to your book.
                            </li>
                            <li>
                              <strong>First-Page Google Search Placement:</strong> High-visibility top-of-page search ad positioning for relevant keyword queries.
                            </li>
                            <li>
                              <strong>Up to 30 Managed Keywords:</strong> In-house search engine marketing experts curate, test, and manage up to 30 targeted keywords.
                            </li>
                            <li>
                              <strong>Monthly Strategy & Reporting:</strong> In-depth monthly performance reports with agile keyword tuning based on live search trends.
                            </li>
                            <li>
                              <strong>Deluxe Author Website Setup:</strong> A custom-designed author website to serve as your brand headquarters and high-converting landing destination.
                            </li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'sem-specialist-campaign' ? (
                    /* SEM - Specialist Campaign (NO PRICE, NO CHECKLIST) */
                    <div className="sem-specialist-detail-content">
                      <div className="editorial-callout-notice p-3 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                        <p className="fst-italic mb-0 fw-medium" style={{ color: '#57534e', fontSize: '0.92rem' }}>
                          Our premier Google search engine marketing campaign: 5 months of first-page placement, up to 50 tracked keywords, bi-weekly analytics, and a website with an integrated author blog.
                        </p>
                      </div>

                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          The Specialist Campaign delivers maximum Google reach and proactive search dominance over a five-month span, paired with bi-weekly optimization meetings to keep you at the helm of your digital growth.
                        </p>

                        <div className="p-3.5 mb-4 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                          <h6 className="fw-bold mb-2" style={{ color: '#2b2219', fontSize: '0.96rem' }}>
                            Specialist Campaign Inclusions:
                          </h6>
                          <ul className="mb-0 ps-3" style={{ color: '#57534e', fontSize: '0.92rem', lineHeight: '1.75' }}>
                            <li>
                              <strong>5 Months Premier Ad Presence:</strong> Extended multi-month campaign establishing dominant visibility on Google.
                            </li>
                            <li>
                              <strong>First-Page Placement Throughout:</strong> Your book ads consistently show on page 1 of Google search results for target queries.
                            </li>
                            <li>
                              <strong>Up to 50 Curated Keywords:</strong> Expanded keyword spectrum researched and optimized by senior search specialists.
                            </li>
                            <li>
                              <strong>Bi-Weekly Reporting & Proactive Refinement:</strong> Frequent progress reviews and rapid campaign tuning every two weeks.
                            </li>
                            <li>
                              <strong>Premier Website Design with Blog:</strong> Full author website setup including a dedicated blogging system to regularly update readers on your writing, events, and releases.
                            </li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'author-website-setup' ? (
                    /* Author Website Setup (NO PRICE, NO CHECKLIST) */
                    <div className="author-website-setup-detail-content">
                      <div className="editorial-callout-notice p-3 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                        <p className="fst-italic mb-0 fw-medium" style={{ color: '#57534e', fontSize: '0.92rem' }}>
                          Reach out to a worldwide audience with Omni's Author Website Setup service—your 24/7 digital storefront, resume, portfolio, and brand hub.
                        </p>
                      </div>

                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          Having a personal website means readers, bookstores, and media can learn about you anytime, anywhere. We handle creative design, content layout, and technical setup from start to finish.
                        </p>

                        <div className="p-3.5 mb-4 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                          <h6 className="fw-bold mb-2" style={{ color: '#2b2219', fontSize: '0.96rem' }}>
                            Website Packages & Structure:
                          </h6>
                          <div className="row g-3 mb-3">
                            <div className="col-md-4">
                              <div className="p-2.5 rounded-2 h-100" style={{ background: '#ffffff', border: '1px solid #ebd9c4' }}>
                                <strong className="d-block mb-1" style={{ color: '#2b2219', fontSize: '0.92rem' }}>3-Page Setup</strong>
                                <ul className="mb-0 ps-3" style={{ color: '#57534e', fontSize: '0.84rem', lineHeight: '1.55' }}>
                                  <li>Up to 3 custom pages</li>
                                  <li>2 featured book images</li>
                                  <li>1 dedicated email account</li>
                                  <li>Contact form integration</li>
                                </ul>
                              </div>
                            </div>
                            <div className="col-md-4">
                              <div className="p-2.5 rounded-2 h-100" style={{ background: '#ffffff', border: '1px solid #ebd9c4' }}>
                                <strong className="d-block mb-1" style={{ color: '#2b2219', fontSize: '0.92rem' }}>6-Page Setup</strong>
                                <ul className="mb-0 ps-3" style={{ color: '#57534e', fontSize: '0.84rem', lineHeight: '1.55' }}>
                                  <li>Up to 6 custom pages</li>
                                  <li>10 featured book images</li>
                                  <li>2 rotating header banners</li>
                                  <li>2 dedicated email accounts</li>
                                </ul>
                              </div>
                            </div>
                            <div className="col-md-4">
                              <div className="p-2.5 rounded-2 h-100" style={{ background: '#ffffff', border: '1px solid #ebd9c4' }}>
                                <strong className="d-block mb-1" style={{ color: '#2b2219', fontSize: '0.92rem' }}>10-Page Setup</strong>
                                <ul className="mb-0 ps-3" style={{ color: '#57534e', fontSize: '0.84rem', lineHeight: '1.55' }}>
                                  <li>Up to 10 custom pages</li>
                                  <li>Up to 60 MB asset storage</li>
                                  <li>4 rotating header banners</li>
                                  <li>3 dedicated email accounts</li>
                                  <li>Animated book excerpt area</li>
                                </ul>
                              </div>
                            </div>
                          </div>

                          <h6 className="fw-bold mb-2" style={{ color: '#2b2219', fontSize: '0.94rem' }}>
                            Flexible Page Choices Available:
                          </h6>
                          <p className="mb-2" style={{ color: '#57534e', fontSize: '0.88rem', lineHeight: '1.6' }}>
                            Home, About the Book, About the Author, Order / Retailer Links, Excerpt, Contact Page, Reviews & Media, Events, and Photo Gallery.
                          </p>
                        </div>

                        <div className="p-3 mb-0 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                          <p className="mb-0" style={{ color: '#57534e', fontSize: '0.88rem', lineHeight: '1.65' }}>
                            <em>*Free Domain & Hosting: Custom domain name registration and high-speed web hosting are included completely free for an entire year.</em>
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'press-release-essential-edition' ? (
                    /* Press Release - Essential Edition (NO PRICE, NO CHECKLIST) */
                    <div className="press-release-essential-detail-content">
                      <div className="editorial-callout-notice p-3 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                        <p className="fst-italic mb-0 fw-medium" style={{ color: '#57534e', fontSize: '0.92rem' }}>
                          When done right, a press release is an effective way to get publicity. Grab the media’s attention and create widespread exposure for your title with an expertly crafted news release.
                        </p>
                      </div>

                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          The Omni Press Release – Essential Edition helps you grab the media’s attention by promoting your book with an expertly crafted press release. Prepared in a format to pique editors' interest in your book, your press release is delivered to numerous media outlets, creating the potential for increased coverage of you and your book. More coverage equals more exposure for your title.
                        </p>

                        <div className="p-3.5 mb-4 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                          <h6 className="fw-bold mb-2" style={{ color: '#2b2219', fontSize: '0.96rem' }}>
                            The Press Release – Essential Edition Includes:
                          </h6>
                          <ul className="mb-0 ps-3" style={{ color: '#57534e', fontSize: '0.92rem', lineHeight: '1.75' }}>
                            <li>
                              <strong>Customized One-Page Press Release:</strong> Expertly crafted by a professional writer based on the detailed information and story background you provide about your book.
                            </li>
                            <li>
                              <strong>Targeted Distribution to 500+ Media Outlets:</strong> Delivery of your press release to a minimum of 500 media outlets chosen strategically based on location, book genre, target audience, and subject matter; recipients may include magazines, newspapers, online publications, and radio and TV programs.
                            </li>
                            <li>
                              <strong>One-Month Comprehensive PR Tracking via Meltwater:</strong> Active tracking for one month through Meltwater's industry-leading PR monitoring platform to monitor pickups and news clips.
                            </li>
                          </ul>
                        </div>

                        <div className="p-3.5 mb-4 rounded-3" style={{ background: '#faf6f0', border: '1px solid #ebd9c4' }}>
                          <h6 className="fw-bold mb-2" style={{ color: '#ad7d42', fontSize: '0.95rem' }}>
                            About Meltwater
                          </h6>
                          <p className="mb-0" style={{ color: '#57534e', fontSize: '0.88rem', lineHeight: '1.65' }}>
                            Meltwater was founded in 2001 as the world’s first online media monitoring company. Today, Meltwater is a global leader in media intelligence and social analytics, helping to bridge the gap between Public Relations, Communications, and Marketing departments with an intuitive, all-in-one solution powered by AI-driven insights. Over 30,000 of the world’s most respected brands rely on Meltwater across more than 55 offices on six continents.
                          </p>
                        </div>

                        <div className="p-3 mb-0 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                          <span className="fw-bold" style={{ color: '#ad7d42' }}>Note: </span>
                          <span style={{ color: '#57534e', fontSize: '0.88rem' }}>
                            Press release samples and distribution recommendations are provided during your campaign consultation.
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'press-release-web-optimized-edition' ? (
                    /* Press Release - Web Optimized Edition (NO PRICE, NO CHECKLIST) */
                    <div className="press-release-web-optimized-detail-content">
                      <div className="editorial-callout-notice p-3 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                        <p className="fst-italic mb-0 fw-medium" style={{ color: '#57534e', fontSize: '0.92rem' }}>
                          With a web-optimized press release, anyone who conducts a web search of you or your book can find you much easier, including members of the press searching for story ideas.
                        </p>
                      </div>

                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          The Omni Press Release – Web-Optimized Edition is professionally crafted to include strategic search keywords that increase your release’s chances of being returned as a higher ranking search engine result. The easier your release is to find, the more likely you are to get promotional coverage and online discoverability for your book.
                        </p>

                        <div className="p-3.5 mb-4 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                          <h6 className="fw-bold mb-2" style={{ color: '#2b2219', fontSize: '0.96rem' }}>
                            Press Release – Web-Optimized Edition Includes:
                          </h6>
                          <ul className="mb-0 ps-3" style={{ color: '#57534e', fontSize: '0.92rem', lineHeight: '1.75' }}>
                            <li>
                              <strong>Keyword-Optimized Professional Writing:</strong> A professional writer crafts your press release and infuses strategic keywords to optimize it for search engine results, so your release has the highest probability of being found and read.
                            </li>
                            <li>
                              <strong>Newswire Distribution via PRWeb:</strong> Distributed to as many as 30,000 opt-in journalists and more than 250,000 news subscribers through our newswire service partner, PRWeb. Distributed releases commonly appear on prominent news hubs including Google News, Yahoo News, and websites where journalists search daily for relevant news and topics.
                            </li>
                            <li>
                              <strong>One-Month Press Release Tracking:</strong> Active monitoring for 30 days to measure digital pickups, indexing, and syndication across the web.
                            </li>
                            <li>
                              <strong>Activity Feedback & Performance Reporting:</strong> Comprehensive activity feedback and analytics so you can track the reach, reads, clicks, and overall effectiveness of your web-optimized release.
                            </li>
                          </ul>
                        </div>

                        <div className="p-3 mb-0 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                          <span className="fw-bold" style={{ color: '#ad7d42' }}>Note: </span>
                          <span style={{ color: '#57534e', fontSize: '0.88rem' }}>
                            Web-optimized press release samples and keyword strategy recommendations are available upon request.
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'radio-book-talk' ? (
                    /* Radio Book Talk (NO PRICE, NO CHECKLIST) */
                    <div className="radio-book-talk-detail-content">
                      <div className="editorial-callout-notice p-3 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                        <p className="fst-italic mb-0 fw-medium" style={{ color: '#57534e', fontSize: '0.92rem' }}>
                          Talk about what you love and introduce your book to listeners nationwide. Combine terrestrial radio reach with prominent bookish podcast features on America Tonight, Books on Air, and Newsgram.
                        </p>
                      </div>

                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          You'll never run out of places to talk about books. There are cafés, libraries, bookstores, and you can chat about it on the radio. As an author, you can use the airwaves not only to talk about what you love, but to promote your book to interested listeners across the country.
                        </p>
                        <p className="mb-3">
                          With our Radio Book Talk service, you get both online and terrestrial radio coverage: talk about your book on a radio show hosted by Kate Delaney, an Emmy award-winning broadcaster, and get interviewed on WebTalkRadio’s Books on Air. Plus, your book will be announced to the avid listeners of Newsgram, a show that highlights trends and popular recommendations.
                        </p>

                        <div className="p-3 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                          <p className="mb-0 fw-medium" style={{ color: '#57534e', fontSize: '0.88rem' }}>
                            <strong>Genre Recommendation:</strong> Radio Book Talk is highly recommended for literary novels, memoirs, business books, and nonfiction titles such as self-help and personal growth.
                          </p>
                        </div>

                        <div className="p-3.5 mb-4 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                          <h6 className="fw-bold mb-2" style={{ color: '#2b2219', fontSize: '0.96rem' }}>
                            Radio Book Talk Package Inclusions:
                          </h6>
                          <ul className="mb-0 ps-3" style={{ color: '#57534e', fontSize: '0.92rem', lineHeight: '1.75' }}>
                            <li>
                              <strong>8 to 12-Minute Interview on America Tonight:</strong> In-depth interview with Emmy Award-winning host Kate Delaney. America Tonight airs across approximately 100 stations nationwide and reaches around 2.9 million listeners. You will receive an MP3 audio file following the interview.
                            </li>
                            <li>
                              <strong>15-Minute Online Interview on Books on Air:</strong> Featured with host Suzanne Harris on WebTalkRadio, and syndicated across Apple Podcasts, iHeartRadio, Spotify, and major podcast aggregators.
                            </li>
                            <li>
                              <strong>Book Feature on Newsgram:</strong> Featured spotlight on WebTalkRadio's Newsgram show hosted by seasoned newsroom personality Sam Youmans, distributed across Apple, iHeartRadio, and Spotify.
                            </li>
                            <li>
                              <strong>Digital Master Copies:</strong> Digital copies of all radio interviews with full commercial rights for your author website, social media promotions, speaking engagements, and press kits.
                            </li>
                          </ul>
                        </div>

                        <div className="p-3.5 mb-4 rounded-3" style={{ background: '#faf6f0', border: '1px solid #ebd9c4' }}>
                          <h6 className="fw-bold mb-2" style={{ color: '#ad7d42', fontSize: '0.95rem' }}>
                            About the Hosts & Broadcasters
                          </h6>
                          <div className="d-flex flex-column gap-2" style={{ color: '#57534e', fontSize: '0.88rem', lineHeight: '1.6' }}>
                            <p className="mb-0">
                              <strong>Kate Delaney:</strong> An award-winning and respected national broadcaster with 20 years in television and radio, having interviewed over 16,000 guests. She garnered a Television Emmy for her special report on the AIDS epidemic and several Golden Mics for her investigative series.
                            </p>
                            <p className="mb-0">
                              <strong>Suzanne Harris (Books on Air):</strong> An experienced media personality who guides authors in sharing their creative journey with passionate readers worldwide.
                            </p>
                            <p className="mb-0">
                              <strong>Sam Youmans (Newsgram):</strong> A seasoned newsroom veteran who curates standout book releases and creative work for dedicated weekly listeners.
                            </p>
                          </div>
                        </div>

                        <div className="p-3 mb-0 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                          <span className="fw-bold" style={{ color: '#ad7d42' }}>Broadcast Policy: </span>
                          <span style={{ color: '#57534e', fontSize: '0.88rem' }}>
                            Featured books are subject to network review and approval. Certain themes, genres, or explicit topics may not be suitable for terrestrial broadcast syndication.
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'audio-snip' ? (
                    /* Audio Snip (NO PRICE, NO CHECKLIST) */
                    <div className="audio-snip-detail-content">
                      <div className="editorial-callout-notice p-3 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                        <p className="fst-italic mb-0 fw-medium" style={{ color: '#57534e', fontSize: '0.92rem' }}>
                          Thirty seconds may seem like an insignificant amount of time, but in half a minute you can grab reader attention, present your hook, and direct listeners right to where your book is sold.
                        </p>
                      </div>

                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          Yes, you read that right—it's entirely possible to reach out to prospective readers in such a short window. All you need is the right marketing vehicle. The Audio Snip service serves as a high-impact audio trailer of your book to announce its release, create intrigue, and inform listeners where they can purchase their copy.
                        </p>
                        <p className="mb-3">
                          With this service, you take your story directly to the airwaves and digital audio channels with a professionally voiced and engineered audio teaser designed to integrate seamlessly into your author platform.
                        </p>

                        <div className="p-3.5 mb-4 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                          <h6 className="fw-bold mb-2" style={{ color: '#2b2219', fontSize: '0.96rem' }}>
                            The Audio Snip Package Includes:
                          </h6>
                          <ul className="mb-0 ps-3" style={{ color: '#57534e', fontSize: '0.92rem', lineHeight: '1.75' }}>
                            <li>
                              <strong>30-Second Professionally Produced Audio Commercial:</strong> Crisp, studio-engineered audio teaser highlighting your book title, logline, author identity, and retail availability.
                            </li>
                            <li>
                              <strong>Studio Voiceover & Sound Design:</strong> Professional voice talent and licensed background music tuned to match your book's mood and genre.
                            </li>
                            <li>
                              <strong>Multi-Platform Digital Asset:</strong> Complete digital master copy formatted for radio rotation, podcast preroll/midroll ads, Instagram reels, YouTube shorts, and author website landing pages.
                            </li>
                          </ul>
                        </div>

                        <div className="p-3 mb-0 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                          <p className="mb-0" style={{ color: '#57534e', fontSize: '0.88rem', lineHeight: '1.65' }}>
                            <em>*Tip: An Audio Snip is an ideal promotional companion to pair with social media advertising, website header media, and newsletter releases.</em>
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'online-interview' ? (
                    /* Online Interview (NO PRICE, NO CHECKLIST) */
                    <div className="online-interview-detail-content">
                      <div className="editorial-callout-notice p-3 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                        <p className="fst-italic mb-0 fw-medium" style={{ color: '#57534e', fontSize: '0.92rem' }}>
                          Position yourself as an expert on your book’s subject matter and put your voice on the radio. Gain a powerful promotional push and an evergreen audio asset with broadcast veteran J. Douglas Barker.
                        </p>
                      </div>

                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          Position yourself as an authority in your genre and share the heart of your message with eager listeners. The Online Interview service is a strategic marketing tool designed to enhance your promotional plan. With the rise in streaming audio and satellite radio, listeners have more choices and more ways to access content than ever before, and streaming radio is an exceptional way to reach new audiences.
                        </p>
                        <p className="mb-3">
                          Plus, you can use your high-quality recorded interview as a launch pad for your next big promotional push across social media, author blogs, and speaking engagements.
                        </p>

                        <div className="p-3.5 mb-4 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                          <h6 className="fw-bold mb-2" style={{ color: '#2b2219', fontSize: '0.96rem' }}>
                            Online Interview Package Inclusions:
                          </h6>
                          <ul className="mb-0 ps-3" style={{ color: '#57534e', fontSize: '0.92rem', lineHeight: '1.75' }}>
                            <li>
                              <strong>10- to 15-Minute Online Radio Interview:</strong> Recorded comfortably over the phone, focused on your book, writing process, and expertise.
                            </li>
                            <li>
                              <strong>Broadcast on Omni Radio Stations:</strong>
                              <ul className="mt-1 mb-1 ps-3" style={{ fontSize: '0.88rem' }}>
                                <li><strong>Omni Radio:</strong> Airs Saturdays at 3:00 p.m. CT (encore Thursdays at 11:00 p.m. CT)</li>
                                <li><strong>Omni Radio 2:</strong> Airs Saturdays at 1:00 p.m. CT (encore Sundays at 1:00 p.m. CT)</li>
                              </ul>
                            </li>
                            <li>
                              <strong>Global Syndication:</strong> Syndicated via iTunes and Toginet.com, digitally retrievable for on-demand playback on mobile devices (iPhone, iPad, Android).
                            </li>
                            <li>
                              <strong>Master Digital Audio Copy:</strong> Unlimited rights to burn, distribute, play at speaking engagements, or embed on your author website, blog, and email promotions.
                            </li>
                            <li>
                              <strong>Pre-Show Questionnaire & Guided Warm-Up:</strong> A thorough pre-show questionnaire and warm-up conversation with host J. Douglas Barker to ensure you are confident and comfortable with the interview topics.
                            </li>
                          </ul>
                        </div>

                        <div className="p-3.5 mb-4 rounded-3" style={{ background: '#faf6f0', border: '1px solid #ebd9c4' }}>
                          <h6 className="fw-bold mb-2" style={{ color: '#ad7d42', fontSize: '0.95rem' }}>
                            About Host J. Douglas Barker
                          </h6>
                          <p className="mb-2" style={{ color: '#57534e', fontSize: '0.88rem', lineHeight: '1.65' }}>
                            With a passion for all things creative, J. Douglas Barker is an accomplished actor, singer, and audio producer with over 35 years of studio excellence. He can be heard worldwide as producer and talent for Toginet Radio Network, with voice actor credits in the CBS "Movie of the Week," along with commercial and studio work for national accounts including Disney, Church's Chicken, and United Technologies.
                          </p>
                          <p className="fst-italic mb-0" style={{ color: '#78716c', fontSize: '0.86rem' }}>
                            Never been interviewed for radio before? No problem. The interview is structured to be fun, relaxing, and collaborative. J. Douglas Barker guides you through every step so you shine on the airwaves.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'set-your-own-price' ? (
                    /* Set Your Own Price (NO PRICE, NO CHECKLIST) */
                    <div className="set-your-own-price-detail-content">
                      <div className="editorial-callout-notice p-3 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                        <p className="fst-italic mb-0 fw-medium" style={{ color: '#57534e', fontSize: '0.92rem' }}>
                          Take control of your book's retail price and the royalties you earn. Set Your Own Price gives you the flexibility to adjust the retail price of the hardcover and paperback formats of your book.
                        </p>
                      </div>

                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          Pricing is a fundamental component of book marketing. Whether your objective is to set an enticing promotional price to drive maximum unit sales or to establish a premium price point that yields higher royalties per copy, the Set Your Own Price service puts you in the driver’s seat.
                        </p>

                        <div className="p-3.5 mb-4 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                          <h6 className="fw-bold mb-2" style={{ color: '#2b2219', fontSize: '0.96rem' }}>
                            Key Benefits & Strategic Power:
                          </h6>
                          <ul className="mb-0 ps-3" style={{ color: '#57534e', fontSize: '0.92rem', lineHeight: '1.75' }}>
                            <li>
                              <strong>Format Flexibility:</strong> Adjust the retail price of both hardcover and paperback editions of your title.
                            </li>
                            <li>
                              <strong>Strategic Pricing Alignment:</strong> Position your title competitively within your genre against competing commercial releases.
                            </li>
                            <li>
                              <strong>Synergy with Author Advantage:</strong> Combine with the Author Advantage Royalty Program to set a competitive retail price while harvesting maximum royalty margins.
                            </li>
                            <li>
                              <strong>Full Distribution Synchronization:</strong> Price updates are distributed across major online booksellers and global distributor networks including Amazon, Barnes & Noble, and Ingram.
                            </li>
                          </ul>
                        </div>

                        <div className="p-3 mb-0 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                          <p className="mb-0" style={{ color: '#57534e', fontSize: '0.88rem', lineHeight: '1.65' }}>
                            <em>*Consultation Note: Contact your Publishing Consultant to analyze print-on-demand base production costs and identify optimal price thresholds for your page count.</em>
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'author-advantage-royalty-program' ? (
                    /* Author Advantage Royalty Program (NO PRICE, NO CHECKLIST) */
                    <div className="author-advantage-detail-content">
                      <div className="editorial-callout-notice p-3 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                        <p className="fst-italic mb-0 fw-medium" style={{ color: '#57534e', fontSize: '0.92rem' }}>
                          The Author Advantage Royalty Program empowers you to earn substantial financial gains with every print book sold. This 3-Year Program ensures you receive maximum profits and deeply discounted author copies.
                        </p>
                      </div>

                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          Figuring out how much your book will cost and how much you will receive from each sale is easy and transparent. The retail price is based on your final manuscript's page count, and your royalty is determined by clean, industry-leading payout percentages.
                        </p>

                        <div className="p-3.5 mb-4 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                          <h6 className="fw-bold mb-2" style={{ color: '#2b2219', fontSize: '0.96rem' }}>
                            Royalty Calculations:
                          </h6>
                          <div className="d-flex flex-column gap-2" style={{ color: '#57534e', fontSize: '0.92rem', lineHeight: '1.7' }}>
                            <div className="p-2.5 rounded-2" style={{ background: '#fff', border: '1px solid #e7ded5' }}>
                              <strong className="d-block text-dark">Online Bookstore Sales:</strong>
                              <span>Your Book’s List Price × <strong>60%</strong> = Your Royalty</span>
                            </div>
                            <div className="p-2.5 rounded-2" style={{ background: '#fff', border: '1px solid #e7ded5' }}>
                              <strong className="d-block text-dark">Channel Retailers (Amazon, Barnes & Noble, etc.):</strong>
                              <span>Your Book’s List Price × <strong>15%</strong> = Your Royalty</span>
                            </div>
                          </div>
                        </div>

                        <div className="p-3.5 mb-4 rounded-3" style={{ background: '#faf6f0', border: '1px solid #ebd9c4' }}>
                          <h6 className="fw-bold mb-2" style={{ color: '#ad7d42', fontSize: '0.95rem' }}>
                            Enrollment Start Dates:
                          </h6>
                          <p className="mb-2" style={{ color: '#57534e', fontSize: '0.88rem', lineHeight: '1.65' }}>
                            The Work will be enrolled on the earlier of the following:
                          </p>
                          <ul className="mb-0 ps-3" style={{ color: '#57534e', fontSize: '0.88rem', lineHeight: '1.65' }}>
                            <li>
                              <strong>Already available for sale:</strong> On the first day of the next calendar quarter following receipt by Company of both the signed Agreement and payment of the applicable fee.
                            </li>
                            <li>
                              <strong>Not yet available for sale:</strong> On the first day of the next calendar quarter after the Work becomes available for sale, provided payment has been received prior to that time.
                            </li>
                          </ul>
                        </div>

                        <div className="p-3 mb-0 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                          <p className="mb-0" style={{ color: '#57534e', fontSize: '0.88rem', lineHeight: '1.65' }}>
                            <em>*Please Note: To be eligible for the Author Advantage Royalty Program, your publishing package must have been purchased on or after January 2023. Combining this program with Set Your Own Price enables maximum author earnings.</em>
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'retail-focus' ? (
                    /* Retail Focus (NO PRICE, NO CHECKLIST) */
                    <div className="retail-focus-detail-content">
                      <div className="editorial-callout-notice p-3 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                        <p className="fst-italic mb-0 fw-medium" style={{ color: '#57534e', fontSize: '0.92rem' }}>
                          If your dream is to see your work displayed on a bookstore shelf, Retail Focus provides direct pitching to 25 independent bookstores across the US, premier trade publication ads, and a 2-bookstore stocking test guarantee.
                        </p>
                      </div>

                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          Although self-published titles are gaining popularity, authors often face hurdles getting brick-and-mortar stores to stock their books. Retailers consider factors like sales potential, subject matter, and returnability. The Retail Focus Service combines direct sales pitching with premier trade publication advertising to make your book stand out.
                        </p>

                        <div className="p-3.5 mb-4 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                          <h6 className="fw-bold mb-2" style={{ color: '#2b2219', fontSize: '0.96rem' }}>
                            Retail Focus Package Inclusions:
                          </h6>
                          <ul className="mb-0 ps-3" style={{ color: '#57534e', fontSize: '0.92rem', lineHeight: '1.75' }}>
                            <li>
                              <strong>Direct Pitching to 25 Independent Bookstores:</strong> Pitched across the US (with focus on a specific area or state) over the span of 3 months using a customized sales kit.
                            </li>
                            <li>
                              <strong>Ingram Advance Catalog Ad:</strong> Single-slot print ad in Ingram’s Advance Catalog buying guide, read by over 7,000 print and 27,000 digital retailers, librarians, and international buyers.
                            </li>
                            <li>
                              <strong>ForeWord Magazine Ad:</strong> Single-slot print ad in the quarterly ForeWord Magazine, reaching more than 30,000 librarians and booksellers (including 1,100 ABA members).
                            </li>
                            <li>
                              <strong>Booksellers Return Program for 12 Months:</strong> Full 1-year returnable status ensuring bookstores can stock your title risk-free.
                            </li>
                            <li>
                              <strong>Retailer Test Guarantee:</strong> A guarantee that at least two (2) bookstores or retailers will agree to test your book.
                            </li>
                          </ul>
                        </div>

                        <div className="p-3.5 mb-4 rounded-3" style={{ background: '#faf6f0', border: '1px solid #ebd9c4' }}>
                          <h6 className="fw-bold mb-2" style={{ color: '#ad7d42', fontSize: '0.95rem' }}>
                            Program Guidelines & Prerequisites:
                          </h6>
                          <ul className="mb-0 ps-3" style={{ color: '#57534e', fontSize: '0.88rem', lineHeight: '1.65' }}>
                            <li>Option to extend your campaign by adding 25 more independent bookstores.</li>
                            <li>Retail-ready review: Complimentary cover enhancements may be recommended to meet bookstore standards; professional copyediting is advised.</li>
                            <li>Publication timeline: Official publication date must not be more than two (2) years ago, or the book must have received an award, 5-star review, or media recognition in the last 24 months.</li>
                            <li>Active retail availability: Your book must already be available for sale prior to campaign launch.</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'retail-focus-for-childrens-books' ? (
                    /* Retail Focus for Children's Books (NO PRICE, NO CHECKLIST) */
                    <div className="retail-focus-children-detail-content">
                      <div className="editorial-callout-notice p-3 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                        <p className="fst-italic mb-0 fw-medium" style={{ color: '#57534e', fontSize: '0.92rem' }}>
                          Tailored specifically for children's literature, this service pitches your title to 25 independent bookstores, features your book in Children's Advance Catalog and ForeWord Magazine, and includes a 2-bookstore test guarantee.
                        </p>
                      </div>

                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          Children’s books are perennially in demand, but children’s bookstore buyers have particular criteria regarding illustration quality, age grading, and subject matter. The Retail Focus for Children’s Books service is customized from the ground up to address what independent children’s book buyers look for.
                        </p>

                        <div className="p-3.5 mb-4 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                          <h6 className="fw-bold mb-2" style={{ color: '#2b2219', fontSize: '0.96rem' }}>
                            Package Inclusions:
                          </h6>
                          <ul className="mb-0 ps-3" style={{ color: '#57534e', fontSize: '0.92rem', lineHeight: '1.75' }}>
                            <li>
                              <strong>Direct Pitching to 25 Independent Bookstores:</strong> Pitched across the US (with focus on your target region or state) over 3 months using a tailored children's sales kit.
                            </li>
                            <li>
                              <strong>Ingram Children's Advance Catalog Ad:</strong> Single-slot print ad in the dedicated bimonthly children's buying guide read by 7,000 print and 29,000 digital retailers and librarians.
                            </li>
                            <li>
                              <strong>ForeWord Magazine Ad:</strong> Single-slot print ad reaching over 30,000 librarians and booksellers.
                            </li>
                            <li>
                              <strong>Booksellers Return Program for 12 Months:</strong> 1 full year of returnable status eliminating retailer stocking risk.
                            </li>
                            <li>
                              <strong>Retailer Test Guarantee:</strong> A guarantee that at least two (2) bookstores or retailers will agree to test your book.
                            </li>
                          </ul>
                        </div>

                        <div className="p-3.5 mb-4 rounded-3" style={{ background: '#faf6f0', border: '1px solid #ebd9c4' }}>
                          <h6 className="fw-bold mb-2" style={{ color: '#ad7d42', fontSize: '0.95rem' }}>
                            Program Guidelines & Prerequisites:
                          </h6>
                          <ul className="mb-0 ps-3" style={{ color: '#57534e', fontSize: '0.88rem', lineHeight: '1.65' }}>
                            <li>Option to extend your campaign to 25 additional independent bookstores.</li>
                            <li>Complimentary cover adjustments may be provided by design professionals if needed to satisfy children's retailer expectations.</li>
                            <li>Book must be published within the last two (2) years or have received recent recognition (award, review, media coverage) within 24 months.</li>
                            <li>Book must already be available for sale before the campaign launches.</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'library-focus' ? (
                    /* Library Focus (NO PRICE, NO CHECKLIST) */
                    <div className="library-focus-detail-content">
                      <div className="editorial-callout-notice p-3 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                        <p className="fst-italic mb-0 fw-medium" style={{ color: '#57534e', fontSize: '0.92rem' }}>
                          Make your book available in public libraries across the United States. Omni pitches your title directly to Collection Development Departments and Acquisition Librarians of 25 public libraries, with ads in Forecast Catalog and ForeWord Magazine.
                        </p>
                      </div>

                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          Libraries are beloved sites of community, history, and education. Getting libraries to stock your book connects you directly to enthusiastic readers, book clubs, and students. The Library Focus Service pairs institutional trade advertising with direct acquisition pitching.
                        </p>

                        <div className="p-3.5 mb-4 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                          <h6 className="fw-bold mb-2" style={{ color: '#2b2219', fontSize: '0.96rem' }}>
                            Library Focus Inclusions:
                          </h6>
                          <ul className="mb-0 ps-3" style={{ color: '#57534e', fontSize: '0.92rem', lineHeight: '1.75' }}>
                            <li>
                              <strong>Direct Pitching to 25 Public Libraries:</strong> Presented directly to Collection Development Departments and Acquisition Librarians across the US over 3 months using a customized sales kit.
                            </li>
                            <li>
                              <strong>Baker & Taylor Forecast Catalog Ad:</strong> Single-slot print ad in the most widely circulated library buying publication, mailed to 45,000 librarians in the US.
                            </li>
                            <li>
                              <strong>ForeWord Magazine Ad:</strong> Single-slot print ad reaching over 30,000 librarians and booksellers.
                            </li>
                            <li>
                              <strong>Booksellers Return Program for 12 Months:</strong> Returnable status across wholesale distributors.
                            </li>
                            <li>
                              <strong>Library Test Guarantee:</strong> A guarantee that at least two (2) libraries will agree to test your book.
                            </li>
                          </ul>
                        </div>

                        <div className="p-3.5 mb-4 rounded-3" style={{ background: '#faf6f0', border: '1px solid #ebd9c4' }}>
                          <h6 className="fw-bold mb-2" style={{ color: '#ad7d42', fontSize: '0.95rem' }}>
                            Library Guidelines & Prerequisites:
                          </h6>
                          <ul className="mb-0 ps-3" style={{ color: '#57534e', fontSize: '0.88rem', lineHeight: '1.65' }}>
                            <li>Option to extend the campaign by pitching 25 additional public libraries.</li>
                            <li>Complimentary cover design adjustments and copyediting recommendations to ensure your book is library-ready.</li>
                            <li>Official publication date must not be more than two (2) years ago, or the book must have received recent recognition (awards, reviews, press) in the last 24 months.</li>
                            <li>Title must already be live and available for sale before the campaign starts.</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'booksellers-return-program' ? (
                    /* Booksellers Return Program (NO PRICE, NO CHECKLIST) */
                    <div className="booksellers-return-detail-content">
                      <div className="editorial-callout-notice p-3 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                        <p className="fst-italic mb-0 fw-medium" style={{ color: '#57534e', fontSize: '0.92rem' }}>
                          The ability to return unsold books is a standard publishing practice since the Great Depression. Designate your book as "Returnable" in Ingram ipage and Baker & Taylor systems for 12 months with no royalty chargebacks.
                        </p>
                      </div>

                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          Often, booksellers will hesitate to order and stock books when they aren’t “Returnable.” Booksellers mitigate their own financial risk by relying on publishers to credit returned copies. If getting your title stocked on bookstore shelves or booking in-store book signings is part of your marketing plan, the Booksellers Return Program is an essential element to earning shelf space.
                        </p>

                        <div className="p-3.5 mb-4 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                          <h6 className="fw-bold mb-2" style={{ color: '#2b2219', fontSize: '0.96rem' }}>
                            When You Enroll in the Booksellers Return Program:
                          </h6>
                          <ul className="mb-0 ps-3" style={{ color: '#57534e', fontSize: '0.92rem', lineHeight: '1.75' }}>
                            <li>
                              <strong>Designated "Returnable" in Ingram's ipage:</strong> Visible to retailers and libraries worldwide through the world's largest wholesaler and distributor of books.
                            </li>
                            <li>
                              <strong>Designated "Returnable" in Baker & Taylor:</strong> Listed in the ordering system of a leading book distributor with over 180 years of industry leadership.
                            </li>
                            <li>
                              <strong>No Royalty Chargebacks:</strong> You will not be charged back for royalties earned on sales to stores if copies are returned.
                            </li>
                            <li>
                              <strong>One-Year Protection:</strong> Valid for one full year (12 months) from the date your book goes live.
                            </li>
                          </ul>
                        </div>

                        <div className="p-3 mb-0 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                          <p className="mb-0" style={{ color: '#57534e', fontSize: '0.88rem', lineHeight: '1.65' }}>
                            <em>*Timeline: Your book will be designated on ipage within two to seven weeks. It can then take 30 to 60 days for returnability status to appear within individual retailers’ systems. Confirmation of your title's listing in ipage is available upon request.</em>
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : selectedService?.slug === 'booksellers-return-program-renewal' ? (
                    /* Booksellers Return Program Renewal (NO PRICE, NO CHECKLIST) */
                    <div className="booksellers-return-renewal-detail-content">
                      <div className="editorial-callout-notice p-3 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                        <p className="fst-italic mb-0 fw-medium" style={{ color: '#57534e', fontSize: '0.92rem' }}>
                          Renew your book’s participation in the Booksellers Return Program for one year. Keep your book "Returnable" in distributor ordering systems so retailers continue stocking and re-ordering without risk.
                        </p>
                      </div>

                      <div className="editorial-narrative mb-4" style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}>
                        <p className="mb-3">
                          When you purchase this program renewal, your book will remain “Returnable” in major book distributor ordering systems (Ingram and Baker & Taylor), reassuring bookstores that they can return any unsold copies without loss of profit.
                        </p>
                        <p className="mb-3">
                          Renew your valuable Booksellers Return Program for another year and help your title continue to meet commercial bookseller standards for physical retail stocking and in-store events.
                        </p>

                        <div className="p-3.5 mb-4 rounded-3" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                          <h6 className="fw-bold mb-2" style={{ color: '#2b2219', fontSize: '0.96rem' }}>
                            Renewal Highlights:
                          </h6>
                          <ul className="mb-0 ps-3" style={{ color: '#57534e', fontSize: '0.92rem', lineHeight: '1.75' }}>
                            <li>
                              <strong>Uninterrupted Listing:</strong> Seamlessly maintains active "Returnable" status in Ingram and Baker & Taylor catalogs without lapse.
                            </li>
                            <li>
                              <strong>No Royalty Chargebacks:</strong> Retains complete protection against royalty deductions for returned retail inventory.
                            </li>
                            <li>
                              <strong>Annual Increment Flexibility:</strong> Valid for one full year and renewable annually to match your long-term promotional campaign.
                            </li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  ) : isCurrentSubcategoryOverview ? (
                    /* Subcategory Overview matching user's screenshots (Image 1 - Image 5) */
                    <div className="subcategory-overview-content">
                      <div className="subcategory-services-lead-container mb-4">
                        <div 
                          className="d-flex align-items-center justify-content-between mb-3 pb-2" 
                          style={{ borderBottom: '2px solid rgba(173, 125, 66, 0.2)' }}
                        >
                          <h4 className="fw-bold m-0" style={{ color: '#2b2219', fontSize: '1.2rem' }}>
                            Available Services in {selectedService.title}
                          </h4>
                          <span className="badge rounded-pill bg-light text-muted border px-2.5 py-1" style={{ fontSize: '0.78rem' }}>
                            {(selectedService.services || (currentSubcategory?.services || []).filter(s => s.slug !== selectedCategory?.id)).length} {(selectedService.services || (currentSubcategory?.services || []).filter(s => s.slug !== selectedCategory?.id)).length === 1 ? 'Offering' : 'Offerings'}
                          </span>
                        </div>
                        <p className="text-muted mb-4" style={{ fontSize: '0.92rem' }}>
                          Select any service below to explore complete inclusions, pricing, and dedicated publishing assistance.
                        </p>

                        {currentSubcategory?.id === 'video-book-trailer' && (
                          <div className="video-trailer-reasons-box p-3.5 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                            <h6 className="fw-bold mb-2" style={{ color: '#2b2219', fontSize: '0.96rem' }}>
                              Reasons Why Video Book Trailers are Essential:
                            </h6>
                            <ul className="mb-0 ps-3" style={{ color: '#57534e', fontSize: '0.9rem', lineHeight: '1.75' }}>
                              <li>A book video trailer combines visuals, text, music, and voiceovers, making it appealing to people who prefer video content over traditional text-based marketing.</li>
                              <li>Videos rank well on search engines and social media platforms, increasing the discoverability of your book.</li>
                              <li>Platforms like YouTube, Facebook, Instagram, and TikTok favor video content, leading to higher shares, likes, and comments.</li>
                              <li>The combination of visuals and sound evokes emotions, making your story more compelling and enticing to potential readers.</li>
                              <li>A well-made trailer can be featured in online ads, author websites, newsletters, and book launch events to sustain interest.</li>
                              <li>Short, cinematic previews draw in audiences who may not usually read long text book summaries.</li>
                              <li>A high-quality book trailer establishes credibility and professionalism, attracting literary agents, publishers, and media attention.</li>
                            </ul>
                          </div>
                        )}

                        {currentSubcategory?.id === 'book-reviews' && (
                          <div className="book-reviews-advantages-box p-3.5 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                            <h6 className="fw-bold mb-2" style={{ color: '#2b2219', fontSize: '0.96rem' }}>
                              Advantages of Editorial Book Reviews:
                            </h6>
                            <p className="mb-2" style={{ color: '#57534e', fontSize: '0.9rem', lineHeight: '1.6' }}>
                              A book review is an excellent way to generate interest for your title. Book readers, buyers, and retailers rely on the opinion of experts when considering which titles are worth purchasing and reading.
                            </p>
                            <div className="row g-3 mt-1">
                              <div className="col-md-6">
                                <div className="p-2.5 rounded-2" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                                  <strong className="d-block mb-1" style={{ color: '#2b2219', fontSize: '0.88rem' }}>For Authors & Publishers:</strong>
                                  <ul className="mb-0 ps-3" style={{ color: '#57534e', fontSize: '0.84rem', lineHeight: '1.6' }}>
                                    <li>Boosts credibility, trust, and author reputation</li>
                                    <li>Increases book sales through social proof</li>
                                    <li>Improves online discoverability and search ranking</li>
                                    <li>Provides constructive feedback to refine future works</li>
                                    <li>Encourages word-of-mouth recommendations and organic buzz</li>
                                    <li>Attracts media attention and bookstore distribution opportunities</li>
                                  </ul>
                                </div>
                              </div>
                              <div className="col-md-6">
                                <div className="p-2.5 rounded-2" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                                  <strong className="d-block mb-1" style={{ color: '#2b2219', fontSize: '0.88rem' }}>For Book Buyers & Readers:</strong>
                                  <ul className="mb-0 ps-3" style={{ color: '#57534e', fontSize: '0.84rem', lineHeight: '1.6' }}>
                                    <li>Provides reliable insights on book quality, themes, and writing style</li>
                                    <li>Saves time and money by matching personal reading preferences</li>
                                    <li>Fosters literary discussion and reader community engagement</li>
                                  </ul>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {currentSubcategory?.id === 'book-signings-and-galleries' && (
                          <div className="book-signings-advantages-box p-3.5 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                            <h6 className="fw-bold mb-2" style={{ color: '#2b2219', fontSize: '0.96rem' }}>
                              Why Book Signings & Gallery Exhibitions Matter:
                            </h6>
                            <p className="mb-3" style={{ color: '#57534e', fontSize: '0.9rem', lineHeight: '1.6' }}>
                              A book exhibition or book signing event can be a terrific way to create buzz around your book. As an exhibitor at many of the largest trade shows and book events, Omni puts books directly into the hands of booklovers and industry insiders.
                            </p>
                            <div className="d-flex flex-column gap-2.5">
                              <div className="p-2.5 rounded-2" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                                <strong className="d-block mb-1" style={{ color: '#2b2219', fontSize: '0.88rem' }}>1. Direct Reader Engagement & Community Building</strong>
                                <p className="mb-0" style={{ color: '#57534e', fontSize: '0.84rem', lineHeight: '1.55' }}>
                                  Meeting readers in person builds stronger connections and increases reader loyalty. <em>74% of consumers say they are more likely to buy from brands they personally interact with (Eventbrite, 2023).</em>
                                </p>
                              </div>
                              <div className="p-2.5 rounded-2" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                                <strong className="d-block mb-1" style={{ color: '#2b2219', fontSize: '0.88rem' }}>2. Increased Book Sales & Revenue</strong>
                                <p className="mb-0" style={{ color: '#57534e', fontSize: '0.84rem', lineHeight: '1.55' }}>
                                  Personalized, signed copies encourage higher purchases compared to online sales. <em>Authors can sell 20–50% more books at live events compared to online promotions (Public Forum Expo 2023).</em>
                                </p>
                              </div>
                              <div className="p-2.5 rounded-2" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                                <strong className="d-block mb-1" style={{ color: '#2b2219', fontSize: '0.88rem' }}>3. Strengthens Author Brand & Credibility</strong>
                                <p className="mb-0" style={{ color: '#57534e', fontSize: '0.84rem', lineHeight: '1.55' }}>
                                  Meeting an author in person creates deep emotional resonance. <em>82% of consumers trust a brand more if it hosts in-person events and interactions (Forbes, 2024).</em>
                                </p>
                              </div>
                              <div className="p-2.5 rounded-2" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                                <strong className="d-block mb-1" style={{ color: '#2b2219', fontSize: '0.88rem' }}>4. Networking with Industry Professionals</strong>
                                <p className="mb-0" style={{ color: '#57534e', fontSize: '0.84rem', lineHeight: '1.55' }}>
                                  Authors can connect directly with bookstore owners, literary agents, publishers, and fellow authors. <em>68% of business professionals say networking at live events helps build long-term partnerships (Harvard Business Review, 2023).</em>
                                </p>
                              </div>
                              <div className="p-2.5 rounded-2" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                                <strong className="d-block mb-1" style={{ color: '#2b2219', fontSize: '0.88rem' }}>5. Social Media Content & Marketing Opportunities</strong>
                                <p className="mb-0" style={{ color: '#57534e', fontSize: '0.84rem', lineHeight: '1.55' }}>
                                  Photos, videos, and behind-the-scenes moments attract new readers online. <em>Events with live social media updates see a 35% increase in online engagement (Event Marketing Institute, 2023).</em>
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {currentSubcategory?.id === 'hollywood-book-to-screen' && (
                          <div className="hollywood-advantages-box p-3.5 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                            <h6 className="fw-bold mb-2" style={{ color: '#2b2219', fontSize: '0.96rem' }}>
                              Advantages of Hollywood Book-to-Screen Adaptation:
                            </h6>
                            <p className="mb-3" style={{ color: '#57534e', fontSize: '0.9rem', lineHeight: '1.6' }}>
                              Have you ever considered for even a moment that your book could be adapted into a movie or television series? Omni makes your book accessible to agents, producers, directors, writers, and actors through specialized industry pathways.
                            </p>
                            <div className="d-flex flex-column gap-2.5">
                              <div className="p-2.5 rounded-2" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                                <strong className="d-block mb-1" style={{ color: '#2b2219', fontSize: '0.88rem' }}>1. Increases the Book’s Marketability</strong>
                                <p className="mb-0" style={{ color: '#57534e', fontSize: '0.84rem', lineHeight: '1.55' }}>
                                  A book backed by a professional screen adaptation evaluation or treatment is exponentially more appealing to Hollywood studios and production companies.
                                </p>
                              </div>
                              <div className="p-2.5 rounded-2" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                                <strong className="d-block mb-1" style={{ color: '#2b2219', fontSize: '0.88rem' }}>2. Provides a Clear Path to Adaptation</strong>
                                <p className="mb-0" style={{ color: '#57534e', fontSize: '0.84rem', lineHeight: '1.55' }}>
                                  Our services provide structured coverage, treatment outlines, and complete screenplays, guiding authors step-by-step through the film and TV development pipeline.
                                </p>
                              </div>
                              <div className="p-2.5 rounded-2" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                                <strong className="d-block mb-1" style={{ color: '#2b2219', fontSize: '0.88rem' }}>3. Attracts Filmmakers & Studios</strong>
                                <p className="mb-0" style={{ color: '#57534e', fontSize: '0.84rem', lineHeight: '1.55' }}>
                                  A polished screenplay or treatment dramatically raises the likelihood of catching the attention of directors, showrunners, and streaming networks.
                                </p>
                              </div>
                              <div className="p-2.5 rounded-2" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                                <strong className="d-block mb-1" style={{ color: '#2b2219', fontSize: '0.88rem' }}>4. Expands the Book’s Global Audience</strong>
                                <p className="mb-0" style={{ color: '#57534e', fontSize: '0.84rem', lineHeight: '1.55' }}>
                                  A film or television adaptation can introduce your story to millions of viewers who haven’t yet discovered the print edition, creating surging book sales.
                                </p>
                              </div>
                              <div className="p-2.5 rounded-2" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                                <strong className="d-block mb-1" style={{ color: '#2b2219', fontSize: '0.88rem' }}>5. Enhances Author Credibility & Brand Prestige</strong>
                                <p className="mb-0" style={{ color: '#57534e', fontSize: '0.84rem', lineHeight: '1.55' }}>
                                  Being associated with Hollywood development talks elevates your reputation and opens substantial opportunities with literary agents and publishers.
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {currentSubcategory?.id === 'internet-marketing' && (
                          <div className="internet-marketing-advantages-box p-3.5 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                            <h6 className="fw-bold mb-2" style={{ color: '#2b2219', fontSize: '0.96rem' }}>
                              Advantages of Internet Marketing for Authors:
                            </h6>
                            <p className="mb-3" style={{ color: '#57534e', fontSize: '0.9rem', lineHeight: '1.6' }}>
                              Having your own website, internet search, or preview tools are effective and economical ways to promote your book, enhance your image as an author, and communicate with prospective readers around the world.
                            </p>
                            <div className="d-flex flex-column gap-2.5">
                              <div className="p-2.5 rounded-2" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                                <strong className="d-block mb-1" style={{ color: '#2b2219', fontSize: '0.88rem' }}>1. Global Reach & Increased Visibility</strong>
                                <p className="mb-0" style={{ color: '#57534e', fontSize: '0.84rem', lineHeight: '1.55' }}>
                                  The internet provides direct access to billions of potential readers worldwide. <em>As of 2024, there are 5.35 billion internet users globally, creating a massive prospective readership (DataReportal, 2024).</em>
                                </p>
                              </div>
                              <div className="p-2.5 rounded-2" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                                <strong className="d-block mb-1" style={{ color: '#2b2219', fontSize: '0.88rem' }}>2. Cost-Effective Promotion Compared to Traditional Marketing</strong>
                                <p className="mb-0" style={{ color: '#57534e', fontSize: '0.84rem', lineHeight: '1.55' }}>
                                  Digital marketing delivers higher ROI than print ads or live tours. <em>Digital marketing costs 62% less than traditional marketing while generating three times more leads (HubSpot, 2023).</em>
                                </p>
                              </div>
                              <div className="p-2.5 rounded-2" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                                <strong className="d-block mb-1" style={{ color: '#2b2219', fontSize: '0.88rem' }}>3. Higher Engagement & Reader Interaction</strong>
                                <p className="mb-0" style={{ color: '#57534e', fontSize: '0.84rem', lineHeight: '1.55' }}>
                                  Online channels foster genuine connections through comments, reviews, and interactive content. <em>72% of consumers prefer engaging with brands through digital channels (Salesforce, 2023).</em>
                                </p>
                              </div>
                              <div className="p-2.5 rounded-2" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                                <strong className="d-block mb-1" style={{ color: '#2b2219', fontSize: '0.88rem' }}>4. Boosts Book Sales via E-Commerce & Online Ads</strong>
                                <p className="mb-0" style={{ color: '#57534e', fontSize: '0.84rem', lineHeight: '1.55' }}>
                                  Internet marketing drives immediate digital book sales. <em>Amazon accounts for 83% of the U.S. eBook market, making targeted online advertising essential (Author Earnings Report, 2023).</em>
                                </p>
                              </div>
                              <div className="p-2.5 rounded-2" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                                <strong className="d-block mb-1" style={{ color: '#2b2219', fontSize: '0.88rem' }}>5. Strengthens Brand & Author Credibility</strong>
                                <p className="mb-0" style={{ color: '#57534e', fontSize: '0.84rem', lineHeight: '1.55' }}>
                                  An active digital footprint (author website, blog, search footprint) builds lasting trust. <em>81% of consumers research a brand online before making a purchase (Edelman Trust Barometer, 2024).</em>
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {currentSubcategory?.id === 'publicity-services' && (
                          <div className="publicity-services-advantages-box p-3.5 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                            <h6 className="fw-bold mb-2" style={{ color: '#2b2219', fontSize: '0.96rem' }}>
                              The Power of Publicity & Media Services:
                            </h6>
                            <p className="mb-3" style={{ color: '#57534e', fontSize: '0.9rem', lineHeight: '1.6' }}>
                              Get your book noticed from a unique platform created by our publicity and media services. A targeted press release bridges the gap between authors and newsrooms, creating third-party validation that readers and industry influencers trust.
                            </p>
                            <div className="d-flex flex-column gap-2.5">
                              <div className="p-2.5 rounded-2" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                                <strong className="d-block mb-1" style={{ color: '#2b2219', fontSize: '0.88rem' }}>1. Media Credibility & Third-Party Validation</strong>
                                <p className="mb-0" style={{ color: '#57534e', fontSize: '0.84rem', lineHeight: '1.55' }}>
                                  Editorial and media coverage carries significantly higher trust than paid ads, elevating your author authority.
                                </p>
                              </div>
                              <div className="p-2.5 rounded-2" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                                <strong className="d-block mb-1" style={{ color: '#2b2219', fontSize: '0.88rem' }}>2. Targeted Newsroom & Journalist Distribution</strong>
                                <p className="mb-0" style={{ color: '#57534e', fontSize: '0.84rem', lineHeight: '1.55' }}>
                                  Direct delivery to journalists, editors, TV/radio producers, and publications matched to your book's specific genre and themes.
                                </p>
                              </div>
                              <div className="p-2.5 rounded-2" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                                <strong className="d-block mb-1" style={{ color: '#2b2219', fontSize: '0.88rem' }}>3. Permanent SEO Footprint & Discoverability</strong>
                                <p className="mb-0" style={{ color: '#57534e', fontSize: '0.84rem', lineHeight: '1.55' }}>
                                  Web-optimized distribution generates permanent backlinks, Google News indexing, and higher search result rankings for your name and title.
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {currentSubcategory?.id === 'radio-services' && (
                          <div className="radio-services-advantages-box p-3.5 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                            <h6 className="fw-bold mb-2" style={{ color: '#2b2219', fontSize: '0.96rem' }}>
                              Advantages of Radio Services for Authors:
                            </h6>
                            <p className="mb-3" style={{ color: '#57534e', fontSize: '0.9rem', lineHeight: '1.6' }}>
                              Have you ever considered how a radio interview might affect your book’s marketing plan? Omni can make your voice available on the airwaves to reach new audiences and build lasting authority.
                            </p>
                            <div className="d-flex flex-column gap-2.5">
                              <div className="p-2.5 rounded-2" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                                <strong className="d-block mb-1" style={{ color: '#2b2219', fontSize: '0.88rem' }}>1. Expands Audience Reach</strong>
                                <p className="mb-0" style={{ color: '#57534e', fontSize: '0.84rem', lineHeight: '1.55' }}>
                                  Radio stations, including local, national, and online platforms, expose your book to thousands or even millions of listeners across diverse demographics who may not actively browse bookstore shelves online.
                                </p>
                              </div>
                              <div className="p-2.5 rounded-2" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                                <strong className="d-block mb-1" style={{ color: '#2b2219', fontSize: '0.88rem' }}>2. Builds Credibility & Authority</strong>
                                <p className="mb-0" style={{ color: '#57534e', fontSize: '0.84rem', lineHeight: '1.55' }}>
                                  Being featured on radio shows or podcasts establishes you as an expert in your genre. Conversational interviews allow authors to personally connect with listeners and earn their trust.
                                </p>
                              </div>
                              <div className="p-2.5 rounded-2" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                                <strong className="d-block mb-1" style={{ color: '#2b2219', fontSize: '0.88rem' }}>3. Cost-Effective, High-ROI Promotion</strong>
                                <p className="mb-0" style={{ color: '#57534e', fontSize: '0.84rem', lineHeight: '1.55' }}>
                                  Compared to television or large print ad campaigns, radio marketing is exceptionally accessible and yields evergreen digital recordings for website embedding and ongoing social campaigns.
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {currentSubcategory?.id === 'bookstore-essentials' && (
                          <div className="bookstore-essentials-advantages-box p-3.5 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                            <h6 className="fw-bold mb-2" style={{ color: '#2b2219', fontSize: '0.96rem' }}>
                              Why Bookstore Essentials Matter:
                            </h6>
                            <p className="mb-3" style={{ color: '#57534e', fontSize: '0.9rem', lineHeight: '1.6' }}>
                              Through Omni Bookstore Essentials, your book receives professional bookselling services that make your title attractive to independent bookstores, national retail chains, and public libraries.
                            </p>
                            <div className="d-flex flex-column gap-2.5">
                              <div className="p-2.5 rounded-2" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                                <strong className="d-block mb-1" style={{ color: '#2b2219', fontSize: '0.88rem' }}>1. Overcomes the Primary Barrier to Bookstore Stocking</strong>
                                <p className="mb-0" style={{ color: '#57534e', fontSize: '0.84rem', lineHeight: '1.55' }}>
                                  Physical retailers rarely stock non-returnable titles. The Booksellers Return Program eliminates inventory risk for bookstore buyers.
                                </p>
                              </div>
                              <div className="p-2.5 rounded-2" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                                <strong className="d-block mb-1" style={{ color: '#2b2219', fontSize: '0.88rem' }}>2. Direct Trade Pitches to Decision-Makers</strong>
                                <p className="mb-0" style={{ color: '#57534e', fontSize: '0.84rem', lineHeight: '1.55' }}>
                                  Presents your book directly to independent booksellers and acquisition librarians with professional sales kits and trade catalog ads.
                                </p>
                              </div>
                              <div className="p-2.5 rounded-2" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                                <strong className="d-block mb-1" style={{ color: '#2b2219', fontSize: '0.88rem' }}>3. Maximum Profit Margins & Pricing Control</strong>
                                <p className="mb-0" style={{ color: '#57534e', fontSize: '0.84rem', lineHeight: '1.55' }}>
                                  Empowers authors to set competitive retail prices and earn up to 60% royalties on sales through the Author Advantage Royalty Program.
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* List of services in this subcategory */}
                        <div className="d-flex flex-column gap-3 mb-4">
                          {(selectedService.services || (currentSubcategory?.services || []).filter(s => s.slug !== selectedCategory?.id))
                            .map((svc) => {
                              const svcTitle = t(`service.${svc.slug}.title`, svc.title);
                              const svcLead = AUTHENTIC_SERVICE_SUMMARIES[svc.slug] || t(`service.${svc.slug}.lead`, svc.lead || svc.lead_paragraph || svc.summary || '');
                              const svcPrice = t(`service.${svc.slug}.price`, svc.price || svc.price_display || '');

                              return (
                                <div
                                  key={svc.slug}
                                  className="subcategory-service-card"
                                  onClick={() => handleSelectService({ ...svc, title: svcTitle }, selectedCategory, currentSubcategory)}
                                  role="button"
                                  tabIndex={0}
                                >
                                  <div className="d-flex align-items-start justify-content-between gap-3 mb-2">
                                    <h5
                                      className="subcategory-item-title fw-bold m-0"
                                      style={{ color: '#d9534f', fontSize: '1.18rem', letterSpacing: '-0.01em', transition: 'color 0.2s ease' }}
                                      data-block-key={`service.${svc.slug}.title`}
                                    >
                                      {svcTitle}
                                    </h5>
                                    <div className="d-flex align-items-center gap-2 flex-shrink-0">
                                      <span className="publishing-package-arrow-badge">
                                        <i className="bi bi-arrow-right-short"></i>
                                      </span>
                                    </div>
                                  </div>

                                  {svcLead && (
                                    <p
                                      className="mb-0"
                                      style={{ color: '#57534e', fontSize: '0.94rem', lineHeight: '1.68' }}
                                      data-block-key={`service.${svc.slug}.lead`}
                                    >
                                      {svcLead}
                                    </p>
                                  )}
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    </div>
                  ) : isCurrentCategoryOverview ? (
                    /* General Category Overview with Subcategory Options & Key Benefits */
                    <div className="category-overview-content">
                      {/* Specific Callouts / Quotes for Categories */}
                      {selectedService?.slug === 'editorial-services' && (
                        <div 
                          className="editorial-note-callout p-3 mb-4 rounded-3"
                          style={{
                            background: '#faf6f0',
                            border: '1px solid rgba(173, 125, 66, 0.3)',
                            borderLeft: '5px solid #ad7d42'
                          }}
                        >
                          <div className="fw-bold mb-1" style={{ color: '#2b2219', fontSize: '0.98rem' }}>
                            Chicago Manual of Style & Microsoft Word Tracking
                          </div>
                          <p className="mb-0" style={{ color: '#57534e', fontSize: '0.92rem', lineHeight: '1.68' }}>
                            In order to take advantage of our Editorial Services, you must have access to Microsoft Word. Our editing appears as tracked changes in your manuscript, which must be read in Word. Omni evaluators, editors, and copywriters follow the most current edition of the Chicago Manual of Style, the premier style guide used by traditional book publishers.
                          </p>
                        </div>
                      )}

                      {selectedService?.slug === 'formats' && (
                        <div className="category-formats-overview">
                          <div 
                            className="editorial-note-callout p-3 mb-4 rounded-3"
                            style={{
                              background: '#faf6f0',
                              border: '1px solid rgba(173, 125, 66, 0.3)',
                              borderLeft: '5px solid #ad7d42'
                            }}
                          >
                            <div 
                              className="fw-bold mb-1" 
                              style={{ color: '#2b2219', fontSize: '0.98rem' }}
                              data-block-key="service.formats.industry_note_title"
                            >
                              {t('service.formats.industry_note_title', 'Industry-Standard Print & Digital Formats')}
                            </div>
                            <p 
                              className="mb-0" 
                              style={{ color: '#57534e', fontSize: '0.92rem', lineHeight: '1.68' }}
                              data-block-key="service.formats.industry_note"
                            >
                              {t('service.formats.industry_note', 'All manuscripts submitted to Omni are formatted as trade paperbacks and printed on high-quality, acid-free, book-grade opaque paper stock. Standard with our publishing packages, with options for hardcover cloth bindings and professional audiobook production.')}
                            </p>
                          </div>

                          <div className="d-flex flex-column gap-3 mb-4">
                            <div 
                              className="p-3.5 rounded-3 border"
                              style={{ background: '#ffffff', borderColor: '#ebd9c4', cursor: 'pointer' }}
                              onClick={() => {
                                const sub = selectedCategory?.subcategories?.find(s => s.id === 'audiobook-publishing');
                                if (sub) handleJumpToSubcategory(selectedCategory, sub);
                              }}
                            >
                              <div className="d-flex align-items-center justify-content-between mb-2">
                                <h5 
                                  className="fw-bold m-0" 
                                  style={{ color: '#2b2219', fontSize: '1.08rem' }}
                                  data-block-key="service.formats.electronic_title"
                                >
                                  <i className="bi bi-tablet me-2" style={{ color: '#ad7d42' }}></i>
                                  {t('service.formats.electronic_title', 'Electronic Format')}
                                </h5>
                                <span className="publishing-package-arrow-badge"><i className="bi bi-arrow-right-short"></i></span>
                              </div>
                              <p 
                                className="mb-0" 
                                style={{ color: '#57534e', fontSize: '0.93rem', lineHeight: '1.7' }}
                                data-block-key="service.formats.electronic_desc"
                              >
                                {t('service.formats.electronic_desc', 'With the increasing number of readers who prefer a digital format, it’s important that your book is accessible to these tech-savvy booklovers too. With our Digital Formatting and Distribution service, your book will be available for sale as an e-book.')}
                              </p>
                            </div>

                            <div 
                              className="p-3.5 rounded-3 border"
                              style={{ background: '#ffffff', borderColor: '#ebd9c4', cursor: 'pointer' }}
                              onClick={() => {
                                const sub = selectedCategory?.subcategories?.find(s => s.id === 'audiobook-publishing');
                                if (sub) handleJumpToSubcategory(selectedCategory, sub);
                              }}
                            >
                              <div className="d-flex align-items-center justify-content-between mb-2">
                                <h5 
                                  className="fw-bold m-0" 
                                  style={{ color: '#2b2219', fontSize: '1.08rem' }}
                                  data-block-key="service.formats.audiobook_title"
                                >
                                  <i className="bi bi-headphones me-2" style={{ color: '#ad7d42' }}></i>
                                  {t('service.formats.audiobook_title', 'AudioBook Publishing')}
                                </h5>
                                <span className="publishing-package-arrow-badge"><i className="bi bi-arrow-right-short"></i></span>
                              </div>
                              <p 
                                className="mb-0" 
                                style={{ color: '#57534e', fontSize: '0.93rem', lineHeight: '1.7' }}
                                data-block-key="service.formats.audiobook_desc"
                              >
                                {t('service.formats.audiobook_desc', 'Over the years, the demand for audiobooks has significantly increased because readers are now able to easily download books and listen to them while they are on the move. Through audiobooks, stories are shared in a convenient way. Let your words unfold in your readers’ imagination through Omni audiobook publishing. Lift your story from its pages and let your readers listen to it.')}
                              </p>
                            </div>

                            <div 
                              className="p-3.5 rounded-3 border"
                              style={{ background: '#ffffff', borderColor: '#ebd9c4', cursor: 'pointer' }}
                              onClick={() => {
                                const sub = selectedCategory?.subcategories?.find(s => s.id === 'print-formats');
                                if (sub) handleJumpToSubcategory(selectedCategory, sub);
                              }}
                            >
                              <div className="d-flex align-items-center justify-content-between mb-2">
                                <h5 
                                  className="fw-bold m-0" 
                                  style={{ color: '#2b2219', fontSize: '1.08rem' }}
                                  data-block-key="service.formats.print_title"
                                >
                                  <i className="bi bi-book me-2" style={{ color: '#ad7d42' }}></i>
                                  {t('service.formats.print_title', 'Print Formats')}
                                </h5>
                                <span className="publishing-package-arrow-badge"><i className="bi bi-arrow-right-short"></i></span>
                              </div>
                              <p 
                                className="mb-0" 
                                style={{ color: '#57534e', fontSize: '0.93rem', lineHeight: '1.7' }}
                                data-block-key="service.formats.print_desc"
                              >
                                {t('service.formats.print_desc', 'All manuscripts submitted to Omni are formatted as trade paperbacks and printed on high-quality, acid-free, book-grade opaque paper stock.')}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {selectedService?.slug === 'design-services' && (
                        <div className="category-design-overview">
                          <div 
                            className="editorial-note-callout p-3 mb-4 rounded-3"
                            style={{
                              background: '#faf6f0',
                              border: '1px solid rgba(173, 125, 66, 0.3)',
                              borderLeft: '5px solid #ad7d42'
                            }}
                          >
                            <div 
                              className="fw-bold mb-1" 
                              style={{ color: '#2b2219', fontSize: '0.98rem' }}
                              data-block-key="service.design-services.impressions_title"
                            >
                              {t('service.design-services.impressions_title', 'First Impressions That Sell')}
                            </div>
                            <p 
                              className="mb-0" 
                              style={{ color: '#57534e', fontSize: '0.92rem', lineHeight: '1.68' }}
                              data-block-key="service.design-services.impressions_note"
                            >
                              {t('service.design-services.impressions_note', 'The cover is the first opportunity you have to connect with potential readers. That\'s why at Omni we make sure that your cover and interior layout meet the professional standards for commercially successful books.')}
                            </p>
                          </div>

                          <div className="d-flex flex-column gap-3 mb-4">
                            <div 
                              className="p-3.5 rounded-3 border"
                              style={{ background: '#ffffff', borderColor: '#ebd9c4', cursor: 'pointer' }}
                              onClick={() => {
                                const sub = selectedCategory?.subcategories?.find(s => s.id === 'interior-page-layout');
                                if (sub) handleJumpToSubcategory(selectedCategory, sub);
                              }}
                            >
                              <div className="d-flex align-items-center justify-content-between mb-2">
                                <h5 
                                  className="fw-bold m-0" 
                                  style={{ color: '#2b2219', fontSize: '1.08rem' }}
                                  data-block-key="service.design-services.layout_title"
                                >
                                  <i className="bi bi-layout-text-window-reverse me-2" style={{ color: '#ad7d42' }}></i>
                                  {t('service.design-services.layout_title', 'Interior Page Layout')}
                                </h5>
                                <span className="publishing-package-arrow-badge"><i className="bi bi-arrow-right-short"></i></span>
                              </div>
                              <p 
                                className="mb-0" 
                                style={{ color: '#57534e', fontSize: '0.93rem', lineHeight: '1.7' }}
                                data-block-key="service.design-services.layout_desc"
                              >
                                {t('service.design-services.layout_desc', 'Careful planning and execution of the layout of your book is very important. Readers need to be able to easily follow the text of your book. Our professionals will help you create the best layout for your book.')}
                              </p>
                            </div>

                            <div 
                              className="p-3.5 rounded-3 border"
                              style={{ background: '#ffffff', borderColor: '#ebd9c4', cursor: 'pointer' }}
                              onClick={() => {
                                const sub = selectedCategory?.subcategories?.find(s => s.id === 'cover-design');
                                if (sub) handleJumpToSubcategory(selectedCategory, sub);
                              }}
                            >
                              <div className="d-flex align-items-center justify-content-between mb-2">
                                <h5 
                                  className="fw-bold m-0" 
                                  style={{ color: '#2b2219', fontSize: '1.08rem' }}
                                  data-block-key="service.design-services.cover_title"
                                >
                                  <i className="bi bi-image me-2" style={{ color: '#ad7d42' }}></i>
                                  {t('service.design-services.cover_title', 'Cover Design')}
                                </h5>
                                <span className="publishing-package-arrow-badge"><i className="bi bi-arrow-right-short"></i></span>
                              </div>
                              <p 
                                className="mb-0" 
                                style={{ color: '#57534e', fontSize: '0.93rem', lineHeight: '1.7' }}
                                data-block-key="service.design-services.cover_desc"
                              >
                                {t('service.design-services.cover_desc', 'The cover is the first opportunity you have to connect with potential readers. That\'s why at Omni we make sure that your cover will meet the professional standards for commercially successful books. After all, when a book is sitting on the shelf, potential readers don\'t look to see how a book is published. They only know whether the cover image draws their attention or the back cover copy makes them to want to read more. These elements make a great cover, and that is why we pay attention to these details when we are publishing your book.')}
                              </p>
                            </div>

                            <div 
                              className="p-3.5 rounded-3 border"
                              style={{ background: '#ffffff', borderColor: '#ebd9c4', cursor: 'pointer' }}
                              onClick={() => {
                                const sub = selectedCategory?.subcategories?.find(s => s.id === 'cover-design');
                                if (sub) handleJumpToSubcategory(selectedCategory, sub);
                              }}
                            >
                              <div className="d-flex align-items-center justify-content-between mb-2">
                                <h5 
                                  className="fw-bold m-0" 
                                  style={{ color: '#2b2219', fontSize: '1.08rem' }}
                                  data-block-key="service.design-services.stock_title"
                                >
                                  <i className="bi bi-images me-2" style={{ color: '#ad7d42' }}></i>
                                  {t('service.design-services.stock_title', 'Stock Images')}
                                </h5>
                                <span className="publishing-package-arrow-badge"><i className="bi bi-arrow-right-short"></i></span>
                              </div>
                              <p 
                                className="mb-0" 
                                style={{ color: '#57534e', fontSize: '0.93rem', lineHeight: '1.7' }}
                                data-block-key="service.design-services.stock_desc"
                              >
                                {t('service.design-services.stock_desc', 'All books published via the Omni standard publishing packages receive custom-designed covers, produced in full color. Within the realm of this custom-designed cover, you have the option to choose two images, free of charge, from the millions found through Getty Images.')}
                              </p>
                            </div>

                            <div 
                              className="p-3.5 rounded-3 border"
                              style={{ background: '#ffffff', borderColor: '#ebd9c4', cursor: 'pointer' }}
                              onClick={() => {
                                const sub = selectedCategory?.subcategories?.find(s => s.id === 'black-and-white-illustrations');
                                if (sub) handleJumpToSubcategory(selectedCategory, sub);
                              }}
                            >
                              <div className="d-flex align-items-center justify-content-between mb-2">
                                <h5 
                                  className="fw-bold m-0" 
                                  style={{ color: '#2b2219', fontSize: '1.08rem' }}
                                  data-block-key="service.design-services.bw_illustrations_title"
                                >
                                  <i className="bi bi-brush me-2" style={{ color: '#ad7d42' }}></i>
                                  {t('service.design-services.bw_illustrations_title', 'Interior Black-and-White Illustrations')}
                                </h5>
                                <span className="publishing-package-arrow-badge"><i className="bi bi-arrow-right-short"></i></span>
                              </div>
                              <p 
                                className="mb-0" 
                                style={{ color: '#57534e', fontSize: '0.93rem', lineHeight: '1.7' }}
                                data-block-key="service.design-services.bw_illustrations_desc"
                              >
                                {t('service.design-services.bw_illustrations_desc', 'Elevate your book to the next creative level with custom artwork produced in our in-house art studio. The Omni team of seasoned studio artists will work with you to produce striking black-and-white illustrations that add visual interest to your book’s content.')}
                              </p>
                            </div>

                            <div 
                              className="p-3.5 rounded-3 border"
                              style={{ background: '#ffffff', borderColor: '#ebd9c4', cursor: 'pointer' }}
                              onClick={() => {
                                const sub = selectedCategory?.subcategories?.find(s => s.id === 'color-illustrations');
                                if (sub) handleJumpToSubcategory(selectedCategory, sub);
                              }}
                            >
                              <div className="d-flex align-items-center justify-content-between mb-2">
                                <h5 
                                  className="fw-bold m-0" 
                                  style={{ color: '#2b2219', fontSize: '1.08rem' }}
                                  data-block-key="service.design-services.color_illustrations_title"
                                >
                                  <i className="bi bi-palette me-2" style={{ color: '#ad7d42' }}></i>
                                  {t('service.design-services.color_illustrations_title', 'Interior Color Illustrations')}
                                </h5>
                                <span className="publishing-package-arrow-badge"><i className="bi bi-arrow-right-short"></i></span>
                              </div>
                              <p 
                                className="mb-0" 
                                style={{ color: '#57534e', fontSize: '0.93rem', lineHeight: '1.7' }}
                                data-block-key="service.design-services.color_illustrations_desc"
                              >
                                {t('service.design-services.color_illustrations_desc', 'One of Omni\'s talented studio artists will use your descriptions and feedback to create custom color illustrations that reflect your book’s unique style.')}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {selectedService?.slug === 'production' && (
                        <div className="category-production-overview">
                          <div 
                            className="editorial-note-callout p-3 mb-4 rounded-3"
                            style={{
                              background: '#faf6f0',
                              border: '1px solid rgba(173, 125, 66, 0.3)',
                              borderLeft: '5px solid #ad7d42'
                            }}
                          >
                            <div 
                              className="fw-bold mb-1" 
                              style={{ color: '#2b2219', fontSize: '0.98rem' }}
                              data-block-key="service.production.workflow_title"
                            >
                              {t('service.production.workflow_title', 'Seamless Publishing Workflow')}
                            </div>
                            <p 
                              className="mb-0" 
                              style={{ color: '#57534e', fontSize: '0.92rem', lineHeight: '1.68' }}
                              data-block-key="service.production.workflow_note"
                            >
                              {t('service.production.workflow_note', 'Preparing your manuscript for submission and publishing is a whole lot easier when we do it for you. Omni handles everything from raw document conversion to post-layout revisions and catalog resubmissions.')}
                            </p>
                          </div>

                          <div className="d-flex flex-column gap-3 mb-4">
                            <div 
                              className="p-3.5 rounded-3 border"
                              style={{ background: '#ffffff', borderColor: '#ebd9c4', cursor: 'pointer' }}
                              onClick={() => {
                                const sub = selectedCategory?.subcategories?.find(s => s.id === 'pre-manuscript-services');
                                if (sub) handleJumpToSubcategory(selectedCategory, sub);
                              }}
                            >
                              <div className="d-flex align-items-center justify-content-between mb-2">
                                <h5 
                                  className="fw-bold m-0" 
                                  style={{ color: '#2b2219', fontSize: '1.08rem' }}
                                  data-block-key="service.production.pre_manuscript_title"
                                >
                                  <i className="bi bi-file-earmark-text me-2" style={{ color: '#ad7d42' }}></i>
                                  {t('service.production.pre_manuscript_title', 'Pre-Manuscript Services')}
                                </h5>
                                <span className="publishing-package-arrow-badge"><i className="bi bi-arrow-right-short"></i></span>
                              </div>
                              <p 
                                className="mb-0" 
                                style={{ color: '#57534e', fontSize: '0.93rem', lineHeight: '1.7' }}
                                data-block-key="service.production.pre_manuscript_desc"
                              >
                                {t('service.production.pre_manuscript_desc', 'Preparing your manuscript for submission and for publishing is a whole lot easier when we do it for you. Omni can convert your typewritten manuscript, or previously published book, to a word-processed format.')}
                              </p>
                            </div>

                            <div 
                              className="p-3.5 rounded-3 border"
                              style={{ background: '#ffffff', borderColor: '#ebd9c4', cursor: 'pointer' }}
                              onClick={() => {
                                const sub = selectedCategory?.subcategories?.find(s => s.id === 'post-page-layout-services');
                                if (sub) handleJumpToSubcategory(selectedCategory, sub);
                              }}
                            >
                              <div className="d-flex align-items-center justify-content-between mb-2">
                                <h5 
                                  className="fw-bold m-0" 
                                  style={{ color: '#2b2219', fontSize: '1.08rem' }}
                                  data-block-key="service.production.post_page_title"
                                >
                                  <i className="bi bi-pencil-square me-2" style={{ color: '#ad7d42' }}></i>
                                  {t('service.production.post_page_title', 'Post-Page Layout Services')}
                                </h5>
                                <span className="publishing-package-arrow-badge"><i className="bi bi-arrow-right-short"></i></span>
                              </div>
                              <p 
                                className="mb-0" 
                                style={{ color: '#57534e', fontSize: '0.93rem', lineHeight: '1.7' }}
                                data-block-key="service.production.post_page_desc"
                              >
                                {t('service.production.post_page_desc', 'Omni allows you to make changes to your book after the manuscript has been laid out by our designers. Charges will be applied.')}
                              </p>
                            </div>

                            <div 
                              className="p-3.5 rounded-3 border"
                              style={{ background: '#ffffff', borderColor: '#ebd9c4', cursor: 'pointer' }}
                              onClick={() => {
                                const sub = selectedCategory?.subcategories?.find(s => s.id === 'resubmission');
                                if (sub) handleJumpToSubcategory(selectedCategory, sub);
                              }}
                            >
                              <div className="d-flex align-items-center justify-content-between mb-2">
                                <h5 
                                  className="fw-bold m-0" 
                                  style={{ color: '#2b2219', fontSize: '1.08rem' }}
                                  data-block-key="service.production.resubmission_title"
                                >
                                  <i className="bi bi-arrow-repeat me-2" style={{ color: '#ad7d42' }}></i>
                                  {t('service.production.resubmission_title', 'Resubmission')}
                                </h5>
                                <span className="publishing-package-arrow-badge"><i className="bi bi-arrow-right-short"></i></span>
                              </div>
                              <p 
                                className="mb-0" 
                                style={{ color: '#57534e', fontSize: '0.93rem', lineHeight: '1.7' }}
                                data-block-key="service.production.resubmission_desc"
                              >
                                {t('service.production.resubmission_desc', 'Once your book has gone live and is for sale, you can still correct errors or other issues that might have been missed. Resubmission services are available for a fee.')}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {selectedService?.slug === 'marketing-services' && (
                        <div className="category-marketing-overview">
                          <blockquote 
                            className="editorial-testimonial-quote"
                            style={{
                              margin: '0 0 24px',
                              padding: '16px 20px',
                              borderLeft: '4px solid #ad7d42',
                              background: 'rgba(173, 125, 66, 0.05)',
                              borderRadius: '0 8px 8px 0',
                              fontStyle: 'italic',
                              color: '#444'
                            }}
                          >
                            <p className="mb-2" style={{ fontSize: '0.95rem', lineHeight: '1.6' }} data-block-key="service.marketing-services.quote">
                              {t('service.marketing-services.quote', '"Once my book was released, I had to think about marketing and publicity. I received tremendous guidance from my marketing consultant and publicist! They made my life easy and worry-free. Thank you Omni for helping independent authors publish and market their books with confidence!"')}
                            </p>
                            <footer 
                              className="editorial-quote-author" 
                              style={{ fontStyle: 'normal', fontWeight: '600', color: '#666', fontSize: '0.88rem' }}
                              data-block-key="service.marketing-services.quote_author"
                            >
                              {t('service.marketing-services.quote_author', '—Carisia Switala, author of Eternity\'s Secret')}
                            </footer>
                          </blockquote>

                          <div className="mb-4">
                            <p 
                              className="mb-0" 
                              style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}
                              data-block-key="service.marketing-services.intro_p1"
                            >
                              {t('service.marketing-services.intro_p1', 'If you want your book to sell, you’ll want to do more than just hope for the best. Our selection of promotional products and services allows authors to build a dynamic platform from which they can effectively promote and sell their books. Create your marketing plan and materials with our simple step-by-step tools.')}
                            </p>
                          </div>

                          <div className="d-flex flex-column gap-3 mb-4">
                            <div 
                              className="p-3.5 rounded-3 border"
                              style={{ background: '#ffffff', borderColor: '#ebd9c4', cursor: 'pointer' }}
                              onClick={() => {
                                const sub = selectedCategory?.subcategories?.find(s => s.id === 'video-book-trailer');
                                if (sub) handleJumpToSubcategory(selectedCategory, sub);
                              }}
                            >
                              <div className="d-flex align-items-center justify-content-between mb-2">
                                <h5 
                                  className="fw-bold m-0" 
                                  style={{ color: '#2b2219', fontSize: '1.08rem' }}
                                  data-block-key="service.marketing-services.videos_title"
                                >
                                  <i className="bi bi-camera-video me-2" style={{ color: '#ad7d42' }}></i>
                                  {t('service.marketing-services.videos_title', 'Author and Book Videos')}
                                </h5>
                                <span className="publishing-package-arrow-badge"><i className="bi bi-arrow-right-short"></i></span>
                              </div>
                              <p 
                                className="mb-0" 
                                style={{ color: '#57534e', fontSize: '0.93rem', lineHeight: '1.7' }}
                                data-block-key="service.marketing-services.videos_desc"
                              >
                                {t('service.marketing-services.videos_desc', 'Give a mass audience a look inside your story. With your professional book video or author interview, you can captivate your audience visually while your story unfolds before their eyes.')}
                              </p>
                            </div>

                            <div 
                              className="p-3.5 rounded-3 border"
                              style={{ background: '#ffffff', borderColor: '#ebd9c4', cursor: 'pointer' }}
                              onClick={() => {
                                const sub = selectedCategory?.subcategories?.find(s => s.id === 'publicity-services');
                                if (sub) handleJumpToSubcategory(selectedCategory, sub);
                              }}
                            >
                              <div className="d-flex align-items-center justify-content-between mb-2">
                                <h5 
                                  className="fw-bold m-0" 
                                  style={{ color: '#2b2219', fontSize: '1.08rem' }}
                                  data-block-key="service.marketing-services.publicity_title"
                                >
                                  <i className="bi bi-megaphone me-2" style={{ color: '#ad7d42' }}></i>
                                  {t('service.marketing-services.publicity_title', 'Publicity Services')}
                                </h5>
                                <span className="publishing-package-arrow-badge"><i className="bi bi-arrow-right-short"></i></span>
                              </div>
                              <p 
                                className="mb-0" 
                                style={{ color: '#57534e', fontSize: '0.93rem', lineHeight: '1.7' }}
                                data-block-key="service.marketing-services.publicity_desc"
                              >
                                {t('service.marketing-services.publicity_desc', 'Get your book noticed from a unique platform created by our publicity and media services.')}
                              </p>
                            </div>

                            <div 
                              className="p-3.5 rounded-3 border"
                              style={{ background: '#ffffff', borderColor: '#ebd9c4', cursor: 'pointer' }}
                              onClick={() => {
                                const sub = selectedCategory?.subcategories?.find(s => s.id === 'book-reviews');
                                if (sub) handleJumpToSubcategory(selectedCategory, sub);
                              }}
                            >
                              <div className="d-flex align-items-center justify-content-between mb-2">
                                <h5 
                                  className="fw-bold m-0" 
                                  style={{ color: '#2b2219', fontSize: '1.08rem' }}
                                  data-block-key="service.marketing-services.reviews_title"
                                >
                                  <i className="bi bi-star-half me-2" style={{ color: '#ad7d42' }}></i>
                                  {t('service.marketing-services.reviews_title', 'Book Reviews')}
                                </h5>
                                <span className="publishing-package-arrow-badge"><i className="bi bi-arrow-right-short"></i></span>
                              </div>
                              <p 
                                className="mb-0" 
                                style={{ color: '#57534e', fontSize: '0.93rem', lineHeight: '1.7' }}
                                data-block-key="service.marketing-services.reviews_desc"
                              >
                                {t('service.marketing-services.reviews_desc', 'A book review is an excellent way to generate interest for your title. Book readers, buyers, and retailers rely on the opinion of experts when considering which titles are worth purchasing and reading. Omni offers four distinct review services to help you elevate your book’s credibility and raise its marketing potential.')}
                              </p>
                            </div>

                            <div 
                              className="p-3.5 rounded-3 border"
                              style={{ background: '#ffffff', borderColor: '#ebd9c4', cursor: 'pointer' }}
                              onClick={() => {
                                const sub = selectedCategory?.subcategories?.find(s => s.id === 'book-signings-and-galleries');
                                if (sub) handleJumpToSubcategory(selectedCategory, sub);
                              }}
                            >
                              <div className="d-flex align-items-center justify-content-between mb-2">
                                <h5 
                                  className="fw-bold m-0" 
                                  style={{ color: '#2b2219', fontSize: '1.08rem' }}
                                  data-block-key="service.marketing-services.signings_title"
                                >
                                  <i className="bi bi-calendar-event me-2" style={{ color: '#ad7d42' }}></i>
                                  {t('service.marketing-services.signings_title', 'Book Signings and Galleries')}
                                </h5>
                                <span className="publishing-package-arrow-badge"><i className="bi bi-arrow-right-short"></i></span>
                              </div>
                              <p 
                                className="mb-0" 
                                style={{ color: '#57534e', fontSize: '0.93rem', lineHeight: '1.7' }}
                                data-block-key="service.marketing-services.signings_desc"
                              >
                                {t('service.marketing-services.signings_desc', 'A book exhibition or book signing event can be a terrific way to create buzz around your book. As an exhibitor at many of the largest trade shows and book events, we\'ve put our books in the hands of booklovers and industry insiders through Omni book exhibition services.')}
                              </p>
                            </div>

                            <div 
                              className="p-3.5 rounded-3 border"
                              style={{ background: '#ffffff', borderColor: '#ebd9c4', cursor: 'pointer' }}
                              onClick={() => {
                                const sub = selectedCategory?.subcategories?.find(s => s.id === 'hollywood-book-to-screen');
                                if (sub) handleJumpToSubcategory(selectedCategory, sub);
                              }}
                            >
                              <div className="d-flex align-items-center justify-content-between mb-2">
                                <h5 
                                  className="fw-bold m-0" 
                                  style={{ color: '#2b2219', fontSize: '1.08rem' }}
                                  data-block-key="service.marketing-services.hollywood_title"
                                >
                                  <i className="bi bi-film me-2" style={{ color: '#ad7d42' }}></i>
                                  {t('service.marketing-services.hollywood_title', 'Hollywood Book-to-Screen')}
                                </h5>
                                <span className="publishing-package-arrow-badge"><i className="bi bi-arrow-right-short"></i></span>
                              </div>
                              <p 
                                className="mb-0" 
                                style={{ color: '#57534e', fontSize: '0.93rem', lineHeight: '1.7' }}
                                data-block-key="service.marketing-services.hollywood_desc"
                              >
                                {t('service.marketing-services.hollywood_desc', 'Have you ever considered for even a moment that your book could be adapted into a movie or television series? If the answer is yes, then Omni can make your book available to agents, producers, directors, writers and actors through multiple new services available to our authors.')}
                              </p>
                            </div>

                            <div 
                              className="p-3.5 rounded-3 border"
                              style={{ background: '#ffffff', borderColor: '#ebd9c4', cursor: 'pointer' }}
                              onClick={() => {
                                const sub = selectedCategory?.subcategories?.find(s => s.id === 'internet-marketing');
                                if (sub) handleJumpToSubcategory(selectedCategory, sub);
                              }}
                            >
                              <div className="d-flex align-items-center justify-content-between mb-2">
                                <h5 
                                  className="fw-bold m-0" 
                                  style={{ color: '#2b2219', fontSize: '1.08rem' }}
                                  data-block-key="service.marketing-services.internet_title"
                                >
                                  <i className="bi bi-globe me-2" style={{ color: '#ad7d42' }}></i>
                                  {t('service.marketing-services.internet_title', 'Internet Marketing')}
                                </h5>
                                <span className="publishing-package-arrow-badge"><i className="bi bi-arrow-right-short"></i></span>
                              </div>
                              <p 
                                className="mb-0" 
                                style={{ color: '#57534e', fontSize: '0.93rem', lineHeight: '1.7' }}
                                data-block-key="service.marketing-services.internet_desc"
                              >
                                {t('service.marketing-services.internet_desc', 'Having your own website, internet search, or preview tools are effective and economical ways to promote your book, enhance your image as an author, and communicate with prospective readers around the world.')}
                              </p>
                            </div>

                            <div 
                              className="p-3.5 rounded-3 border"
                              style={{ background: '#ffffff', borderColor: '#ebd9c4', cursor: 'pointer' }}
                              onClick={() => {
                                const sub = selectedCategory?.subcategories?.find(s => s.id === 'radio-services');
                                if (sub) handleJumpToSubcategory(selectedCategory, sub);
                              }}
                            >
                              <div className="d-flex align-items-center justify-content-between mb-2">
                                <h5 
                                  className="fw-bold m-0" 
                                  style={{ color: '#2b2219', fontSize: '1.08rem' }}
                                  data-block-key="service.marketing-services.radio_title"
                                >
                                  <i className="bi bi-broadcast me-2" style={{ color: '#ad7d42' }}></i>
                                  {t('service.marketing-services.radio_title', 'Radio Services')}
                                </h5>
                                <span className="publishing-package-arrow-badge"><i className="bi bi-arrow-right-short"></i></span>
                              </div>
                              <p 
                                className="mb-0" 
                                style={{ color: '#57534e', fontSize: '0.93rem', lineHeight: '1.7' }}
                                data-block-key="service.marketing-services.radio_desc"
                              >
                                {t('service.marketing-services.radio_desc', 'Have you ever considered how a radio interview might affect your book’s marketing plan? If the answer is yes, then Omni can make your voice available on the airwaves to help you reach new audiences and further your cause.')}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {selectedService?.slug === 'bookselling' && (
                        <div className="category-bookselling-overview">
                          <div 
                            className="editorial-note-callout p-3 mb-4 rounded-3"
                            style={{
                              background: '#faf6f0',
                              border: '1px solid rgba(173, 125, 66, 0.3)',
                              borderLeft: '5px solid #ad7d42'
                            }}
                          >
                            <div 
                              className="fw-bold mb-1" 
                              style={{ color: '#2b2219', fontSize: '0.98rem' }}
                              data-block-key="service.bookselling.distribution_title"
                            >
                              {t('service.bookselling.distribution_title', 'Worldwide Retail Distribution & Legal Protection')}
                            </div>
                            <p 
                              className="mb-0" 
                              style={{ color: '#57534e', fontSize: '0.92rem', lineHeight: '1.68' }}
                              data-block-key="service.bookselling.distribution_note"
                            >
                              {t('service.bookselling.distribution_note', 'Once your book is published, we make it available for order online with retail outlets worldwide. Our bookselling promotional services provide you the opportunity to actively promote and protect your book.')}
                            </p>
                          </div>

                          <div className="d-flex flex-column gap-3 mb-4">
                            <div 
                              className="p-3.5 rounded-3 border"
                              style={{ background: '#ffffff', borderColor: '#ebd9c4', cursor: 'pointer' }}
                              onClick={() => {
                                const sub = selectedCategory?.subcategories?.find(s => s.id === 'bookstore-essentials');
                                if (sub) handleJumpToSubcategory(selectedCategory, sub);
                              }}
                            >
                              <div className="d-flex align-items-center justify-content-between mb-2">
                                <h5 
                                  className="fw-bold m-0" 
                                  style={{ color: '#2b2219', fontSize: '1.08rem' }}
                                  data-block-key="service.bookselling.essentials_title"
                                >
                                  <i className="bi bi-shop me-2" style={{ color: '#ad7d42' }}></i>
                                  {t('service.bookselling.essentials_title', 'Bookstore Essentials')}
                                </h5>
                                <span className="publishing-package-arrow-badge"><i className="bi bi-arrow-right-short"></i></span>
                              </div>
                              <p 
                                className="mb-0" 
                                style={{ color: '#57534e', fontSize: '0.93rem', lineHeight: '1.7' }}
                                data-block-key="service.bookselling.essentials_desc"
                              >
                                {t('service.bookselling.essentials_desc', 'Through Omni Bookstore Essentials, your book receives professional bookselling services that make your book even more attractive to bookstores. By making your book returnable or adding preview services to your book, bookstores and other book buyers receive additional incentives to stock or purchase your book.')}
                              </p>
                            </div>

                            <div 
                              className="p-3.5 rounded-3 border"
                              style={{ background: '#ffffff', borderColor: '#ebd9c4', cursor: 'pointer' }}
                              onClick={() => {
                                const sub = selectedCategory?.subcategories?.find(s => s.id === 'registration');
                                if (sub) handleJumpToSubcategory(selectedCategory, sub);
                              }}
                            >
                              <div className="d-flex align-items-center justify-content-between mb-2">
                                <h5 
                                  className="fw-bold m-0" 
                                  style={{ color: '#2b2219', fontSize: '1.08rem' }}
                                  data-block-key="service.bookselling.registration_title"
                                >
                                  <i className="bi bi-shield-check me-2" style={{ color: '#ad7d42' }}></i>
                                  {t('service.bookselling.registration_title', 'Registration')}
                                </h5>
                                <span className="publishing-package-arrow-badge"><i className="bi bi-arrow-right-short"></i></span>
                              </div>
                              <p 
                                className="mb-0" 
                                style={{ color: '#57534e', fontSize: '0.93rem', lineHeight: '1.7' }}
                                data-block-key="service.bookselling.registration_desc"
                              >
                                {t('service.bookselling.registration_desc', 'As you make your work available to the public, you want to make sure you have the appropriate protection. There are two ways we can help you with that. The first is registering your copyright with the U.S. Copyright Office. Second, a Library of Congress Control Number makes your book more accessible to librarians and book vendors.')}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Subcategories Options Grid */}
                      {selectedCategory?.subcategories && selectedCategory.subcategories.length > 0 && selectedCategory.id !== 'publishing-packages' && selectedCategory.id !== 'evaluation-services' && (
                        <div className="publishing-options-section mb-4">
                          <h4 className="publishing-options-title">
                            Explore {selectedCategory.title} Options
                          </h4>
                          <p className="publishing-options-desc">
                            Select any section below to view individual specialist services, packages, and detailed offerings.
                          </p>

                          <div className="publishing-packages-container">
                            {selectedCategory.subcategories.map((sub) => {
                              const subServiceCount = (sub.services || []).filter(s => s.slug !== selectedCategory.id).length;
                              const subSummary = SUBCATEGORY_DESCRIPTIONS[sub.id] || `${sub.title} services designed for published authors.`;
                              return (
                                <div 
                                  key={sub.id}
                                  className="publishing-package-card"
                                  onClick={() => handleJumpToSubcategory(selectedCategory, sub)}
                                  role="button"
                                  tabIndex={0}
                                >
                                  <div className="publishing-package-card-header">
                                    <h5 className="publishing-package-card-title m-0">
                                      {sub.title}
                                    </h5>
                                    <div className="d-flex align-items-center gap-2">
                                      <span className="badge bg-light text-muted border" style={{ fontSize: '0.72rem' }}>
                                        {subServiceCount} {subServiceCount === 1 ? 'Service' : 'Services'}
                                      </span>
                                      <span className="publishing-package-arrow-badge">
                                        <i className="bi bi-arrow-right-short"></i>
                                      </span>
                                    </div>
                                  </div>
                                  <p className="publishing-package-card-summary">
                                    {subSummary}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (selectedCategory?.id === 'publishing-packages' || selectedService?.categoryId === 'publishing-packages' || selectedService?.isPackage) && displayFeatures && displayFeatures.length > 0 ? (
                    /* What's Included Feature Checklist only for Publishing Packages */
                    <div className="features-checklist-section">
                      <h5 className="fw-bold mb-3" style={{ color: '#2b2219', fontSize: '1.1rem' }} data-block-key="services.included.heading">
                        {includedHeading}
                      </h5>

                      <div className="service-features-list">
                        {displayFeatures.map((feat, idx) => (
                          <div className="feature-checkpoint-item" key={idx}>
                            <i className="bi bi-patch-check-fill feature-check-icon"></i>
                            <span>{feat}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {/* Direct Action Card (Book / Consult) */}
                  <div className="service-cta-card">
                    <div className="service-cta-text-col">
                      <h4 className="fw-bold mb-1" style={{ color: '#ffffff', fontSize: '1.25rem' }} data-block-key="services.cta.heading">
                        {ctaHeading}
                      </h4>
                      <p className="small mb-0" style={{ color: '#fae2b2' }} data-block-key="services.cta.subtitle">
                        {ctaSubtitle}
                      </p>
                    </div>

                    <div className="service-cta-actions">
                      <Link to="/#contact" className="service-cta-btn">
                        <span data-block-key="services.cta.btn_text">{ctaBtnText}</span>
                        <i className="bi bi-arrow-right"></i>
                      </Link>

                      <div className="service-email-action-row">
                        <span className="service-email-label">or email us on</span>
                        <button
                          type="button"
                          className={`service-email-chip ${emailCopied ? 'copied' : ''}`}
                          onClick={handleCopyEmail}
                          title={emailCopied ? "Copied to clipboard!" : "Click to copy email address"}
                          aria-label={`Copy email: ${ctaEmail}`}
                        >
                          <i className={`bi ${emailCopied ? 'bi-check-circle-fill' : 'bi-envelope-fill'} email-lead-icon`}></i>
                          <span className="service-email-address" data-block-key="services.cta.email">
                            {ctaEmail}
                          </span>
                          <span className="email-copy-icon-btn" aria-hidden="true">
                            <i className={`bi ${emailCopied ? 'bi-check2' : 'bi-clipboard'}`}></i>
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Mobile Next / Previous Controls */}
                  <div className="service-nav-controls">
                    <button
                      type="button"
                      className="service-step-btn"
                      disabled={!prevService}
                      onClick={() => prevService && handleSelectService(prevService)}
                    >
                      <i className="bi bi-arrow-left"></i>
                      <span className="d-none d-sm-inline">Previous: </span>
                      <span className="text-truncate" style={{ maxWidth: '140px' }}>
                        {prevService ? t(`service.${prevService.slug}.title`, prevService.title) : 'None'}
                      </span>
                    </button>

                    <button
                      type="button"
                      className="service-step-btn"
                      disabled={!nextService}
                      onClick={() => nextService && handleSelectService(nextService)}
                    >
                      <span className="d-none d-sm-inline">Next: </span>
                      <span className="text-truncate" style={{ maxWidth: '140px' }}>
                        {nextService ? t(`service.${nextService.slug}.title`, nextService.title) : 'None'}
                      </span>
                      <i className="bi bi-arrow-right"></i>
                    </button>
                  </div>

                </div>
              ) : (
                <div className="text-center p-5 bg-white rounded-3 shadow-sm">
                  <i className="bi bi-search fs-1 text-muted"></i>
                  <h4 className="mt-3">No matching services found</h4>
                  <p className="text-muted">Try clearing your search query or selecting another category.</p>
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    onClick={() => {
                      setSearchQuery('');
                      setActiveCategoryTag('all');
                    }}
                  >
                    Reset Filters
                  </button>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Modern Slide-Over Off-Canvas Drawer for Mobile */}
        <div
          className={`mobile-drawer-overlay ${drawerOpen ? 'open' : ''}`}
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
        <div className={`mobile-drawer ${drawerOpen ? 'open' : ''}`} role="dialog" aria-modal="true">
          <div className="drawer-header">
            <h3 className="drawer-title">
              <i className="bi bi-grid-fill" style={{ color: '#d8aa71' }}></i>
              Service Categories
            </h3>
            <button
              type="button"
              className="drawer-close-btn"
              onClick={() => setDrawerOpen(false)}
              aria-label="Close categories menu"
            >
              <i className="bi bi-x-lg"></i>
            </button>
          </div>

          <div className="drawer-body">
            {catalog.map((cat) => {
              const isExplicit = expandedCategories[cat.id] !== undefined
                ? expandedCategories[cat.id]
                : expandedCategories[cat.tag];
              const isExpanded = isExplicit !== undefined
                ? Boolean(isExplicit)
                : (searchQuery.length > 0 || (selectedCategory && (selectedCategory.id === cat.id || selectedCategory.tag === cat.tag)));
              const catTitle = t(`service.${cat.id}.title`, cat.title);
              const isCatOverviewSelected = selectedService?.slug === cat.id;
              return (
                <div key={cat.id} className="sidebar-category-group mb-2">
                  <button
                    type="button"
                    className={`category-accordion-btn ${isExpanded ? 'expanded' : ''} ${isCatOverviewSelected ? 'active-category' : ''}`}
                    onClick={() => {
                      if (isExpanded) {
                        setExpandedCategories((prev) => ({
                          ...prev,
                          [cat.id]: false,
                          [cat.tag]: false,
                        }));
                        return;
                      }
                      setExpandedCategories((prev) => ({
                        ...prev,
                        [cat.id]: true,
                        [cat.tag]: true,
                      }));
                      const catOverviewSvc = allServicesList.find((s) => s.slug === cat.id);
                      if (catOverviewSvc) {
                        handleSelectService(
                          {
                            ...catOverviewSvc,
                            title: catOverviewSvc.title || t(`service.${catOverviewSvc.slug}.title`, cat.title),
                            lead: catOverviewSvc.lead || catOverviewSvc.lead_paragraph || t(`service.${catOverviewSvc.slug}.lead`, ''),
                          },
                          cat,
                          cat.subcategories[0],
                          true
                        );
                        setDrawerOpen(false);
                      } else if (cat.subcategories[0]?.services[0]) {
                        const targetSvc = cat.subcategories[0].services[0];
                        handleSelectService({ ...targetSvc, title: targetSvc.title || t(`service.${targetSvc.slug}.title`, '') }, cat, cat.subcategories[0], true);
                        setDrawerOpen(false);
                      }
                    }}
                  >
                    <span className="d-flex align-items-center gap-2">
                      <i className={`bi ${cat.icon}`} style={{ color: '#ad7d42' }}></i>
                      <span data-block-key={`service.${cat.id}.title`}>{catTitle}</span>
                    </span>
                    <span
                      className="cat-toggle-chevron-btn"
                      title={isExpanded ? "Collapse category" : "Expand category"}
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedCategories((prev) => ({
                          ...prev,
                          [cat.id]: !isExpanded,
                          [cat.tag]: !isExpanded,
                        }));
                      }}
                    >
                      <i className={`bi bi-chevron-${isExpanded ? 'down' : 'right'} small`}></i>
                    </span>
                  </button>

                  {isExpanded && (
                    <div className="subcategories-list">
                      {cat.subcategories.map((sub) => {
                        const subTitle = t(`service.${sub.id}.title`, sub.title);

                        if (cat.id === 'publishing-packages') {
                          const isSubOverviewSelected = Boolean(selectedService?.slug === sub.id || (selectedService?.isSubcategoryOverview && selectedService?.slug === sub.id));
                          return (
                            <div key={sub.id} className="subcategory-group mb-2">
                              <button
                                type="button"
                                className={`subcategory-dropdown-btn ${isSubOverviewSelected ? 'active-subcategory' : ''}`}
                                onClick={() => {
                                  handleSelectSubcategory(cat, sub);
                                  setDrawerOpen(false);
                                }}
                              >
                                <span className="subcategory-label-text" data-block-key={`service.${sub.id}.title`}>
                                  {subTitle}
                                </span>
                              </button>
                            </div>
                          );
                        }

                        const filteredServices = (sub.services || []).filter(
                          (svc) => svc.slug !== cat.id
                        );
                        if (filteredServices.length === 0) return null;

                        const defaultSubOpen =
                          selectedService?.subcategoryId === sub.id ||
                          filteredServices.some((s) => s.slug === selectedService?.slug) ||
                          cat.subcategories.length === 1 ||
                          searchQuery.length > 0;

                        const isSubExpanded =
                          expandedSubcategories[sub.id] !== undefined
                            ? expandedSubcategories[sub.id]
                            : defaultSubOpen;

                        const isSubOverviewSelected = Boolean(selectedService?.isSubcategoryOverview && selectedService?.slug === sub.id);

                        return (
                          <div key={sub.id} className="subcategory-group mb-2">
                            <button
                              type="button"
                              className={`subcategory-dropdown-btn ${isSubExpanded ? 'expanded' : ''} ${isSubOverviewSelected ? 'active-subcategory' : ''}`}
                              onClick={() => {
                                handleSelectSubcategory(cat, sub);
                                setDrawerOpen(false);
                              }}
                              aria-expanded={isSubExpanded}
                            >
                              <span className="subcategory-label-text" data-block-key={`service.${sub.id}.title`}>
                                {subTitle}
                              </span>
                              <span className="d-flex align-items-center gap-1">
                                <span className="subcat-count-badge">
                                  {filteredServices.length}
                                </span>
                                <span
                                  className="subcat-toggle-chevron-btn"
                                  title={isSubExpanded ? "Collapse" : "Expand"}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleSubcategoryAccordion(sub.id, e, defaultSubOpen);
                                  }}
                                >
                                  <i className={`bi bi-chevron-${isSubExpanded ? 'down' : 'right'} subcat-chevron`}></i>
                                </span>
                              </span>
                            </button>

                            {isSubExpanded && (
                              <div className="subcategory-services-list">
                                {filteredServices.map((svc) => {
                                  const isSelected = !selectedService?.isSubcategoryOverview && selectedService?.slug === svc.slug;
                                  const svcTitle = t(`service.${svc.slug}.title`, svc.title);
                                  return (
                                    <button
                                      key={svc.slug}
                                      type="button"
                                      className={`service-nav-item ${isSelected ? 'active' : ''}`}
                                      onClick={() => {
                                        handleSelectService({ ...svc, title: svcTitle }, cat, sub);
                                        setDrawerOpen(false);
                                      }}
                                    >
                                      <span className="text-truncate" data-block-key={`service.${svc.slug}.title`}>{svcTitle}</span>
                                      {isSelected && <i className="bi bi-check2"></i>}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

      </main>
    </div>
  );
}
