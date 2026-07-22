const { Pool } = require('pg');

// Single shared pool factory. Each service imports this and gets a
// connection to the same Postgres instance (schema is shared).
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('error', (err) => console.error('Unexpected PG error', err));

module.exports = { pool };
