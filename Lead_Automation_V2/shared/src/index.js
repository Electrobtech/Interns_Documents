module.exports = {
  ...require('./db'),
  ...require('./auth'),
  ...require('./audit'),
  ...require('./permissions'),
};
