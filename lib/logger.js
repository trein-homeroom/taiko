const debug = require('debug');
// const logEvent = debug('taiko:event');
// const logQuery = debug('taiko:query');

function logEvent() {
  console.log(new Date(), ...arguments);
}

function logQuery() {
  console.log(new Date(), ...arguments);
}

module.exports = {
  logEvent,
  logQuery,
};
