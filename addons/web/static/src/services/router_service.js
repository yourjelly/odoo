/** @odoo-module **/

import { browser } from "../core/browser";
import { serviceRegistry } from "../webclient/service_registry";
import { shallowEqual } from "../utils/objects";
import { objectToUrlEncodedString } from "../utils/urls";

function parseString(str) {
  const parts = str.split("&");
  const result = {};
  for (let part of parts) {
    const [key, value] = part.split("=");
    result[key] = decodeURIComponent(value || "");
  }
  return result;
}

function sanitizeHash(hash) {
  return Object.fromEntries(Object.entries(hash).filter(([_, v]) => v !== undefined));
}

export function parseHash(hash) {
  return hash === "#" || hash === "" ? {} : parseString(hash.slice(1));
}

export function parseSearchQuery(search) {
  return search === "" ? {} : parseString(search.slice(1));
}

export function routeToUrl(route) {
  const search = objectToUrlEncodedString(route.search);
  const hash = objectToUrlEncodedString(route.hash);
  return route.pathname + (search ? "?" + search : "") + (hash ? "#" + hash : "");
}

export function redirect(env, url, wait) {
  const load = () => browser.location.assign(url);
  if (wait) {
    const wait_server = function () {
      env.services
        .rpc("/web/webclient/version_info", {})
        .then(load)
        .catch(() => browser.setTimeout(wait_server, 250));
    };
    browser.setTimeout(wait_server, 1000);
  } else {
    load();
  }
}

function getRoute() {
  const { pathname, search, hash } = window.location;
  const searchQuery = parseSearchQuery(search);
  const hashQuery = parseHash(hash);
  return { pathname, search: searchQuery, hash: hashQuery };
}

/*
 * @typedef {[key: string: string]} Query
 * @typedef {Object} Route
 */

/**
 * For each push request (replaceState or pushState), filterout keys that have been locked before
 * overrides locked keys that are explicitly re-locked or unlocked
 * registers keys in "hash" in "lockedKeys" according to the "lock" Boolean
 *
 * @param  {Set}  lockedKeys   A set containing all keys that were locked
 * @param  {Query}  hash         An Object representing the pushed url hash
 * @param  {Query}  currentHash The current hash compare against
 * @param  {Boolean} [lock=false]         Whether to lock all hash keys in "hash" to prevent them from being changed afterwards
 * @return {Query}   The resulting "hash" where previous locking has been applied
 */
function applyLocking(lockedKeys, hash, currentHash, lock = false) {
  const newHash = {};
  Object.keys(hash).forEach((key) => {
    if (!lock && lockedKeys.has(key)) {
      // forbid implicit override of key
      return;
    }
    if (lock === "on") {
      lockedKeys.add(key);
    } else if (lock === "off") {
      lockedKeys.delete(key);
    }
    newHash[key] = hash[key];
  });

  Object.keys(currentHash).forEach((key) => {
    if (lockedKeys.has(key) && !(key in newHash)) {
      newHash[key] = currentHash[key];
    }
  });
  return newHash;
}

/**
 * Builds and returns a router object that holds all the logic to properly handle pushState, replaceState
 * with some specific features: Pushes are actually done in a setTimeoutin order to alter the actual
 * history only when necessary. Pushes request can lock or unlock some keys.
 * This allows components or services that want to alter the URL to own their keys in that URL,
 * and protect them against external overrides

 * @param  {Env} env                    The owl env
 * @param  {Function} options.getRoute       a function that returns the full Route Object ccorresponding to the current URL state
 * @param  {Function} options.historyPush    a function that should match history.pushState
 * @param  {Function} options.historyReplace  a function that should match history.replaceState
 * @param  {Function} options.redirect       a function that should redirect to an URL
 * @return {router: Router , bus: EventBus}
 */
