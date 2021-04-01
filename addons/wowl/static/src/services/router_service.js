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

function applyLocking(lockedKeys, hash, currentRoute, lock=false) {
  const newHash = {};
  Object.keys(hash).forEach((key) => {
    if (!lock && lockedKeys.has(key)){ // forbid implicit override of key
      return;
    }
    if (lock === 'on') {
      lockedKeys.add(key);
    } else if (lock === 'off') {
      lockedKeys.delete(key);
    }
    newHash[key] = hash[key];
  });

  Object.keys(currentRoute.hash).forEach((key) => {
    if (lockedKeys.has(key) && !(key in newHash)) {
      newHash[key] = currentRoute.hash[key];
    }
  });
  return newHash;
}

export function routerSkeleton(env, {getRoute, historyPush, historyReplace, redirect}) {
  let bus = env.bus;
  let current = getRoute();
  const lockedKeys = new Set();

  bus.on('hashchange', null, () => {
    current = getRoute();
    bus.trigger('ROUTE_CHANGE');
  });

  function computeNewRoute(hash, replace, currentRoute) {
    hash = sanitizeHash(hash);
    if (!replace) {
      hash = Object.assign({}, currentRoute.hash, hash);
    }
    if (!shallowEqual(hash, currentRoute.hash)) {
      return Object.assign({}, currentRoute, { hash });
    }
    return false;
  }

  function replayPushes(allCallsArgs) {
    let finalHash, finalOptions={};
    allCallsArgs.forEach(([hash, options={}]) => {
      hash = applyLocking(lockedKeys, hash, current, options.lock);
      finalOptions.replace = finalOptions.replace || options.replace;
      finalHash = Object.assign(finalHash || {}, hash);
    });
    return [finalHash, finalOptions];
  }

  function pushState(hash, options) {
    const newRoute = computeNewRoute(hash, options.replace, current);
    if (newRoute) {
      historyPush(newRoute);
    }
    current  = getRoute();
  }

  function replaceState(hash, options) {
    const newRoute = computeNewRoute(hash, options.replace, current);
    if (newRoute) {
      historyReplace(newRoute);
    }
    current  = getRoute();
  }

  return {
    pushState: cumulativeCallable((allPushes) =>
      pushState(...replayPushes(allPushes))
    ),
    replaceState: cumulativeCallable((allPushes) =>
      replaceState(...replayPushes(allPushes))
    ),
    get current() {
      return current;
    },
    redirect,
  };
}

function cumulativeCallable(callable, timeout) {
  let timeoutId, acc = [], prom, resolve;
  return (...args) => {
    clearTimeout(timeoutId);
    if (!prom) {
      prom = new Promise((_r) => {resolve = _r;});
    }
    acc.push(args);
    timeoutId = setTimeout(() => {
      resolve(callable(acc));
      acc = [];
      timeoutId = undefined;
      prom = undefined;
      resolve = undefined;
    }, timeout);
    return prom;
  };
}

export const routerService = {
  deploy(env) {
    window.addEventListener("hashchange", () => env.bus.trigger("hashchange"));

    function historyPush(route) {
      const url = routeToUrl(route);
      window.history.pushState({}, url, url);
    }

    function historyReplace(route) {
      const url = routeToUrl(route);
      window.history.replaceState({}, url, url);
    }

    const redirect =  (url, wait) => redirect(env, url, wait);

    return routerSkeleton(env, {getRoute, historyPush, historyReplace, redirect});
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
