/** @odoo-module */

import { groupBy, isIterable, log, match } from "../utils";

/**
 * @typedef {{ x?: number; y?: number; left?: number; top?: number }} Coordinates
 *
 * @typedef {(content: string) => (node: Node, index: number, node: Node[])=> boolean | Node} PseudoClassFilterBuilder
 *
 * @typedef {{
 *  ensureOne?: boolean;
 *  focusable?: boolean;
 *  root?: HTMLElement;
 *  scrollable?: boolean;
 *  visible?: boolean;
 * }} QueryOptions
 *
 * @typedef {HTMLOrSVGElement | Iterable<HTMLOrSVGElement> | string | null | undefined | false} Target
 */

//-----------------------------------------------------------------------------
// Internal
//-----------------------------------------------------------------------------

/**
 * @param {Document | Element} element
 */
const isElementFocusable = (element) => element.matches(FOCUSABLE_SELECTOR);

/**
 * @param {Document | Element} element
 * @param {"x" | "y"} axis
 */
const isElementScrollable = (element, axis) => {
    const [scrollProp, sizeProp] =
        axis === "x" ? ["scrollWidth", "clientWidth"] : ["scrollHeight", "clientHeight"];
    if (element[scrollProp] > element[sizeProp]) {
        const overflow = getComputedStyle(element).getPropertyValue("overflow");
        if (/\bauto\b|\bscroll\b/.test(overflow)) {
            return true;
        }
    }
    return false;
};

/**
 * @param {Document | Element} element
 */
const isElementVisible = (element) => {
    if (isDocument(element) || element === config.defaultRoot) {
        return true;
    } else if (!element) {
        return false;
    }
    let visible = false;
    if ("offsetWidth" in element && "offsetHeight" in element) {
        visible = element.offsetWidth > 0 && element.offsetHeight > 0;
    } else if ("getBoundingClientRect" in element) {
        // for example, svgelements
        const rect = getRect(element);
        visible = rect.width > 0 && rect.height > 0;
    }
    if (!visible && getComputedStyle(element).display === "contents") {
        for (const child of element.children) {
            if (isElementVisible(child)) {
                return true;
            }
        }
    }
    return visible;
};

/**
 * @template T
 * @param {T} node
 * @param {"element" | "text" | "document"} type
 */
const isNodeOfType = (node, type) => {
    if (node && typeof node === "object" && node.nodeType) {
        switch (type) {
            case "element":
                return node.nodeType === 1;
            case "text":
                return node.nodeType === 3;
            case "document":
                return node.nodeType === 9;
        }
    }
    return false;
};

/**
 * Converts a CSS pixel value to a number, removing the 'px' part.
 *
 * @param {string} val
 * @returns {number}
 */
const pixelValueToNumber = (val) => {
    return Number(val.endsWith("px") ? val.slice(0, -2) : val);
};

/**
 * @param {string} text
 */
const toPermissiveRegex = (text) => {
    return new RegExp(text.replace(/\s+/g, "\\s+"), "i");
};

// Following selector is based on this spec: https://html.spec.whatwg.org/multipage/interaction.html#dom-tabindex
const FOCUSABLE_SELECTOR = [
    "[tabindex]",
    "a",
    "area",
    "button",
    "frame",
    "iframe",
    "input",
    "object",
    "select",
    "textarea",
    "details > summary:nth-child(1)",
]
    .map((sel) => `${sel}:not([tabindex="-1"]):not(:disabled)`)
    .join(",");

const PSEUDO_SELECTOR_REGEX = /:([\w-]+)(\(([^)]*)\))?/g;
const ROOT_SPECIAL_SELECTORS = {
    get body() {
        return config.defaultRoot.ownerDocument.body;
    },
    document,
};

/** @type {Map<HTMLElement, { callbacks: Set<MutationCallback>, observer: MutationObserver }>} */
const observers = new Map();

//-----------------------------------------------------------------------------
// Default pseudo classes
//-----------------------------------------------------------------------------

/** @type {WeakMap<Element, DOMRect>} */
const rectMap = new WeakMap();

/** @type {Map<string, PseudoClassFilterBuilder>} */
const customPseudoClasses = new Map();

customPseudoClasses
    .set("contains", (content) => {
        const regex = toPermissiveRegex(content);
        return (node) => regex.test(node.textContent);
    })
    .set("containsExact", (content) => {
        const regex = new RegExp(`^${content}$`);
        return (node) => regex.test(node.textContent);
    })
    .set("empty", () => {
        return (node) => node.children.length === 0;
    })
    .set("eq", (content) => {
        const index = Number(content);
        return (node, i) => i === index;
    })
    .set("first", () => {
        return (node, i) => i === 0;
    })
    .set("focusable", () => {
        return (node) => isElementFocusable(node);
    })
    .set("hidden", () => {
        return (node) => !isElementVisible(node);
    })
    .set("iframe", () => {
        return (node) => {
            const document = node.contentDocument;
            return document && document.readyState !== "loading" ? document.body : false;
        };
    })
    .set("last", () => {
        return (node, i, nodes) => i === nodes.length - 1;
    })
    .set("selected", () => {
        return (node) => Boolean(node.selected);
    })
    .set("scrollable", () => {
        return (node) => isElementScrollable(node);
    })
    .set("value", (content) => {
        const regex = toPermissiveRegex(content);
        return (node) => regex.test(node.value);
    })
    .set("visible", () => {
        return (node) => isElementVisible(node);
    });

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

