const { Pool } = require('pg');

const writeUrl = String(process.env.DATABASE_URL_WRITE || process.env.DATABASE_URL || '').trim();
const readUrl = String(process.env.DATABASE_URL_READ || writeUrl || '').trim();
const ssl = process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : false;

const isReadQuery = (text) => {
  const trimmed = String(text || '').trimStart();
  return /^\s*(SELECT|WITH)\b/i.test(trimmed);
};

let pool;
if (readUrl !== writeUrl) {
  const writePool = new Pool({ connectionString: writeUrl, ssl });
  const readPool = new Pool({ connectionString: readUrl, ssl });
  pool = {
    query(textOrConfig, params, callback) {
      const text = typeof textOrConfig === 'string' ? textOrConfig : (textOrConfig && textOrConfig.text);
      const target = isReadQuery(text) ? readPool : writePool;
      return target.query(textOrConfig, params, callback);
    },
    connect() { return writePool.connect(); },
    get totalCount() { return writePool.totalCount; },
    get idleCount() { return writePool.idleCount; },
    get waitingCount() { return writePool.waitingCount; },
    on(evt, handler) { writePool.on(evt, handler); readPool.on(evt, handler); },
    end() { return Promise.all([writePool.end(), readPool.end()]); }
  };
} else {
  pool = new Pool({ connectionString: writeUrl, ssl });
}

module.exports = { pool };
