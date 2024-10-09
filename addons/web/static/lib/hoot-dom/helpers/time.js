/** @odoo-module */

import { HootDomError } from "../hoot_dom_utils";

/**
 * @typedef DateSpecs
 * @property {number} [year]
 * @property {number} [month] // 1-12
 * @property {number} [day] // 1-31
 * @property {number} [hour] // 0-23
 * @property {number} [minute] // 0-59
 * @property {number} [second] // 0-59
 * @property {number} [millisecond] // 0-999
 *
 * @typedef {{
 *  handler: () => any;
 *  cancel: () => any;
 *  init: number;
 *  delay: number;
 * }} TimerValues
 */

//-----------------------------------------------------------------------------
// Internal
//-----------------------------------------------------------------------------

/**
 * @param {number} id
 */
const animationToId = (id) => ID_PREFIX.animation + String(id);

const getNextTimerValues = () => {
    /** @type {[number, () => any, string] | null} */
    let timerValues = null;
    for (const [internalId, { handler, init, delay }] of timers.entries()) {
        const timeout = init + delay;
        if (!timerValues || timeout < timerValues[0]) {
            timerValues = [timeout, handler, internalId];
        }
    }
    return timerValues;
};

/**
 * @param {number} id
 */
const intervalToId = (id) => ID_PREFIX.interval + String(id);

const now = () => performance.now() + timeOffset;

/**
 * @param {number} id
 */
const timeoutToId = (id) => ID_PREFIX.timeout + String(id);

const ID_PREFIX = {
    animation: "a_",
    interval: "i_",
    timeout: "t_",
};

/** @type {Map<string, TimerValues>} */
const timers = new Map();

let allowTimers = true;
let freezed = false;
let frameDelay = 1000 / 60;
let timeOffset = 0;

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

/**
 * @param {number} [frameCount]
 */
export function advanceFrame(frameCount) {
    return advanceTime(frameDelay * $max(1, frameCount));
}

/**
 * Advances the current time by the given amount of milliseconds. This will
 * affect all timeouts, intervals, animations and date objects.
 *
 * It returns a promise resolved after all related callbacks have been executed.
 *
 * @param {number} ms
 * @returns {Promise<number>} time consumed by timers (in ms).
 */
export function advanceTime(ms) {
    const targetTime = now() + ms;
    let remaining = ms;
    /** @type {ReturnType<typeof getNextTimerValues>} */
    let timerValues;
    while ((timerValues = getNextTimerValues()) && timerValues[0] <= targetTime) {
        const [timeout, handler, id] = timerValues;
        const diff = timeout - now();
        if (diff > 0) {
            timeOffset += Math.min(remaining, diff);
            remaining = Math.max(remaining - diff, 0);
        }
        if (timers.has(id)) {
            handler(timeout);
        }
    }

    if (remaining > 0) {
        timeOffset += remaining;
    }

    // Waits for callbacks to execute
    return animationFrame().then(() => ms);
}

/**
 * Returns a promise resolved after the next animation frame, typically allowing
 * Owl components to render.
 *
 * @returns {Deferred<void>}
 */
export function animationFrame() {
    return new Deferred((resolve) => requestAnimationFrame(() => delay().then(resolve)));
}

/**
 * Cancels all current timeouts, intervals and animations.
 */
export function cancelAllTimers() {
    for (const { cancel } of timers.values()) {
        cancel();
    }
}

export function cleanupTime() {
    cancelAllTimers();

    freezed = false;
}

/**
 * Returns a promise resolved after a given amount of milliseconds (default to 0).
 *
 * @param {number} [duration]
 * @returns {Deferred<void>}
 * @example
 *  await delay(1000); // waits for 1 second
 */
export function delay(duration) {
    return new Deferred((resolve) => setTimeout(resolve, duration));
}

/**
 * @param {boolean} setFreeze
 */
export function freezeTime(setFreeze) {
    freezed = setFreeze ?? !freezed;
}

export function getTimeOffset() {
    return timeOffset;
}

export function isTimeFreezed() {
    return freezed;
}

/**
 * Returns a promise resolved after the next microtask tick.
 *
 * @returns {Promise<void>}
 */
export function microTick() {
    return Deferred.resolve();
}

/**
 * @param {Window} window
 * @returns {typeof cancelAnimationFrame}
 */
export function mockedCancelAnimationFrame(window) {
    return function (handle) {
        window.cancelAnimationFrame(handle);
        timers.delete(animationToId(handle));
    };
}

/**
 * @param {Window} window
 * @returns {typeof clearInterval}
 */
export function mockedClearInterval({ clearInterval }) {
    return function (intervalId) {
        clearInterval(intervalId);
        timers.delete(intervalToId(intervalId));
    };
}

/**
 * @param {Window} window
 * @returns {typeof clearTimeout}
 */
export function mockedClearTimeout({ clearTimeout }) {
    return function (timeoutId) {
        clearTimeout(timeoutId);
        timers.delete(timeoutToId(timeoutId));
    };
}

/**
 * @param {Window} window
 * @returns {typeof requestAnimationFrame}
 */
export function mockedRequestAnimationFrame({ cancelAnimationFrame, requestAnimationFrame }) {
    return function (callback) {
        if (!allowTimers) {
            return 0;
        }

        const cancel = () => cancelAnimationFrame(handle);

        const handler = () => {
            cancel();
            return callback(now());
        };

        const init = now();
        const handle = requestAnimationFrame(handler);
        const internalId = animationToId(handle);
        timers.set(internalId, { handler, cancel, init, delay: frameDelay });

        return handle;
    };
}

