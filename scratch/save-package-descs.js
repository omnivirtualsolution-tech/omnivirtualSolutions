const { db } = require('../backend/db');

const descMap = {
  'service.basic-package.desc': "The Basic package is designed for authors seeking basic publishing needs. It includes digital formatting and distribution for e-books, paperback publishing, and customization options for the interior and cover. This package supports up to 25 image insertions and provides one block of 50 interior revisions. Authors receive electronic proofs, one-on-one support, and distribution across major online retailers like Amazon and Barnes & Noble. The package also features ISBN assignment, U.S. Copyright registration, a Library of Congress Control Number, and three paperback copies. Additional perks include Amazon Look Inside, Google Preview, Barnes & Noble Read Instantly, and a 12-month bookseller return program.",
  'service.standard-package.desc': "Building on the Basic, the Standard package adds hardcover publishing to the mix, enhancing the physical presence of your book. This package maintains all the services of the Basic package, including the customization, support, and online distribution features. In addition to the three paperback copies, it also includes one hardcover copy. The bookseller return program is extended to 36 months, providing additional flexibility and support for bookstores to manage inventory.",
  'service.advanced-package.desc': "The Advanced package is the most comprehensive, designed for authors who want extensive support and marketing tools. It includes everything from the Standard package, but boosts the number of copies provided to 20 paperbacks and 5 hardcovers. This package distinguishes itself with marketing enhancements such as 30 days of online book ads via Google and a professional book review from Kirkus Reviews. Additionally, it includes a deluxe website setup to further promote the book. The return program is extended to 60 months, offering the maximum return flexibility for retailers."
};

(async () => {
  for (const [key, val] of Object.entries(descMap)) {
    await db.execute({
      sql: `INSERT INTO content_blocks (block_key, block_type, value, updated_at)
            VALUES (?, 'text', ?, CURRENT_TIMESTAMP)
            ON CONFLICT(block_key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
      args: [key, val]
    });
    console.log(`Saved ${key}`);
  }
})();
