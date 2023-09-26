/** @odoo-module */

// Internal

const mocks = {
    history: { replaceState: window.history.replaceState.bind(window.history) },
    localStorage: {
        getItem: window.localStorage.getItem.bind(window.localStorage),
        setItem: window.localStorage.setItem.bind(window.localStorage),
    },
    location: window.Object.assign(window.document.createElement("a"), {
        href: window.location.href,
    }),
    matchMedia: window.matchMedia.bind(window),
    sessionStorage: {
        getItem: window.sessionStorage.getItem.bind(window.sessionStorage),
        setItem: window.sessionStorage.setItem.bind(window.sessionStorage),
    },
};

// Exports

/**
 * @param {Storage} params
 */
export function mockLocalStorage({ getItem, setItem }) {
    mocks.localStorage = { getItem, setItem };
}

/**
 * @param {typeof window.location.href} href
 */
export function mockLocation(href) {
    mocks.location.href = href;
}

/**
 * @param {typeof window.history.replaceState} replaceState
 */
export function mockHistory(replaceState) {
    mocks.history.replaceState = replaceState;
}

/**
 * @param {typeof window.matchMedia} matchMedia
 */
export function mockMatchMedia(matchMedia) {
    mocks.matchMedia = matchMedia;
}

/**
 * @param {Storage} params
 */
export function mockSessionStorage({ getItem, setItem }) {
    mocks.sessionStorage = { getItem, setItem };
}

// Import initial Window object to prevent them from being patched
export const Boolean = window.Boolean;
export const cancelAnimationFrame = window.cancelAnimationFrame;
export const clearInterval = window.clearInterval;
export const clearTimeout = window.clearTimeout;
export const console = window.console;
export const CustomEvent = window.CustomEvent;
export const Date = window.Date;
export const Document = window.Document;
export const document = window.document;
export const Element = window.Element;
export const Error = window.Error;
export const EventTarget = window.EventTarget;
export const history = mocks.history;
export const JSON = window.JSON;
export const localStorage = mocks.localStorage;
export const location = mocks.location;
export const Map = window.Map;
export const matchMedia = (...args) => mocks.matchMedia(...args);
export const MutationObserver = window.MutationObserver;
export const navigator = window.navigator;
export const Number = window.Number;
export const Object = window.Object;
export const ontouchstart = window.ontouchstart;
export const performance = window.performance;
export const Promise = window.Promise;
export const Proxy = window.Proxy;
export const RegExp = window.RegExp;
export const requestAnimationFrame = window.requestAnimationFrame;
export const sessionStorage = mocks.sessionStorage;
export const Set = window.Set;
export const setInterval = window.setInterval;
export const setTimeout = window.setTimeout;
export const String = window.String;
export const URL = window.URL;
export const URLSearchParams = window.URLSearchParams;
export const Window = window.Window;
