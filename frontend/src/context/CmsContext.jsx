import React, { createContext, useContext, useState, useEffect } from 'react';

const CmsContext = createContext({
  blocks: {},
  stats: {},
  company: {},
  books: [],
  loading: true,
  t: (key, fallback) => fallback,
});

export const CmsProvider = ({ children }) => {
  const [blocks, setBlocks] = useState({});
  const [stats, setStats] = useState({});
  const [company, setCompany] = useState({});
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);

  // 1. Fetch initial metadata
  useEffect(() => {
    let isMounted = true;
    const fetchMeta = async () => {
      try {
        const res = await fetch('/api/v1/site-meta');
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            if (data.blockMap) setBlocks(data.blockMap);
            if (data.company) {
              setCompany(data.company);
              setBlocks((prev) => ({
                ...prev,
                ...(data.company.company_name ? { 'site.name': data.company.company_name } : {}),
                ...(data.company.tagline ? { 'site.tagline': data.company.tagline } : {}),
                ...(data.company.email ? { 'footer.email': data.company.email, 'services.cta.email': data.company.email } : {}),
                ...(data.company.phone ? { 'footer.phone': data.company.phone } : {}),
                ...(data.company.full_address ? { 'footer.address': data.company.full_address } : {}),
                ...(data.company.copyright_text ? { 'footer.copyright': data.company.copyright_text } : {}),
                ...(data.company.hq_caption ? { 'footer.hq.caption': data.company.hq_caption } : {}),
              }));
            }
            if (data.showcase_books && data.showcase_books.length > 0) {
              setBooks(data.showcase_books);
            }
            if (data.stats && Array.isArray(data.stats)) {
              const statMap = {};
              data.stats.forEach((s) => {
                statMap[s.stat_key] = s.stat_value;
              });
              setStats((prev) => ({ ...prev, ...statMap }));
            }
          }
        }
      } catch (err) {
        // Fallback gracefully to default static text
        console.warn('[CMS] Running in standalone/fallback mode:', err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchMeta();

    return () => {
      isMounted = false;
    };
  }, []);

  const t = (key, fallback = '') => {
    // Check specific profile overrides first if set in company state
    if (key === 'site.name' && company?.company_name) return company.company_name;
    if (key === 'site.tagline' && company?.tagline) return company.tagline;
    if (key === 'footer.email' && company?.email) return company.email;
    if (key === 'services.cta.email' && company?.email) return company.email;
    if (key === 'footer.phone' && company?.phone) return company.phone;
    if (key === 'footer.address' && company?.full_address) return company.full_address;
    if (key === 'footer.copyright' && company?.copyright_text) return company.copyright_text;
    if (key === 'footer.hq.caption' && company?.hq_caption) return company.hq_caption;

    const val = blocks[key];
    if (val !== undefined && val !== null) {
      if (typeof val === 'string' && (key.includes('image') || key.includes('img') || key.includes('logo')) && val.startsWith('assets/')) {
        return '/' + val;
      }
      return val;
    }

    if (key.startsWith('home.cta.trust_tag_') && blocks['home.cta.trust_tags']) {
      try {
        const idx = parseInt(key.replace('home.cta.trust_tag_', ''), 10) - 1;
        const parsed = typeof blocks['home.cta.trust_tags'] === 'string' ? JSON.parse(blocks['home.cta.trust_tags']) : blocks['home.cta.trust_tags'];
        if (Array.isArray(parsed) && parsed[idx]?.text) {
          return parsed[idx].text;
        }
      } catch (_) {}
    }

    return fallback;
  };

  return (
    <CmsContext.Provider value={{ blocks, stats, company, books, loading, t }}>
      {children}
    </CmsContext.Provider>
  );
};

export const useCms = () => useContext(CmsContext);