export function cleanupDOM() {
    // TODO: this is called by the sub-runners in the runner tests, making
    // them crash because it's throwing errors in the ongoing (actual) test.

    const remainingElements = config.defaultRoot?.children.length;
    if (remainingElements) {
        log.warn(`${remainingElements} undesired elements left in the root element`);
        config.defaultRoot.innerHTML = "";
    }

    const remainingObservers = observers.size;
    if (remainingObservers) {
        log.warn(`${remainingObservers} observers still running`);
        for (const { observer } of observers.values()) {
            observer.disconnect();
        }
    }
}

export function getActiveElement() {
    const { activeElement } = match(config.defaultRoot, Document)
        ? config.defaultRoot
        : config.defaultRoot.ownerDocument;
    return activeElement;
}

export function getFocusableElements(parent) {
    const byTabIndex = groupBy(
        (parent || config.defaultRoot).querySelectorAll(FOCUSABLE_SELECTOR),
        "tabIndex"
    );
    const withTabIndexZero = byTabIndex[0] || [];
    delete byTabIndex[0];
    return [...Object.values(byTabIndex).flat(), ...withTabIndexZero];
}

export function getNextFocusableElement(parent) {
    const focusableEls = getFocusableElements(parent);
    const index = focusableEls.indexOf((parent || config.defaultRoot).ownerDocument.activeElement);
    return focusableEls[index + 1] || null;
}

/**
 * @param {Node} node
 */
export function getParentFrame(node) {
    const view = node.ownerDocument.defaultView;
    if (view !== view.parent) {
        const currentDocument = node.ownerDocument;
        for (const iframe of view.parent.document.getElementsByTagName("iframe")) {
            if (iframe.contentDocument === currentDocument) {
                return iframe;
            }
        }
    }
    return null;
}

export function getPreviousFocusableElement(parent) {
    const focusableEls = getFocusableElements(parent);
    const index = focusableEls.indexOf((parent || config.defaultRoot).ownerDocument.activeElement);
    return index < 0 ? focusableEls.at(-1) : focusableEls[index - 1] || null;
}

export function getFixture() {
    return config.defaultRoot;
}

/**
 * @param {Element} element
 * @param {{ trimPadding }} options
 */
export function getRect(element, options) {
    if (!element) {
        return new DOMRect();
    }

    if (!rectMap.has(element)) {
        const rect = element.getBoundingClientRect();
        const parentFrame = getParentFrame(element);
        if (parentFrame) {
            const parentRect = getRect(parentFrame);
            rect.x -= parentRect.x;
            rect.y -= parentRect.y;
        }
        rectMap.set(element, rect);
    }
    const rect = rectMap.get(element);

    if (!options?.trimPadding) {
        return rect;
    }

    const style = getComputedStyle(element);
    const { x, y, width, height } = rect;
    const [pl, pr, pt, pb] = ["left", "right", "top", "bottom"].map((side) =>
        pixelValueToNumber(style.getPropertyValue(`padding-${side}`))
    );

    return new DOMRect(x + pl, y + pt, width - (pl + pr), height - (pt + pb));
}

/**
 * @param {Target} target
 * @param {QueryOptions} options
 */
export function getText(target, options) {
    return queryAll(target, options).map((element) => element.innerText);
}

/**
 * @template T
 * @param {T} object
 * @returns {T is Document}
 */
export function isDocument(object) {
    return isNodeOfType(object, "document");
}

/**
 * @template T
 * @param {T} element
 */
export function isEditable(element) {
    return (
        isElement(element) &&
        (["INPUT", "TEXTAREA"].includes(element.tagName) || element.contentEditable === "true")
    );
}

/**
 * @template T
 * @param {T} object
 * @returns {T is Element}
 */
export function isElement(object) {
    return isNodeOfType(object, "element");
}

/**
 * @template T
 * @param {T} object
 * @returns {T is EventTarget}
 */
export function isEventTarget(object) {
    return object && typeof object === "object" && typeof object.dispatchEvent === "function";
}

/**
 * @param {Target} target
 * @returns {boolean}
 */
export function isFocusable(target) {
    return isElementFocusable(queryOne(target));
}

/**
 * rough approximation of a visible element. not perfect (does not take into
 * account opacity = 0 for example), but good enough for our purpose
 *
 * @param {Target} target
 */
export function isVisible(target) {
    if (isWindow(target) || isDocument(target) || target === config.defaultRoot) {
        return true;
    }
    return isElementVisible(queryOne(target));
}

