module.exports = {
  ...require('./db'),
  ...require('./auth'),
  ...require('./audit'),
  ...require('./permissions'),
  ...require('./superAdmin'),
  companyModel: require('./models/companyModel'),
  userModel: require('./models/userModel'),
  leadModel: require('./models/leadModel'),
  walletModel: require('./models/walletModel'),
  paymentModel: require('./models/paymentModel'),
  attachmentModel: require('./models/attachmentModel'),
};
