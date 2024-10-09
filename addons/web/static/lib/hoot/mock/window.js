/** @odoo-module */

import { whenReady } from "@odoo/owl";
import { mockedMatchMedia } from "@web/../lib/hoot-dom/helpers/dom";
import {
    mockedCancelAnimationFrame,
    mockedClearInterval,
    mockedClearTimeout,
    mockedRequestAnimationFrame,
    mockedSetInterval,
    mockedSetTimeout,
} from "@web/../lib/hoot-dom/helpers/time";
import { getRunner, getTargetWindow, protectOriginalValue, setTargetWindow } from "../hoot_globals";
import { MockConsole } from "./console";
import { MockDate } from "./date";
import { MockClipboardItem, mockNavigator } from "./navigator";
import {
    MockBroadcastChannel,
    MockRequest,
    MockResponse,
    MockSharedWorker,
    MockURL,
    MockWebSocket,
    MockWorker,
    MockXMLHttpRequest,
    mockCookie,
    mockHistory,
    mockedFetch,
} from "./network";
import { MockNotification } from "./notification";
import { MockStorage } from "./storage";
import { MockBlob } from "./sync_values";

//-----------------------------------------------------------------------------
// Internal
//-----------------------------------------------------------------------------

/**
 * @param {any} target
 * @param {Record<string, PropertyDescriptor>} descriptors
 */
const applyPropertyDescriptors = (target, descriptors) => {
    for (const [property, rawDescriptor] of Object.entries(descriptors)) {
        protectOriginalValue(target, property);

        const owner = findPropertyOwner(target, property);
        originalDescriptors.push({
            descriptor: Object.getOwnPropertyDescriptor(owner, property),
            owner,
            property,
            target,
        });
        const descriptor = { ...rawDescriptor };
        if ("value" in descriptor) {
            descriptor.writable = false;
        }
        Object.defineProperty(owner, property, descriptor);
    }
};

/**
 * @template T
 * @param {T} target
 * @param {keyof T} property
 */
const findOriginalDescriptor = (target, property) => {
    for (const { descriptor, target: t, property: p } of originalDescriptors) {
        if (t === target && p === property) {
            return descriptor;
        }
    }
    return null;
};

/**
 * @param {unknown} object
 * @param {string} property
 * @returns {any}
 */
const findPropertyOwner = (object, property) => {
    if (Object.hasOwn(object, property)) {
        return object;
    }
    const prototype = Object.getPrototypeOf(object);
    if (prototype) {
        return findPropertyOwner(prototype, property);
    }
    return object;
};

/**
 * @param {Document} document
 */
const getDocumentMockDescriptors = (document) => ({
    cookie: {
        get: () => mockCookie.get(),
        set: (value) => mockCookie.set(value),
    },
    title: {
        get: () => mockTitle,
        set: (value) => (mockTitle = value),
    },
});

/**
 * @param {Window} window
 */
const getWindowMockDescriptors = (window) => ({
    Blob: { value: MockBlob },
    BroadcastChannel: { value: MockBroadcastChannel },
    cancelAnimationFrame: { value: mockedCancelAnimationFrame(window), writable: false },
    clearInterval: { value: mockedClearInterval(window), writable: false },
    clearTimeout: { value: mockedClearTimeout(window), writable: false },
    console: { value: mockConsole, writable: false },
    ClipboardItem: { value: MockClipboardItem },
    Date: { value: MockDate, writable: false },
    fetch: { value: mockedFetch, writable: false },
    history: { value: mockHistory },
    localStorage: { value: mockLocalStorage, writable: false },
    matchMedia: { value: mockedMatchMedia },
    navigator: { value: mockNavigator },
    Notification: { value: MockNotification },
    Request: { value: MockRequest, writable: false },
    requestAnimationFrame: { value: mockedRequestAnimationFrame(window), writable: false },
    Response: { value: MockResponse, writable: false },
    sessionStorage: { value: mockSessionStorage, writable: false },
    setInterval: { value: mockedSetInterval(window), writable: false },
    setTimeout: { value: mockedSetTimeout(window), writable: false },
    SharedWorker: { value: MockSharedWorker },
    URL: { value: MockURL },
    WebSocket: { value: MockWebSocket },
    Worker: { value: MockWorker },
    XMLHttpRequest: { value: MockXMLHttpRequest },
});