export function routerSkeleton(env, { getRoute, historyPush, historyReplace, redirect }) {
  const bus = new owl.core.EventBus();
  let current = getRoute();
  const lockedKeys = new Set();

  bus.on("hashchange", null, () => {
    current = getRoute();
    env.bus.trigger("ROUTE_CHANGE");
  });

  function computeNewRoute(hash, replace, currentRoute) {
    if (!replace) {
      hash = Object.assign({}, currentRoute.hash, hash);
    }
    hash = sanitizeHash(hash);
    if (!shallowEqual(currentRoute.hash, hash)) {
      return Object.assign({}, currentRoute, { hash });
    }
    return false;
  }

  /**
   * Used when the setTimeout executes, allows all calls to a "pushState" function during the timeout
   * to be aggregated together into one call to the "pushState" function
   * @param  {[hash, options][]} allCallsArgs: the array of all args accumulated during calls
   * @return {[hash, options]}
   */
  function aggregatePushes(allCallsArgs) {
    let finalHash;
    let finalOptions = {};
    allCallsArgs.forEach(([hash, options = {}]) => {
      hash = applyLocking(lockedKeys, hash, current.hash, options.lock);
      if (finalHash) {
        hash = applyLocking(lockedKeys, hash, finalHash, options.lock);
      }
      finalOptions.replace = finalOptions.replace || options.replace;
      finalHash = Object.assign(finalHash || {}, hash);
    });
    return [finalHash, finalOptions];
  }

  /**
   * A pushState function that uses historyPush
   * Executed at the end of the setTimeout, with hash and options being aggregates of all calls
   * @param  {Query} hash   The new hash
   * @param  {{ replace: boolean }} options to compute the new route.
   * If replace is true, the new route will wipe the old one
   */
  function pushState(hash, options) {
    const newRoute = computeNewRoute(hash, options.replace, current);
    if (newRoute) {
      historyPush(newRoute);
    }
    current = getRoute();
  }

  /**
   * A pushState function that uses historyReplace
   * Executed at the end of the setTimeout, with hash and options being aggregates of all calls
   * @param  {Query} hash   The new hash
   * @param  {{ replace: boolean }} options to compute the new route.
   * If replace is true, the new route will wipe the old one
   */
  function replaceState(hash, options) {
    const newRoute = computeNewRoute(hash, options.replace, current);
    if (newRoute) {
      historyReplace(newRoute);
    }
    current = getRoute();
  }

  const router = {
    pushState: cumulativeCallable((allPushes) => pushState(...aggregatePushes(allPushes))),
    replaceState: cumulativeCallable((allPushes) => replaceState(...aggregatePushes(allPushes))),
    get current() {
      return current;
    },
    redirect,
  };
  return { router, bus };
}

/**
 * Utility function that allows to execute the "callable" function after a timeout
 * callable is then passed all arguments of all calls to the resulting function during the timeout
 * callable should decides how to aggregate those calls
 *
 * @param  {Function} callable  a function that takes a list of list og arguments to be aggregated
 * @param  {number} [timeout] timeout after which callable is called
 */
function cumulativeCallable(callable, timeout) {
  let timeoutId,
    acc = [];
  return (...args) => {
    clearTimeout(timeoutId);
    acc.push(args);
    timeoutId = setTimeout(() => {
      callable(acc);
      acc = [];
      timeoutId = undefined;
    }, timeout);
  };
}

export const routerService = {
  start(env) {
    function historyPush(route) {
      const url = routeToUrl(route);
      window.history.pushState({}, url, url);
    }

    function historyReplace(route) {
      const url = routeToUrl(route);
      window.history.replaceState({}, url, url);
    }

    const redirect = (url, wait) => redirect(env, url, wait);

    const { router, bus } = routerSkeleton(env, {
      getRoute,
      historyPush,
      historyReplace,
      redirect,
    });
    window.addEventListener("hashchange", () => bus.trigger("hashchange"));
    return router;
  },
};

export function objectToQuery(obj) {
  const query = {};
  Object.entries(obj).forEach(([k, v]) => {
    query[k] = v ? `${v}` : v;
  });
  return query;
}

serviceRegistry.add("router", routerService);
