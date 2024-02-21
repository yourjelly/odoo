import { EventBus } from "@odoo/owl";
import { omit, pick } from "../utils/objects";
import { objectToUrlEncodedString } from "../utils/urls";
import { browser } from "./browser";
import { slidingWindow } from "@web/core/utils/arrays";

const ACTION_KEYS = ["resId", "action", "active_id", "model"];

export const routerBus = new EventBus();

/**
 * Casts the given string to a number if possible.
 *
 * @param {string} value
 * @returns {string|number}
 */
function cast(value) {
    return !value || isNaN(value) ? value : Number(value);
}

/**
 * @typedef {{ [key: string]: string }} Query
 * @typedef {{ [key: string]: any }} Route
 */

function parseString(str) {
    const parts = str.split("&");
    const result = {};
    for (const part of parts) {
        const [key, value] = part.split("=");
        const decoded = decodeURIComponent(value || "");
        result[key] = cast(decoded);
    }
    return result;
}

/**
 * For each push request (replaceState or pushState), filterout keys that have been locked before
 * overrides locked keys that are explicitly re-locked or unlocked
 * registers keys in "search" in "lockedKeys" according to the "lock" Boolean
 *
 * @param {Query} search An Object representing the pushed url search
 * @param {Query} currentSearch The current search compare against
 * @return {Query} The resulting "search" where previous locking has been applied
 */
function applyLocking(search, currentSearch) {
    const newSearch = Object.assign({}, search);
    for (const key in currentSearch) {
        if ([..._lockedKeys].includes(key) && !(key in newSearch)) {
            newSearch[key] = currentSearch[key];
        }
    }
    return newSearch;
}

// FIXME: do we need this (ditto with sanitize etc)
function computeNewState(nextState, replace, currentState) {
    if (!replace) {
        nextState = Object.assign({}, currentState, nextState);
        if (nextState.actionStack?.length) {
            Object.assign(nextState.actionStack.at(-1), pick(nextState, ...ACTION_KEYS));
        }
    }
    return sanitizeSearch(nextState);
}

function sanitize(obj, valueToRemove) {
    return Object.fromEntries(
        Object.entries(obj)
            .filter(([, v]) => v !== valueToRemove)
            .map(([k, v]) => [k, cast(v)])
    );
}

function sanitizeSearch(search) {
    return sanitize(search);
}

function sanitizeHash(hash) {
    return sanitize(hash, "");
}

/**
 * @param {string} hash
 * @returns {any}
 */
export function parseHash(hash) {
    return hash && hash !== "#" ? parseString(hash.slice(1)) : {};
}

/**
 * @param {string} search
 * @returns {any}
 */
export function parseSearchQuery(search) {
    return search ? parseString(search.slice(1)) : {};
}

function pathFromActionState(state) {
    const path = [];
    const { action, model, active_id, resId } = state;
    if (active_id) {
        path.push(active_id);
    }
    if (action) {
        if (typeof action === "number" || action.includes(".")) {
            path.push(`act-${action}`);
        } else {
            path.push(action);
        }
    } else if (model) {
        if (model.includes(".")) {
            path.push(model);
        } else {
            path.push(`m-${model}`);
        }
    }
    if (resId) {
        path.push(resId);
    }
    return path.join("/");
}

/**
 * @param {{ [key: string]: any }} route
 * @returns
 */
export function stateToUrl(state) {
    const actionStack = (state.actionStack || [state]).map((a) => ({ ...a }));
    for (const [prevAct, act] of slidingWindow(actionStack, 2)) {
        if (act.active_id === prevAct.resId) {
            // actions would typically map to a path like `active_id/action/res_id`
            // avoid doubling up when the active_id is the same as the previous action's res_id
            delete act.active_id;
        }
        if (prevAct.action === act.action) {
            delete act.action;
        }
    }
    const pathSegments = actionStack.map(pathFromActionState).filter(Boolean);
    const path = pathSegments.length ? `/${pathSegments.join("/")}` : "";
    const search = objectToUrlEncodedString(omit(state, "actionStack", ...ACTION_KEYS));
    return `/home${path}${search ? `?${search}` : ""}`;
}

