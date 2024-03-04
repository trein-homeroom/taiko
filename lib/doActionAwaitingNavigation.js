const { wait, waitUntil } = require('./helper');
const networkHandler = require('./handlers/networkHandler');
const pageHandler = require('./handlers/pageHandler');
const runtimeHandler = require('./handlers/runtimeHandler');
const { defaultConfig } = require('./config');
const { eventHandler } = require('./eventBus');
const { logEvent } = require('./logger');
let counter = 0;
let runningAction = null;

const doActionAwaitingNavigation = async (options, action) => {
  if (!options.waitForNavigation) {
    return action();
  }
  
  const id = ++counter;

  // console.log(Date.now() + ', id = ' + id + 'xxx doActionAwaitingNavigation start', action.toString());

  if (runningAction) {
    console.trace(`doActionAwaitingNavigation called while another one is pending ${options} ${action?.toString ? action?.toString() : action}`);
  }

  runningAction = action;
  
  let timeouts = [];
  let promises = [];
  let listenerCallbackMap = {};
  pageHandler.resetPromises();
  networkHandler.resetPromises();
  options.navigationTimeout = options.navigationTimeout || defaultConfig.navigationTimeout;
  options.waitForEvents = options.waitForEvents || defaultConfig.waitForEvents;
  if (options.waitForEvents.length > 0) {
    options.waitForEvents.forEach((event) => {
      promises.push(
        new Promise((resolve) => {
          eventHandler.addListener(event, resolve);
          listenerCallbackMap[event] = resolve;
        }),
      );
    });
  } else {
    if (!defaultConfig.firefox) {
      let func = addPromiseToWait(promises);
      listenerCallbackMap['xhrEvent'] = func;
      listenerCallbackMap['frameEvent'] = func;
      listenerCallbackMap['frameNavigationEvent'] = func;
      eventHandler.addListener('xhrEvent', func);
      eventHandler.addListener('frameEvent', func);
      eventHandler.addListener('frameNavigationEvent', func);
    }
    const waitForTargetCreated = () => {
      promises = [
        new Promise((resolve) => {
          eventHandler.addListener('targetNavigated', resolve);
          listenerCallbackMap['targetNavigated'] = resolve;
        }),
      ];
    };
    eventHandler.once('targetCreated', waitForTargetCreated);
    listenerCallbackMap['targetCreated'] = waitForTargetCreated;
    const waitForReconnection = () => {
      promises = [
        new Promise((resolve) => {
          eventHandler.addListener('reconnected', resolve);
          listenerCallbackMap['reconnected'] = resolve;
        }),
      ];
    };
    eventHandler.once('reconnecting', waitForReconnection);
    listenerCallbackMap['reconnecting'] = waitForReconnection;
  }
  try {
    await action();
    await waitForPromises(timeouts, promises, options.waitForStart);
    await waitForNavigation(timeouts, options.navigationTimeout, promises);
  } catch (e) {
    console.log(Date.now() + ', id = ' + id + 'xxx doActionAwaitingNavigation error', e);
    
    if (e === 'Timedout') {
      // throw new Error(
      //   `Navigation took more than ${options.navigationTimeout}ms. Please increase the navigationTimeout.`,
      // );
    }
    else {
      throw e;
    }
  } finally {
    // console.log(Date.now() + ', id = ' + id + " xxx doActionAwaitingNavigation finish");
    // networkHandler.logPromises();
    cleanUp(timeouts, listenerCallbackMap);
    runningAction = null;
  }
};

const cleanUp = (timeouts, listenerCallbackMap) => {
  timeouts.forEach((timeout) => {
    if (timeout) {
      clearTimeout(timeout);
    }
  });
  for (var listener in listenerCallbackMap) {
    eventHandler.removeListener(listener, listenerCallbackMap[listener]);
  }
  pageHandler.resetPromises();
  networkHandler.resetPromises();
};

const addPromiseToWait = (promises) => {
  return (promise) => {
    if (Object.prototype.hasOwnProperty.call(promise, 'request')) {
      let request = promise.request;
      logEvent(
        `Waiting for:\t RequestId : ${request.requestId}\tRequest Url : ${request.request.url}`,
      );
      promise = promise.promise;
    }
    promises.push(promise);
  };
};

const waitForPromises = (timeouts, promises, waitForStart) => {
  return Promise.race([
    wait(waitForStart),
    new Promise(function waitForPromise(resolve) {
      if (promises.length) {
        const timeoutId = setTimeout(resolve, waitForStart / 5);
        timeouts.push(timeoutId);
      } else {
        const timeoutId = setTimeout(() => {
          waitForPromise(resolve);
        }, waitForStart / 5);
        timeouts.push(timeoutId);
      }
    }),
  ]);
};

const waitForNavigation = (timeouts, timeout, promises = []) => {
  return new Promise((resolve, reject) => {
    Promise.all(promises)
      .then(() => {
        waitUntil(
          async () => {
            return (
              (await runtimeHandler.runtimeEvaluate('document.readyState')).result.value ===
              'complete'
            );
          },
          defaultConfig.retryInterval,
          timeout,
        )
          .then(resolve)
          .catch(() => reject('Timedout'));
      })
      .catch(reject);
    const timeoutId = setTimeout(() => reject('Timedout'), timeout);
    timeouts.push(timeoutId);
  });
};

module.exports = {
  doActionAwaitingNavigation,
};
