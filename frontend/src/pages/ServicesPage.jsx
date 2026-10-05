import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useCms } from '../context/CmsContext';
import './ServicesPage.css';

// Comprehensive fallback catalog matching services catalog
const DEFAULT_CATALOG = [
  {
    id: 'publishing-packages',
    title: 'Publishing Packages',
    tag: 'eval-services',
    icon: 'bi-book-half',
    subcategories: [
      {
        id: 'publishing-options',
        title: 'Publishing Options',
        services: [
          {
            slug: 'basic-package',
            title: 'Basic Package',
            price: '$1,499',
            lead: 'The Basic package is designed for authors seeking core publishing needs. It includes digital formatting, paperback publishing, and customized distribution across major online retailers.',
            features: [
              'Digital formatting and distribution for e-books and paperbacks',
              'Custom cover layout and interior formatting (up to 25 image insertions)',
              'Worldwide distribution across Amazon, Barnes & Noble, and Ingram',
              'ISBN assignment, US Copyright registration, and LCCN',
              '3 complimentary author paperback copies and 12-month bookseller return program',
            ],
          },
          {
            slug: 'standard-package',
            title: 'Standard Package',
            price: '$2,199',
            lead: 'Building on the Basic, the Standard package adds hardcover publishing to enhance the physical presence and prestige of your book.',
            features: [
              'Simultaneous paperback and casebound hardcover publishing',
              'All customization, design, and global distribution features included',
              '3 paperback copies and 1 hardcover author copy',
              'Extended 36-month bookseller return program for bookstores',
              'One-on-one dedicated author publishing representative',
            ],
          },
          {
            slug: 'advanced-package',
            title: 'Advanced Package',
            price: '$3,499',
            lead: 'Our most comprehensive package, designed for authors who want extensive marketing firepower and editorial support.',
            features: [
              '20 paperback copies and 5 hardcover author copies included',
              '30 days of targeted online book advertising via Google Ads',
              'Professional book review from certified critics (Kirkus Reviews)',
              'Deluxe author promotional website setup',
              'Maximum 60-month bookseller return program flexibility',
            ],
          },
          {
            slug: 'founder-package',
            title: 'Founder Package',
            price: '$3,499',
            lead: 'Comprehensive end-to-end publishing package for ambitious authors and enterprises looking to establish industry authority.',
            features: [
              'Complete interior and cover design tailored to industry standards',
              'Worldwide distribution across major online retailers (Amazon, B&N, Ingram)',
              '100% author royalty retention program',
              'Free electronic galley proof and priority proofing cycles',
              'Dedicated senior author consultant throughout production',
            ],
          },
          {
            slug: 'pioneer-package',
            title: 'Pioneer Package',
            price: '$2,199',
            lead: 'Designed for first-time authors needing professional publishing standards at an accessible, transparent price.',
            features: [
              'Custom book cover design from professional artists',
              'Paperback formatting and digital file conversions',
              'Global distribution network setup across 40,000+ bookstores',
              '5 complimentary softcover author copies',
              'Complete copyright protection and registration assistance',
            ],
          },
          {
            slug: 'voyager-package',
            title: 'Voyager Package',
            price: '$4,799',
            lead: 'The ultimate all-inclusive publishing bundle with expansive marketing, media releases, and editorial services.',
            features: [
              'Simultaneous Softcover & Hardcover publication',
              'Comprehensive copyediting up to 75,000 words included',
              'Cinematic video book trailer production',
              'Press release creation and syndication to 200+ media outlets',
              '15 free author copies and priority shelf-ready stock',
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'evaluation-services',
    title: 'Evaluation Services',
    tag: 'editorial-services',
    icon: 'bi-journal-check',
    subcategories: [
      {
        id: 'editorial-eval',
        title: 'Editorial Evaluation',
        services: [
          {
            slug: 'editorial-evaluation',
            title: 'Editorial Evaluation',
            price: 'From $499',
            lead: 'One of the key features that makes an Omni book distinct from other self-published works is our comprehensive editorial evaluation by seasoned literary editors.',
            features: [
              'Comprehensive diagnostic evaluation of your complete manuscript',
              'Detailed critique covering plot, pacing, character development, and tone',
              'Actionable editorial roadmap recommending specific editorial tracks',
              'Market readiness and commercial genre positioning assessment',
            ],
          },
          {
            slug: 'editorial-rx-referral',
            title: 'Editorial Rx Referral',
            price: '$350',
            lead: 'Diagnostic assessment pairing your manuscript with the exact editorial specialist—from line editor to book doctor—tailored to your writing style.',
            features: [
              'Deep sample edit (up to 3,000 words)',
              'Direct consultation with a senior managing editor',
              'Custom editing plan tailored to your budget and publication timeline',
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'editorial-services',
    title: 'Editorial Services',
    tag: 'combined-dropdown',
    icon: 'bi-pencil-square',
    subcategories: [
      {
        id: 'advanced-editorial',
        title: 'Advanced Editorial Services',
        services: [
          {
            slug: 'developmental-editing',
            title: 'Developmental Editing',
            price: 'From $0.035 / word',
            lead: 'Substantive developmental critique evaluating structural flow, pacing, character development, and narrative arc.',
            features: [
              'Substantive chapter-by-chapter developmental critique',
              'Structural reorganization and plot arc optimization',
              'Character depth, consistency, and perspective alignment',
              'Two rounds of revisions and tracked Word markups included',
            ],
          },
          {
            slug: 'book-doctor',
            title: 'Book Doctor',
            price: 'Custom Quote',
            lead: 'Specialized intervention for stalled manuscripts, structural snags, or complex multi-genre works needing hands-on editorial surgery.',
            features: [
              'Senior book doctor assigned to dissect and repair manuscript issues',
              'Rewriting and ghost-enhancement of critical scenes and transitions',
              'Timeline and internal consistency reconciliation',
            ],
          },
        ],
      },
      {
        id: 'core-editorial',
        title: 'Core Editorial Services',
        services: [
          {
            slug: 'copyediting',
            title: 'Copyediting',
            price: 'From $0.020 / word',
            lead: 'Polishing grammar, punctuation, syntax, and flow while strictly preserving the author’s unique voice.',
            features: [
              'Comprehensive grammatical, spelling, and typographical correction',
              'Tone consistency and stylistic voice preservation',
              'Chicago Manual of Style (current edition) adherence',
              'Track changes markup provided for full author control',
            ],
          },
          {
            slug: 'line-editing',
            title: 'Line Editing',
            price: 'From $0.025 / word',
            lead: 'Sentence-level craftsmanship focusing on style, rhythm, vocabulary precision, and readability.',
            features: [
              'Clarity, conciseness, and pacing refinement',
              'Dialogue flow and emotional resonance enhancement',
              'Elimination of repetition and awkward phrasing',
            ],
          },
          {
            slug: 'proofreading',
            title: 'Proofreading',
            price: 'From $0.015 / word',
            lead: 'The vital final check before printing—eliminating typographical slips, bad breaks, and formatting inconsistencies.',
            features: [
              'Thorough final-pass review of layout proofs',
              'Catching lingering typos, punctuation errors, and word omissions',
              'Verification of page numbers, running heads, and table of contents',
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'marketing-services',
    title: 'Marketing Services',
    tag: 'marketing-dropdown',
    icon: 'bi-megaphone-fill',
    subcategories: [
      {
        id: 'publicity-and-pr',
        title: 'Publicity & PR',
        services: [
          {
            slug: 'press-release-campaign',
            title: 'Press Release Campaign',
            price: '$899',
            lead: 'Get your book and author story in front of journalists, book reviewers, and targeted industry media.',
            features: [
              'Professionally crafted media release by veteran book publicists',
              'Distribution across major syndicated wire services (PR Newswire / PRWeb)',
              'Direct pitch to 50+ niche book bloggers, podcasters, and journalists',
              'Detailed clipping and media impression report with live links',
            ],
          },
          {
            slug: 'bookblast-video-marketing',
            title: 'BookBlast Video Marketing',
            price: '$1,299',
            lead: 'Engage modern readers with cinematic book trailers optimized for YouTube, Instagram Reels, and TikTok.',
            features: [
              'Cinematic 60-second video trailer with professional voiceover',
              'Optimized formats for 16:9 widescreen and 9:16 vertical shorts',
              'Social media promotional asset kit and thumbnail package',
              'Full commercial rights granted to author in perpetuity',
            ],
          },
          {
            slug: 'indie-book-review-bundle',
            title: 'Indie Book Review Bundle',
            price: '$1,499',
            lead: 'Secure verified critical reviews from established editorial review bodies to build instant reader trust.',
            features: [
              'Guaranteed editorial critique by certified review organizations',
              'Licensed quotes for cover back-matter, bookstore displays, and ads',
              'Syndication into bookstore and library acquisition catalogs',
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'format-services',
    title: 'Formats & Production',
    tag: 'format-services',
    icon: 'bi-layers-fill',
    subcategories: [
      {
        id: 'specialty-formats',
        title: 'Specialty Formats',
        services: [
          {
            slug: 'hardcover-publishing',
            title: 'Hardcover Publishing',
            price: '$1,199',
            lead: 'Premium case-laminate or dust jacket hardcover editions designed for prestige and library collections.',
            features: [
              'Durable casebound or dust-jacket binding options',
              'High-resolution cover finish with premium matte or gloss lamination',
              'Library of Congress Control Number (LCCN) registration',
            ],
          },
          {
            slug: 'professional-audiobook',
            title: 'Professional Audiobook Package',
            price: '$2,499',
            lead: 'Transform your manuscript into a studio-grade audiobook narrated by professional voice talent.',
            features: [
              'Audible, Amazon, and iTunes (ACX) compliance guaranteed',
              'Auditioning and selection of SAG-AFTRA voice actors',
              'Full audio mastering, chapter splitting, and QC testing',
              'Global audiobook distribution across 30+ streaming platforms',
            ],
          },
        ],
      },
    ],
  },
];

// Helper to normalize and ensure full property tree for catalog objects
function formatCatalog(rawList) {
  if (!Array.isArray(rawList)) return [];
  return rawList.map((cat) => ({
    id: cat.id || cat.slug || '',
    title: cat.title || '',
    tag: cat.tag || cat.slug || '',
    icon: cat.icon || cat.icon_class || 'bi-bookmark-star',
    subcategories: (cat.subcategories || []).map((sub) => ({
      id: sub.id || sub.slug || '',
      title: sub.title || '',
      services: (sub.services || []).map((s) => ({
        slug: s.slug || '',
        title: s.title || '',
        price: s.price || s.price_display || 'Inquire for Quote',
        price_display: s.price || s.price_display || 'Inquire for Quote',
        lead: s.lead || s.lead_paragraph || '',
        lead_paragraph: s.lead || s.lead_paragraph || '',
        features: Array.isArray(s.features) && s.features.length > 0 ? s.features : [
          'Full editorial and publishing consultation',
          'Dedicated project manager assignment',
          '100% author rights and royalty retention',
        ],
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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [emailCopied, setEmailCopied] = useState(false);

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

  // Synchronize individual service block overrides in real-time
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

      if (titleOverride !== undefined && titleOverride !== current.title) {
        updated.title = titleOverride;
        changed = true;
      }
      if (priceOverride !== undefined && priceOverride !== current.price) {
        updated.price = priceOverride;
        updated.price_display = priceOverride;
        changed = true;
      }
      if (leadOverride !== undefined && leadOverride !== current.lead) {
        updated.lead = leadOverride;
        updated.lead_paragraph = leadOverride;
        changed = true;
      }
      if (featOverride !== undefined) {
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
  const includedHeading = t('services.included.heading', "What's Included:");
  const ctaSubtitle = t('services.cta.subtitle', 'Get a free consultation, custom quote, and turnaround timeline today.');
  const ctaBtnText = t('services.cta.btn_text', 'Inquire About This Service');
  const ctaEmail = t('services.cta.email', t('footer.email', company?.email || company?.recipient_email || 'admin@omnivirtualsolution.com'));

  // Active selected service display values with fallback to t() overrides
  const displayTitle = selectedService ? t(`service.${selectedService.slug}.title`, selectedService.title) : '';
  const displayPrice = selectedService ? t(`service.${selectedService.slug}.price`, selectedService.price || selectedService.price_display) : '';
  const displayLead = selectedService ? t(`service.${selectedService.slug}.desc`, t(`service.${selectedService.slug}.lead`, selectedService.lead || selectedService.lead_paragraph)) : '';
  const ctaHeading = t('services.cta.heading', selectedService ? `Ready to start with ${displayTitle}?` : 'Ready to get started?');

  const displayFeatures = useMemo(() => {
    if (!selectedService) return [];
    const override = blocks ? blocks[`service.${selectedService.slug}.features`] : null;
    if (Array.isArray(override)) return override;
    if (typeof override === 'string') {
      try {
        const parsed = JSON.parse(override);
        if (Array.isArray(parsed)) return parsed;
      } catch (_) {}
    }
    return selectedService.features || [];
  }, [selectedService, blocks]);

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
  const toggleCategoryAccordion = (tag) => {
    setExpandedCategories((prev) => ({ ...prev, [tag]: !prev[tag] }));
  };

  const handleSelectService = (service, cat, sub) => {
    setSelectedService({
      ...service,
      categoryId: cat?.id || service.categoryId,
      categoryTitle: cat?.title || service.categoryTitle,
      subcategoryId: sub?.id || service.subcategoryId,
      subcategoryTitle: sub?.title || service.subcategoryTitle,
      categoryTag: cat?.tag || service.categoryTag,
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
                    const isExpanded = expandedCategories[cat.tag] || activeCategoryTag === cat.tag || searchQuery.length > 0;
                    const totalCount = cat.subcategories.reduce((acc, sub) => acc + sub.services.length, 0);
                    const catTitle = t(`service.${cat.id}.title`, cat.title);

                    return (
                      <div key={cat.id} className="sidebar-category-group">
                        <div className="d-flex align-items-center justify-content-between category-header-row">
                          <button
                            type="button"
                            className={`category-accordion-btn ${isExpanded ? 'expanded' : ''}`}
                            onClick={() => toggleCategoryAccordion(cat.tag)}
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
                              <i className={`bi bi-chevron-${isExpanded ? 'down' : 'right'} small`}></i>
                            </span>
                          </button>
                        </div>

                        {isExpanded && (
                          <div className="subcategories-list">
                            {cat.subcategories.map((sub) => {
                              const subTitle = t(`service.${sub.id}.title`, sub.title);
                              return (
                                <div key={sub.id} className="mb-2">
                                  <div className="subcategory-label" data-block-key={`service.${sub.id}.title`}>
                                    {subTitle}
                                  </div>
                                  {sub.services.map((svc) => {
                                    const isSelected = selectedService?.slug === svc.slug;
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
                    <span>{selectedService.categoryTitle || 'Publishing'}</span>
                    <i className="bi bi-chevron-right" style={{ fontSize: '0.65rem' }}></i>
                    <span className="text-dark fw-semibold" data-block-key={selectedService ? `service.${selectedService.slug}.title` : undefined}>{displayTitle}</span>
                  </div>

                  {/* Header row: Badge, Title */}
                  <div className="d-flex align-items-start justify-content-between flex-wrap gap-2">
                    <div>
                      <div className="service-tag-badge">
                        <i className="bi bi-award-fill"></i>
                        <span data-block-key="services.badge.text">{badgeText}</span>
                      </div>
                      <h2 className="service-title" data-block-key={selectedService ? `service.${selectedService.slug}.title` : undefined}>
                        {displayTitle}
                      </h2>
                    </div>
                  </div>

                  <hr className="service-divider" />

                  {/* Service Overview Box */}
                  <div className="service-lead-box">
                    <h5 data-block-key="services.overview.heading">{overviewHeading}</h5>
                    <p className="service-lead-text" data-block-key={selectedService ? `service.${selectedService.slug}.lead` : undefined}>
                      {displayLead}
                    </p>
                  </div>

                  {/* What's Included Feature Checklist */}
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
              const isExpanded = expandedCategories[cat.tag] || searchQuery.length > 0;
              const catTitle = t(`service.${cat.id}.title`, cat.title);
              return (
                <div key={cat.id} className="sidebar-category-group mb-2">
                  <button
                    type="button"
                    className={`category-accordion-btn ${isExpanded ? 'expanded' : ''}`}
                    onClick={() => toggleCategoryAccordion(cat.tag)}
                  >
                    <span className="d-flex align-items-center gap-2">
                      <i className={`bi ${cat.icon}`} style={{ color: '#ad7d42' }}></i>
                      <span data-block-key={`service.${cat.id}.title`}>{catTitle}</span>
                    </span>
                    <i className={`bi bi-chevron-${isExpanded ? 'down' : 'right'} small`}></i>
                  </button>

                  {isExpanded && (
                    <div className="subcategories-list">
                      {cat.subcategories.map((sub) => {
                        const subTitle = t(`service.${sub.id}.title`, sub.title);
                        return (
                          <div key={sub.id} className="mb-2">
                            <div className="subcategory-label" data-block-key={`service.${sub.id}.title`}>{subTitle}</div>
                            {sub.services.map((svc) => {
                              const isSelected = selectedService?.slug === svc.slug;
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
