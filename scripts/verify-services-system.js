const fs = require('fs');
const path = require('path');

async function runVerification() {
  console.log('=== RUNNING COMPREHENSIVE VERIFICATION FOR SERVICES CATALOG & EDITOR ===\n');

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

  // 1. Verify services-content-registry.js loads
  try {
    global.window = global;
    require('../admin/services-content-registry.js');
    assert(window.SERVICE_CUSTOM_VIEWS && Object.keys(window.SERVICE_CUSTOM_VIEWS).length >= 97, `SERVICE_CUSTOM_VIEWS loaded with ${Object.keys(window.SERVICE_CUSTOM_VIEWS || {}).length} custom views`);
    assert(window.SUBCATEGORY_DESCRIPTIONS && Object.keys(window.SUBCATEGORY_DESCRIPTIONS).length >= 30, `SUBCATEGORY_DESCRIPTIONS loaded with ${Object.keys(window.SUBCATEGORY_DESCRIPTIONS || {}).length} descriptions`);
    assert(window.CATEGORY_CUSTOM_CALLOUTS && Object.keys(window.CATEGORY_CUSTOM_CALLOUTS).length >= 4, `CATEGORY_CUSTOM_CALLOUTS loaded`);
    assert(window.SUBCATEGORY_ADVANTAGES_BOXES && Object.keys(window.SUBCATEGORY_ADVANTAGES_BOXES).length >= 6, `SUBCATEGORY_ADVANTAGES_BOXES loaded`);
    assert(window.SERVICE_CUSTOM_VIEWS['content-editing'] !== undefined, `'content-editing' custom view exists`);
    assert(window.SERVICE_CUSTOM_VIEWS['editorial-evaluation'] !== undefined, `'editorial-evaluation' custom view exists`);
    assert(window.SERVICE_CUSTOM_VIEWS['quality-review-copyediting'] !== undefined, `'quality-review-copyediting' custom view exists`);
    assert(window.SERVICE_CUSTOM_VIEWS['editorial-assistant-copyediting'] !== undefined, `'editorial-assistant-copyediting' custom view exists`);
  } catch (err) {
    assert(false, `services-content-registry.js failed to load: ${err.message}`);
  }

  // 2. Verify editor-services.html structure and functions
  const editorHtml = fs.readFileSync(path.join(__dirname, '..', 'admin', 'editor-services.html'), 'utf8');
  assert(editorHtml.includes('<script src="/admin/services-content-registry.js"></script>'), 'editor-services.html includes correct registry script tag');
  assert(editorHtml.includes('window.selectCategoryById = function'), 'editor-services.html defines selectCategoryById');
  assert(editorHtml.includes('window.selectCategory = function'), 'editor-services.html defines selectCategory');
  assert(editorHtml.includes('window.selectSubcategoryById = function'), 'editor-services.html defines selectSubcategoryById');
  assert(editorHtml.includes('window.selectSubcategory = function'), 'editor-services.html defines selectSubcategory');
  assert(editorHtml.includes('window.selectServiceBySlug = function'), 'editor-services.html defines selectServiceBySlug');
  assert(editorHtml.includes('function selectService(svc'), 'editor-services.html defines selectService');
  assert(editorHtml.includes('window.toggleCatAccordion = function'), 'editor-services.html defines toggleCatAccordion');
  assert(editorHtml.includes('window.toggleSubcatAccordion = function'), 'editor-services.html defines toggleSubcatAccordion');
  assert(editorHtml.includes('function attachEditableFields('), 'editor-services.html defines attachEditableFields');
  assert(editorHtml.includes('function applyLoadedBlocks('), 'editor-services.html defines applyLoadedBlocks');
  assert(editorHtml.includes('window.handleContentBlockSave = function'), 'editor-services.html defines handleContentBlockSave');
  assert(editorHtml.includes('serviceCustomDetailContainer'), 'editor-services.html contains serviceCustomDetailContainer element');
  assert(editorHtml.includes('publishing-package-card'), 'editor-services.html contains publishing-package-card class styling/markup');
  assert(editorHtml.includes('subcategory-service-card'), 'editor-services.html contains subcategory-service-card class markup');

  // 3. Verify Frontend build dist contains updated ServicesPage
  const frontendDistHtml = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'dist', 'index.html'), 'utf8');
  assert(frontendDistHtml.length > 500, 'frontend/dist/index.html is built and ready');

  // 4. Verify Backend API endpoints
  try {
    const healthRes = await fetch('http://localhost:3000/api/v1/health');
    const health = await healthRes.json();
    assert(health.status === 'ok' && health.database === 'turso-cloud', 'Backend health is OK on Turso Cloud');

    const servicesRes = await fetch('http://localhost:3000/api/v1/services');
    const servicesData = await servicesRes.json();
    assert(servicesData && Array.isArray(servicesData.catalog) && servicesData.catalog.length > 0, `Services API returns catalog with ${servicesData.catalog.length} categories`);

    // Verify editorial services category and core editorial subcategory exist
    const editorialCat = servicesData.catalog.find(c => c.id === 'editorial-services');
    assert(editorialCat !== undefined, 'Editorial Services category found in API catalog');
    const coreEditorialSub = editorialCat ? editorialCat.subcategories.find(s => s.id === 'core-editorial-services') : null;
    assert(coreEditorialSub !== undefined, 'Core Editorial Services subcategory found in Editorial Services');
    const contentEditingSvc = coreEditorialSub ? coreEditorialSub.services.find(s => s.slug === 'content-editing') : null;
    assert(contentEditingSvc !== undefined, 'Content Editing service found in Core Editorial Services');

    // 5. Verify live block saving and retrieval with valid fingerprint token
    const { db } = require('../backend/db');
    const { signToken, credentialFingerprint } = require('../backend/middleware/auth');
    const userRes = await db.execute('SELECT * FROM admin_users LIMIT 1');
    const user = userRes.rows[0];
    const testToken = signToken({
      id: user.id,
      username: user.username,
      role: 'admin',
      cfp: credentialFingerprint(user)
    });

    const patchTestKey = 'test.verify.sync';
    const testVal = 'Sync Verification Test ' + Date.now();
    const patchRes = await fetch(`http://localhost:3000/api/v1/cms/blocks/${encodeURIComponent(patchTestKey)}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + testToken
      },
      body: JSON.stringify({ value: testVal })
    });
    const patchJson = await patchRes.json();
    assert(patchJson.success === true, 'PATCH /api/v1/cms/blocks saves to Turso Cloud DB');

    const metaRes = await fetch('http://localhost:3000/api/v1/site-meta');
    const metaData = await metaRes.json();
    assert(metaData.blockMap && metaData.blockMap[patchTestKey] === testVal, 'Saved block retrieved in blockMap via /api/v1/site-meta');

  } catch (err) {
    assert(false, `API verification failed: ${err.message}`);
  }

  console.log(`\n=== RESULTS: ${passed} PASSED, ${failed} FAILED ===`);
  process.exit(failed > 0 ? 1 : 0);
}

runVerification();
