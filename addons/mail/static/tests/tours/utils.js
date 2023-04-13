/** @odoo-module **/

import { isMacOS } from "@web/core/browser/feature_detection";

export const assert = {
    n(selector, n) {
        const $res = $(selector);
        if ($res.length !== n) {
            console.error(
                `Failed to assert.n("${selector}"). Expected ${n} matches, found ${$res.length}`
            );
        }
    },
    none(selector) {
        const $res = $(selector);
        if ($res.length !== 0) {
            console.error(
                `Failed to assert.none("${selector}"). Expected 0 matches, found ${$res.length}`
            );
        }
    },
    once(selector) {
        const $res = $(selector);
        if ($res.length !== 1) {
            console.error(
                `Failed to assert.once("${selector}"). Expected 1 match, found ${$res.length}`
            );
        }
    },
    equal(a, b) {
        if (a !== b) {
            console.error(`Failed to assert.equal(${a}, ${b}): `, a, b);
        }
    },
    ok(expr) {
        if (!expr) {
            console.error(`Failed to assert.ok(${expr}): `, expr);
        }
    },
    notOk(expr) {
        if (expr) {
            console.error(`Failed to assert.notOk(${expr}): `, expr);
        }
    },
};

// Provide a seed for tour that guarantees no collision around 5 days.
// As long as no one asks for a seed during around the same second.
export function makeSeed() {
    return Math.round((new Date().getTime() % 1000_000_000) / 1000).toString(32);
}

/**
 * Triggers an hotkey properly disregarding the operating system.
 *
 * @param {string} hotkey
 * @param {boolean} addOverlayModParts
 * @param {KeyboardEventInit} eventAttrs
 * @returns {{ keydownEvent: KeyboardEvent, keyupEvent: KeyboardEvent }}
 */
export function triggerHotkey(hotkey, addOverlayModParts = false, eventAttrs = {}) {
    eventAttrs.key = hotkey.split("+").pop();

    if (/shift/i.test(hotkey)) {
        eventAttrs.shiftKey = true;
    }

    if (/control/i.test(hotkey)) {
        if (isMacOS()) {
            eventAttrs.metaKey = true;
        } else {
            eventAttrs.ctrlKey = true;
        }
    }

    if (/alt/i.test(hotkey) || addOverlayModParts) {
        if (isMacOS()) {
            eventAttrs.ctrlKey = true;
        } else {
            eventAttrs.altKey = true;
        }
    }

    if (!("bubbles" in eventAttrs)) {
        eventAttrs.bubbles = true;
    }

    const keydownEvent = new KeyboardEvent("keydown", eventAttrs);
    const keyupEvent = new KeyboardEvent("keyup", eventAttrs);
    document.activeElement.dispatchEvent(keydownEvent);
    document.activeElement.dispatchEvent(keyupEvent);
    return { keydownEvent, keyupEvent };
}
