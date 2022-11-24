/** @odoo-module **/

import { browser } from "../browser/browser";

const hashPartsSequence = {
    action: 10,
    menu_id: 20,
    model: 30,
    cids: 40,
};

function prepareObject(obj) {
    const result = {};
    for (const key in obj) {
        if (["view_type", "id", "active_id"].includes(key)) {
            // handled below
            continue;
        }
        if (key === "model") {
            result[key] = {
                model: obj[key],
                res_id: obj.id,
                active_id: obj.active_id,
                view_type: obj.view_type,
            };
            continue;
        }
        if (key === "cids") {
            result[key] = `${obj[key]}`.split(",");
            continue;
        }
        result[key] = obj[key];
    }
    return result;
}

function getValueFormatter(type) {
    switch (type) {
        case "menu_id":
            return (v) => `~${v}`;
        case "action":
            return (v) => `${v}`;
        case "model":
            return (v) => {
                const parts = [v.model];
                if (v.active_id) {
                    parts.push(`@${v.active_id}`);
                }
                if (v.view_type && v.view_type !== "form") {
                    parts.push(v.view_type);
                }
                if (v.res_id) {
                    parts.push(v.res_id);
                }
                return parts.join("/");
            };
        case "cids":
            return (v) => `cids-${v.join("-")}`;
        default:
            return (v) => encodeURIComponent(v || "");
    }
}

/**
 * Transforms a key value mapping to a string formatted as url hash, e.g.
 * {a: "x", b: 2} -> "a=x&b=2"
 *
 * @param {Object} obj
 * @returns {string}
 */
export function objectToUrlEncodedString(obj) {
    return Object.entries(prepareObject(obj))
        .sort((a, b) => (hashPartsSequence[a[0]] || 50) - (hashPartsSequence[b[0]] || 50))
        .map(([key, value]) => getValueFormatter(key)(value))
        .join("/");
}

/**
 * Gets the origin url of the page, or cleans a given one
 *
 * @param {string} [origin]: a given origin url
 * @return {string} a cleaned origin url
 */
export function getOrigin(origin) {
    if (origin) {
        // remove trailing slashes
        origin = origin.replace(/\/+$/, "");
    } else {
        const { host, protocol } = browser.location;
        origin = `${protocol}//${host}`;
    }
    return origin;
}

/**
 * @param {string} route: the relative route, or absolute in the case of cors urls
 * @param {object} [queryParams]: parameters to be appended as the url's queryString
 * @param {object} [options]
 * @param {string} [options.origin]: a precomputed origin
 */
export function url(route, queryParams, options = {}) {
    const origin = getOrigin(options.origin);
    if (!route) {
        return origin;
    }

    let queryString = objectToUrlEncodedString(queryParams || {});
    queryString = queryString.length > 0 ? `?${queryString}` : queryString;

    // Compare the wanted url against the current origin
    let prefix = ["http://", "https://", "//"].some(
        (el) => route.length >= el.length && route.slice(0, el.length) === el
    );
    prefix = prefix ? "" : origin;
    return `${prefix}${route}${queryString}`;
}

/**
 * Gets dataURL (base64 data) from the given file or blob.
 * Technically wraps FileReader.readAsDataURL in Promise.
 *
 * @param {Blob | File} file
 * @returns {Promise} resolved with the dataURL, or rejected if the file is
 *  empty or if an error occurs.
 */
export function getDataURLFromFile(file) {
    if (!file) {
        return Promise.reject();
    }
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.addEventListener("load", () => resolve(reader.result));
        reader.addEventListener("abort", reject);
        reader.addEventListener("error", reject);
        reader.readAsDataURL(file);
    });
}
