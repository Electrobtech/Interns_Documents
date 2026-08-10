const { pool } = require('@lead/shared');

module.exports = { 
  query: pool.query.bind(pool),
  pool
};