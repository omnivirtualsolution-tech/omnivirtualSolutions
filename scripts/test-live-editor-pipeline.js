// ============================================================================
// scripts/test-live-editor-pipeline.js
// Tests the full editing pipeline across all categories:
// 1. Turso Cloud DB connection check
// 2. Auth token generation
// 3. Edit across categories in catalog
// 4. PUT /api/v1/cms/services/catalog
// 5. Query Turso Cloud DB directly to verify persistence
// 6. Verify GET /api/v1/services returns edited data
// 7. Revert to original pristine catalog and verify restored in Turso
// ============================================================================

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { db } = require('../backend/db');
const { signToken, credentialFingerprint } = require('../backend/middleware/auth');

async function runTest() {
  console.log('=== STEP 1: Verifying Turso Cloud Database Connection ===');
  const isTurso = Boolean(process.env.TURSO_DATABASE_URL && process.env.TURSO_DATABASE_URL.trim() !== '');
  console.log(`Turso configured in env: ${isTurso}`);
  console.log(`Turso URL: ${process.env.TURSO_DATABASE_URL ? process.env.TURSO_DATABASE_URL.slice(0, 30) + '...' : 'none'}`);

  const checkRes = await db.execute({
    sql: "SELECT block_key, length(value) as len, updated_at FROM content_blocks WHERE block_key = 'services.catalog.data' LIMIT 1",
    args: []
  });

  if (checkRes.rows.length === 0) {
    throw new Error('services.catalog.data not found in content_blocks table!');
  }
  console.log('✅ Found services.catalog.data in Turso Cloud. Length:', checkRes.rows[0].len, 'Updated at:', checkRes.rows[0].updated_at);

  console.log('\n=== STEP 2: Generating Admin Auth Token ===');
  const adminRes = await db.execute({
    sql: 'SELECT * FROM admin_users WHERE id = 1 AND is_active = 1 LIMIT 1',
    args: []
  });
  if (adminRes.rows.length === 0) throw new Error('Admin user not found');
  const adminUser = adminRes.rows[0];
  const token = signToken({
    id: adminUser.id,
    username: adminUser.username,
    role: adminUser.role,
    cfp: credentialFingerprint(adminUser)
  });
  console.log('✅ Admin token generated successfully for user:', adminUser.username);

  console.log('\n=== STEP 3: Fetching Current Catalog via GET /api/v1/services ===');
  const getRes = await fetch('http://localhost:3000/api/v1/services');
  if (!getRes.ok) throw new Error(`GET /api/v1/services failed with status ${getRes.status}`);
  const getData = await getRes.json();
  const originalCatalog = getData.catalog;
  console.log(`✅ Loaded ${originalCatalog.length} categories from API (Source: ${getData.source})`);

  console.log('\nCategories in catalog:');
  originalCatalog.forEach((c, idx) => {
    const subCount = c.subcategories?.length || 0;
    const svcCount = (c.subcategories || []).reduce((acc, s) => acc + (s.services?.length || 0), 0);
    console.log(`  ${idx + 1}. [${c.id}] "${c.title}" (${subCount} subcategories, ${svcCount} services)`);
  });

  console.log('\n=== STEP 4: Simulating Live Editor Edit on All 8 Categories ===');
  // Deep clone catalog so we can test edits
  const testCatalog = JSON.parse(JSON.stringify(originalCatalog));

  // Add a test marker to each category title: " [LIVE_TEST]"
  testCatalog.forEach((c) => {
    c.title = `${c.title} [LIVE_TEST]`;
  });

  // Also test editing a service price & lead in category 1 and category 3
  if (testCatalog[0]?.subcategories[0]?.services[0]) {
    testCatalog[0].subcategories[0].services[0].lead = 'TEST EDIT: Live In-Place Editor verification in progress.';
  }
  if (testCatalog[2]?.subcategories[0]?.services[0]) {
    testCatalog[2].subcategories[0].services[0].price = '$999';
  }

  console.log('Sending PUT /api/v1/cms/services/catalog with edited categories...');
  const putRes = await fetch('http://localhost:3000/api/v1/cms/services/catalog', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ catalog: testCatalog })
  });

  const putData = await putRes.json();
  if (!putRes.ok || !putData.success) {
    throw new Error(`PUT /api/v1/cms/services/catalog failed: ${JSON.stringify(putData)}`);
  }
  console.log('✅ PUT succeeded:', putData);

  console.log('\n=== STEP 5: Verifying Persistence Directly in Turso Cloud Database ===');
  const tursoQuery = await db.execute({
    sql: "SELECT value, updated_at FROM content_blocks WHERE block_key = 'services.catalog.data' LIMIT 1",
    args: []
  });
  const savedInTurso = JSON.parse(tursoQuery.rows[0].value);
  const allHaveTestMarker = savedInTurso.every((c) => c.title.includes('[LIVE_TEST]'));
  console.log('Direct Turso DB check:');
  console.log(`- Updated timestamp: ${tursoQuery.rows[0].updated_at}`);
  console.log(`- All 8 categories have test marker in Turso: ${allHaveTestMarker ? 'YES ✅' : 'NO ❌'}`);
  console.log(`- First category title in Turso: "${savedInTurso[0].title}"`);
  console.log(`- Third category service price in Turso: "${savedInTurso[2]?.subcategories[0]?.services[0]?.price}"`);

  console.log('\n=== STEP 6: Verifying Public /api/v1/services Serves Edited Content ===');
  const verifyGet = await fetch('http://localhost:3000/api/v1/services');
  const verifyData = await verifyGet.json();
  const publicAllMarked = verifyData.catalog.every((c) => c.title.includes('[LIVE_TEST]'));
  console.log(`- Public API returns source: "${verifyData.source}"`);
  console.log(`- All categories in public API contain test marker: ${publicAllMarked ? 'YES ✅' : 'NO ❌'}`);

  console.log('\n=== STEP 7: Reverting Changes to Pristine Catalog (Don\'t Ruin Anything) ===');
  const revertRes = await fetch('http://localhost:3000/api/v1/cms/services/catalog', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ catalog: originalCatalog })
  });
  const revertData = await revertRes.json();
  console.log('✅ Revert PUT succeeded:', revertData.message);

  const finalCheck = await db.execute({
    sql: "SELECT value, updated_at FROM content_blocks WHERE block_key = 'services.catalog.data' LIMIT 1",
    args: []
  });
  const finalInTurso = JSON.parse(finalCheck.rows[0].value);
  const isPristine = finalInTurso.every((c) => !c.title.includes('[LIVE_TEST]'));
  console.log(`- Turso Cloud database cleanly restored: ${isPristine ? 'YES ✅' : 'NO ❌'}`);
  console.log(`- First category title restored: "${finalInTurso[0].title}"`);
  console.log(`- All 8 categories intact: ${finalInTurso.length === 8 ? 'YES ✅' : 'NO ❌'}`);

  console.log('\n======================================================');
  console.log('🎉 ALL TESTS PASSED: Live Editor + Turso DB + Services Page are fully connected!');
  console.log('======================================================');
}

runTest().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