/** @type {{ descriptor: PropertyDescriptor; owner: any; property: string; target: any }[]} */
const originalDescriptors = [];

const mockConsole = new MockConsole();
const mockLocalStorage = new MockStorage();
const mockSessionStorage = new MockStorage();
let mockTitle = "";

const R_OWL_SYNTHETIC_LISTENER = /\bnativeToSyntheticEvent\b/;

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

export function cleanupWindow() {
    // Storages
    mockLocalStorage.clear();
    mockSessionStorage.clear();

    // Title
    mockTitle = "";
}

export function getTitle() {
    const titleDescriptor = findOriginalDescriptor(document, "title");
    if (titleDescriptor) {
        return titleDescriptor.get.call(document);
    } else {
        return document.title;
    }
}

export function getViewPortHeight() {
    const heightDescriptor = findOriginalDescriptor(window, "innerHeight");
    if (heightDescriptor) {
        return heightDescriptor.get.call(window);
    } else {
        return window.innerHeight;
    }
}

export function getViewPortWidth() {
    const titleDescriptor = findOriginalDescriptor(window, "innerWidth");
    if (titleDescriptor) {
        return titleDescriptor.get.call(window);
    } else {
        return window.innerWidth;
    }
}

/**
 * @param {boolean} setTouch
 */
export function mockTouch(setTouch) {
    const window = getTargetWindow();
    const previous = window.ontouchstart;
    if (setTouch) {
        window.ontouchstart ||= null;
    } else {
        delete window.ontouchstart;
    }

    getRunner().after(() => {
        if (previous === undefined) {
            delete window.ontouchstart;
        } else {
            window.ontouchstart = previous;
        }
    });
}

/**
 * @param {typeof globalThis} global
 */
export function patchWindow({ document, window }) {
    setTargetWindow(window);

    applyPropertyDescriptors(window, getWindowMockDescriptors(window));
    whenReady(() => {
        applyPropertyDescriptors(document, getDocumentMockDescriptors(document));
    });
}

/**
 * @param {string} value
 */
export function setTitle(value) {
    const titleDescriptor = findOriginalDescriptor(document, "title");
    if (titleDescriptor) {
        titleDescriptor.set.call(document, value);
    } else {
        document.title = value;
    }
}

/**
 * @param {...typeof EventTarget} TargetClasses
 */
export function watchListeners(...TargetClasses) {
    const remaining = [];
    /** @type {[EventTarget, EventTarget["addEventListener"]][]} */
    const originalFunctions = [];

    for (const cls of TargetClasses) {
        const [proto, addEventListener] = [cls.prototype, cls.prototype.addEventListener];
        originalFunctions.push([proto, addEventListener]);
        proto.addEventListener = function mockedAddEventListener(...args) {
            const runner = getRunner();
            if (runner.dry) {
                // Ignore listeners during dry run
                return;
            }
            if (runner.suiteStack.length && !R_OWL_SYNTHETIC_LISTENER.test(String(args[1]))) {
                // Do not cleanup:
                // - listeners outside of suites
                // - Owl synthetic listeners
                remaining.push([this, args]);
                runner.after(() => this.removeEventListener(...args));
            }
            return addEventListener.call(this, ...args);
        };
    }

    return function unwatchAllListeners() {
        while (remaining.length) {
            const [target, args] = remaining.pop();
            target.removeEventListener(...args);
        }

        for (const [proto, addEventListener] of originalFunctions) {
            proto.addEventListener = addEventListener;
        }
    };
}

/**
 * Returns a function checking that the given target does not contain any unexpected
 * key. The list of accepted keys is the initial list of keys of the target, along
 * with an optional `whiteList` argument.
 *
 * @template T
 * @param {T} target
 * @param {string[]} [whiteList]
 * @example
 *  afterEach(watchKeys(window, ["odoo"]));
 */
export function watchKeys(target, whiteList) {
    const acceptedKeys = new Set([...Reflect.ownKeys(target), ...(whiteList || [])]);

    return function checkKeys() {
        const keysDiff = Reflect.ownKeys(target).filter(
            (key) => Number.isNaN(Number.parseFloat(key)) && !acceptedKeys.has(key)
        );
        for (const key of keysDiff) {
            const descriptor = Object.getOwnPropertyDescriptor(target, key);
            if (descriptor.configurable) {
                delete target[key];
            } else if (descriptor.writable) {
                target[key] = undefined;
            }
        }
    };
}
