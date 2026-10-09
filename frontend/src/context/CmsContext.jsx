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
        if (isMounted) {
          setLoading(false);
          if (typeof window !== 'undefined' && typeof window.dismissPreloader === 'function') {
            window.dismissPreloader();
          }
        }
      }
    };

    fetchMeta();

    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Real-time Live Synchronization (SSE & Cross-Tab BroadcastChannel)
  useEffect(() => {
    // 2a. BroadcastChannel for instant 0ms local cross-tab sync
    let channel;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        channel = new BroadcastChannel('omni_cms_channel');
        channel.onmessage = (event) => {
          const data = event.data;
          if (!data) return;
          if ((data.type === 'cms_block_updated' || data.table === 'content_blocks') && data.key) {
            setBlocks((prev) => ({ ...prev, [data.key]: data.value }));
            if (data.key === 'services.cta.email' || data.key === 'footer.email') {
              setCompany((prev) => ({ ...prev, email: data.value, recipient_email: data.value }));
            } else if (data.key === 'footer.phone') {
              setCompany((prev) => ({ ...prev, phone: data.value }));
            } else if (data.key === 'footer.address') {
              setCompany((prev) => ({ ...prev, full_address: data.value }));
            } else if (data.key === 'site.name') {
              setCompany((prev) => ({ ...prev, company_name: data.value }));
            } else if (data.key === 'site.tagline') {
              setCompany((prev) => ({ ...prev, tagline: data.value }));
            } else if (data.key === 'footer.copyright') {
              setCompany((prev) => ({ ...prev, copyright_text: data.value }));
            } else if (data.key === 'footer.hq.caption') {
              setCompany((prev) => ({ ...prev, hq_caption: data.value }));
            }
          } else if (data.type === 'company_updated' || data.type === 'business_profile_updated') {
            const comp = data.company || data.profile;
            if (comp) setCompany((prev) => ({ ...prev, ...comp }));
          }
        };
      } catch (_) {}
    }

    // 2b. Server-Sent Events (SSE) for server-pushed live updates across all clients & production
    let eventSource;
    let sseTimeout;
    const connectSSE = () => {
      if (typeof window === 'undefined' || !window.EventSource) return;
      try {
        eventSource = new EventSource('/api/v1/live');
        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (!data) return;

            if ((data.type === 'cms_block_updated' || data.table === 'content_blocks') && data.key) {
              setBlocks((prev) => ({ ...prev, [data.key]: data.value }));
              if (data.key === 'services.cta.email' || data.key === 'footer.email') {
                setCompany((prev) => ({ ...prev, email: data.value, recipient_email: data.value }));
              } else if (data.key === 'footer.phone') {
                setCompany((prev) => ({ ...prev, phone: data.value }));
              } else if (data.key === 'footer.address') {
                setCompany((prev) => ({ ...prev, full_address: data.value }));
              } else if (data.key === 'site.name') {
                setCompany((prev) => ({ ...prev, company_name: data.value }));
              } else if (data.key === 'site.tagline') {
                setCompany((prev) => ({ ...prev, tagline: data.value }));
              } else if (data.key === 'footer.copyright') {
                setCompany((prev) => ({ ...prev, copyright_text: data.value }));
              } else if (data.key === 'footer.hq.caption') {
                setCompany((prev) => ({ ...prev, hq_caption: data.value }));
              }
            } else if (data.type === 'stats_updated' && data.key) {
              setStats((prev) => ({ ...prev, [data.key]: data.value }));
            } else if (data.type === 'company_updated' || data.type === 'business_profile_updated') {
              const comp = data.company || data.profile;
              if (comp) {
                setCompany((prev) => ({ ...prev, ...comp }));
                const newEmail = comp.email || comp.recipient_email;
                const addressParts = [comp.address_line1, comp.address_line2, comp.city_state_zip].filter(Boolean);
                const fullAddress = comp.full_address || (addressParts.length > 0 ? addressParts.join(', ') : null);
                setBlocks((prev) => ({
                  ...prev,
                  ...(newEmail ? { 'footer.email': newEmail, 'services.cta.email': newEmail } : {}),
                  ...(comp.phone ? { 'footer.phone': comp.phone } : {}),
                  ...(fullAddress ? { 'footer.address': fullAddress } : {}),
                  ...(comp.company_name ? { 'site.name': comp.company_name } : {}),
                  ...(comp.tagline ? { 'site.tagline': comp.tagline } : {}),
                  ...(comp.copyright_text ? { 'footer.copyright': comp.copyright_text } : {}),
                  ...(comp.hq_caption ? { 'footer.hq.caption': comp.hq_caption } : {}),
                }));
              }
            } else if (data.type === 'email_settings_updated' && (data.recipient_email || data.sender_email)) {
              const emailVal = data.sender_email || data.recipient_email;
              setCompany((prev) => ({
                ...prev,
                email: emailVal || prev.email,
                recipient_email: data.recipient_email || prev.recipient_email,
                ...(data.sender_name ? { company_name: data.sender_name } : {}),
              }));
              if (emailVal) {
                setBlocks((prev) => ({
                  ...prev,
                  'footer.email': emailVal,
                  'services.cta.email': emailVal,
                  ...(data.sender_name ? { 'site.name': data.sender_name } : {}),
                }));
              }
            }
          } catch (_) {}
        };

        eventSource.onerror = () => {
          if (eventSource) eventSource.close();
          sseTimeout = setTimeout(connectSSE, 5000);
        };
      } catch (_) {
        sseTimeout = setTimeout(connectSSE, 5000);
      }
    };

    connectSSE();

    return () => {
      if (channel) channel.close();
      if (eventSource) eventSource.close();
      if (sseTimeout) clearTimeout(sseTimeout);
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
      if (typeof val === 'string' && (key.includes('image') || key.includes('img') || key.includes('logo'))) {
        if (!val.startsWith('http') && !val.startsWith('/')) {
          return '/' + val;
        }
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
