const path = require('path');
const sharp = require('sharp');
const { db } = require('../backend/db');
const { signToken, credentialFingerprint } = require('../backend/middleware/auth');
const { testSmtpConnection, getSettings, getQuotaStatus } = require('../backend/email-service');

const BASE = 'http://127.0.0.1:3000';

async function main() {
  console.log('========================================================');
  console.log('  🔍 FULL WEBSITE INTEGRITY & FUNCTIONALITY AUDIT');
  console.log('========================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(name, cond, details = '') {
    if (cond) {
      console.log(`✅ [PASS] ${name} ${details ? '— ' + details : ''}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${name} — ${details}`);
      failed++;
    }
  }

  // ── 1. PUBLIC APIS ──
  console.log('1. Public Core APIs:');
  const hRes = await fetch(`${BASE}/api/v1/health`);
  const hData = await hRes.json();
  assert('Health Check', hRes.ok && hData.status === 'ok', `status: ${hData.status}, db: ${hData.database}`);

  const smRes = await fetch(`${BASE}/api/v1/site-meta`);
  const smData = await smRes.json();
  assert('Site Metadata', smRes.ok && smData.company, `Company: ${smData.company?.company_name}, Blocks: ${smData.blocks?.length}`);

  const svcRes = await fetch(`${BASE}/api/v1/services`);
  const svcData = await svcRes.json();
  const catalogCount = svcData.catalog?.length || svcData.categories?.length || 0;
  assert('Services Catalog', svcRes.ok && catalogCount > 0, `Loaded ${catalogCount} categories`);

  // ── 2. AUTH & SECURITY ──
  console.log('\n2. Authentication & Admin Security:');
  const badLogin = await fetch(`${BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'nobody@nowhere.com', password: 'badpassword' }),
  });
  const badLoginData = await badLogin.json();
  assert('Brute Force / Invalid Auth Guard', badLogin.status === 401 && badLoginData.error?.code === 'INVALID_CREDENTIALS');

  const adminQuery = await db.execute('SELECT * FROM admin_users WHERE is_active = 1 LIMIT 1');
  const admin = adminQuery.rows[0];
  const token = signToken({
    id: admin.id,
    username: admin.username,
    role: admin.role,
    cfp: credentialFingerprint(admin),
  });

  const meRes = await fetch(`${BASE}/api/v1/auth/me`, {
    headers: { Authorization: 'Bearer ' + token },
  });
  const meData = await meRes.json();
  assert('Admin Session Verification (/me)', meRes.ok && meData.admin?.username === admin.username, `Admin: ${meData.admin?.username}`);

  // ── 3. IMAGE UPLOAD & TURSO STORAGE ──
  console.log('\n3. Image Upload Pipeline & Turso BLOB Storage:');
  const testW = 2000;
  const testH = 1200;
  const rawPng = await sharp({
    create: { width: testW, height: testH, channels: 4, background: { r: 60, g: 120, b: 240, alpha: 1 } },
  }).png().toBuffer();

  const form = new FormData();
  form.append('image', new Blob([rawPng], { type: 'image/png' }), 'audit_upload.png');

  const upRes = await fetch(`${BASE}/api/v1/cms/upload`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token },
    body: form,
  });
  const upData = await upRes.json();
  assert('Upload Endpoint Response', upRes.status === 201 && upData.success, `File: ${upData.filename}`);
  assert('Resolution Integrity', upData.width === testW && upData.height === testH, `Exact ${testW}x${testH} preserved`);
  assert('Size Optimization', Number(upData.savings?.replace('%', '')) > 80, `Original: ${(upData.originalSize/1024).toFixed(1)}KB -> Saved: ${(upData.optimizedSize/1024).toFixed(1)}KB (${upData.savings} reduction)`);

  // Direct fetch from Turso
  const streamRes = await fetch(`${BASE}/api/v1/cms/media/${upData.filename}`);
  const streamBuf = Buffer.from(await streamRes.arrayBuffer());
  const streamMeta = await sharp(streamBuf).metadata();
  assert('Direct Turso Binary Stream', streamRes.ok && streamMeta.width === testW && streamMeta.height === testH, `Content-Type: ${streamRes.headers.get('content-type')}, Size: ${streamBuf.length} bytes`);

  const fallbackRes = await fetch(`${BASE}/assets/uploads/${upData.filename}`);
  assert('Fallback /assets/uploads Interceptor', fallbackRes.ok, `HTTP ${fallbackRes.status}`);

  // Cleanup via new DELETE /api/v1/cms/media/:filename API
  const delRes = await fetch(`${BASE}/api/v1/cms/media/${upData.filename}`, {
    method: 'DELETE',
    headers: { Authorization: 'Bearer ' + token },
  });
  const delData = await delRes.json();
  assert('Turso Media Deletion API', delRes.ok && delData.success, `Freed ${delData.freedBytes} bytes from Turso`);

  // Verify deletion from Turso Cloud database
  const verifyDb = await db.execute({ sql: 'SELECT id FROM media_files WHERE filename = ?', args: [upData.filename] });
  assert('Turso Database Zero Residue', verifyDb.rows.length === 0, 'Row permanently purged from Turso Cloud');

  // ── 4. WEBSITE UPDATES ──
  console.log('\n4. Website Updates (CMS, Profile, Catalog):');
  const blocksRes = await fetch(`${BASE}/api/v1/cms/blocks`, { headers: { Authorization: 'Bearer ' + token } });
  const blocksData = await blocksRes.json();
  assert('CMS Content Blocks Read', blocksRes.ok && blocksData.blocks?.length > 0, `${blocksData.blocks?.length} blocks loaded`);

  const testKey = 'home.hero.cta_label';
  const block = blocksData.blocks.find(b => b.block_key === testKey);
  if (block) {
    const origVal = block.value;
    const patchRes = await fetch(`${BASE}/api/v1/cms/blocks/${encodeURIComponent(testKey)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ value: origVal }),
    });
    assert('CMS Content Block Update', patchRes.ok, `Key: ${testKey}`);
  }

  const profRes = await fetch(`${BASE}/api/v1/cms/business-profile`, { headers: { Authorization: 'Bearer ' + token } });
  const profData = await profRes.json();
  assert('Business Profile Read', profRes.ok && profData.profile?.company_name, `Company: ${profData.profile?.company_name}`);

  const patchProf = await fetch(`${BASE}/api/v1/cms/business-profile`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ company_name: profData.profile?.company_name }),
  });
  assert('Business Profile Sync', patchProf.ok);

  const catRes = await fetch(`${BASE}/api/v1/cms/services/catalog`, { headers: { Authorization: 'Bearer ' + token } });
  assert('CMS Services Catalog Read', catRes.ok);

  // ── 5. EMAIL PIPELINE ──
  console.log('\n5. Email Delivery System & Contact Pipeline:');
  const settings = await getSettings();
  const smtpTest = await testSmtpConnection(settings);
  assert('Gmail SMTP Live Connection', smtpTest.success, `Host: ${settings.smtp_host}:${settings.smtp_port}, User: ${settings.smtp_user}`);

  const quota = await getQuotaStatus();
  assert('Email Quota Engine', quota.strategy && quota.limit > 0, `Strategy: ${quota.strategy}, 24h Quota: ${quota.sent24h}/${quota.limit}`);

  const badContact = await fetch(`${BASE}/api/v1/contact/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ full_name: 'X', email: 'notanemail', message: '' }),
  });
  assert('Contact Form Input Guard', badContact.status === 400);

  const goodContact = await fetch(`${BASE}/api/v1/contact/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      full_name: 'Integrity Audit',
      email: 'audit-visitor@example.com',
      subject: 'End-to-End Test',
      message: 'Automated test to verify submission CRM saving.',
    }),
  });
  const goodData = await goodContact.json();
  assert('Contact Form Submission', goodContact.status === 201 && goodData.success, `ID: ${goodData.id}, Mode: ${goodData.mode}`);

  if (goodData.id) {
    const subCheck = await db.execute({ sql: 'SELECT * FROM contact_submissions WHERE id = ?', args: [goodData.id] });
    assert('CRM Database Record Creation', subCheck.rows.length > 0, `Sender: ${subCheck.rows[0]?.sender_name || subCheck.rows[0]?.full_name}`);
    await db.execute({ sql: 'DELETE FROM contact_submissions WHERE id = ?', args: [goodData.id] });
  }

  console.log('\n========================================================');
  console.log(`  AUDIT SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================\n');
}

main().catch(e => {
  console.error('Fatal audit failure:', e);
  process.exit(1);
});
