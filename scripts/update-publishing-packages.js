const path = require('path');
const { createClient } = require('@libsql/client');
const { db: tursoDb } = require('../backend/db');
const { DEFAULT_CATALOG } = require('../backend/seed-catalog');

const localDb = createClient({
  url: 'file:' + path.resolve(__dirname, '../data/omni.db')
});

const packages = [
  {
    slug: 'basic-package',
    title: 'Basic Package',
    price_display: '$899.00',
    price_cents: 89900,
    lead: 'Begin your publishing journey with the package that lets you take the extra mile.',
    features: [
      'Digital Formatting and Distribution (E-Book)',
      'Paperback Publishing',
      'Customization of Interior and Cover',
      'Image Insertions Up to 25',
      'Electronic Proofs of Your Book',
      'Interior Revisions – One Block of 50',
      'One-On-One Author Support',
      'West Harmony Bookstore Availability',
      'Online Distribution through Amazon, Barnes & Noble, and Other Book Retailers',
      'ISBN Assignment',
      'U.S. Copyright',
      'Library of Congress Control Number',
      '3 Paperback Copies',
      'Amazon Look Inside',
      'Google Preview',
      'Barnes & Noble Read Instantly',
      '12-Month Bookseller Return Program',
    ]
  },
  {
    slug: 'standard-package',
    title: 'Standard Package',
    price_display: '$1,599.00',
    price_cents: 159900,
    lead: 'Begin your publishing journey with the package that lets you take the extra mile.',
    features: [
      'Digital Formatting and Distribution (E-Book)',
      'Paperback Publishing',
      'Hardcover Publishing',
      'Customization of Interior and Cover',
      'Image Insertions Up to 25',
      'Electronic Proofs of Your Book',
      'Interior Revisions – One Block of 50',
      'One-On-One Author Support',
      'West Harmony Bookstore Availability',
      'Online Distribution through Amazon, Barnes & Noble, and Other Book Retailers',
      'ISBN Assignment',
      'U.S. Copyright',
      'Library of Congress Control Number',
      '3 Paperback Copies',
      '1 Hardcover Copy',
      'Amazon Look Inside',
      'Google Preview',
      'Barnes & Noble Read Instantly',
      '36-Month Bookseller Return Program',
    ]
  },
  {
    slug: 'advanced-package',
    title: 'Advanced Package',
    price_display: '$4,999.00',
    price_cents: 499900,
    lead: 'Begin your publishing journey with the package that lets you take the extra mile.',
    features: [
      'Digital Formatting and Distribution (E-Book)',
      'Paperback Publishing',
      'Hardcover Publishing',
      'Customization of Interior and Cover',
      'Image Insertions Up to 25',
      'Electronic Proofs of Your Book',
      'Interior Revisions – One Block of 50',
      'One-On-One Author Support',
      'West Harmony Bookstore Availability',
      'Online Distribution through Amazon, Barnes & Noble, and Other Book Retailers',
      'ISBN Assignment',
      'U.S. Copyright',
      'Library of Congress Control Number',
      'Amazon Look Inside',
      'Google Preview',
      'Barnes & Noble Read Instantly',
      '60-Month Bookseller Return Program',
      '20 Paperback Copies',
      '5 Hardcover Copies',
      'Online Book Ads via Google - 30 days Package',
      'Kirkus Book Review',
      'Deluxe Website Setup',
    ]
  }
];

