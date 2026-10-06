const { db } = require('../backend/db');

(async () => {
  const r = await db.execute({
    sql: "SELECT block_key FROM content_blocks WHERE block_key LIKE '%.custom_html'",
    args: []
  });
  console.log(r.rows);
})();
