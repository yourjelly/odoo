/** @odoo-module */

import { Map, Object, Set } from "../globals";
import { cleanupDOM, cleanupObservers, getDocument, getFixture, getWindow } from "../helpers/dom";
import { intercept, log } from "../utils";

/**
 * @param {import("./runner").TestRunner} runner
 */
export function makeCleanup(runner) {
    runner.beforeAnyTest(() => {
        if (runner.config.nocleanup) {
            return;
        }

        const fixture = getFixture();
        const document = getDocument(fixture);
        const window = getWindow(fixture);

        acceptedKeys.set(window, new Set(Object.keys(window)));

        for (const element of [fixture, document, window]) {
            const { prototype } = element.constructor;
            const listeners = {};
            listenersMap.set(element, listeners);
            cleanupFns.push(
                intercept(
                    prototype,
                    "addEventListener",
                    function addEventListener(type, callback, options) {
                        if (options?.once) {
                            return;
                        }
                        if (!listeners[type]) {
                            listeners[type] = new Set();
                        }
                        listeners[type].add(callback);
                    }
                ),
                intercept(
                    prototype,
                    "removeEventListener",
                    function removeEventListener(type, callback) {
                        listeners[type]?.delete(callback);
                    }
                )
            );
        }
    });

    runner.afterAnyTest(() => {
        if (runner.config.nocleanup) {
            return;
        }

        while (cleanupFns.length) {
            cleanupFns.pop()();
        }

        cleanupDOM();
        cleanupObservers();

        const fixture = getFixture();
        const document = getDocument(fixture);
        const window = getWindow(fixture);

        // Check keys
        const keys = acceptedKeys.get(window);
        const keysDiff = Object.keys(window).filter((key) => isNaN(key) && !keys.has(key));
        if (keysDiff.length) {
            log.warn(
                `Found`,
                keysDiff.length,
                `added keys on ${window.constructor.name} object after test:`,
                keysDiff
            );
            for (const key of keysDiff) {
                delete window[key];
            }
        }

        for (const element of [fixture, document, window]) {
            // Check listeners
            for (const [type, callbacks] of Object.entries(listenersMap.get(element))) {
                if (callbacks.size) {
                    log.warn(
                        `Element ${element.constructor.name} has`,
                        callbacks.size,
                        `event listeners left on "${type}" events.`
                    );
                    for (const callback of callbacks) {
                        element.removeEventListener(type, callback);
                    }
                }
            }
        }

        listenersMap.clear();
    });

    /** @type {Map<Document | Element | Window, Set<string>>} */
    const acceptedKeys = new Map();
    const cleanupFns = [];
    /** @type {Map<Document | Element | Window, Record<string, Set<typeof EventTarget["prototype"]["addEventListener"]>>>} */
    const listenersMap = new Map();
}
