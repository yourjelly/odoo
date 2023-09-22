/** @odoo-module */

import { EventTarget, Map, Object, Set } from "../globals";
import { intercept } from "../intercept";
import { match } from "../utils";

/**
 * @param {import("../core/runner").TestRunner} runner
 */
export function makeCleanup(runner) {
    runner.beforeAnyTest(() => {
        acceptedGlobalKeys = new Set(Object.keys(window));
        cleanupFns.push(
            intercept(
                EventTarget.prototype,
                "addEventListener",
                function addEventListener(type, callback, options) {
                    if (options?.once) {
                        return;
                    }
                    if (!listenersMap.has(this)) {
                        listenersMap.set(this, {});
                    }
                    const elListeners = listenersMap.get(this);
                    if (!elListeners[type]) {
                        elListeners[type] = new Set();
                    }
                    elListeners[type].add(callback);
                }
            ),
            intercept(
                EventTarget.prototype,
                "removeEventListener",
                function removeEventListener(type, callback) {
                    if (!listenersMap.has(this)) {
                        return;
                    }
                    const elListeners = listenersMap.get(this);
                    if (!elListeners[type]) {
                        return;
                    }
                    elListeners[type].delete(callback);
                }
            )
        );
    });

    runner.afterAnyTest(() => {
        while (cleanupFns.length) {
            cleanupFns.pop()();
        }

        const keysDiff = Object.keys(window).filter((key) => !acceptedGlobalKeys.has(key));
        if (keysDiff.length) {
            console.warn(
                `Found`,
                keysDiff.length,
                `added keys on Window object after test:`,
                keysDiff
            );
            for (const key of keysDiff) {
                delete window[key];
            }
        }

        for (const [element, listeners] of listenersMap) {
            if (!match(element, "Window") && !match(element, "Document")) {
                continue;
            }
            for (const [type, callbacks] of Object.entries(listeners)) {
                if (callbacks.size) {
                    console.warn(
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

    let acceptedGlobalKeys;
    const cleanupFns = [];
    /** @type {Map<EventTarget, Record<string, Set<typeof EventTarget["prototype"]["addEventListener"]>>>} */
    const listenersMap = new Map();
}