async function updateTarget(targetDb, targetName) {
  console.log(`\n--- Updating ${targetName} ---`);

  // 0. Normalize slugs in services table if needed
  await targetDb.execute({
    sql: `UPDATE services SET slug = 'basic-package' WHERE slug = 'basic'`,
    args: []
  });
  await targetDb.execute({
    sql: `UPDATE services SET slug = 'advanced-package' WHERE slug = 'advanced'`,
    args: []
  });

  // 1. Delete Founder, Pioneer, Voyager from services table
  const delRows = await targetDb.execute({
    sql: `SELECT id FROM services WHERE slug IN ('founder-package', 'pioneer-package', 'voyager-package', 'Founder-Package', 'Pioneer-Package', 'Voyager-Package')`,
    args: []
  });
  const idsToDelete = delRows.rows.map(r => r.id);
  if (idsToDelete.length > 0) {
    for (const sid of idsToDelete) {
      await targetDb.execute({
        sql: `DELETE FROM service_features WHERE service_id = ?`,
        args: [sid]
      });
    }
    const delRes = await targetDb.execute({
      sql: `DELETE FROM services WHERE id IN (${idsToDelete.join(',')})`,
      args: []
    });
    console.log(`[${targetName}] Deleted ${delRes.rowsAffected} services (Founder, Pioneer, Voyager)`);
  } else {
    console.log(`[${targetName}] No Founder, Pioneer, or Voyager in services table.`);
  }

  // 2. Delete related content blocks
  const delBlocks = await targetDb.execute({
    sql: `DELETE FROM content_blocks WHERE block_key LIKE '%founder%' OR block_key LIKE '%pioneer%' OR block_key LIKE '%voyager%'`,
    args: []
  });
  console.log(`[${targetName}] Deleted ${delBlocks.rowsAffected} related content blocks`);

  // 3. Update Basic, Standard, Advanced packages
  for (const pkg of packages) {
    const sRes = await targetDb.execute({
      sql: `SELECT id FROM services WHERE slug = ? LIMIT 1`,
      args: [pkg.slug]
    });
    if (sRes.rows.length > 0) {
      const sId = sRes.rows[0].id;
      await targetDb.execute({
        sql: `UPDATE services SET lead_paragraph = ?, price_cents = ?, price_display = ? WHERE id = ?`,
        args: [pkg.lead, pkg.price_cents, pkg.price_display, sId]
      });

      await targetDb.execute({
        sql: `DELETE FROM service_features WHERE service_id = ?`,
        args: [sId]
      });

      for (let i = 0; i < pkg.features.length; i++) {
        await targetDb.execute({
          sql: `INSERT INTO service_features (service_id, feature_text, display_order) VALUES (?, ?, ?)`,
          args: [sId, pkg.features[i], i + 1]
        });
      }
      console.log(`[${targetName}] Updated services & ${pkg.features.length} features for ${pkg.slug}`);
    }

    // Upsert CMS lead block
    await targetDb.execute({
      sql: `INSERT INTO content_blocks (block_key, block_type, label, value, updated_by)
            VALUES (?, 'text', ?, ?, 'system')
            ON CONFLICT(block_key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
      args: [`service.${pkg.slug}.lead`, `${pkg.title} Overview Lead`, pkg.lead]
    });
  }

  // 4. Update services.catalog.data
  const catalogJson = JSON.stringify(DEFAULT_CATALOG);
  const catExists = await targetDb.execute({
    sql: `SELECT id FROM content_blocks WHERE block_key = 'services.catalog.data' LIMIT 1`,
    args: []
  });
  if (catExists.rows.length > 0) {
    await targetDb.execute({
      sql: `UPDATE content_blocks SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE block_key = 'services.catalog.data'`,
      args: [catalogJson]
    });
  } else {
    await targetDb.execute({
      sql: `INSERT INTO content_blocks (block_key, block_type, label, value, updated_by) VALUES ('services.catalog.data', 'json', 'Live Services Catalog', ?, 'system')`,
      args: [catalogJson]
    });
  }
  console.log(`[${targetName}] ✅ Successfully updated services.catalog.data`);
}

async function run() {
  await updateTarget(tursoDb, 'Turso Cloud Database');
  try {
    await updateTarget(localDb, 'Local SQLite Database');
  } catch (e) {
    console.log('Local SQLite update note:', e.message);
  }
  console.log('\nAll databases updated successfully!');
}

run().catch(err => {
  console.error('Fatal error running migration:', err);
  process.exit(1);
});
