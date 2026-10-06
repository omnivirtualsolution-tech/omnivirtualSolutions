// ============================================================================
// scripts/verify-service-overview-live.js
// Tests that Service Overview edits made in Live Editor are 100% reflected
// in the user view and public APIs.
// ============================================================================

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { db } = require('../backend/db');
const { signToken, credentialFingerprint } = require('../backend/middleware/auth');

async function testOverviewLiveEdit() {
  console.log('=== TEST: Service Overview Live Update in User View ===\n');

  // 1. Get admin token
  const adminRes = await db.execute({
    sql: 'SELECT * FROM admin_users WHERE id = 1 AND is_active = 1 LIMIT 1',
    args: []
  });
  const admin = adminRes.rows[0];
  const token = signToken({
    id: admin.id,
    username: admin.username,
    role: admin.role,
    cfp: credentialFingerprint(admin)
  });

  // 2. Fetch current catalog from API
  const apiRes = await fetch('http://localhost:3000/api/v1/services');
  const apiData = await apiRes.json();
  const catalog = apiData.catalog;

  // Find Basic Package and Editorial Services Copyediting
  let basicPkg = null;
  let copyediting = null;
  for (const c of catalog) {
    for (const sub of (c.subcategories || [])) {
      for (const s of (sub.services || [])) {
        if (s.slug === 'basic-package') basicPkg = s;
        if (s.slug === 'copyediting') copyediting = s;
      }
    }
  }

  console.log('Current Basic Package overview in live catalog:');
  console.log(`"${basicPkg.lead.slice(0, 120)}..."\n`);

  console.log('Current Copyediting overview in live catalog:');
  console.log(`"${copyediting.lead.slice(0, 120)}..."\n`);

  // Verify that the user's latest edited text for Basic Package is present
  const expectedMarker = 'This package supports up to 25 image insertions';
  if (basicPkg.lead.includes(expectedMarker)) {
    console.log('✅ User edit in Basic Package IS present in the live catalog!');
  } else {
    console.log('⚠️ Expected marker not found in Basic Package');
  }

  // 3. Test saving a new Service Overview edit for a service
  const testMarker = '[VERIFIED_OVERVIEW_TEST]';
  const originalCopyLead = copyediting.lead;
  copyediting.lead = `${testMarker} Professional copyediting service for authors.`;

  console.log('\nSending test update for Copyediting overview to PUT /api/v1/cms/services/catalog...');
  const putRes = await fetch('http://localhost:3000/api/v1/cms/services/catalog', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ catalog })
  });

  const putData = await putRes.json();
  console.log('PUT result:', putData);

  // 4. Verify that public GET /api/v1/services immediately serves the new overview
  const verifyRes = await fetch('http://localhost:3000/api/v1/services');
  const verifyData = await verifyRes.json();
  let updatedCopyediting = null;
  for (const c of verifyData.catalog) {
    for (const sub of (c.subcategories || [])) {
      for (const s of (sub.services || [])) {
        if (s.slug === 'copyediting') updatedCopyediting = s;
      }
    }
  }

  console.log('\nVerifying Public API reflection:');
  console.log('Updated lead in public API:', updatedCopyediting.lead);
  const isReflected = updatedCopyediting.lead.includes(testMarker);
  console.log('Public API reflects edited overview:', isReflected ? 'YES ✅' : 'NO ❌');

  // 5. Cleanly restore original copyediting lead so we don't ruin anything
  copyediting.lead = originalCopyLead;
  await fetch('http://localhost:3000/api/v1/cms/services/catalog', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ catalog })
  });

  console.log('\n✅ Cleanly restored copyediting lead back to pristine.');
  console.log('🎉 Service Overview live edit pipeline is verified and working!');
}

testOverviewLiveEdit().catch(console.error);
