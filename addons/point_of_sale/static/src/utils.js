import { parseDateTime } from "@web/core/l10n/dates";
import { effect } from "@web/core/utils/reactive";

/*
 * comes from o_spreadsheet.js
 * https://stackoverflow.com/questions/105034/create-guid-uuid-in-javascript
 * */
export function uuidv4() {
    // mainly for jest and other browsers that do not have the crypto functionality
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
        const r = (Math.random() * 16) | 0,
            v = c == "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

/**
 * Formats the given `url` with correct protocol and port.
 * Useful for communicating to local iot box instance.
 * @param {string} url
 * @returns {string}
 */
export function deduceUrl(url) {
    const { protocol } = window.location;
    if (!url.includes("//")) {
        url = `${protocol}//${url}`;
    }
    if (url.indexOf(":", 6) < 0) {
        url += ":" + (protocol === "https:" ? 443 : 8069);
    }
    return url;
}

export function constructFullProductName(line) {
    let attributeString = "";

    if (line.attribute_value_ids && line.attribute_value_ids.length > 0) {
        for (const value of line.attribute_value_ids) {
            if (value.is_custom) {
                const customValue = line.custom_attribute_value_ids.find(
                    (cus) =>
                        cus.custom_product_template_attribute_value_id?.id == parseInt(value.id)
                );
                if (customValue) {
                    attributeString += `${value.attribute_id.name}: ${value.name}: ${customValue.custom_value}, `;
                }
            } else {
                attributeString += `${value.name}, `;
            }
        }

        attributeString = attributeString.slice(0, -2);
        attributeString = ` (${attributeString})`;
    }

    return `${line?.product_id?.name}${attributeString}`;
}
/**
 * Returns a random 5 digits alphanumeric code
 * @returns {string}
 */
export function random5Chars() {
    let code = "";
    while (code.length != 5) {
        code = Math.random().toString(36).slice(2, 7);
    }
    return code;
}

export function qrCodeSrc(url, { size = 200 } = {}) {
    return `/report/barcode/QR/${encodeURIComponent(url)}?width=${size}&height=${size}`;
}

/**
 * @template T
 * @param {T[]} entries - The array of objects to search through.
 * @param {Function} [criterion=(x) => x] - A function that returns a number for each entry. The entry with the highest value of this function will be returned. If not provided, defaults to an identity function that returns the entry itself.
 * @param {boolean} [inverted=false] - If true, the entry with the lowest value of the criterion function will be returned instead.
 * @returns {T} The entry with the highest or lowest value of the criterion function, depending on the value of `inverted`.
 */
export function getMax(entries, { criterion = (x) => x, inverted = false } = {}) {
    return entries.reduce((prev, current) => {
        const res = criterion(prev) > criterion(current);
        return (inverted ? !res : res) ? prev : current;
    });
}
export function getMin(entries, options) {
    return getMax(entries, { ...options, inverted: true });
}
export function getOnNotified(bus, channel) {
    bus.addChannel(channel);
    return (notif, callback) => bus.subscribe(`${channel}-${notif}`, callback);
}

/**
 * Loading image is converted to a Promise to allow await when
 * loading an image. It resolves to the loaded image if successful,
 * else, resolves to false.
 *
 * [Source](https://stackoverflow.com/questions/45788934/how-to-turn-this-callback-into-a-promise-using-async-await)
 */
export function loadImage(url, options = {}) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.addEventListener("load", () => resolve(img));
        img.addEventListener("error", () => {
            if (options.onError) {
                options.onError();
            }
            reject(new Error(`Failed to load image at ${url}`));
        });
        img.src = url;
    });
}

/**
 * Load all images in the given element.
 * @param {HTMLElement} el
 */
export function loadAllImages(el) {
    if (!el) {
        return Promise.resolve();
    }

    const images = el.querySelectorAll("img");
    return Promise.all(Array.from(images).map((img) => loadImage(img.src)));
}
export function parseUTCString(utcStr) {
    return parseDateTime(utcStr, { format: "yyyy-MM-dd HH:mm:ss", tz: "utc" });
}

export class Counter {
    constructor(start = 0) {
        this.value = start;
    }
    next() {
        this.value++;
        return this.value;
    }
}

export function getAllGetters(proto) {
    const getterNames = new Set();
    const getters = new Set();
    while (proto !== null) {
        const descriptors = Object.getOwnPropertyDescriptors(proto);
        for (const [name, descriptor] of Object.entries(descriptors)) {
            if (descriptor.get && !getterNames.has(name)) {
                getterNames.add(name);
                getters.add([name, descriptor.get]);
            }
        }
        proto = Object.getPrototypeOf(proto);
    }
    return getters;
}

export const proxyTrapUtil = (function () {
    const classGetters = new Map();

    function getGetters(Class) {
        if (!classGetters.has(Class)) {
            const getters = new Map();
            for (const [name, func] of getAllGetters(Class.prototype)) {
                if (name.startsWith("__") && name.endsWith("__")) {
                    continue;
                }
                getters.set(name, [
                    `__lazy_${name}`,
                    (obj) => {
                        return func.call(obj);
                    },
                ]);
            }
            classGetters.set(Class, getters);
        }
        return classGetters.get(Class);
    }

    let proxyTrapDisabled = 0;
    function withoutProxyTrap(fn) {
        return function (...args) {
            try {
                proxyTrapDisabled += 1;
                return fn(...args);
            } finally {
                proxyTrapDisabled -= 1;
            }
        };
    }
    function isDisabled() {
        return proxyTrapDisabled > 0;
    }
    return {
        isDisabled,
        withoutProxyTrap,
        defineLazyGetterTrap(Class) {
            const getters = getGetters(Class);
            return function get(target, prop, receiver) {
                if (isDisabled() || !getters.has(prop)) {
                    return Reflect.get(target, prop, receiver);
                }
                const getLazyGetterValue = withoutProxyTrap(() => {
                    const [lazyName] = getters.get(prop);
                    // For a getter, we should get the value from the receiver.
                    // Because the receiver is linked to the reactivity.
                    // We want to read the getter from it to make sure that the getter
                    // is part of the reactivity as well.
                    // To avoid infinite recursion, we disable this proxy trap
                    // during the time the lazy getter is accessed.
                    return receiver[lazyName];
                });
                return getLazyGetterValue();
            };
        },
        getGetters,
    };
})();

export function lazyComputed(obj, propName, compute) {
    const key = Symbol(propName);
    Object.defineProperty(obj, propName, {
        get() {
            return this[key]();
        },
        configurable: true,
    });

    effect(
        function recompute(obj) {
            const value = [];
            obj[key] = () => {
                if (!value.length) {
                    value.push(compute(obj));
                }
                return value[0];
            };
        },
        [obj]
    );
}
