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
    tag: cat.tag || cat.slug || '',
    icon: cat.icon || cat.icon_class || 'bi-bookmark-star',
    subcategories: (cat.subcategories || []).map((sub) => ({
      id: sub.id || sub.slug || '',
      title: sub.title || '',
      services: (sub.services || []).map((s) => ({
        slug: s.slug || '',
        title: s.title || '',
        price: s.price || s.price_display || '',
        price_display: s.price || s.price_display || '',
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

  const publishingOptionsTitle = t('service.publishing-options.title', 'Publishing Options');
  const publishingOptionsDesc = t('service.publishing-options.desc', 'Our packages offer various combinations of our publishing, editorial, and marketing services for a truly customized publishing experience. With Omni, you can choose the package that best suits your literary goals.');

  const publishingPackagesList = [
    {
      slug: 'basic-package',
      title: t('service.basic-package.title', 'Basic Package'),
      price: t('service.basic-package.price', '$899.00'),
      summary: t('service.basic-package.summary', 'The Basic package is designed for authors seeking basic publishing needs. It includes digital formatting and distribution for e-books, paperback publishing, and customization options for the interior and cover.'),
    },
    {
      slug: 'standard-package',
      title: t('service.standard-package.title', 'Standard Package'),
      price: t('service.standard-package.price', '$1,599.00'),
      summary: t('service.standard-package.summary', 'Building on the Basic, the Standard package adds hardcover publishing to the mix, enhancing the physical presence of your book. This package maintains all the services of the Basic package, including the customization, support, and online distribution features.'),
    },
    {
      slug: 'advanced-package',
      title: t('service.advanced-package.title', 'Advanced Package'),
      price: t('service.advanced-package.price', '$4,999.00'),
      summary: t('service.advanced-package.summary', 'The Advanced package is the most comprehensive, designed for authors who want extensive support and marketing tools. It includes everything from the Standard package, but boosts the number of copies provided to 20 paperbacks and 5 hardcovers.'),
    },
  ];

  // Active selected service display values with fallback to t() overrides
  const displayTitle = selectedService ? t(`service.${selectedService.slug}.title`, selectedService.title) : '';
  const displayPrice = selectedService ? t(`service.${selectedService.slug}.price`, selectedService.price || selectedService.price_display || '') : '';
  const displayLead = selectedService ? t(`service.${selectedService.slug}.lead`, selectedService.lead || selectedService.lead_paragraph) : '';
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
                    const totalCount = cat.subcategories.reduce(
                      (acc, sub) => acc + (sub.services || []).filter((s) => !(cat.id === 'publishing-packages' && s.slug === 'publishing-packages')).length,
                      0
                    );
                    const catTitle = t(`service.${cat.id}.title`, cat.title);
                    const isCatOverviewSelected = selectedService?.slug === 'publishing-packages' && cat.id === 'publishing-packages';

                    return (
                      <div key={cat.id} className="sidebar-category-group">
                        <div className="d-flex align-items-center justify-content-between category-header-row">
                          <button
                            type="button"
                            className={`category-accordion-btn ${isExpanded ? 'expanded' : ''} ${isCatOverviewSelected ? 'active-category' : ''}`}
                            onClick={() => {
                              toggleCategoryAccordion(cat.tag);
                              if (cat.id === 'publishing-packages') {
                                const pubSvc = allServicesList.find((s) => s.slug === 'publishing-packages') || cat.subcategories[0]?.services[0];
                                if (pubSvc) {
                                  handleSelectService(
                                    {
                                      ...pubSvc,
                                      title: t(`service.${pubSvc.slug}.title`, pubSvc.title),
                                      lead: t(`service.${pubSvc.slug}.lead`, pubSvc.lead),
                                    },
                                    cat,
                                    cat.subcategories[0]
                                  );
                                }
                              } else if (cat.subcategories[0]?.services[0]) {
                                const targetSvc = cat.subcategories[0].services[0];
                                handleSelectService({ ...targetSvc, title: t(`service.${targetSvc.slug}.title`, targetSvc.title) }, cat, cat.subcategories[0]);
                              }
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
                              <i className={`bi bi-chevron-${isExpanded ? 'down' : 'right'} small`}></i>
                            </span>
                          </button>
                        </div>

                        {isExpanded && (
                          <div className="subcategories-list">
                            {cat.subcategories.map((sub) => {
                              const subTitle = t(`service.${sub.id}.title`, sub.title);
                              const filteredServices = (sub.services || []).filter(
                                (svc) => !(cat.id === 'publishing-packages' && svc.slug === 'publishing-packages')
                              );
                              return (
                                <div key={sub.id} className="mb-2">
                                  <div className="subcategory-label" data-block-key={`service.${sub.id}.title`}>
                                    {subTitle}
                                  </div>
                                  {filteredServices.map((svc) => {
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
                      {displayPrice && (
                        <div className="service-package-price-display">
                          <span 
                            className="editable-field"
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

                  {/* Service Overview Box */}
                  <div className="service-lead-box">
                    <h5 data-block-key="services.overview.heading">{overviewHeading}</h5>
                    <p className="service-lead-text" data-block-key={selectedService ? `service.${selectedService.slug}.lead` : undefined}>
                      {displayLead}
                    </p>
                  </div>

                  {/* Bottom section: Publishing Options for overview, or What's Included for other services */}
                  {selectedService?.slug === 'publishing-packages' ? (
                    <div className="publishing-options-section">
                      <h4 
                        className="publishing-options-title" 
                        data-block-key="service.publishing-options.title"
                      >
                        {publishingOptionsTitle}
                      </h4>
                      <p 
                        className="publishing-options-desc" 
                        data-block-key="service.publishing-options.desc"
                      >
                        {publishingOptionsDesc}
                      </p>

                      <div className="publishing-packages-container">
                        {publishingPackagesList.map((pkg) => (
                          <div 
                            key={pkg.slug} 
                            className="publishing-package-card"
                            onClick={() => {
                              const found = allServicesList.find(s => s.slug === pkg.slug);
                              if (found) setSelectedService(found);
                            }}
                          >
                            <div className="publishing-package-card-header">
                              <div className="d-flex align-items-center gap-2 flex-wrap">
                                <h5 className="publishing-package-card-title">
                                  {pkg.title}
                                </h5>
                                {pkg.price && (
                                  <span 
                                    className="publishing-package-price-badge"
                                    data-block-key={`service.${pkg.slug}.price`}
                                  >
                                    {pkg.price}
                                  </span>
                                )}
                              </div>
                              <span className="publishing-package-arrow-badge">
                                <i className="bi bi-arrow-right-short"></i>
                              </span>
                            </div>
                            <p 
                              className="publishing-package-card-summary" 
                              data-block-key={`service.${pkg.slug}.summary`}
                            >
                              {pkg.summary}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    /* What's Included Feature Checklist */
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
              const isExpanded = expandedCategories[cat.tag] || searchQuery.length > 0;
              const catTitle = t(`service.${cat.id}.title`, cat.title);
              const isCatOverviewSelected = selectedService?.slug === 'publishing-packages' && cat.id === 'publishing-packages';
              return (
                <div key={cat.id} className="sidebar-category-group mb-2">
                  <button
                    type="button"
                    className={`category-accordion-btn ${isExpanded ? 'expanded' : ''} ${isCatOverviewSelected ? 'active-category' : ''}`}
                    onClick={() => {
                      toggleCategoryAccordion(cat.tag);
                      if (cat.id === 'publishing-packages') {
                        const pubSvc = allServicesList.find((s) => s.slug === 'publishing-packages') || cat.subcategories[0]?.services[0];
                        if (pubSvc) {
                          handleSelectService(
                            {
                              ...pubSvc,
                              title: t(`service.${pubSvc.slug}.title`, pubSvc.title),
                              lead: t(`service.${pubSvc.slug}.lead`, pubSvc.lead),
                            },
                            cat,
                            cat.subcategories[0]
                          );
                          setDrawerOpen(false);
                        }
                      } else if (cat.subcategories[0]?.services[0]) {
                        const targetSvc = cat.subcategories[0].services[0];
                        handleSelectService({ ...targetSvc, title: t(`service.${targetSvc.slug}.title`, targetSvc.title) }, cat, cat.subcategories[0]);
                        setDrawerOpen(false);
                      }
                    }}
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
                        const filteredServices = (sub.services || []).filter(
                          (svc) => !(cat.id === 'publishing-packages' && svc.slug === 'publishing-packages')
                        );
                        return (
                          <div key={sub.id} className="mb-2">
                            <div className="subcategory-label" data-block-key={`service.${sub.id}.title`}>{subTitle}</div>
                            {filteredServices.map((svc) => {
                              const isSelected = selectedService?.slug === svc.slug;
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
