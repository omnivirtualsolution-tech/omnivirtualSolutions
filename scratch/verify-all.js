const fs = require('fs');

(async () => {
  console.log('=== VERIFYING SERVICES & ADMIN LIVE EDIT CONFIGURATION ===\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
      failed++;
    }
  }

  try {
    // 1. Check API endpoint
    const res = await fetch('http://localhost:3000/api/v1/services');
    assert(res.status === 200, 'API /api/v1/services returns 200 OK');
    const data = await res.json();
    assert(Array.isArray(data.catalog) && data.catalog.length === 8, 'Catalog has exactly 8 categories');

    const expectedCats = [
      'publishing-packages',
      'evaluation-services',
      'editorial-services',
      'formats',
      'design-services',
      'production',
      'marketing-services',
      'bookselling'
    ];

    expectedCats.forEach(id => {
      const cat = data.catalog.find(c => c.id === id);
      assert(cat !== undefined, `Category "${id}" exists in catalog`);
      assert(typeof cat?.lead === 'string' && cat.lead.length > 20, `Category "${id}" has non-empty authentic lead description`);
    });

    // Check that NO services have hardcoded prices
    let servicesWithPrice = 0;
    data.catalog.forEach(cat => {
      (cat.subcategories || []).forEach(sub => {
        (sub.services || []).forEach(svc => {
          if (svc.price || svc.price_display) {
            servicesWithPrice++;
            console.warn(`Warning: Service ${svc.slug} still has price: ${svc.price || svc.price_display}`);
          }
        });
      });
    });
    assert(servicesWithPrice === 0, `No hardcoded prices exist in catalog (found: ${servicesWithPrice})`);

    // 2. Check admin editor HTML
    const editorRes = await fetch('http://localhost:3000/admin/editor-services.html');
    assert(editorRes.status === 200, 'Admin editor returns 200 OK');
    const editorHtml = await editorRes.text();
    assert(editorHtml.includes('#detailPrice:empty::before'), 'Admin editor has #detailPrice:empty::before placeholder style');
    assert(editorHtml.includes('CATEGORY_CUSTOM_CALLOUTS'), 'Admin editor references CATEGORY_CUSTOM_CALLOUTS');
    assert(editorHtml.includes('service.${cat.id}.overview_heading'), 'Admin editor sets category overview_heading block key');
    assert(editorHtml.includes('service.${cat.id}.lead'), 'Admin editor sets category lead block key');

    // 3. Check services registry JS
    const registryRes = await fetch('http://localhost:3000/admin/services-content-registry.js');
    assert(registryRes.status === 200, 'Services registry JS returns 200 OK');
    const registryJs = await registryRes.text();
    ['formats', 'design-services', 'production', 'marketing-services', 'bookselling'].forEach(catId => {
      assert(registryJs.includes(`'${catId}':`), `Registry includes custom layout for category "${catId}"`);
    });

    console.log(`\n=== AUDIT SUMMARY: ${passed} PASSED, ${failed} FAILED ===`);
  } catch (err) {
    console.error('Audit encountered error:', err);
  }
})();
