const { db } = require('../backend/db');

(async () => {
  const r = await db.execute({
    sql: "SELECT block_key, value FROM content_blocks WHERE block_key LIKE 'service.%package%'",
    args: []
  });
  console.log(r.rows);
})();
