import { EventBus } from "@odoo/owl";
import { omit, pick } from "../utils/objects";
import { objectToUrlEncodedString } from "../utils/urls";
import { browser } from "./browser";
import { slidingWindow } from "@web/core/utils/arrays";

// Keys that are serialized in the URL as path segments instead of query string
export const PATH_KEYS = ["resId", "action", "active_id", "model"];

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
 * @param {object} values An object with the values of the new state
 * @param {boolean} replace whether the values should replace the state or be
 *  layered on top of the current state
 * @returns {object} the next state of the router
 */
function computeNextState(values, replace) {
    const nextState = replace ? pick(current, ..._lockedKeys) : { ...current };
    Object.assign(nextState, values);
    // Update last entry in the actionStack
    if (nextState.actionStack?.length) {
        Object.assign(nextState.actionStack.at(-1), pick(nextState, ...PATH_KEYS));
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
            // A few models don't have a dot at all, we need to distinguish
            // them from action paths (eg: website)
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
        // actions would typically map to a path like `active_id/action/res_id`
        if (act.active_id === prevAct.resId) {
            // avoid doubling up when the active_id is the same as the previous action's res_id
            delete act.active_id;
        }
        if (prevAct.action === act.action) {
            // avoid doubling up when the action's id is the same as the previous action's
            delete act.action;
        }
    }
    const pathSegments = actionStack.map(pathFromActionState).filter(Boolean);
    const path = pathSegments.length ? `/${pathSegments.join("/")}` : "";
    const search = objectToUrlEncodedString(omit(state, "actionStack", ...PATH_KEYS));
    return `/odoo${path}${search ? `?${search}` : ""}`;
}

const isNumeric = (str) => str?.match(/^\d+$/);

export function urlToState(urlObj) {
    const { pathname, hash, search } = urlObj;
    const state = parseSearchQuery(search);

    // If the url contains a hash, it can be for two motives:
    // 1. It is an anchor link, in that case, we ignore it, as it will not have a keys/values format
    //    the sanitizeHash function will remove it from the hash object.
    // 2. It has one or more keys/values, in that case, we merge it with the search.
    if (pathname === "/web") {
        const sanitizedHash = sanitizeHash(parseHash(hash));
        // Old urls used "id", it is now resId for clarity. Remap to the new name.
        if (sanitizedHash.id) {
            sanitizedHash.resId = sanitizedHash.id;
            delete sanitizedHash.id;
        }
        Object.assign(state, sanitizedHash);
        const addHash = hash && !Object.keys(sanitizedHash).length;
        const url = browser.location.origin + stateToUrl(state) + (addHash ? hash : "");
        // Change the url of the current history entry to the canonical url
        browser.history.replaceState(browser.history.state, null, url);
        urlObj.href = url;
    }

    const splitPath = urlObj.pathname.split("/").filter(Boolean);

    if (splitPath.length > 1 && splitPath[0] === "odoo") {
        splitPath[0] = null;
        const actionParts = [...splitPath.entries()].filter(
            ([i, part]) => i !== 0 && !part.match(/^\d+$/) && part !== "new"
        );
        const actions = [];
        for (const [i, part] of actionParts) {
            const action = {};
            const [left, right] = [splitPath[i - 1], splitPath[i + 1]];
            if (isNumeric(left)) {
                action.active_id = parseInt(left);
            }

            if (right === "new") {
                action.resId = "new";
            } else if (isNumeric(right)) {
                action.resId = parseInt(right);
            }

            if (part.startsWith("act-")) {
                // numeric id or xml_id
                const actionId = part.slice(4);
                action.action = isNumeric(actionId) ? parseInt(actionId) : actionId;
            } else if (part.startsWith("m-")) {
                action.model = part.slice(2);
            } else if (part.includes(".")) {
                action.model = part;
            } else {
                // action tag or path
                action.action = part;
            }

            if (action.resId && action.action) {
                actions.push(omit(action, "resId"));
            }
            // Don't create actions for models without resId unless they're the last one.
            // If the last one is a model but doesn't have a view_type, the action service will not mount it anyway.
            if (action.action || action.resId || i === splitPath.length - 1) {
                actions.push(action);
            }
        }
        const activeAction = actions.at(-1);
        if (activeAction) {
            Object.assign(state, activeAction);
            Object.assign(activeAction, pick(state, ...PATH_KEYS));
        }
        state.actionStack = actions;
    }
    return state;
}

let current;
let pushTimeout;
let allPushArgs;
let _lockedKeys;

export function startRouter() {
    current = urlToState(new URL(browser.location));
    pushTimeout = null;
    allPushArgs = [];
    _lockedKeys = new Set(["debug"]);
}

// FIXME rewrite this comment
// pushState and replaceState keep the browser on the same document. It's a simulation of going to a new page.
// The back button on the browser is a navigation tool that takes you to the previous document.
// But in this case, there isn't a previous document.
// To make the back button appear to work, we need to simulate a new document being loaded.

browser.addEventListener("popstate", (ev) => {
    console.log("popState");
    browser.clearTimeout(pushTimeout);
    current = ev.state?.nextState || {};
    // Some client actions want to handle loading their own state
    if (!ev.state?.skipRouteChange && !router.skipLoad) {
        routerBus.trigger("ROUTE_CHANGE");
    }
    router.skipLoad = false;
});

/**
 * @param {string} mode
 */
function makeDebouncedPush(mode) {
    function doPush() {
        // Aggregates push/replace state arguments
        const replace = allPushArgs.some(([, options]) => options?.replace);
        const newValues = allPushArgs.reduce((state, [search]) => Object.assign(state, search), {});
        // Calculates new route based on aggregated search and options
        const nextState = computeNextState(newValues, replace);
        const url = browser.location.origin + stateToUrl(nextState);
        if (url !== browser.location.href) {
            // If the route changed: pushes or replaces browser state
            if (mode === "push") {
                console.log("pushState", url);
                // Because doPush is delayed, the history entry will have the wrong name.
                // We set the document title to what it was at the time of the pushState
                // call, then push, which generates the history entry with the right title
                // then restore the title to what it's supposed to be
                const prevTitle = allPushArgs.at(-1)[2];
                const title = document.title;
                document.title = prevTitle;
                browser.history.pushState({ nextState }, "", url);
                document.title = title;
            } else {
                browser.history.replaceState({ nextState }, "", url);
            }
            current = nextState;
        }
        const reload = allPushArgs.some(([, options]) => options && options.reload);
        if (reload) {
            browser.location.reload();
        }
    }
    /**
     * @param {object} state
     * @param {object} options
     */
    return function pushOrReplaceState(state, options) {
        allPushArgs.push([state, options, document.title]);
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
    // TODO: stop debouncing these and remove the ugly hack to have the correct title for history entries
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
