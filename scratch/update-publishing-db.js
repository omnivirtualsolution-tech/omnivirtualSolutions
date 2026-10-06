const { db } = require('../backend/db');

// Publishing Packages category overview HTML - NO Basic, Standard, or Advanced Package here!
const pubPackagesCatHtml = `<div class="category-overview-content">
  <div class="publishing-options-section mb-4">
    <div class="publishing-packages-container">
      <div 
        class="publishing-package-card" 
        role="button" 
        tabindex="0"
        onclick="window.omniJumpToSubcategory && window.omniJumpToSubcategory('publishing-packages', 'publishing-options')"
      >
        <div class="publishing-package-card-header">
          <h5 class="publishing-package-card-title m-0 editable-field" data-block-key="service.publishing-options.title">
            Publishing Options
          </h5>
          <span class="publishing-package-arrow-badge"><i class="bi bi-arrow-right-short"></i></span>
        </div>
        <p class="publishing-package-card-summary mb-0 editable-field" data-block-key="service.publishing-options.desc">
          Our packages offer various combinations of our publishing, editorial, and marketing services for a truly customized publishing experience. With Omni, you can choose the package that best suits your literary goals.
        </p>
      </div>
    </div>
  </div>
</div>`;

// Publishing Options subcategory page HTML - FULL DETAILS of Basic, Standard, and Advanced Package!
const pubOptionsPageHtml = `<div class="subcategory-overview-content">
  <div class="publishing-options-section">
    <div class="package-card-block mb-4">
      <h5 class="fw-bold mb-2 editable-field" style="color: #d9534f; font-size: 1.25rem;" data-block-key="service.basic-package.title">
        Basic Package
      </h5>
      <p class="mb-0 editable-field" style="color: #57534e; font-size: 0.96rem; line-height: 1.72;" data-block-key="service.basic-package.desc">
        The Basic package is designed for authors seeking basic publishing needs. It includes digital formatting and distribution for e-books, paperback publishing, and customization options for the interior and cover. This package supports up to 25 image insertions and provides one block of 50 interior revisions. Authors receive electronic proofs, one-on-one support, and distribution across major online retailers like Amazon and Barnes & Noble. The package also features ISBN assignment, U.S. Copyright registration, a Library of Congress Control Number, and three paperback copies. Additional perks include Amazon Look Inside, Google Preview, Barnes & Noble Read Instantly, and a 12-month bookseller return program.
      </p>
    </div>

    <div class="package-card-block mb-4">
      <h5 class="fw-bold mb-2 editable-field" style="color: #d9534f; font-size: 1.25rem;" data-block-key="service.standard-package.title">
        Standard Package
      </h5>
      <p class="mb-0 editable-field" style="color: #57534e; font-size: 0.96rem; line-height: 1.72;" data-block-key="service.standard-package.desc">
        Building on the Basic, the Standard package adds hardcover publishing to the mix, enhancing the physical presence of your book. This package maintains all the services of the Basic package, including the customization, support, and online distribution features. In addition to the three paperback copies, it also includes one hardcover copy. The bookseller return program is extended to 36 months, providing additional flexibility and support for bookstores to manage inventory.
      </p>
    </div>

    <div class="package-card-block mb-4">
      <h5 class="fw-bold mb-2 editable-field" style="color: #d9534f; font-size: 1.25rem;" data-block-key="service.advanced-package.title">
        Advanced Package
      </h5>
      <p class="mb-0 editable-field" style="color: #57534e; font-size: 0.96rem; line-height: 1.72;" data-block-key="service.advanced-package.desc">
        The Advanced package is the most comprehensive, designed for authors who want extensive support and marketing tools. It includes everything from the Standard package, but boosts the number of copies provided to 20 paperbacks and 5 hardcovers. This package distinguishes itself with marketing enhancements such as 30 days of online book ads via Google and a professional book review from Kirkus Reviews. Additionally, it includes a deluxe website setup to further promote the book. The return program is extended to 60 months, offering the maximum return flexibility for retailers.
      </p>
    </div>
  </div>
</div>`;

(async () => {
  try {
    console.log('Updating Turso DB content blocks for publishing-packages and publishing-options...');
    await db.execute({
      sql: `INSERT INTO content_blocks (block_key, block_type, value, updated_at)
            VALUES ('service.publishing-packages.custom_html', 'html', ?, CURRENT_TIMESTAMP)
            ON CONFLICT(block_key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
      args: [pubPackagesCatHtml]
    });
    console.log('Updated service.publishing-packages.custom_html (without the 3 packages)!');

    await db.execute({
      sql: `INSERT INTO content_blocks (block_key, block_type, value, updated_at)
            VALUES ('service.publishing-options.custom_html', 'html', ?, CURRENT_TIMESTAMP)
            ON CONFLICT(block_key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
      args: [pubOptionsPageHtml]
    });
    console.log('Updated service.publishing-options.custom_html (with the 3 packages full details)!');
  } catch (err) {
    console.error('Error updating DB:', err);
  }
})();
