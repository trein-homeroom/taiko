const { eventHandler } = require('../eventBus');
const { logEvent } = require('../logger');
const networkPresets = require('../data/networkConditions');
let requestPromises, requestPromises2, network;

const createdSessionListener = (client) => {
  let resolve;
  eventHandler.emit(
    'handlerActingOnNewSession',
    new Promise((r) => {
      resolve = r;
    }),
  );
  network = client.Network;
  requestPromises = {};
  requestPromises2 = {};
  network.requestWillBeSent(emitXHREvent);
  network.responseReceived(responseHandler);
  network.loadingFinished(resolveXHREvent);
  network.loadingFailed(resolveXHREvent);
  network.setCacheDisabled({ cacheDisabled: true });

  // network.dataReceived(logX.bind(logX, 'dataReceived'))
  // network.eventSourceMessageReceived(logX.bind(logX, 'eventSourceMessageReceived'))
  // network.loadingFailed(logX.bind(logX, 'loadingFailed'))
  // network.loadingFinished(logX.bind(logX, 'loadingFinished'))
  // network.requestServedFromCache(logX.bind(logX, 'requestServedFromCache'))
  // network.requestWillBeSent(logX.bind(logX, 'requestWillBeSent'))
  // network.responseReceived(logX.bind(logX, 'responseReceived'))
  // network.webSocketClosed(logX.bind(logX, 'webSocketClosed'))
  // network.webSocketCreated(logX.bind(logX, 'webSocketCreated'))
  // network.webSocketFrameError(logX.bind(logX, 'webSocketFrameError'))
  // network.webSocketFrameReceived(logX.bind(logX, 'webSocketFrameReceived'))
  // network.webSocketFrameSent(logX.bind(logX, 'webSocketFrameSent'))
  // network.webSocketHandshakeResponseReceived(logX.bind(logX, 'webSocketHandshakeResponseReceived'))
  // network.webSocketWillSendHandshakeRequest(logX.bind(logX, 'webSocketWillSendHandshakeRequest'))
  // network.webTransportClosed(logX.bind(logX, 'webTransportClosed'))
  // network.webTransportConnectionEstablished(logX.bind(logX, 'webTransportConnectionEstablished'))
  // network.webTransportCreated(logX.bind(logX, 'webTransportCreated'))
  
  resolve();
};

function logX() {
  console.log('xxx logX', arguments[0], Array.from(arguments).slice(1));
}

async function awaitPromises() {
  if (!Object.keys(requestPromises).length) {
    // console.log('xxx no promises to await on')
    return;
  }

  console.log('xxxx not waiting promises on', Object.keys(requestPromises2));
  // await Promise.all(Object.values(requestPromises2));

  requestPromises = {}
  requestPromises2 = {}
}


eventHandler.on('createdSession', createdSessionListener);

const logPromises = () => {
  requestPromises = requestPromises || {}
  requestPromises2 = requestPromises2 || {}

  // console.log(Date.now() + ' xxx logPromises, remaining listeners:', Object.keys(requestPromises));
  // console.trace();
}

const resetPromises = () => {
  requestPromises = requestPromises || {}
  requestPromises2 = requestPromises2 || {}

  if (Object.keys(requestPromises).length) {
    console.log(Date.now() + ' xxx reset promises, remaining listeners:', Object.keys(requestPromises));
    console.trace();
  }

  // resolve any pending promises because this code
  // isn't properly designed to handle multiple network listeners at a time.
  for (let id in requestPromises) {
    // console.log(Date.now() + ' xxx calling dangling listener:', id);
    requestPromises[id]();
  }
  
  requestPromises = {};
  requestPromises2 = {};
};

const emitXHREvent = (p) => {
  eventHandler.emit('requestStarted', p);
  if (!(requestPromises && requestPromises[p.requestId])) {
    console.log(`${Date.now()} + Request started:\t RequestId : ${p.requestId}\tRequest Url : ${p.request.url}`);
    logEvent(`Request started:\t RequestId : ${p.requestId}\tRequest Url : ${p.request.url}`);
    let resolve;
    let promise = new Promise((r) => {
        resolve = r;
      });
    eventHandler.emit('xhrEvent', {
      request: p,
      promise: promise,
    });
    requestPromises[p.requestId] = resolve;
    requestPromises2[p.requestId] = promise;
  }
};

const responseHandler = (response) => {
  console.log(`${Date.now()} Response Recieved: Request id: ${response.requestId}`);
  logEvent(`Response Recieved: Request id: ${response.requestId}`);
  eventHandler.emit('responseReceived', response);

  // hack for when the response is not resolved
  setTimeout(() => {
    const p = {requestId:response.requestId}
    if (requestPromises && requestPromises[p.requestId]) {
      // console.log(new Date(), 'xxx calling resolveXHREvent', p)

      resolveXHREvent(response)
    }
  }, 15000);
};

const resolveXHREvent = (p) => {
  if (requestPromises && requestPromises[p.requestId]) {
    console.log(`${Date.now()} Request resolved:\t RequestId : ${p.requestId}`);
    logEvent(`Request resolved:\t RequestId : ${p.requestId}`);
    requestPromises[p.requestId]();
    delete requestPromises[p.requestId];
    delete requestPromises2[p.requestId];
    logEvent(`remaining ${Object.keys(requestPromises)}`);
  }
  else {
    console.log(`${Date.now()} xxx resolveXHREvent called but missing:\t RequestId : ${p.requestId}`);
  }
};

const setNetworkEmulation = async (networkType) => {
  const _networkType = process.env.TAIKO_EMULATE_NETWORK;
  if (!networkType && _networkType) {
    networkType = _networkType;
  }
  const defaultNetworkConditions = {
    offline: false,
    downloadThroughput: 0,
    uploadThroughput: 0,
    latency: 0,
  };
  const emulate =
    typeof networkType === 'object'
      ? Object.assign(defaultNetworkConditions, networkType)
      : networkPresets[networkType];
  let networkModes = Object.keys(networkPresets);
  if (emulate === undefined) {
    throw new Error(`Please set one of the given network types \n${networkModes.join('\n')}`);
  }
  await network.emulateNetworkConditions(emulate).catch((err) => {
    console.warn(`Could not emulate network ${err}`);
  });
};

const setUserAgent = async (deviceEmulate) => {
  await network.setUserAgentOverride({
    userAgent: deviceEmulate.userAgent,
  });
};

const setCookie = async (options) => await network.setCookie(options);

const getCookies = async (options) => {
  return await network.getCookies(options);
};

const clearBrowserCookies = async () => await network.clearBrowserCookies();

const deleteCookies = async (options) => await network.deleteCookies(options);

module.exports = {
  setNetworkEmulation,
  resetPromises,
  logPromises,
  setUserAgent,
  setCookie,
  getCookies,
  clearBrowserCookies,
  deleteCookies,
  awaitPromises
};
