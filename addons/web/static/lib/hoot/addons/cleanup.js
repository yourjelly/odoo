/** @odoo-module */

import { cleanupDOM, cleanupObservers } from "@odoo/hoot/helpers";
import { Map, Object, Set, document } from "../globals";
import { intercept, log } from "../utils";

const INSPECTED_ELEMENTS = [window, document];

/**
 * @param {import("../core/runner").TestRunner} runner
 */
export function makeCleanup(runner) {
    runner.beforeAnyTest(() => {
        for (const element of INSPECTED_ELEMENTS) {
            const { prototype } = element.constructor;
            const listeners = {};
            acceptedKeys.set(element, new Set(Object.keys(element)));
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
        while (cleanupFns.length) {
            cleanupFns.pop()();
        }

        cleanupDOM();
        cleanupObservers();

        for (const element of INSPECTED_ELEMENTS) {
            // Check keys
            const keys = acceptedKeys.get(element);
            const keysDiff = Object.keys(element).filter((key) => !keys.has(key));
            if (keysDiff.length) {
                log.warn(
                    `Found`,
                    keysDiff.length,
                    `added keys on ${element.constructor.name} object after test:`,
                    keysDiff
                );
                for (const key of keysDiff) {
                    delete element[key];
                }
            }

            // Check listeners
            for (const [type, callbacks] of Object.entries(listenersMap.get(element))) {
                if (callbacks.size) {
                    log.warn(
                        `Element`,
                        element.constructor.name,
                        `has`,
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

    /** @type {Map<typeof INSPECTED_ELEMENTS[number], Set<string>>} */
    const acceptedKeys = new Map();
    const cleanupFns = [];
    /** @type {Map<typeof INSPECTED_ELEMENTS[number], Record<string, Set<typeof EventTarget["prototype"]["addEventListener"]>>>} */
    const listenersMap = new Map();
}
