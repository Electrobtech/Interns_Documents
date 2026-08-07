/**
 * Channel -> provider registry. mhWorker.js looks up `providers[channel]`
 * and calls `.sendMessage()` — it never imports a specific channel module
 * directly, so adding a 7th channel or swapping one provider's
 * implementation for a real API never touches the worker.
 */
module.exports = {
  whatsapp: require('./whatsapp'),
  email: require('./email'),
  sms: require('./sms'),
  messenger: require('./messenger'),
  instagram: require('./instagram'),
  linkedin: require('./linkedin'),
};