export function urlToState(urlObj) {
    const { pathname, hash, search } = urlObj;
    const state = parseSearchQuery(search);

    // If the url contains a hash, it can be for two motives:
    // 1. It is an anchor link, in that case, we ignore it, as it will not have a keys/values format
    //    the sanitizeHash function will remove it from the hash object.
    // 2. It has one or more keys/values, in that case, we merge it with the search.
    if (pathname === "/web") {
        const sanitizedHash = sanitizeHash(parseHash(hash));
        if (sanitizedHash.id) {
            sanitizedHash.resId = sanitizedHash.id;
            delete sanitizedHash.id;
        }
        Object.assign(state, sanitizedHash);
        const addHash = hash && !Object.keys(sanitizedHash).length;
        const url = browser.location.origin + stateToUrl(state) + (addHash ? hash : "");
        browser.history.replaceState({}, "", url);
    }

    const splitPath = pathname.split("/").filter(Boolean);

    if (splitPath.length > 1 && splitPath[0] === "home") {
        splitPath.splice(0, 1);
        let actions = [];
        let action = {};
        let aid = undefined;
        for (const part of splitPath) {
            if (aid) {
                action.active_id = aid;
                aid = undefined;
            }
            if (isNaN(parseInt(part)) && part !== "new") {
                // part is an action (id or shortcut) or a model (when no action is found)
                if (Object.values(action).length > 0) {
                    // We have a new action, so we push the previous one
                    if (action.resId) {
                        aid = action.resId;
                    }
                    actions.push({ ...action });
                }
                action = {};
                if (part.startsWith("act-")) {
                    // it's an action id or an action xmlid
                    action.action = isNaN(parseInt(part.slice(4)))
                        ? part.slice(4)
                        : parseInt(part.slice(4));
                } else if (part.includes(".") || part.startsWith("m-")) {
                    // it's a model
                    // Note that the shourtcut don't have "."
                    if (part.startsWith("m-")) {
                        action.model = part.slice(2);
                    } else {
                        action.model = part;
                    }
                } else {
                    // it's a shortcut of an action
                    action.action = part;
                }
                continue;
            }
            // Action with a resId
            if (Object.values(action).length > 0) {
                // We push the action without the id, to have a multimodel action view
                actions.push({ ...action });
            }
            if (part === "new") {
                action.resId = part;
                action.view_type = "form";
            } else {
                action.resId = parseInt(part);
            }
        }
        if (actions.at(-1)?.resId) {
            action.active_id = actions.at(-1).resId;
        }
        actions.push(action);
        // Don't keep actions for models unless they're the last one.
        // FIXME: should we remove the last action if there is no view_type?
        actions = actions.filter((a) => a.action || (a.model && a.resId) || a === actions.at(-1));
        const activeAction = actions.at(-1);
        if (activeAction) {
            if (activeAction.resId && activeAction.resId !== "new") {
                state.resId = activeAction.resId;
            }
            Object.assign(state, pick(activeAction, "action", "model", "active_id", "view_type"));
            state.actionStack = actions;
        }
    }
    return state;
}

let current;
let pushTimeout;
let allPushArgs;
let _lockedKeys;

export function startRouter() {
    current = urlToState(browser.location);
    pushTimeout = null;
    allPushArgs = [];
    _lockedKeys = new Set(["debug"]);
}

// pushState and replaceState keep the browser on the same document. It's a simulation of going to a new page.
// The back button on the browser is a navigation tool that takes you to the previous document.
// But in this case, there isn't a previous document.
// To make the back button appear to work, we need to simulate a new document being loaded.

browser.addEventListener("popstate", (ev) => {
    // FIXME add breadcrumb display names to state so we don't lose them if we back out of odoo then
    // forward back into it
    console.log("popState");
    browser.clearTimeout(pushTimeout);
    current = ev.state?.newState || {};
    // Some client actions want to handle loading their own state
    if (!ev.state?.skipRouteChange && !router.skipLoad) {
        routerBus.trigger("ROUTE_CHANGE");
    }
    router.skipLoad = false;
});

/**
 * @param {string} mode
 * @returns {(hash: string, options: any) => any}
 */
function makeDebouncedPush(mode) {
    function doPush() {
        // Aggregates push/replace state arguments
        const replace = allPushArgs.some(([, options]) => options && options.replace);
        let newSearch = allPushArgs.reduce((finalSearch, [search]) => {
            return Object.assign(finalSearch || {}, search);
        }, null);
        // apply Locking on the final search
        newSearch = applyLocking(newSearch, current);
        // Calculates new route based on aggregated search and options
        const newState = computeNewState(newSearch, replace, current);
        const url = browser.location.origin + stateToUrl(newState);
        // FIXME is url equality sufficient to skip push/replace? Comparing state seems problematic
        if (url !== browser.location.href) {
            // If the route changed: pushes or replaces browser state
            if (mode === "push") {
                console.log("pushState", url);
                browser.history.pushState({ newState }, "", url);
            } else {
                browser.history.replaceState({ newState }, "", url);
            }
            current = urlToState(browser.location);
        }
        const reload = allPushArgs.some(([, options]) => options && options.reload);
        if (reload) {
            browser.location.reload();
        }
    }
    return function pushOrReplaceState(search, options) {
        allPushArgs.push([search, options]);
        browser.clearTimeout(pushTimeout);
        pushTimeout = browser.setTimeout(() => {
            doPush();
            pushTimeout = null;
            allPushArgs = [];
        });
    };
}

startRouter();

export const router = {
    get current() {
        return current;
    },
    pushState: makeDebouncedPush("push"),
    replaceState: makeDebouncedPush("replace"),
    cancelPushes: () => browser.clearTimeout(pushTimeout),
    addLockedKey: (key) => _lockedKeys.add(key),
    skipLoad: false,
};

export function objectToQuery(obj) {
    const query = {};
    Object.entries(obj).forEach(([k, v]) => {
        query[k] = v ? String(v) : v;
    });
    return query;
}
