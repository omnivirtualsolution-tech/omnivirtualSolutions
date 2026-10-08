import React, { useState, useEffect, useMemo, useRef, useLayoutEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useCms } from '../context/CmsContext';
import './ServicesPage.css';

import DEFAULT_CATALOG from '../data/catalog.json';
import SERVICES_CONTENT from '../data/services-content.json';

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

// Safely highlight matching search tokens in text
function highlightMatch(text, query) {
  if (!query || !text) return text;
  const trimmed = query.trim();
  if (!trimmed) return text;
  try {
    const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) =>
      part.toLowerCase() === trimmed.toLowerCase() ? (
        <mark key={i} className="search-highlight-match">{part}</mark>
      ) : (
        part
      )
    );
  } catch (_) {
    return text;
  }
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
  const [expandedCategories, setExpandedCategories] = useState(() => {
    try {
      const saved = sessionStorage.getItem('omni_expanded_categories');
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return { 'eval-services': true };
  });
  const [expandedSubcategories, setExpandedSubcategories] = useState(() => {
    try {
      const saved = sessionStorage.getItem('omni_expanded_subcategories');
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return {};
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [emailCopied, setEmailCopied] = useState(false);

  // Refs for locking category cabinet scroll, smooth-scrolling, and search wrapper
  const sidebarRef = useRef(null);
  const contentColRef = useRef(null);
  const detailCardRef = useRef(null);
  const keepCabinetScrollRef = useRef(null);
  const searchWrapRef = useRef(null);

  // Close search dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  // Synchronize expanded state to sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem('omni_expanded_categories', JSON.stringify(expandedCategories));
    } catch (_) {}
  }, [expandedCategories]);

  useEffect(() => {
    try {
      sessionStorage.setItem('omni_expanded_subcategories', JSON.stringify(expandedSubcategories));
    } catch (_) {}
  }, [expandedSubcategories]);

  // Toggle subcategory expansion accordion
  const toggleSubcategoryAccordion = (subId, e, defaultOpen = false) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (sidebarRef.current) {
      keepCabinetScrollRef.current = sidebarRef.current.scrollTop;
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

  // Handle URL deep-linking, session recovery, or initial selection
  useEffect(() => {
    const effectiveServiceSlug = serviceParam || sessionStorage.getItem('omni_reading_service_slug');

    if (effectiveServiceSlug && allServicesList.length > 0) {
      const found = allServicesList.find((s) => s.slug === effectiveServiceSlug);
      if (found) {
        setSelectedService(found);
        setActiveCategoryTag(found.categoryTag);
        setExpandedCategories((prev) => ({ ...prev, [found.categoryTag]: true, [found.categoryId]: true }));
        if (found.subcategoryId) {
          setExpandedSubcategories((prev) => ({ ...prev, [found.subcategoryId]: true }));
        }
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

  // Synchronize current active service to URL and sessionStorage for reload persistence
  useEffect(() => {
    if (selectedService?.slug) {
      sessionStorage.setItem('omni_reading_service_slug', selectedService.slug);
      try {
        const currentUrl = new URL(window.location.href);
        if (currentUrl.searchParams.get('service') !== selectedService.slug) {
          currentUrl.searchParams.set('service', selectedService.slug);
          window.history.replaceState(null, '', currentUrl.toString());
        }
      } catch (_) {}
    }
  }, [selectedService]);

  // Ensure category cabinet scroll is maintained and never resets to top
  useLayoutEffect(() => {
    if (keepCabinetScrollRef.current !== null && sidebarRef.current) {
      sidebarRef.current.scrollTop = keepCabinetScrollRef.current;
    }
  });

  useEffect(() => {
    if (keepCabinetScrollRef.current !== null && sidebarRef.current) {
      const scrollPos = keepCabinetScrollRef.current;
      sidebarRef.current.scrollTop = scrollPos;
      const frameId = requestAnimationFrame(() => {
        if (sidebarRef.current) sidebarRef.current.scrollTop = scrollPos;
      });
      const timerId = setTimeout(() => {
        if (sidebarRef.current) sidebarRef.current.scrollTop = scrollPos;
      }, 150);
      return () => {
        cancelAnimationFrame(frameId);
        clearTimeout(timerId);
      };
    }
  }, [selectedService?.slug, expandedCategories, expandedSubcategories]);

  // Continuously record scroll positions (window scroll + cabinet scroll) for accidental refresh restoration
  useEffect(() => {
    let scrollTimeout = null;

    const handleWindowScroll = () => {
      if (scrollTimeout) clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        sessionStorage.setItem('omni_reading_scroll_y', String(window.scrollY));
      }, 60);
    };

    const handleCabinetScroll = () => {
      if (sidebarRef.current) {
        keepCabinetScrollRef.current = sidebarRef.current.scrollTop;
        sessionStorage.setItem('omni_cabinet_scroll_top', String(sidebarRef.current.scrollTop));
      }
    };

    const handleBeforeUnload = () => {
      sessionStorage.setItem('omni_reading_scroll_y', String(window.scrollY));
      if (sidebarRef.current) {
        sessionStorage.setItem('omni_cabinet_scroll_top', String(sidebarRef.current.scrollTop));
      }
    };

    window.addEventListener('scroll', handleWindowScroll, { passive: true });
    window.addEventListener('beforeunload', handleBeforeUnload);

    const cabinetEl = sidebarRef.current;
    if (cabinetEl) {
      cabinetEl.addEventListener('scroll', handleCabinetScroll, { passive: true });
    }

    return () => {
      if (scrollTimeout) clearTimeout(scrollTimeout);
      window.removeEventListener('scroll', handleWindowScroll);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (cabinetEl) {
        cabinetEl.removeEventListener('scroll', handleCabinetScroll);
      }
    };
  }, []);

  // Restore scroll positions upon reload / initial mount
  useEffect(() => {
    const isReload =
      (window.performance &&
        window.performance.getEntriesByType &&
        window.performance.getEntriesByType('navigation')[0]?.type === 'reload') ||
      Boolean(sessionStorage.getItem('omni_reading_scroll_y'));

    if (isReload) {
      if ('scrollRestoration' in window.history) {
        window.history.scrollRestoration = 'manual';
      }
      const savedY = sessionStorage.getItem('omni_reading_scroll_y');
      const savedCabinetTop = sessionStorage.getItem('omni_cabinet_scroll_top');

      if (savedCabinetTop !== null && sidebarRef.current) {
        sidebarRef.current.scrollTop = Number(savedCabinetTop);
        keepCabinetScrollRef.current = Number(savedCabinetTop);
      }

      if (savedY !== null && Number(savedY) > 0) {
        const targetY = Number(savedY);
        const restore = () => {
          window.scrollTo({ top: targetY, behavior: 'instant' });
          if (sidebarRef.current && savedCabinetTop !== null) {
            sidebarRef.current.scrollTop = Number(savedCabinetTop);
          }
        };

        restore();
        const rAF = requestAnimationFrame(restore);
        const t1 = setTimeout(restore, 50);
        const t2 = setTimeout(restore, 150);
        const t3 = setTimeout(restore, 350);

        return () => {
          cancelAnimationFrame(rAF);
          clearTimeout(t1);
          clearTimeout(t2);
          clearTimeout(t3);
        };
      }
    } else {
      window.scrollTo(0, 0);
    }
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
  'stock-images': 'All books published via the Omni standard publishing packages receive custom-designed covers, produced in full color. Within the realm of this custom-designed cover, you have the option to choose two images, free of charge, from the millions found through Getty Images.',
  'post-page-layout-services': 'Omni allows you to make changes to your book after the manuscript has been laid out by our designers. Charges will be applied.',
  'pre-manuscript-services': 'Preparing your manuscript for submission and for publishing is a whole lot easier when we do it for you. Omni can convert your typewritten manuscript, or previously published book, to a word-processed format.',
  'resubmission': 'Once your book has gone live and is for sale, you can still correct errors or other issues that might have been missed. Resubmission services are available for a fee.',
  'video-book-trailer': 'REASONS WHY VIDEO BOOK TRAILERS ARE ESSENTIAL: A book video trailer combines visuals, text, music, and voiceovers, making it appealing to people who prefer video content over traditional text-based marketing. Videos rank well on search engines and social media platforms, increasing discoverability.',
  'book-reviews': 'A book review is an excellent way to generate interest for your title. Book readers, buyers, and retailers rely on the opinion of experts when considering which titles are worth purchasing and reading. Omni offers four distinct review services to help you elevate your book’s credibility and raise its marketing potential.',
  'book-signings-and-galleries': "A book exhibition or book signing event can be a terrific way to create buzz around your book. As an exhibitor at many of the largest trade shows and book events, we've put our books in the hands of booklovers and industry insiders through Omni book exhibition services.",
  'hollywood-book-to-screen': 'Have you ever considered for even a moment that your book could be adapted into a movie or television series? If the answer is yes, then Omni can make your book available to agents, producers, directors, writers, and actors through multiple services available to our authors.',
  'internet-marketing': 'Having your own website, internet search, or preview tools are effective and economical ways to promote your book, enhance your image as an author, and communicate with prospective readers around the world.',
  'publicity-services': 'Get your book noticed from a unique platform created by our publicity and media services.',
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
  'data-entry-standard': 'At Omni we can take your printed manuscript and convert it into a working digital file. Our professional staff can then work on your manuscript more efficiently. Because we are a print-on-demand publishing company, we must have a digital file available.',
  'data-entry-spanish': 'Spanish-language materials you provide are converted into an electronic format for publication with our Spanish Data Entry service.',
  'data-entry-handwritten': 'Relieve yourself from the tedious task of encoding multiple pages and let us do all the manual encoding for you. This service is only applicable to handwritten documents.',
  'large-image-scanning': 'Images larger than 11" x 17" can be scanned by Omni and placed in your book.',
  'b-w-image-scanning': 'Authors who send in hard copies of original black and white images can have them scanned and placed into the correct place in your work.',
  'manuscript-file-conversion': 'If this service is chosen, Omni will make every effort to work with manuscripts created using any of a wide variety of software packages.',
  'graphic-file-conversions-quantity-25': 'When authors send in graphic files, they sometimes require an extensive amount of work. With this service, Omni will work to ensure graphics appear correctly in the final product.',
  'file-merging': 'If the standard manuscript submission process of sending one file is not followed, files must be merged or combined in order to ensure a correct outcome.',
  'image-extraction': 'If you choose to submit your manuscript with the images included in the body of your work, Omni must extract these images to properly create a professional layout of your book. This service will cover the cost of extracting the images to ensure proper interior layout.',
  'resubmission-one-version': 'When a book has gone live and the author finds problems, errors, or other issues that need to be corrected, we can re-submit the file to the printer to update future copies.',
  'resubmission-two-version': 'When a book has gone live and the author finds problems, errors, or other issues that need to be corrected, we can re-submit the file to the printer to update future copies.',
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
  'radio-book-talk': 'Introduce your book to the literary world with Emmy Award-winning host, Kate Delaney. Plus, reach out to more interested readers through these two bookish podcasts—Books on Air and Newsgram.',
  'audio-snip': 'The Audio Snip service serves as an audio trailer of your book to promote its presence and inform your audience where they can purchase it. With this service, you can take your story to the airwaves and talk about it yourself.',
  'online-interview': 'Position yourself as an expert on your book’s subject matter and put your voice on the radio. Whatever your reason, getting on the radio can give you a powerful marketing push. The Online Interview service is a strategic marketing tool to enhance your marketing plan.',
  'set-your-own-price': 'Flexibility to adjust the retail price of your hardcover and paperback formats to optimize royalty earnings or sales volume.',
  'author-advantage-royalty-program': 'The Author Advantage Royalty Program empowers you to earn substantial financial gains with every print book sold. This Program runs for a 3-Year Term and ensures that you receive maximum profits from sales of your book, and that you can also order copies of your own book at heavily discounted rates.',
  'retail-focus': 'Although self-published titles are getting more and more popular these days, self-published authors still have a difficult time getting brick-and-mortar shops to stock their books. If your dream is to see your work displayed on a bookstore shelf, you can get the help you need with our Retail Focus Service!',
  'retail-focus-for-childrens-books': 'Children’s books have always been popular on the book market, and independent titles for children are steadily gaining popularity too. However, it can still be a challenge for self-published authors to get brick-and-mortar bookstores to stock up on their books. If you want your book pitched to bookstores, you can get the help you need with our Retail Focus for Children’s Book service!',
  'library-focus': 'The Omni Library Focus Service helps you with your goal of making your book available in libraries through a strategic combination of print ads in two publications popular with librarians and a customized sales kit.',
  'booksellers-return-program': 'Help your title meet bookseller standards for retail stocking with Booksellers Return Program. If your book remains unsold, retailers will be able to return it without a loss of profit for them.',
  'booksellers-return-program-renewal': 'Renew your book’s participation in the Booksellers Return Program for one year. When you purchase this program renewal, your book will remain “returnable” in book distributor ordering systems, ensuring bookstores that they can return any unsold copies (if they choose to stock your book).',
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

  // Memoized authentic HTML with dynamic email substitution
  const renderedAuthenticHtml = useMemo(() => {
    if (!selectedService || !SERVICES_CONTENT[selectedService?.slug]?.bodyHtml) return '';
    let html = SERVICES_CONTENT[selectedService.slug].bodyHtml;

    if (blocks && blocks[`service.${selectedService.slug}.custom_html`]) {
      html = blocks[`service.${selectedService.slug}.custom_html`];
    }

    const companyEmail = company?.email || company?.recipient_email || 'admin@omnivirtualsolution.com';
    const editorialEmail = t(
      `service.${selectedService.slug}.email`,
      t('service.editorial.email', t('services.cta.email', companyEmail))
    );

    if (editorialEmail) {
      html = html
        .replace(/href=["']mailto:editorial@omnivirtualsolution\.com["']/g, `href="mailto:${editorialEmail}"`)
        .replace(/editorial@omnivirtualsolution\.com/g, editorialEmail);
    }

    return html;
  }, [selectedService, blocks, company, t]);

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

  // Helper to always scroll the presentation content area to the start (top) smoothly
  const scrollToContentTop = () => {
    sessionStorage.removeItem('omni_reading_scroll_y');
    if (sidebarRef.current) {
      keepCabinetScrollRef.current = sidebarRef.current.scrollTop;
    }

    const performScroll = () => {
      const targetEl = detailCardRef.current || contentColRef.current;
      if (targetEl) {
        const headerEl = document.querySelector('#header');
        const headerHeight = headerEl ? headerEl.offsetHeight : 68;
        const navOffset = headerHeight + 16;
        const targetY = targetEl.getBoundingClientRect().top + window.scrollY - navOffset;
        window.scrollTo({ top: Math.max(0, targetY), behavior: 'smooth' });
      } else {
        window.scrollTo({ top: 100, behavior: 'smooth' });
      }

      if (detailCardRef.current) {
        detailCardRef.current.scrollTop = 0;
      }
      if (contentColRef.current) {
        contentColRef.current.scrollTop = 0;
      }
    };

    performScroll();
    requestAnimationFrame(performScroll);
    setTimeout(performScroll, 50);
  };

  // Select a subcategory overview
  const handleSelectSubcategory = (cat, sub) => {
    if (sidebarRef.current) {
      keepCabinetScrollRef.current = sidebarRef.current.scrollTop;
    }
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
    scrollToContentTop();
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
    if (sidebarRef.current) {
      keepCabinetScrollRef.current = sidebarRef.current.scrollTop;
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
    if (sidebarRef.current) {
      keepCabinetScrollRef.current = sidebarRef.current.scrollTop;
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
    scrollToContentTop();
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

  // Real-time search index & smart relevance ranking across all services, packages, and categories
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];

    const matches = [];

    allServicesList.forEach((service) => {
      const title = (service.title || '').toLowerCase();
      const lead = (service.lead || service.lead_paragraph || AUTHENTIC_SERVICE_SUMMARIES[service.slug] || '').toLowerCase();
      const catTitle = (service.categoryTitle || '').toLowerCase();
      const subTitle = (service.subcategoryTitle || '').toLowerCase();
      const slug = (service.slug || '').toLowerCase();

      let score = 0;

      // Exact title match gets highest priority
      if (title === q) {
        score += 100;
      } else if (title.startsWith(q)) {
        score += 70;
      } else if (title.includes(q)) {
        score += 50;
      }

      // Slug match
      if (slug.includes(q)) {
        score += 30;
      }

      // Subcategory / category matches
      if (subTitle.includes(q)) {
        score += 25;
      } else if (catTitle.includes(q)) {
        score += 15;
      }

      // Description / lead text match
      if (lead.includes(q)) {
        score += 10;
      }

      if (score > 0) {
        matches.push({ service, score });
      }
    });

    matches.sort((a, b) => b.score - a.score || a.service.title.localeCompare(b.service.title));
    return matches.slice(0, 8).map((m) => m.service);
  }, [allServicesList, searchQuery]);

  // Navigate user directly to service from search dropdown
  const handleSelectSearchResult = (service) => {
    if (!service) return;

    // Find parent category and subcategory from live catalog
    const cat = catalog.find((c) => c.id === service.categoryId || c.tag === service.categoryTag);
    const sub = (cat?.subcategories || []).find((s) => s.id === service.subcategoryId) || cat?.subcategories?.[0];

    // Ensure category and subcategory are expanded in the sidebar cabinet
    if (cat?.tag || cat?.id) {
      setExpandedCategories((prev) => ({
        ...prev,
        [cat.id]: true,
        [cat.tag]: true,
      }));
    }
    if (sub?.id) {
      setExpandedSubcategories((prev) => ({
        ...prev,
        [sub.id]: true,
      }));
    }

    if (service.isCategoryOverview) {
      handleSelectService(
        {
          ...service,
          title: service.title || t(`service.${service.slug}.title`, cat?.title || ''),
          lead: service.lead || service.lead_paragraph || t(`service.${service.slug}.lead`, ''),
        },
        cat,
        sub,
        true
      );
    } else {
      handleSelectService(service, cat, sub);
    }

    setIsSearchOpen(false);
    setHighlightedIndex(-1);
    setSearchQuery('');
    scrollToContentTop();
  };

  // Keyboard navigation for search input
  const handleSearchKeyDown = (e) => {
    if (e.key === 'Escape') {
      setIsSearchOpen(false);
      setHighlightedIndex(-1);
      return;
    }

    if (searchResults.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isSearchOpen) {
        setIsSearchOpen(true);
        setHighlightedIndex(0);
      } else {
        setHighlightedIndex((prev) => (prev < searchResults.length - 1 ? prev + 1 : 0));
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isSearchOpen) {
        setIsSearchOpen(true);
        setHighlightedIndex(searchResults.length - 1);
      } else {
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : searchResults.length - 1));
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < searchResults.length) {
        handleSelectSearchResult(searchResults[highlightedIndex]);
      } else if (searchResults.length > 0) {
        handleSelectSearchResult(searchResults[0]);
      }
    }
  };

  return (
    <div className="services-page-wrapper">
      <main className="main services-catalog-page">
        <div className="container-fluid services-main-container">
          
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
              <div className="services-search-wrap" ref={searchWrapRef}>
                <i className="bi bi-search services-search-icon"></i>
                <input
                  type="text"
                  className="services-search-input"
                  placeholder="Search all services, packages, editorial..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setIsSearchOpen(true);
                    setHighlightedIndex(-1);
                  }}
                  onFocus={() => {
                    if (searchQuery.trim().length > 0) {
                      setIsSearchOpen(true);
                    }
                  }}
                  onKeyDown={handleSearchKeyDown}
                  aria-label="Search services"
                  autoComplete="off"
                  role="combobox"
                  aria-expanded={isSearchOpen && searchQuery.trim().length > 0}
                  aria-haspopup="listbox"
                  aria-autocomplete="list"
                  aria-controls="services-search-dropdown-menu"
                />
                {searchQuery && (
                  <button
                    type="button"
                    className="services-search-clear-btn"
                    onClick={() => {
                      setSearchQuery('');
                      setIsSearchOpen(false);
                      setHighlightedIndex(-1);
                    }}
                    aria-label="Clear search"
                  >
                    <i className="bi bi-x-circle-fill"></i>
                  </button>
                )}

                {/* Live Dropdown Results */}
                {isSearchOpen && searchQuery.trim().length > 0 && (
                  <div
                    id="services-search-dropdown-menu"
                    className="services-search-dropdown shadow-lg"
                    role="listbox"
                  >
                    {searchResults.length > 0 ? (
                      <>
                        <div className="services-search-dropdown-header">
                          <span>
                            Found <strong>{searchResults.length}</strong> matching {searchResults.length === 1 ? 'service' : 'services'}
                          </span>
                          <span className="search-shortcut-hint">
                            Press <kbd>↑</kbd><kbd>↓</kbd> to navigate, <kbd>Enter</kbd> to view
                          </span>
                        </div>
                        <div className="services-search-dropdown-list">
                          {searchResults.map((item, idx) => {
                            const isHighlighted = idx === highlightedIndex;
                            const snippet = item.lead || item.lead_paragraph || AUTHENTIC_SERVICE_SUMMARIES[item.slug] || '';
                            const categoryLabel = item.categoryTitle || 'Omni Services';
                            const subcategoryLabel = item.subcategoryTitle ? ` › ${item.subcategoryTitle}` : '';

                            return (
                              <div
                                key={item.slug || idx}
                                className={`search-result-item ${isHighlighted ? 'is-highlighted' : ''}`}
                                onClick={() => handleSelectSearchResult(item)}
                                onMouseEnter={() => setHighlightedIndex(idx)}
                                role="option"
                                aria-selected={isHighlighted}
                              >
                                <div className="search-result-main">
                                  <div className="search-result-breadcrumbs">
                                    <span className="search-result-badge">
                                      {categoryLabel}{subcategoryLabel}
                                    </span>
                                    {item.price && (
                                      <span className="search-result-price">{item.price}</span>
                                    )}
                                  </div>
                                  <h4 className="search-result-title">
                                    {highlightMatch(item.title, searchQuery)}
                                  </h4>
                                  {snippet && (
                                    <p className="search-result-snippet">
                                      {snippet.length > 130 ? snippet.slice(0, 130) + '…' : snippet}
                                    </p>
                                  )}
                                </div>
                                <div className="search-result-action">
                                  <span className="search-result-arrow">
                                    <i className="bi bi-arrow-right-short"></i>
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    ) : (
                      <div className="search-empty-state">
                        <i className="bi bi-search search-empty-icon"></i>
                        <p className="search-empty-title">
                          No services found for &ldquo;{searchQuery}&rdquo;
                        </p>
                        <p className="search-empty-hint">
                          Try searching for keywords like <em>marketing</em>, <em>editorial</em>, <em>illustrations</em>, or <em>bookstore</em>.
                        </p>
                      </div>
                    )}
                  </div>
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
          <div className="row g-4 services-main-layout-row">
            
            {/* Desktop Persistent Sidebar */}
            <div className="col-lg-4 col-xl-4 col-xxl-3 d-none d-lg-block services-sidebar-col">
              <div className="desktop-services-sidebar" ref={sidebarRef}>
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
                              if (sidebarRef.current) {
                                keepCabinetScrollRef.current = sidebarRef.current.scrollTop;
                              }
                              // Open category if not open
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
                              scrollToContentTop();
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
                                className={`cat-toggle-chevron-btn ${isExpanded ? 'expanded' : ''}`}
                                title={isExpanded ? "Collapse category" : "Expand category"}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (sidebarRef.current) {
                                    keepCabinetScrollRef.current = sidebarRef.current.scrollTop;
                                  }
                                  setExpandedCategories((prev) => ({
                                    ...prev,
                                    [cat.id]: !isExpanded,
                                    [cat.tag]: !isExpanded,
                                  }));
                                }}
                              >
                                <i className="bi bi-chevron-right small cat-chevron-icon"></i>
                              </span>
                            </span>
                          </button>
                        </div>

                        <div className={`category-accordion-collapse ${isExpanded ? 'expanded' : ''}`}>
                          <div className="category-accordion-collapse-inner">
                            <div className="subcategories-list">
                              {cat.subcategories.map((sub) => {
                                const subTitle = t(`service.${sub.id}.title`, sub.title);
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
                                          className={`subcat-toggle-chevron-btn ${isSubExpanded ? 'expanded' : ''}`}
                                          title={isSubExpanded ? "Collapse" : "Expand"}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (sidebarRef.current) {
                                              keepCabinetScrollRef.current = sidebarRef.current.scrollTop;
                                            }
                                            toggleSubcategoryAccordion(sub.id, e, defaultSubOpen);
                                          }}
                                        >
                                          <i className="bi bi-chevron-right subcat-chevron"></i>
                                        </span>
                                      </span>
                                    </button>

                                    <div className={`subcategory-accordion-collapse ${isSubExpanded ? 'expanded' : ''}`}>
                                      <div className="subcategory-accordion-collapse-inner">
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
                                                  if (sidebarRef.current) {
                                                    keepCabinetScrollRef.current = sidebarRef.current.scrollTop;
                                                  }
                                                  handleSelectService({ ...svc, title: svcTitle }, cat, sub);
                                                }}
                                              >
                                                <span className="text-truncate" data-block-key={`service.${svc.slug}.title`}>{svcTitle}</span>
                                                {isSelected && <i className="bi bi-check2"></i>}
                                              </button>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right Presentation Detail Column */}
            <div className="col-lg-8 col-xl-8 col-xxl-9" ref={contentColRef}>
              {selectedService ? (
                <div className="service-detail-card" ref={detailCardRef}>
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
                        {badgeText}
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

                  {/* Service Overview Box: Shown on Category and Subcategory Overviews */}
                  {(isCurrentCategoryOverview || isCurrentSubcategoryOverview) && selectedService?.slug !== 'publishing-packages' && selectedService?.slug !== 'publishing-options' && selectedService?.slug !== 'evaluation-services' && selectedService?.slug !== 'editorial-evaluation' && selectedService?.slug !== 'evaluation-editorial' && (
                    <div className="service-lead-box">
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
                      <div 
                        className="package-card-block mb-4 p-3 rounded-3"
                        style={{ cursor: 'pointer', border: '1px solid #ebd9c4', background: '#ffffff', transition: 'all 0.2s ease' }}
                        onClick={() => {
                          const pubCat = catalog.find(c => c.id === 'publishing-packages');
                          const pubSub = pubCat?.subcategories?.find(s => s.id === 'publishing-options');
                          const svc = pubSub?.services?.find(s => s.slug === 'basic-package');
                          if (svc) handleSelectService(svc, pubCat, pubSub);
                        }}
                        role="button"
                        tabIndex={0}
                      >
                        <div className="d-flex align-items-center justify-content-between mb-2">
                          <h5 
                            className="fw-bold m-0" 
                            style={{ color: '#d9534f', fontSize: '1.25rem' }}
                            data-block-key="service.basic-package.title"
                          >
                            {t('service.basic-package.title', 'Basic Package')}
                          </h5>
                          <span className="publishing-package-arrow-badge"><i className="bi bi-arrow-right-short"></i></span>
                        </div>
                        <p 
                          className="mb-0" 
                          style={{ color: '#57534e', fontSize: '0.96rem', lineHeight: '1.72' }}
                          data-block-key="service.basic-package.desc"
                        >
                          {t('service.basic-package.desc', 'The Basic package is designed for authors seeking basic publishing needs. It includes digital formatting and distribution for e-books, paperback publishing, and customization options for the interior and cover. This package supports up to 25 image insertions and provides one block of 50 interior revisions. Authors receive electronic proofs, one-on-one support, and distribution across major online retailers like Amazon and Barnes & Noble. The package also features ISBN assignment, U.S. Copyright registration, a Library of Congress Control Number, and three paperback copies. Additional perks include Amazon Look Inside, Google Preview, Barnes & Noble Read Instantly, and a 12-month bookseller return program.')}
                        </p>
                      </div>

                      <div 
                        className="package-card-block mb-4 p-3 rounded-3"
                        style={{ cursor: 'pointer', border: '1px solid #ebd9c4', background: '#ffffff', transition: 'all 0.2s ease' }}
                        onClick={() => {
                          const pubCat = catalog.find(c => c.id === 'publishing-packages');
                          const pubSub = pubCat?.subcategories?.find(s => s.id === 'publishing-options');
                          const svc = pubSub?.services?.find(s => s.slug === 'standard-package');
                          if (svc) handleSelectService(svc, pubCat, pubSub);
                        }}
                        role="button"
                        tabIndex={0}
                      >
                        <div className="d-flex align-items-center justify-content-between mb-2">
                          <h5 
                            className="fw-bold m-0" 
                            style={{ color: '#d9534f', fontSize: '1.25rem' }}
                            data-block-key="service.standard-package.title"
                          >
                            {t('service.standard-package.title', 'Standard Package')}
                          </h5>
                          <span className="publishing-package-arrow-badge"><i className="bi bi-arrow-right-short"></i></span>
                        </div>
                        <p 
                          className="mb-0" 
                          style={{ color: '#57534e', fontSize: '0.96rem', lineHeight: '1.72' }}
                          data-block-key="service.standard-package.desc"
                        >
                          {t('service.standard-package.desc', 'Building on the Basic, the Standard package adds hardcover publishing to the mix, enhancing the physical presence of your book. This package maintains all the services of the Basic package, including the customization, support, and online distribution features. In addition to the three paperback copies, it also includes one hardcover copy. The bookseller return program is extended to 36 months, providing additional flexibility and support for bookstores to manage inventory.')}
                        </p>
                      </div>

                      <div 
                        className="package-card-block mb-4 p-3 rounded-3"
                        style={{ cursor: 'pointer', border: '1px solid #ebd9c4', background: '#ffffff', transition: 'all 0.2s ease' }}
                        onClick={() => {
                          const pubCat = catalog.find(c => c.id === 'publishing-packages');
                          const pubSub = pubCat?.subcategories?.find(s => s.id === 'publishing-options');
                          const svc = pubSub?.services?.find(s => s.slug === 'advanced-package');
                          if (svc) handleSelectService(svc, pubCat, pubSub);
                        }}
                        role="button"
                        tabIndex={0}
                      >
                        <div className="d-flex align-items-center justify-content-between mb-2">
                          <h5 
                            className="fw-bold m-0" 
                            style={{ color: '#d9534f', fontSize: '1.25rem' }}
                            data-block-key="service.advanced-package.title"
                          >
                            {t('service.advanced-package.title', 'Advanced Package')}
                          </h5>
                          <span className="publishing-package-arrow-badge"><i className="bi bi-arrow-right-short"></i></span>
                        </div>
                        <p 
                          className="mb-0" 
                          style={{ color: '#57534e', fontSize: '0.96rem', lineHeight: '1.72' }}
                          data-block-key="service.advanced-package.desc"
                        >
                          {t('service.advanced-package.desc', 'The Advanced package is the most comprehensive, designed for authors who want extensive support and marketing tools. It includes everything from the Standard package, but boosts the number of copies provided to 20 paperbacks and 5 hardcovers. This package distinguishes itself with marketing enhancements such as 30 days of online book ads via Google and a professional book review from Kirkus Reviews. Additionally, it includes a deluxe website setup to further promote the book. The return program is extended to 60 months, offering the maximum return flexibility for retailers.')}
                        </p>
                      </div>

                      <p className="mt-3 fst-italic" style={{ color: '#78716c', fontSize: '0.92rem' }} data-block-key="service.navigator.note">
                        {t('service.navigator.note', 'Our Navigator package has everything you need to go beyond and achieve your literary goals.')}
                      </p>
                    </div>
                  ) : selectedService?.slug === 'evaluation-services' ? (
                    /* Evaluation Services Overview Content (Image 1) */
                    <div className="evaluation-services-overview-content">
                      <p 
                        className="mb-4" 
                        style={{ color: '#57534e', fontSize: '0.98rem', lineHeight: '1.7' }}
                        data-block-key="service.evaluation-services.intro"
                      >
                        {t('service.evaluation-services.intro', 'One of the key features that makes an Omni book distinct from other self-published books is our professional editorial evaluation. The evaluation is included in certain publishing packages and is available to purchase separately as well.')}
                      </p>

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

                      {/* Direct Interactive Card to Explore Evaluation Editorial */}
                      <div className="publishing-packages-container mt-4">
                        <div 
                          className="publishing-package-card"
                          onClick={() => {
                            const cat = catalog.find(c => c.id === 'evaluation-services');
                            const sub = cat?.subcategories?.find(s => s.id === 'editorial-evaluation' || s.id === 'evaluation-editorial');
                            if (cat && sub) handleSelectSubcategory(cat, sub);
                          }}
                          style={{ cursor: 'pointer' }}
                          role="button"
                          tabIndex={0}
                        >
                          <div className="publishing-package-card-header">
                            <h5 className="publishing-package-card-title m-0" data-block-key="service.editorial-evaluation.title">
                              {t('service.editorial-evaluation.title', 'Evaluation Editorial')}
                            </h5>
                            <span className="publishing-package-arrow-badge">
                              <i className="bi bi-arrow-right-short"></i>
                            </span>
                          </div>
                          <p className="publishing-package-card-summary mb-0" data-block-key="service.editorial-evaluation.desc">
                            {t('service.editorial-evaluation.desc', 'Editorial Evaluation Services Regardless of your publishing goals, the editorial quality of your work matters—no one wants to read a book that\'s riddled with typos and grammatical errors. However, even the best writers make occasional mistakes. Omni provides editorial services that will help you make your book the best it can be.')}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : ((selectedService?.slug === 'editorial-evaluation' || selectedService?.slug === 'evaluation-editorial') && selectedService?.isSubcategoryOverview) ? (
                      /* Evaluation Editorial Subcategory Overview - Matches prompt 4 screenshot */
                      <div className="evaluation-editorial-content">
                        <p 
                          className="mb-4" 
                          style={{ color: '#44403c', fontSize: '0.98rem', lineHeight: '1.75' }}
                          data-block-key="service.editorial-evaluation.intro_p"
                        >
                          {t('service.editorial-evaluation.intro_p', "Editorial Evaluation Services Regardless of your publishing goals, the editorial quality of your work matters—no one wants to read a book that's riddled with typos and grammatical errors. However, even the best writers make occasional mistakes. Omni provides editorial services that will help you make your book the best it can be.")}
                        </p>

                        <div 
                          className="package-card-block mb-4 p-3 rounded-3"
                          style={{ cursor: 'pointer', border: '1px solid #ebd9c4', background: '#ffffff', transition: 'all 0.2s ease' }}
                          onClick={() => {
                            const cat = catalog.find(c => c.id === 'evaluation-services');
                            const sub = cat?.subcategories?.find(s => s.id === 'editorial-evaluation');
                            const svc = sub?.services?.find(s => s.slug === 'editorial-evaluation');
                            if (svc) handleSelectService(svc, cat, sub);
                          }}
                          role="button"
                          tabIndex={0}
                        >
                          <div className="d-flex align-items-center justify-content-between mb-2">
                            <h5 
                              className="fw-bold m-0" 
                              style={{ color: '#d9534f', fontSize: '1.25rem' }}
                              data-block-key="service.editorial-evaluation.sub_heading"
                            >
                              {t('service.editorial-evaluation.sub_heading', 'Editorial Evaluation')}
                            </h5>
                            <span className="publishing-package-arrow-badge"><i className="bi bi-arrow-right-short"></i></span>
                          </div>
                          <p 
                            className="mb-0" 
                            style={{ color: '#57534e', fontSize: '0.96rem', lineHeight: '1.72' }}
                            data-block-key="service.editorial-evaluation.eval_p"
                          >
                            {t('service.editorial-evaluation.eval_p', 'Omni experienced editorial evaluators will review your manuscript and provide you with a general overview of your manuscript as well as give constructive comments on how to better write your book.')}
                          </p>
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
                          <div 
                            className="video-trailer-reasons-box p-3.5 mb-4 rounded-3" 
                            style={{ 
                              background: '#faf6f0', 
                              borderLeft: '5px solid #ad7d42',
                              borderTop: '1px solid rgba(173, 125, 66, 0.18)',
                              borderRight: '1px solid rgba(173, 125, 66, 0.18)',
                              borderBottom: '1px solid rgba(173, 125, 66, 0.18)',
                              borderRadius: '0 12px 12px 0',
                              padding: '1.5rem 1.85rem'
                            }}
                          >
                            <h6 className="fw-bold mb-3" style={{ color: '#ad7d42', fontSize: '1.02rem', marginTop: 0 }}>
                              Reasons Why Video Book Trailers are Essential:
                            </h6>
                            <ul className="mb-0 ps-3" style={{ color: '#57534e', fontSize: '0.92rem', lineHeight: '1.75' }}>
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



                        {currentSubcategory?.id === 'radio-services' && (
                          <div className="radio-services-advantages-box p-3.5 mb-4 rounded-3" style={{ background: '#faf6f0', borderLeft: '4px solid #ad7d42' }}>
                            <div className="d-flex flex-column gap-2.5">
                              <div className="p-2.5 rounded-2" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                                <strong className="d-block mb-1" style={{ color: '#2b2219', fontSize: '0.88rem' }}>1. Expands Audience Reach</strong>
                                <ul className="mb-0 ps-3" style={{ color: '#57534e', fontSize: '0.84rem', lineHeight: '1.55' }}>
                                  <li>Radio stations, including local, national, and online platforms, can expose your book to thousands or even millions of listeners.</li>
                                  <li>Reaches diverse demographics, including those who may not actively search for books online.</li>
                                </ul>
                              </div>
                              <div className="p-2.5 rounded-2" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                                <strong className="d-block mb-1" style={{ color: '#2b2219', fontSize: '0.88rem' }}>2. Builds Credibility &amp; Authority</strong>
                                <ul className="mb-0 ps-3" style={{ color: '#57534e', fontSize: '0.84rem', lineHeight: '1.55' }}>
                                  <li>Being featured on radio shows or podcasts establishes you as an expert in your genre or subject.</li>
                                  <li>Interviews and discussions allow authors to personally connect with potential readers.</li>
                                </ul>
                              </div>
                              <div className="p-2.5 rounded-2" style={{ background: '#fdfaf5', border: '1px solid #ebd9c4' }}>
                                <strong className="d-block mb-1" style={{ color: '#2b2219', fontSize: '0.88rem' }}>3. Cost-Effective Promotion</strong>
                                <ul className="mb-0 ps-3" style={{ color: '#57534e', fontSize: '0.84rem', lineHeight: '1.55' }}>
                                  <li>Compared to TV and print ads, radio marketing is often more affordable with a high return on investment.</li>
                                  <li>Many radio stations offer package deals, including interviews, advertisements, and social media promotion.</li>
                                </ul>
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
                  ) : (
                    /* Tier 3: Dedicated Individual Service Page with exact content from Omni/services/*.html */
                    <div className="service-individual-detail-content">
                      {SERVICES_CONTENT[selectedService?.slug]?.bodyHtml &&
                      selectedCategory?.id !== 'publishing-packages' &&
                      selectedService?.categoryId !== 'publishing-packages' &&
                      !['basic-package', 'standard-package', 'advanced-package'].includes(selectedService?.slug) ? (
                        <div
                          className="service-authentic-content"
                          dangerouslySetInnerHTML={{ __html: renderedAuthenticHtml }}
                          onClick={(e) => {
                            const link = e.target.closest('a');
                            if (!link) return;
                            const href = link.getAttribute('href');
                            if (href && (href.startsWith('/services?service=') || href.endsWith('.html'))) {
                              e.preventDefault();
                              let targetSlug = '';
                              if (href.startsWith('/services?service=')) {
                                targetSlug = href.replace('/services?service=', '').split('&')[0];
                              } else if (href.endsWith('.html') && !href.startsWith('http')) {
                                targetSlug = href.replace('.html', '').toLowerCase().replace(/[^a-z0-9-]/g, '');
                              }
                              if (targetSlug) {
                                const found = allServicesList.find(
                                  (s) => s.slug === targetSlug || s.slug.replace(/[^a-z0-9]/g, '') === targetSlug.replace(/[^a-z0-9]/g, '')
                                );
                                if (found) {
                                  const cat = catalog.find((c) => c.id === found.categoryId);
                                  const sub = cat?.subcategories?.find((sb) => sb.id === found.subcategoryId);
                                  handleSelectService(found, cat, sub);
                                }
                              }
                            }
                          }}
                        />
                      ) : (
                        displayLead && (
                          <div className="service-lead-box mb-4">
                            <p className="service-lead-text mb-0">{displayLead}</p>
                          </div>
                        )
                      )}

                      {/* Feature Checklist for Publishing Packages */}
                      {(selectedCategory?.id === 'publishing-packages' || selectedService?.categoryId === 'publishing-packages' || selectedService?.isPackage) && displayFeatures && displayFeatures.length > 0 && (
                        <div className="features-checklist-section mt-4">
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
                      )}
                    </div>
                  )}

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
                      scrollToContentTop();
                    }}
                  >
                    <span className="d-flex align-items-center gap-2">
                      <i className={`bi ${cat.icon}`} style={{ color: '#ad7d42' }}></i>
                      <span data-block-key={`service.${cat.id}.title`}>{catTitle}</span>
                    </span>
                    <span
                      className={`cat-toggle-chevron-btn ${isExpanded ? 'expanded' : ''}`}
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
                      <i className="bi bi-chevron-right small cat-chevron-icon"></i>
                    </span>
                  </button>

                  <div className={`category-accordion-collapse ${isExpanded ? 'expanded' : ''}`}>
                    <div className="category-accordion-collapse-inner">
                      <div className="subcategories-list">
                        {cat.subcategories.map((sub) => {
                          const subTitle = t(`service.${sub.id}.title`, sub.title);

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
                                    className={`subcat-toggle-chevron-btn ${isSubExpanded ? 'expanded' : ''}`}
                                    title={isSubExpanded ? "Collapse" : "Expand"}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleSubcategoryAccordion(sub.id, e, defaultSubOpen);
                                    }}
                                  >
                                    <i className="bi bi-chevron-right subcat-chevron"></i>
                                  </span>
                                </span>
                              </button>

                              <div className={`subcategory-accordion-collapse ${isSubExpanded ? 'expanded' : ''}`}>
                                <div className="subcategory-accordion-collapse-inner">
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
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </main>
    </div>
  );
}
