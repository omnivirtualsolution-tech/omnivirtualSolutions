/**
 * =================================================================
 * assets/js/cms-sync.js — Omni Virtual Solutions Universal Live CMS
 * =================================================================
 * 1. Fetches current content blocks from DB (/api/v1/site-meta) and
 *    injects them into any DOM element with [data-block-key].
 * 2. Connects to SSE (/api/v1/live) for real-time live synchronization.
 * 3. Handles in-place live editing for ANY page (Homepage, Services, etc.)
 *    when in admin session, inside editor iframe, or with ?edit=1.
 * 4. Auto-saves changes to the database on blur and debounced input.
 * =================================================================
 */

(function () {
  'use strict';

  // ── 1. Admin & Edit Mode Detection ──────────────────────────────
  const urlParams = new URLSearchParams(window.location.search);
  const isEditParam = urlParams.get('edit') === '1' || urlParams.get('admin') === '1';

  let token = localStorage.getItem('omni_admin_token') || sessionStorage.getItem('omni_admin_token');
  const isInsideIframe = window.parent && window.parent !== window;

  if (!token && isInsideIframe) {
    try {
      token = window.parent.localStorage.getItem('omni_admin_token') || window.parent.sessionStorage.getItem('omni_admin_token');
    } catch (_) {}
  }

  // Edit mode is active ONLY inside the admin editor iframe OR when explicitly requested with ?edit=1.
  // Regular visitors on the public live site will NEVER have edit mode enabled.
  const isEditorSession = isInsideIframe || isEditParam;
  const isAdmin = Boolean(isEditorSession);
  let isEditMode = Boolean(isEditorSession);

  const debounceTimers = {};
  const boundElements = new WeakSet();

  // ── Track Page Visit Telemetry (Deduplicated per session, exclude admin) ──
  const isExcluded = isInsideIframe || window.location.pathname.startsWith('/admin') ||
                     window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ||
                     Boolean(localStorage.getItem('omni_admin_token') || sessionStorage.getItem('omni_admin_token'));

  if (!isExcluded && !sessionStorage.getItem('omni_session_visit')) {
    try {
      sessionStorage.setItem('omni_session_visit', String(Date.now()));
      fetch('/api/v1/track-visit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: window.location.pathname,
          referrer: document.referrer || 'direct'
        })
      }).catch(function(){});
    } catch (_) {}
  }

  // ── 2. Apply content block to DOM element ────────────────────────
  function applyBlock(key, value, type) {
    if (value === undefined || value === null) return;
    const elements = document.querySelectorAll(`[data-block-key="${key}"]`);
    elements.forEach((el) => {
      // Don't overwrite if actively being edited
      if (document.activeElement === el) return;

      if (key === 'home.cta.trust_tags') {
        try {
          const tags = typeof value === 'string' ? JSON.parse(value) : value;
          if (Array.isArray(tags)) {
            tags.forEach((t, idx) => {
              const itemKey = `home.cta.trust_tag_${idx + 1}`;
              const itemEl = document.querySelector(`[data-block-key="${itemKey}"]`);
              if (itemEl && document.activeElement !== itemEl) {
                const icon = itemEl.querySelector('i');
                const iconHtml = icon ? icon.outerHTML + ' ' : '';
                itemEl.innerHTML = iconHtml + (t.text || '');
              }
            });
            return;
          }
        } catch (_) {}
      }

      if (el.tagName.toLowerCase() === 'img') {
        const path = value.startsWith('http') ? value : (value.startsWith('/') ? value : '/' + value);
        el.src = path;
      } else if (el.querySelector('i') && !el.querySelector('[data-block-key]')) {
        const icon = el.querySelector('i');
        const iconHtml = icon ? icon.outerHTML + ' ' : '';
        const cleanVal = String(value).replace(/^[✓📖☑️📢📍]\s*/, '').trim();
        if (cleanVal.includes('\n')) {
          el.innerHTML = iconHtml + cleanVal.replace(/\n/g, '<br>');
        } else {
          el.innerHTML = iconHtml + cleanVal;
        }
      } else {
        if (value.includes('\n')) {
          el.innerHTML = value.replace(/\n/g, '<br>');
        } else {
          el.textContent = value;
        }
      }

      el.classList.add('cms-live-pulsing');
      setTimeout(() => el.classList.remove('cms-live-pulsing'), 1200);
    });

    // Side-effects for global keys across anchors & brand tags
    if (key === 'footer.email' || key === 'services.cta.email') {
      document.querySelectorAll('a[href^="mailto:"]').forEach(a => {
        a.setAttribute('href', `mailto:${value}`);
        if (a.textContent.includes('@') && document.activeElement !== a) a.textContent = value;
      });
    } else if (key === 'footer.phone') {
      const cleanPhone = value.replace(/[^0-9+]/g, '');
      document.querySelectorAll('a[href^="tel:"]').forEach(a => {
        a.setAttribute('href', `tel:${cleanPhone}`);
        if (document.activeElement !== a && (/\d{3}/.test(a.textContent) || a.textContent.trim().startsWith('+'))) a.textContent = value;
      });
    } else if (key === 'site.name') {
      document.querySelectorAll('.sitename, [data-company-name]').forEach(el => {
        if (document.activeElement !== el) el.textContent = value;
      });
      if (document.title && document.title.includes('Omni Virtual Solutions') && value !== 'Omni Virtual Solutions') {
        document.title = document.title.replace(/Omni Virtual Solutions/g, value);
      }
    }
  }

  // ── 2b. Apply Universal Business Profile (Name, Email, Phone, Address, Copyright) ────
  function applyBusinessProfile(company) {
    if (!company) return;

    // 1. Company Name / Brand
    if (company.company_name) {
      document.querySelectorAll('.sitename, [data-company-name]').forEach((el) => {
        if (document.activeElement !== el) el.textContent = company.company_name;
      });
      if (document.title && document.title.includes('Omni Virtual Solutions') && company.company_name !== 'Omni Virtual Solutions') {
        document.title = document.title.replace(/Omni Virtual Solutions/g, company.company_name);
      }
    }

    // 2. Email Address
    const activeEmail = company.email || company.recipient_email;
    if (activeEmail) {
      document.querySelectorAll('[data-block-key="footer.email"], [data-block-key="services.cta.email"], [data-company-email]').forEach((el) => {
        if (document.activeElement !== el) {
          el.textContent = activeEmail;
          if (el.tagName.toLowerCase() === 'a') {
            el.setAttribute('href', `mailto:${activeEmail}`);
          }
        }
      });
      document.querySelectorAll('a[href^="mailto:"]').forEach((a) => {
        a.setAttribute('href', `mailto:${activeEmail}`);
        if (a.textContent.includes('@') && document.activeElement !== a) {
          a.textContent = activeEmail;
        }
      });
    }

    // 3. Phone Number
    if (company.phone) {
      const cleanPhone = company.phone.replace(/[^0-9+]/g, '');
      document.querySelectorAll('[data-block-key="footer.phone"], [data-company-phone]').forEach((el) => {
        if (document.activeElement !== el) {
          el.textContent = company.phone;
          if (el.tagName.toLowerCase() === 'a') {
            el.setAttribute('href', `tel:${cleanPhone}`);
          }
        }
      });
      document.querySelectorAll('a[href^="tel:"]').forEach((a) => {
        a.setAttribute('href', `tel:${cleanPhone}`);
        if (document.activeElement !== a && (/\d{3}/.test(a.textContent) || a.textContent.trim().startsWith('+'))) {
          a.textContent = company.phone;
        }
      });
    }

    // 4. Address & HQ
    const fullAddress = company.full_address || [company.address_line1, company.address_line2, company.city_state_zip].filter(Boolean).join(', ');
    if (fullAddress) {
      document.querySelectorAll('[data-block-key="footer.address"], [data-company-address]').forEach((el) => {
        if (document.activeElement !== el) {
          if (fullAddress.includes('\n') || fullAddress.includes('<br')) {
            el.innerHTML = fullAddress.replace(/\n/g, '<br>');
          } else {
            el.textContent = fullAddress;
          }
        }
      });
    }

    if (company.hq_caption) {
      document.querySelectorAll('[data-block-key="footer.hq.caption"]').forEach((el) => {
        if (document.activeElement !== el) el.textContent = company.hq_caption;
      });
    }

    // 5. Copyright
    if (company.copyright_text) {
      document.querySelectorAll('[data-block-key="footer.copyright"]').forEach((el) => {
        if (document.activeElement !== el) el.textContent = company.copyright_text;
      });
    }
  }

  // ── 3. Auto-assign data-block-key to service sections ────────────
  function setupServiceBlockKeys() {
    const contentArea = document.querySelector('.content') || document.querySelector('main') || document.body;
    if (!contentArea) return;

    // Scan all sections inside content or root
    const sections = contentArea.querySelectorAll('section');
    sections.forEach((sec) => {
      const secId = (sec.id || 'general').replace(/-section$/, '').toLowerCase();
      // Contact section has explicit standardized keys — skip auto-tagging
      if (secId === 'contact') return;

      // Tag Headings
      sec.querySelectorAll('h1, h2, h3, h4, h5').forEach((heading, idx) => {
        if (!heading.hasAttribute('data-block-key')) {
          // Check if it has a child <b> that already has a key
          const childB = heading.querySelector('b[data-block-key]');
          if (!childB) {
            heading.setAttribute('data-block-key', `service.${secId}.h_${idx}`);
          }
        }
      });

      // Tag Paragraphs and Spans
      sec.querySelectorAll('p, blockquote, span').forEach((textEl, idx) => {
        const text = textEl.textContent.trim();
        // Skip tiny labels, icons, or if inside an already tagged element, or if contains tagged child
        if (textEl.hasAttribute('data-block-key') || textEl.querySelector('[data-block-key]')) return;
        const isPill = textEl.classList.contains('service-pill');
        if ((isPill || text.length >= 4) && !textEl.hasAttribute('data-block-key')) {
          const parentTagged = textEl.parentElement?.closest('[data-block-key]');
          if (!parentTagged) {
            const tag = textEl.tagName.toLowerCase();
            textEl.setAttribute('data-block-key', `service.${secId}.${tag}_${idx}`);
          }
        }
      });

      // Tag Service Card Badges/Tags
      sec.querySelectorAll('.service-card-tag').forEach((tagEl, idx) => {
        if (!tagEl.hasAttribute('data-block-key')) {
          tagEl.setAttribute('data-block-key', `service.${secId}.tag_${idx + 1}`);
        }
      });

      // Tag Images
      sec.querySelectorAll('img').forEach((imgEl, idx) => {
        if (!imgEl.hasAttribute('data-block-key')) {
          imgEl.setAttribute('data-block-key', `service.${secId}.img_${idx}`);
        }
      });
    });
  }

  // ── 4. Load initial content from DB via /api/v1/site-meta ────────
  async function loadInitialContent() {
    try {
      const res = await fetch('/api/v1/site-meta');
      if (!res.ok) return;
      const data = await res.json();

      if (data.blockMap) {
        Object.entries(data.blockMap).forEach(([key, val]) => {
          applyBlock(key, val);
        });
      }

      if (data.company) {
        applyBusinessProfile(data.company);
      }
    } catch (err) {
      console.warn('[cms-sync] Could not load initial DB content:', err.message);
    }
  }

  // ── 5. Save Block to Database ────────────────────────────────────
  async function saveBlock(key, value) {
    // Always refresh token from local or parent storage
    token = localStorage.getItem('omni_admin_token') || sessionStorage.getItem('omni_admin_token');
    if (!token && isInsideIframe) {
      try {
        token = window.parent.localStorage.getItem('omni_admin_token') || window.parent.sessionStorage.getItem('omni_admin_token');
      } catch (_) {}
    }

    updateStatus('saving');

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = 'Bearer ' + token;

      const res = await fetch(`/api/v1/cms/blocks/${encodeURIComponent(key)}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ value }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        updateStatus('saved');
        showToast(`Saved: ${key}`);
        if (typeof BroadcastChannel !== 'undefined') {
          try {
            const ch = new BroadcastChannel('omni_cms_channel');
            ch.postMessage({ type: 'cms_block_updated', key, value });
            ch.close();
          } catch (_) {}
        }
      } else {
        updateStatus('error');
      }
    } catch (err) {
      updateStatus('error');
    }
  }

  // ── 6. In-Place Live Editing Engine ──────────────────────────────
  function attachEditableListeners() {
    const editables = document.querySelectorAll('[data-block-key]');
    editables.forEach((el) => {
      if (boundElements.has(el)) return;
      boundElements.add(el);

      const key = el.getAttribute('data-block-key');

      if (el.tagName.toLowerCase() === 'img') {
        el.title = `Click to change image (${key})`;
        
        // Also attach click proxy to parent wrapper if any
        const parentFrame = el.closest('.about-v2-img-frame, .footer-img-wrapper, .book-card-wrap, .about-v2-visual');
        if (parentFrame && !parentFrame.hasAttribute('data-has-img-proxy')) {
          parentFrame.setAttribute('data-has-img-proxy', 'true');
          parentFrame.addEventListener('click', (e) => {
            if (!isEditMode) return;
            if (e.target !== el) {
              e.preventDefault();
              e.stopPropagation();
              el.click();
            }
          });
        }

        el.addEventListener('click', (e) => {
          if (!isEditMode) return;
          e.preventDefault();
          e.stopPropagation();
          if (isInsideIframe) {
            try {
              window.parent.postMessage({ type: 'OPEN_MEDIA', key: key }, '*');
              return;
            } catch (_) {}
          }
          promptImageUpload(key, el);
        });
      } else if (key === 'home.cta.trust_tags') {
        // Trust tags container has specialized child items; do not make container plain editable
        return;
      } else {
        el.contentEditable = isEditMode ? 'true' : 'false';
        el.spellcheck = false;

        // Prevent link navigation and label/button activations when clicking inside content in edit mode, and ensure immediate focus
        el.addEventListener('click', (e) => {
          if (isEditMode) {
            const anchor = el.tagName.toLowerCase() === 'a' ? el : el.closest('a');
            if (anchor) e.preventDefault();
            if (el.tagName.toLowerCase() === 'label' || el.closest('label') || el.closest('button')) {
              e.preventDefault();
            }
            el.focus();
          }
        });
        el.addEventListener('mousedown', (e) => {
          if (isEditMode) {
            if (el.tagName.toLowerCase() === 'label' || el.closest('label') || el.closest('button')) {
              e.preventDefault();
            }
            el.focus();
          }
        });

        // Auto-save on blur
        el.addEventListener('blur', () => {
          if (!isEditMode) return;
          const raw = el.innerText.trim();
          const val = (el.classList.contains('service-pill') || el.classList.contains('trust-item')) ? raw.replace(/^[✓📖☑️📢]\s*/, '').trim() : raw;
          saveBlock(key, val);
          if (key.startsWith('home.cta.trust_tag_')) {
            syncTrustTagsContainer();
          }
        });

        // Debounced auto-save on typing (800ms)
        el.addEventListener('input', () => {
          if (!isEditMode) return;
          updateStatus('saving');
          clearTimeout(debounceTimers[key]);
          debounceTimers[key] = setTimeout(() => {
            const raw = el.innerText.trim();
            const val = (el.classList.contains('service-pill') || el.classList.contains('trust-item')) ? raw.replace(/^[✓📖☑️📢]\s*/, '').trim() : raw;
            saveBlock(key, val);
            if (key.startsWith('home.cta.trust_tag_')) {
              syncTrustTagsContainer();
            }
          }, 800);
        });
      }
    });

    function syncTrustTagsContainer() {
      const container = document.getElementById('ctaTrustTagsContainer') || document.querySelector('.cta-trust-tags');
      if (!container) return;
      const items = Array.from(container.querySelectorAll('.trust-item')).map(item => {
        const i = item.querySelector('i');
        let icon = 'bi-check-circle';
        if (i) {
          const cls = Array.from(i.classList).find(c => c.startsWith('bi-') && c !== 'bi');
          if (cls) icon = cls;
        }
        const text = item.innerText.replace(/^[✓📖☑️📢]\s*/, '').trim();
        return { icon, text };
      });
      saveBlock('home.cta.trust_tags', JSON.stringify(items));
    }

    // Also disable clicking on links within content during edit mode so user can edit text without redirecting
    if (isEditMode) {
      document.querySelectorAll('a, .content a, section a, .service-card-luxury a').forEach((a) => {
        a.addEventListener('click', (e) => {
          if (isEditMode) {
            e.preventDefault();
          }
        });
      });
    }
  }

  function initLiveEditor() {
    if (!isAdmin) return;

    document.body.classList.add('is-admin-session', 'mode-edit');
    attachEditableListeners();
    injectFloatingBar();
  }

  // Public hook to refresh editables when switching sections/tabs
  window.__omniRefreshLiveEditor = function () {
    setupServiceBlockKeys();
    if (isEditMode) {
      document.body.classList.add('is-admin-session', 'mode-edit');
      attachEditableListeners();
    }
  };

  // ── 7. Image Upload ──────────────────────────────────────────────
  function promptImageUpload(blockKey, imgEl) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files[0];
      if (!file) return;

      const formData = new FormData();
      formData.append('image', file);
      formData.append('block_key', blockKey);

      showToast('Uploading new photo...');
      try {
        const headers = {};
        if (token) headers['Authorization'] = 'Bearer ' + token;

        const res = await fetch('/api/v1/cms/upload', {
          method: 'POST',
          headers,
          body: formData,
        });
        const data = await res.json();
        if (res.ok && data.success) {
          imgEl.src = data.path;
          showToast('Photo updated successfully!');
        } else {
          alert('Upload failed: ' + (data.error?.message || 'Error'));
        }
      } catch (err) {
        alert('Upload error: ' + err.message);
      }
    };
    input.click();
  }

  // ── 8. Status Bar & Indicators ───────────────────────────────────
  function injectFloatingBar() {
    if (isInsideIframe) return; // Parent editor bar handles all controls
    if (document.getElementById('omniLiveAdminBar')) return;

    const bar = document.createElement('div');
    bar.id = 'omniLiveAdminBar';

    if (isInsideIframe) {
      // In iframe: Render a sleek, non-intrusive floating indicator pill
      bar.innerHTML = `
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="font-weight:700; color:#eba22d; font-size:11.5px; background:rgba(235,162,45,0.18); padding:3px 8px; border-radius:4px; border:1px solid rgba(235,162,45,0.35);">
            ✦ LIVE IN-PLACE EDITOR
          </span>
          <span id="omniBarStatus" style="font-size:11.5px; color:#48bb78; display:flex; align-items:center; gap:5px;">
            <span style="width:7px; height:7px; background:#48bb78; border-radius:50%; display:inline-block;"></span> Click any text to edit
          </span>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          <button id="toggleEditBtn" style="background:#eba22d; color:#0d1117; border:none; padding:4px 10px; border-radius:6px; font-size:11px; font-weight:700; cursor:pointer;">
            ✏️ Edit Mode: ON
          </button>
        </div>
      `;
      bar.setAttribute('style', `
        position: fixed;
        bottom: 16px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(14, 18, 23, 0.94);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(235, 162, 45, 0.4);
        border-radius: 30px;
        z-index: 999999;
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 6px 16px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        box-shadow: 0 8px 30px rgba(0,0,0,0.6);
      `);
    } else {
      // Top bar for standalone viewing
      bar.innerHTML = `
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="font-weight:700; color:#eba22d; font-size:12px; background:rgba(235,162,45,0.15); padding:3px 8px; border-radius:4px; border:1px solid rgba(235,162,45,0.3);">
            ✦ OMNI CMS
          </span>
          <span id="omniBarStatus" style="font-size:11.5px; color:#48bb78; display:flex; align-items:center; gap:5px;">
            <span style="width:7px; height:7px; background:#48bb78; border-radius:50%; display:inline-block;"></span> All changes saved
          </span>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          <button id="toggleEditBtn" style="background:#eba22d; color:#0d1117; border:none; padding:4px 10px; border-radius:6px; font-size:11.5px; font-weight:700; cursor:pointer;">
            ✏️ Edit Mode: ON
          </button>
          <a href="admin/" style="background:rgba(255,255,255,0.1); color:#fff; border:1px solid rgba(255,255,255,0.15); padding:4px 10px; border-radius:6px; font-size:11.5px; text-decoration:none; font-weight:600;">
            Dashboard &rarr;
          </a>
        </div>
      `;
      bar.setAttribute('style', `
        position: fixed;
        top: 0; left: 0; right: 0;
        height: 40px;
        background: rgba(14, 18, 23, 0.96);
        backdrop-filter: blur(10px);
        border-bottom: 1px solid rgba(235, 162, 45, 0.35);
        z-index: 999999;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 16px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        box-shadow: 0 4px 16px rgba(0,0,0,0.5);
      `);
      document.body.style.paddingTop = '40px';
    }

    document.body.appendChild(bar);

    const toggleBtn = bar.querySelector('#toggleEditBtn');
    if (toggleBtn) {
      toggleBtn.onclick = () => setMode(!isEditMode);
    }
  }

  function setMode(edit) {
    isEditMode = Boolean(edit);
    document.body.classList.toggle('mode-edit', isEditMode);
    document.body.classList.toggle('mode-preview', !isEditMode);
    if (isEditMode) {
      document.body.classList.add('is-admin-session');
    }

    const toggleBtn = document.getElementById('toggleEditBtn');
    if (toggleBtn) {
      toggleBtn.textContent = isEditMode ? '✏️ Edit Mode: ON' : '👁️ Visitor Preview';
      toggleBtn.style.background = isEditMode ? '#eba22d' : 'rgba(255,255,255,0.1)';
      toggleBtn.style.color = isEditMode ? '#0d1117' : '#fff';
    }

    attachEditableListeners();

    document.querySelectorAll('[data-block-key]').forEach((el) => {
      if (el.tagName.toLowerCase() !== 'img' && el.getAttribute('data-block-key') !== 'home.cta.trust_tags') {
        el.contentEditable = isEditMode ? 'true' : 'false';
      }
    });
    showToast(isEditMode ? 'Edit Mode active' : 'Visitor Preview active');
  }

  window.__omniSetEditMode = setMode;

  // Intercept clicks during Edit Mode so clicking cards/text focuses editables and avoids accidental link navigation
  document.addEventListener('click', function (e) {
    if (!isEditMode) return;

    // Delegate clicks for editable images (including Swiper looped/cloned slides and book cards)
    const imgEl = e.target.closest('img[data-block-key]') || e.target.closest('.book-card-wrap, .about-v2-img-frame, .footer-img-wrapper')?.querySelector('img[data-block-key]');
    if (imgEl) {
      const key = imgEl.getAttribute('data-block-key');
      if (key) {
        e.preventDefault();
        e.stopPropagation();
        if (isInsideIframe) {
          try {
            window.parent.postMessage({ type: 'OPEN_MEDIA', key: key }, '*');
            return;
          } catch (_) {}
        }
        promptImageUpload(key, imgEl);
        return;
      }
    }

    const editable = e.target.closest('[contenteditable="true"], [data-block-key]');
    if (editable && editable.tagName.toLowerCase() !== 'img') {
      editable.focus();
    }
    const link = e.target.closest('a');
    if (link && (!editable || editable.tagName.toLowerCase() === 'a')) {
      e.preventDefault();
    }
  }, true);

  document.addEventListener('mousedown', function (e) {
    if (!isEditMode) return;
    const editable = e.target.closest('[contenteditable="true"], [data-block-key]');
    if (editable && editable.tagName.toLowerCase() !== 'img') {
      editable.focus();
    }
  }, true);

  window.addEventListener('message', (e) => {
    if (!e.data) return;
    if (e.data.type === 'SET_MODE') {
      setMode(e.data.edit);
    } else if (e.data.type === 'REFRESH_BLOCKS') {
      loadInitialContent();
    } else if (e.data.type === 'IMAGE_CHANGED') {
      applyBlock(e.data.key, e.data.src, 'image');
    }
  });

  function updateStatus(state) {
    const el = document.getElementById('omniBarStatus') || document.getElementById('editorSaveStatus');
    if (el) {
      if (state === 'saving') {
        el.style.color = '#eba22d';
        el.innerHTML = '<span class="spinner-border spinner-border-sm me-1" style="width:10px;height:10px;border-width:2px;display:inline-block;"></span> Saving to database...';
      } else if (state === 'saved') {
        el.style.color = '#48bb78';
        el.innerHTML = '<span style="width:7px; height:7px; background:#48bb78; border-radius:50%; display:inline-block;"></span> All changes saved';
      } else {
        el.style.color = '#f56565';
        el.innerHTML = '⚠️ Save failed';
      }
    }

    // Also notify parent iframe container if present
    if (isInsideIframe) {
      try {
        window.parent.postMessage({ type: 'CMS_STATUS', status: state }, '*');
      } catch (_) {}
    }
  }

  function showToast(msg) {
    let toast = document.getElementById('omniUniversalToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'omniUniversalToast';
      toast.setAttribute('style', `
        position: fixed;
        bottom: 24px; right: 24px;
        background: #141922;
        border: 1px solid rgba(235, 162, 45, 0.4);
        color: #fff;
        padding: 10px 16px;
        border-radius: 8px;
        font-size: 13px;
        z-index: 9999999;
        box-shadow: 0 10px 30px rgba(0,0,0,0.6);
        transition: all 0.3s ease;
        display: none;
      `);
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.display = 'block';
    setTimeout(() => { if (toast) toast.style.display = 'none'; }, 2400);
  }

  // ── 9. Connect to real-time Server-Sent Events (SSE) ────────────
  function connectLiveSync() {
    if (!window.EventSource) return;

    let sse;
    function handleLivePayload(raw) {
      try {
        const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (!data) return;

        // Content block updates
        if ((data.table === 'content_blocks' || data.type === 'cms_block_updated') && data.key) {
          applyBlock(data.key, data.value, data.blockType);
        }

        // Global business profile updates
        if (data.type === 'business_profile_updated' || data.type === 'company_updated') {
          const comp = data.profile || data.company;
          if (comp) applyBusinessProfile(comp);
        }

        // Email settings updates
        if (data.type === 'email_settings_updated') {
          applyBusinessProfile({
            email: data.sender_email,
            recipient_email: data.recipient_email,
            company_name: data.sender_name,
          });
        }
      } catch (_) {}
    }

    function initSSE() {
      try {
        sse = new EventSource('/api/v1/live');
        sse.onmessage = (e) => handleLivePayload(e.data);
        sse.addEventListener('change', (e) => handleLivePayload(e.data));
        sse.addEventListener('business_profile_updated', (e) => handleLivePayload(e.data));
        sse.addEventListener('company_updated', (e) => handleLivePayload(e.data));
        sse.onerror = () => {
          sse.close();
          setTimeout(initSSE, 5000);
        };
      } catch (_) {
        setTimeout(initSSE, 5000);
      }
    }
    initSSE();

    // ── Local Cross-Tab BroadcastChannel for 0ms same-origin sync ──
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        const localChannel = new BroadcastChannel('omni_cms_channel');
        localChannel.onmessage = (e) => handleLivePayload(e.data);
      } catch (_) {}
    }
  }

  // ── 10. Handle Contact Form submission ──────────────────────────
  function setupContactForm() {
    const form = document.getElementById('omniContactForm');
    if (!form) return;

    // Set form load timestamp for bot timing detection
    const loadTimeField = document.getElementById('_form_load_time');
    if (loadTimeField) loadTimeField.value = Date.now();

    const alertBox = document.getElementById('contactAlert');
    const submitBtn = form.querySelector('button[type="submit"]');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name    = form.querySelector('[name="name"]')?.value.trim();
      const email   = form.querySelector('[name="email"]')?.value.trim();
      const phone   = form.querySelector('[name="phone"]')?.value.trim();
      const subject = form.querySelector('[name="subject"]')?.value.trim();
      const message = form.querySelector('[name="message"]')?.value.trim();
      const serviceInterest = form.querySelector('[name="service_interest"]')?.value;
      const website = form.querySelector('[name="website"]')?.value; // honeypot
      const formLoadTime = form.querySelector('[name="_form_load_time"]')?.value;

      if (!name || !message) {
        showAlert('Please fill in your name and message.', 'danger');
        return;
      }

      const targetEmail = document.querySelector('[data-block-key="footer.email"]')?.textContent?.trim() || 'admin@omnivirtualsolution.com';
      const serviceSelect = form.querySelector('[name="service_interest"]');
      const serviceText = serviceSelect?.options[serviceSelect.selectedIndex]?.text;
      const cleanService = serviceText && !serviceText.includes('Select a Service') ? serviceText : '';

      const emailSubject = subject || (cleanService ? `${cleanService} Inquiry — ${name}` : `Website Inquiry from ${name}`);
      const bodyLines = [
        `Hi Omni Virtual Solutions Team,`,
        ``,
        `Name: ${name}`,
        email ? `Email: ${email}` : null,
        phone ? `Phone: ${phone}` : null,
        cleanService ? `Service of Interest: ${cleanService}` : null,
        ``,
        `Message:`,
        message,
      ].filter(l => l !== null);
      const emailBody = bodyLines.join('\n');

      const submitBtn = form.querySelector('button[type="submit"]');
      const origBtnContent = submitBtn ? submitBtn.innerHTML : 'Send Message';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span> Sending...';
      }

      let resData = null;
      try {
        const response = await fetch('/api/v1/contact/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            full_name: name,
            name,
            email: email || 'visitor@direct-mail.com',
            phone,
            subject: emailSubject,
            message,
            service_interest_id: serviceInterest ? parseInt(serviceInterest, 10) : null,
            form_load_time: formLoadTime,
            website,
          }),
        });
        resData = await response.json();
      } catch (err) {
        console.error('[contact] Submit network error:', err);
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = origBtnContent;
        }
      }

      if (resData && resData.success) {
        form.reset();

        if (resData.mode === 'popup_fallback') {
          // Quota reached or admin forced popup mode: open Gmail popup fallback
          const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(targetEmail)}&su=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
          const width = 680;
          const height = 740;
          const screenLeft = window.screenLeft !== undefined ? window.screenLeft : window.screenX;
          const screenTop = window.screenTop !== undefined ? window.screenTop : window.screenY;
          const innerWidth = window.innerWidth || document.documentElement.clientWidth || screen.width;
          const innerHeight = window.innerHeight || document.documentElement.clientHeight || screen.height;
          const left = Math.max(0, Math.round(screenLeft + (innerWidth - width) / 2));
          const top = Math.max(0, Math.round(screenTop + (innerHeight - height) / 2));
          const features = `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes`;
          const popupWin = window.open(gmailUrl, 'OmniGmailCompose', features);
          if (popupWin && popupWin.focus) popupWin.focus();

          showAlert(`
            <div style="font-weight:700; font-size:14px; margin-bottom:4px;">
              <i class="bi bi-info-circle-fill me-1"></i> Direct Gmail Compose Fallback Opened
            </div>
            <div>${resData.message || 'Daily automated limit reached. Please review and click <strong>Send</strong> inside the popup.'}</div>
            <div class="mt-2" style="font-size:12.5px;">
              Delivering to: <strong style="color:#fef08a;">${targetEmail}</strong>
              &nbsp;|&nbsp;
              <a href="#" onclick="window.open('${gmailUrl}','OmniGmailCompose','${features}');return false;" class="text-white text-decoration-underline fw-bold">Re-open Popup &rarr;</a>
            </div>
          `, 'warning');
        } else {
          // Standard Background Mode: show modern 5s auto-closing modal
          showSuccessModal(name, email);
        }
      } else {
        showAlert(resData?.error?.message || 'Failed to send your message. Please try again.', 'danger');
      }
    });

    function showSuccessModal(clientName, clientEmail) {
      const existing = document.getElementById('omniSuccessModal');
      if (existing) existing.remove();

      const modalEl = document.createElement('div');
      modalEl.id = 'omniSuccessModal';
      modalEl.style.cssText = `
        position: fixed;
        inset: 0;
        z-index: 99999;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(10, 15, 29, 0.78);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        opacity: 0;
        transition: opacity 0.3s ease;
        padding: 16px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      `;

      modalEl.innerHTML = `
        <div style="
          background: #0d1117;
          border: 1px solid rgba(235, 162, 45, 0.45);
          box-shadow: 0 20px 45px rgba(0, 0, 0, 0.65), 0 0 35px rgba(235, 162, 45, 0.18);
          border-radius: 16px;
          max-width: 480px;
          width: 100%;
          padding: 34px 28px;
          text-align: center;
          position: relative;
          color: #f1f5f9;
          transform: scale(0.92);
          transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        ">
          <!-- Animated Checkmark Icon -->
          <div style="
            width: 70px;
            height: 70px;
            margin: 0 auto 18px;
            background: rgba(34, 197, 94, 0.15);
            border: 2px solid #22c55e;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #22c55e;
            font-size: 32px;
            font-weight: 800;
          ">
            ✓
          </div>

          <h3 style="margin: 0 0 8px; font-size: 23px; font-weight: 800; color: #ffffff; letter-spacing: 0.2px;">
            Message Sent Successfully!
          </h3>

          <p style="margin: 0 0 16px; font-size: 14.5px; line-height: 23px; color: #94a3b8;">
            Thank you, <strong style="color: #eba22d;">${clientName || 'Valued Client'}</strong>! We have received your inquiry and sent an automated confirmation to <strong style="color: #ffffff;">${clientEmail || 'your email'}</strong>.
          </p>

          <div style="background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px; padding: 10px 14px; font-size: 12.5px; color: #cbd5e1; margin-bottom: 22px;">
            ⏱ Our team typically responds within <strong>1–2 business days</strong>.
          </div>

          <!-- Countdown and Progress bar -->
          <div style="margin-bottom: 20px;">
            <div style="display: flex; justify-content: space-between; font-size: 12px; color: #94a3b8; margin-bottom: 6px;">
              <span>Auto-closing in <strong id="modalCountdown" style="color: #eba22d;">5</strong>s</span>
              <span style="font-weight: 600;">Omni Virtual Solutions</span>
            </div>
            <div style="height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; overflow: hidden;">
              <div id="modalProgressBar" style="height: 100%; width: 100%; background: #eba22d; transition: width 5s linear;"></div>
            </div>
          </div>

          <button id="modalCloseBtn" style="
            background: #eba22d;
            color: #0d1117;
            border: none;
            border-radius: 8px;
            padding: 10px 28px;
            font-size: 14px;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.2s ease;
          " onmouseover="this.style.background='#f59e0b'" onmouseout="this.style.background='#eba22d'">
            Close Window
          </button>
        </div>
      `;

      document.body.appendChild(modalEl);

      requestAnimationFrame(() => {
        modalEl.style.opacity = '1';
        modalEl.querySelector('div').style.transform = 'scale(1)';
        const bar = document.getElementById('modalProgressBar');
        if (bar) setTimeout(() => { bar.style.width = '0%'; }, 50);
      });

      let secondsLeft = 5;
      const countEl = document.getElementById('modalCountdown');
      const interval = setInterval(() => {
        secondsLeft -= 1;
        if (countEl) countEl.textContent = Math.max(0, secondsLeft);
        if (secondsLeft <= 0) {
          clearInterval(interval);
          closeModal();
        }
      }, 1000);

      function closeModal() {
        clearInterval(interval);
        modalEl.style.opacity = '0';
        modalEl.querySelector('div').style.transform = 'scale(0.92)';
        setTimeout(() => modalEl.remove(), 300);
      }

      document.getElementById('modalCloseBtn')?.addEventListener('click', closeModal);
      modalEl.addEventListener('click', (e) => {
        if (e.target === modalEl) closeModal();
      });
    }

    function showAlert(msg, type) {
      if (!alertBox) { alert(msg); return; }
      alertBox.className = `alert alert-${type} mt-3 mb-0`;
      alertBox.innerHTML = msg;
      alertBox.classList.remove('d-none');
      if (type === 'success') setTimeout(() => alertBox.classList.add('d-none'), 8000);
    }
  }

  // ── 11. Inject Editor Styles ───────────────────────────────────
  function injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .cms-live-pulsing {
        animation: cmsPulseGlow 1.2s cubic-bezier(0.4, 0, 0.2, 1);
      }
      @keyframes cmsPulseGlow {
        0% { outline: 2px solid rgba(200, 149, 74, 0); }
        30% { outline: 2px solid rgba(200, 149, 74, 0.8); background-color: rgba(200, 149, 74, 0.1); border-radius: 4px; }
        100% { outline: 2px solid rgba(200, 149, 74, 0); }
      }
      body.mode-edit [data-block-key] {
        outline: 2px dashed rgba(235, 162, 45, 0.6) !important;
        outline-offset: 3px !important;
        border-radius: 4px !important;
        cursor: text !important;
        transition: outline 0.15s, background-color 0.15s !important;
        min-height: 1.2em;
        max-width: 100% !important;
        box-sizing: border-box !important;
        -webkit-user-select: text !important;
        user-select: text !important;
      }
      body.mode-edit .service-card-title[data-block-key] {
        position: relative !important;
        z-index: 5 !important;
        cursor: text !important;
        -webkit-user-select: text !important;
        user-select: text !important;
      }
      body.mode-edit .service-pill[data-block-key] {
        display: inline-flex !important;
        align-items: center !important;
        gap: 4px !important;
        cursor: text !important;
        -webkit-user-select: text !important;
        user-select: text !important;
      }
      body.mode-edit .service-card-tag[data-block-key] {
        display: inline-block !important;
        cursor: text !important;
        -webkit-user-select: text !important;
        user-select: text !important;
      }
      body.mode-edit .service-link-text[data-block-key] {
        display: inline-block !important;
        cursor: text !important;
        -webkit-user-select: text !important;
        user-select: text !important;
      }
      body.mode-edit .trust-item[data-block-key] {
        display: inline-flex !important;
        align-items: center !important;
        gap: 8px !important;
        cursor: text !important;
        -webkit-user-select: text !important;
        user-select: text !important;
      }
      body.mode-edit p[data-block-key],
      body.mode-edit h1[data-block-key],
      body.mode-edit h2[data-block-key],
      body.mode-edit h3[data-block-key],
      body.mode-edit h4[data-block-key],
      body.mode-edit h5[data-block-key] {
        display: block !important;
      }
      body.mode-edit span[data-block-key]:not(.service-pill):not(.service-link-text):not(.trust-item),
      body.mode-edit b[data-block-key],
      body.mode-edit strong[data-block-key] {
        display: inline !important;
      }
      body.mode-edit a[data-block-key] {
        display: inline-flex !important;
      }
      body.mode-edit .contact-info-card:hover {
        transform: none !important;
      }
      body.mode-edit .contact-pill-badge span[data-block-key] {
        display: inline-block !important;
        cursor: text !important;
      }
      body.mode-edit .contact-section-heading[data-block-key] {
        cursor: text !important;
      }
      body.mode-edit .contact-info-content h4[data-block-key] {
        cursor: text !important;
        display: inline-block !important;
        margin-bottom: 4px !important;
      }
      body.mode-edit .contact-card-text {
        cursor: default;
      }
      body.mode-edit .contact-card-text a[data-block-key] {
        cursor: text !important;
        display: inline-block !important;
      }
      body.mode-edit .contact-btn-submit span[data-block-key] {
        cursor: text !important;
        display: inline-block !important;
      }
      body.mode-edit .form-label span[data-block-key] {
        cursor: text !important;
        display: inline-block !important;
      }
      body.mode-edit [data-block-key]:hover {
        outline: 2px solid #eba22d !important;
        background-color: rgba(235, 162, 45, 0.12) !important;
      }
      body.mode-edit [data-block-key]:focus {
        outline: 2px solid #eba22d !important;
        background-color: rgba(235, 162, 45, 0.18) !important;
      }
      body.mode-edit img[data-block-key] {
        outline: 2.5px dashed #eba22d !important;
        outline-offset: 3px !important;
        cursor: pointer !important;
        transition: outline 0.2s ease, box-shadow 0.2s ease, filter 0.2s ease !important;
        position: relative !important;
      }
      body.mode-edit img[data-block-key]:hover {
        outline: 3px solid #f59e0b !important;
        box-shadow: 0 0 22px rgba(235, 162, 45, 0.75) !important;
        filter: brightness(1.1) !important;
      }
      body.mode-edit .about-v2-img-overlay {
        pointer-events: none !important;
      }
      body.mode-edit .about-v2-img-frame,
      body.mode-edit .footer-img-wrapper,
      body.mode-edit .book-card-wrap {
        cursor: pointer !important;
      }
      body.mode-preview [data-block-key] {
        outline: none !important;
        cursor: default !important;
        background-color: transparent !important;
      }
      html.in-iframe [data-aos],
      body.is-admin-session [data-aos],
      body.mode-edit [data-aos] {
        opacity: 1 !important;
        transform: none !important;
        visibility: visible !important;
        transition: none !important;
      }
      /* Responsive Design Mastery: Hide scroll-to-top button in iframe and edit mode so it never covers buttons (e.g. SERVICES ->) */
      html.in-iframe #scroll-top,
      body.mode-edit #scroll-top,
      body.mode-preview.in-iframe #scroll-top {
        display: none !important;
        opacity: 0 !important;
        pointer-events: none !important;
        visibility: hidden !important;
      }
      /* Sleek mobile overlay scrollbar inside editor iframe (eliminates 17px Windows desktop scrollbar that squishes 393px viewport) */
      html.in-iframe,
      html.in-iframe body {
        scrollbar-width: thin;
        scrollbar-color: rgba(235, 162, 45, 0.4) transparent;
        -webkit-overflow-scrolling: touch;
      }
      html.in-iframe::-webkit-scrollbar,
      html.in-iframe body::-webkit-scrollbar {
        width: 4px;
        height: 4px;
      }
      html.in-iframe::-webkit-scrollbar-track,
      html.in-iframe body::-webkit-scrollbar-track {
        background: transparent;
      }
      html.in-iframe::-webkit-scrollbar-thumb,
      html.in-iframe body::-webkit-scrollbar-thumb {
        background: rgba(235, 162, 45, 0.35);
        border-radius: 4px;
      }
      html.in-iframe::-webkit-scrollbar-thumb:hover,
      html.in-iframe body::-webkit-scrollbar-thumb:hover {
        background: rgba(235, 162, 45, 0.75);
      }
      /* Mobile touch & outline refinement */
      @media (max-width: 768px) {
        body.mode-edit [data-block-key] {
          outline-offset: 1.5px !important;
          outline-width: 1.5px !important;
        }
      }
      body.mode-edit [data-block-key] {
        touch-action: manipulation;
        -webkit-tap-highlight-color: rgba(235, 162, 45, 0.2);
      }
    `;
    document.head.appendChild(style);
  }

  // ── Init ───────────────────────────────────────────────────────
  function init() {
    injectStyles();
    setupServiceBlockKeys();
    loadInitialContent();
    setupContactForm();
    connectLiveSync();
    if (isAdmin) {
      initLiveEditor();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