/**
 * @param {Window} window
 * @returns {typeof setInterval}
 */
export function mockedSetInterval({ clearInterval, setInterval }) {
    return function (callback, ms, ...args) {
        if (!allowTimers) {
            return 0;
        }

        if (isNaN(ms) || !ms || ms < 0) {
            ms = 0;
        }

        const cancel = () => clearInterval(intervalId);

        const handler = () => {
            if (allowTimers) {
                intervalValues.init = Math.max(now(), intervalValues.init + ms);
            } else {
                cancel();
            }
            return callback(...args);
        };

        const init = now();
        const intervalValues = { handler, cancel, init, delay: ms };
        const intervalId = setInterval(handler, ms);
        const internalId = intervalToId(intervalId);
        timers.set(internalId, intervalValues);

        return intervalId;
    };
}

/**
 * @param {Window} window
 * @returns {typeof setTimeout}
 */
export function mockedSetTimeout({ clearTimeout, setTimeout }) {
    return function (callback, ms, ...args) {
        if (!allowTimers) {
            return 0;
        }

        if (isNaN(ms) || !ms || ms < 0) {
            ms = 0;
        }

        const cancel = () => clearTimeout(timeoutId);

        const handler = () => {
            cancel();
            return callback(...args);
        };

        const init = now();
        const timeoutId = setTimeout(handler, ms);
        const internalId = timeoutToId(timeoutId);
        timers.set(internalId, { handler, cancel, init, delay: ms });

        return timeoutId;
    };
}

export function resetTimeOffset() {
    timeOffset = 0;
}

/**
 * Calculates the amount of time needed to run all current timeouts, intervals and
 * animations, and then advances the current time by that amount.
 *
 * @see {@link advanceTime}
 * @param {boolean} [preventTimers=false]
 * @returns {Promise<number>} time consumed by timers (in ms).
 */
export async function runAllTimers(preventTimers = false) {
    if (!timers.size) {
        return 0;
    }

    if (preventTimers) {
        allowTimers = false;
    }

    const endts = Math.max(...[...timers.values()].map(({ init, delay }) => init + delay));
    const ms = await advanceTime(Math.ceil(endts - now()));

    if (preventTimers) {
        allowTimers = true;
    }

    return ms;
}

/**
 * Sets the current frame rate (in fps) used by animation frames (default to 60fps).
 *
 * @param {number} frameRate
 */
export function setFrameRate(frameRate) {
    if (!Number.isInteger(frameRate) || frameRate <= 0 || frameRate > 1000) {
        throw new Error("frame rate must be an number between 1 and 1000");
    }
    frameDelay = 1000 / frameRate;
}

/**
 * Returns a promise resolved after the next task tick.
 *
 * @returns {Deferred<void>}
 */
export function tick() {
    return delay();
}

/**
 * Returns a promise fulfilled when the given `predicate` returns a truthy value,
 * with the value of the promise being the return value of the `predicate`.
 *
 * The `predicate` is run once initially, and then on each animation frame until
 * it succeeds or fail.
 *
 * The promise automatically rejects after a given `timeout` (defaults to 5 seconds).
 *
 * @template T
 * @param {() => T} predicate
 * @param {WaitOptions} [options]
 * @returns {Deferred<T>}
 * @example
 *  await waitUntil(() => []); // -> []
 * @example
 *  const button = await waitUntil(() => queryOne("button:visible"));
 *  button.click();
 */
export function waitUntil(predicate, options) {
    // Early check before running the loop
    const result = predicate();
    if (result) {
        return Deferred.resolve(result);
    }

    let handle;
    let timeoutId;
    return new Deferred((resolve, reject) => {
        const runCheck = () => {
            const result = predicate();
            if (result) {
                resolve(result);
            } else {
                handle = requestAnimationFrame(runCheck);
            }
        };

        const timeout = $floor(options?.timeout ?? 200);
        timeoutId = setTimeout(() => {
            // Last check before the timeout expires
            const result = predicate();
            if (result) {
                resolve(result);
            } else {
                let message =
                    options?.message || `'waitUntil' timed out after %timeout% milliseconds`;
                if (typeof message === "function") {
                    message = message();
                }
                reject(new HootDomError(message.replace("%timeout%", String(timeout))));
            }
        }, timeout);
        handle = requestAnimationFrame(runCheck);
    }).finally(() => {
        cancelAnimationFrame(handle);
        clearTimeout(timeoutId);
    });
}

/**
 * Manually resolvable and rejectable promise. It introduces 2 new methods:
 *  - {@link reject} rejects the deferred with the given reason;
 *  - {@link resolve} resolves the deferred with the given value.
 *
 * @template [T=unknown]
 */
export class Deferred extends Promise {
    /** @type {typeof Promise.resolve<T>} */
    _resolve;
    /** @type {typeof Promise.reject<T>} */
    _reject;

    /**
     * @param {(resolve: (value?: T) => any, reject: (reason?: any) => any) => any} [executor]
     */
    constructor(executor) {
        let _resolve, _reject;

        super((resolve, reject) => {
            _resolve = resolve;
            _reject = reject;
            executor?.(_resolve, _reject);
        });

        this._resolve = _resolve;
        this._reject = _reject;
    }

    /**
     * @param {any} [reason]
     */
    async reject(reason) {
        return this._reject(reason);
    }

    /**
     * @param {T} [value]
     */
    async resolve(value) {
        return this._resolve(value);
    }
}
