/** @odoo-module **/

import { registry } from "../registry";

/**
 * Service to make use of document.cookie
 * https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies
 * As recommended, storage should not be done by the cookie
 * but with localStorage/sessionStorage
 */

const COOKIE_TTL = 24 * 60 * 60 * 365;

function parseCookieString(str) {
    const cookie = {};
    const parts = str.split("; ");
    for (const part of parts) {
        const [key, value] = part.split(/=(.*)/);
        cookie[key] = value || "";
    }
    return cookie;
}

function cookieToString(key, value, ttl = COOKIE_TTL) {
    let fullCookie = [];
    if (value !== undefined) {
        fullCookie.push(`${key}=${value}`);
    }
    fullCookie = fullCookie.concat(["path=/", `max-age=${ttl}`]);
    return fullCookie.join(";");
}

function makeCookieService() {
    function getCurrent() {
        return parseCookieString(document.cookie);
    }
    /**
     * Check if cookie can be written.
     *
     * @param {String} type the type of the cookie
     * @returns {boolean}
     */
    function isAllowedCookie(type) {
        return true;
    }
    let cookie = getCurrent();
    function setCookie(key, value, ttl = 24 * 60 * 60 * 365, type = "required") {
        ttl = isAllowedCookie(type) ? ttl : -1;
        document.cookie = cookieToString(key, value, ttl);
        cookie = getCurrent();
    }
    return {
        get current() {
            return cookie;
        },
        getCookie: (key) => cookie[key],
        setCookie,
        deleteCookie(key) {
            setCookie(key, "kill", 0);
        },
        isAllowedCookie,
    };
}

export const cookieService = {
    start() {
        return makeCookieService();
    },
};

registry.category("services").add("cookie", cookieService);