/**
 * @template T
 * @param {T} object
 * @returns {T is Window}
 */
export function isWindow(object) {
    return object && typeof object === "object" && object.window === object;
}

/**
 * @param {HTMLElement} target
 * @param {MutationCallback} callback
 */
export function observe(target, callback) {
    if (!observers.has(target)) {
        const callbacks = new Set();
        const observer = new MutationObserver((...args) => {
            for (const callback of callbacks) {
                callback(...args);
            }
        });
        observer.observe(target, {
            subtree: true,
            attributes: true,
            childList: true,
        });
        observers.set(target, { callbacks, observer });
    }

    const { callbacks, observer } = observers.get(target);
    callbacks.add(callback);

    return function disconnect() {
        callbacks.delete(callback);
        if (!callbacks.size) {
            observer.disconnect();
            observers.delete(target);
        }
    };
}

/**
 * @param {Target} target
 * @param {QueryOptions} [options]
 */
export function queryAll(target, options) {
    /**
     * @param {...Node} nodes
     * @returns {Element[]}
     */
    const _filter = (...nodes) => {
        const elements = [];
        for (let node of nodes) {
            if (isDocument(node)) {
                node = node.body;
            }
            if (isElement(node) && !elements.includes(node)) {
                elements.push(node);
            }
        }
        return elements;
    };

    /** @type {Element[]} */
    let elements = [];
    let selector;

    if (typeof target === "string") {
        if (target in ROOT_SPECIAL_SELECTORS) {
            elements = _filter(ROOT_SPECIAL_SELECTORS[target]);
        } else {
            elements = _filter(options?.root || config.defaultRoot);
            selector = target;
        }
        // HTMLSelectElement is iterable ¯\_(ツ)_/¯
    } else if (isIterable(target) && !(target && target.tagName === "SELECT")) {
        elements = _filter(...target);
    } else {
        elements = _filter(target);
    }

    if (selector && elements.length) {
        // Sets splits and filters
        /** @type {(number | ReturnType<PseudoClassFilterBuilder>)[]} */
        const splitsAndFilters = [0];
        const matches = selector.matchAll(PSEUDO_SELECTOR_REGEX);
        for (const match of matches) {
            const [fullMatch, pseudo, , content] = match;
            if (customPseudoClasses.has(pseudo)) {
                const makeFilter = customPseudoClasses.get(pseudo);
                splitsAndFilters.push(
                    match.index,
                    makeFilter(content),
                    match.index + fullMatch.length
                );
            }
        }

        // Applies splits and filters
        for (let i = 0; i < splitsAndFilters.length; i += 3) {
            const [start, end, filter] = splitsAndFilters.slice(i, i + 3);
            const nextNodes = [];
            let currentSelector = selector.slice(start, end);
            if (filter && !/[\w)\]-]$/.test(currentSelector)) {
                currentSelector += "*";
            } else if (!currentSelector) {
                continue;
            }
            for (const element of elements) {
                const children = element.querySelectorAll(currentSelector);
                for (let i = 0; i < children.length; i++) {
                    const result = filter ? filter(children[i], i, children) : true;
                    if (result === true) {
                        nextNodes.push(children[i]);
                    } else if (result) {
                        nextNodes.push(result);
                    }
                }
            }

            elements = _filter(...nextNodes);
        }
    }

    /** @type {string[]} */
    const prefixes = [];

    if (options?.focusable) {
        elements = elements.filter(isElementFocusable);
        prefixes.push("focusable");
    }

    if (options?.scrollable) {
        elements = elements.filter(isElementScrollable);
        prefixes.push("scrollable");
    }

    if (options?.visible) {
        elements = elements.filter(isElementVisible);
        prefixes.push("visible");
    }

    if (options?.ensureOne && elements.length !== 1) {
        throw new Error(
            [
                "Found",
                elements.length,
                prefixes.join(" and "),
                `element${elements.length === 1 ? "" : "s"} instead of 1`,
                typeof target === "string" ? `(selector: "${target}")` : "",
            ].join(" ")
        );
    }

    return elements;
}

/**
 * @param {Target} target
 * @param {QueryOptions} [options]
 */
export function queryOne(target, options) {
    if (options && options.ensureOne === false) {
        throw new Error(
            `'queryOne' with 'ensureOne=false' may have unexpected behaviours. Please use 'queryAll' instead.`
        );
    }
    return queryAll(target, { ensureOne: true, ...options })[0];
}

/**
 * @param {HTMLElement} element
 * @param {{ object?: boolean }} [options]
 */
export function toSelector(element, options) {
    const parts = {
        tag: element.tagName.toLowerCase(),
    };
    if (element.id) {
        parts.id = `#${element.id}`;
    }
    if (element.classList.length) {
        parts.class = `.${[...element.classList].join(".")}`;
    }
    return options?.object ? parts : parts.join("");
}

export const config = {
    defaultRoot: null,
    defaultView: window.top,
};
