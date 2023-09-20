/** @odoo-module */

import { Boolean, Date, Error, navigator, Number, Object, Promise } from "./globals";
import { isVisible, queryAll, queryOne } from "./helpers/dom";
import { deepEqual, formatHumanReadable, isIterable, MarkupHelper, match } from "./utils";

/**
 * @typedef {ArgumentPrimitive | `${ArgumentPrimitive}[]` | null} ArgumentDef
 *
 * @typedef {"any" | "boolean" | "number" | "string"} ArgumentPrimitive
 *
 * @typedef {{
 *  aborted: boolean;
 *  afterTestCallbacks: (() => any)[];
 *  assertions: ExpectResult[];
 *  duration: number,
 *  error: Error | null,
 *  pass: boolean,
 *  steps: string[],
 * }} CurrentResults
 */

/**
 * @template [T=unknown], [R=T]
 * @typedef {{
 *  transform?: (actual: T) => R;
 *  predicate: (actual: R) => boolean;
 *  message: (pass: boolean) => string;
 *  details: (actual: R) => any[];
 * }} MatcherSpecifications
 */

/**
 * @template Async
 * @typedef {{
 *  not?: boolean;
 *  rejects?: Async;
 *  resolves?: Async;
 * }} Modifiers
 */

//-----------------------------------------------------------------------------
// Internal
//-----------------------------------------------------------------------------

/**
 * @param {() => boolean} predicate
 * @param {string} errorMessage
 */
const ensure = (predicate, errorMessage) => {
    if (!predicate) {
        throw new Error(errorMessage);
    }
};

/**
 *
 * @param {unknown} value
 * @param {ArgumentDef} type
 * @returns {boolean}
 */
const ensureArgument = (value, type) => {
    if (typeof type === "string" && type.endsWith("[]")) {
        const itemType = type.slice(0, -2);
        return isIterable(value) && [...value].every((v) => ensureArgument(v, itemType));
    }
    switch (type) {
        case null:
            return value === null || value === undefined;
        case "any":
            return true;
        case "string":
            return typeof value === "string";
        case "number":
            return typeof value === "number";
        case "boolean":
            return typeof value === "boolean";
        default:
            return false;
    }
};

/**
 * @param {[unknown, ArgumentDef | ArgumentDef[]][]} argumentsDef
 */
const ensureArguments = (argumentsDef) => {
    for (let i = 0; i < argumentsDef.length; i++) {
        const [value, acceptedType] = argumentsDef[i];
        const types = isIterable(acceptedType) ? [...acceptedType] : [acceptedType];
        ensure(
            types.some((type) => ensureArgument(value, type)),
            `Expected argument ${i} to be of type ${types.join(" or ")}`
        );
    }
};

/**
 * @param {string} message
 * @param {{ actual: unknown; not: boolean }} params
 */
const formatMessage = (message, { actual, not }) => {
    return message
        .replace(NOT_REGEX, (_, ifTrue, ifFalse) => (not ? ifFalse || "" : ifTrue || ""))
        .replace(ACTUAL_REGEX, formatHumanReadable(actual));
};

/** @param {string} stack */
const formatStack = (stack) => {
    const lines = stack
        .toString()
        .split("\n")
        .map((v) => MarkupHelper.text(v.trim()));
    return isFirefox ? lines : lines.slice(1);
};

const ACTUAL_REGEX = /%actual%/i;
const NOT_REGEX = /\[([\w\s])*!([\w\s]*)\]/;
const isFirefox = navigator.userAgent.includes("Firefox");

/** @type {CurrentResults | null} */
let currentResults = null;
let nextResultId = 1;

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

export function setupExpect() {
    const setStatus = (status) => {
        if ("aborted" in status) {
            currentResults.aborted = true;
        }
        if ("error" in status) {
            currentResults.error = status.error;
            currentResults.pass = false;
        }
        if ("pass" in status) {
            currentResults.pass = status.pass;
        }
    };

    const tearDown = async () => {
        while (currentResults.afterTestCallbacks.length) {
            await currentResults.afterTestCallbacks.pop()();
        }

        const results = {
            ...currentResults,
            duration: Date.now() - startTime,
        };
        currentResults = null;

        return results;
    };

    if (currentResults) {
        throw new Error("Cannot setup expect: results already exist");
    }

    const startTime = Date.now();
    currentResults = {
        aborted: false,
        afterTestCallbacks: [],
        assertions: [],
        duration: 0,
        error: null,
        pass: true,
        steps: [],
    };

    return { setStatus, tearDown };
}

/**
 * @template T
 * @template [Async=false]
 */
export class Matchers {
    /** @type {Record<string, (...args: any[]) => MatcherSpecifications>} */
    static registry = Object.create(null);

    /** @type {T} */
    #actual = null;
    /** @type {Modifiers} */
    #modifiers = {
        not: false,
        rejects: false,
        resolves: false,
    };
    /** @type {Promise<T> | null} */
    #promise = null;
    /** @type {string} */
    #stack = "";

    /**
     * Returns a set of matchers expecting a result opposite to what normal matchers
     * would expect.
     *
     * @example ```js
     *  expect(false).not.toBeTruthy();
     *  expect("foo").not.toBe("bar");
     * ```
     */
    get not() {
        if (this.#modifiers.not) {
            throw new Error(`Invalid modifier "not": cannot negate a negated matcher.`);
        }
        return new Matchers(this.#actual, { ...this.#modifiers, not: true });
    }

    /**
     * Returns a set of matchers which will await the received value as a promise
     * and will be applied to a value rejected by that promise. The matcher will
     * throw an error should the promise resolve instead of being rejected.
     *
     * @returns {Matchers<T, true>}
     * @example ```js
     *  expect(Promise.reject("foo")).rejects.toBe("foo");
     * ```
     */
    get rejects() {
        if (this.#promise) {
            throw new Error(
                `Invalid modifier "rejects": received value has already been wrapped in a \`Promise.resolve()\`.`
            );
        }
        return new Matchers(this.#actual, { ...this.#modifiers, rejects: true });
    }

    /**
     * Returns a set of matchers which will await the received value as a promise
     * and will be applied to a value resolved by that promise. The matcher will
     * throw an error should the promise reject instead of being resolved.

     * @returns {Matchers<T, true>}
     * @example ```js
     *  expect(Promise.resolve("foo")).resolves.toBe("foo");
     * ```
     */
    get resolves() {
        if (this.#promise) {
            throw new Error(
                `Invalid modifier "resolves": received value has already been wrapped in a \`Promise.resolve()\`.`
            );
        }
        return new Matchers(this.#actual, { ...this.#modifiers, resolves: true });
    }

    /**
     * @param {T} actual
     * @param {Modifiers<Async>} modifiers
     */
    constructor(actual, modifiers) {
        this.#modifiers = modifiers;

        if (this.#modifiers.rejects || this.#modifiers.resolves) {
            this.#promise = Promise.resolve(this.#actual)
                .then(
                    /** @param {PromiseFulfilledResult<T>} reason */
                    (result) => {
                        if (this.#modifiers.rejects) {
                            throw new Error(
                                `Expected promise to reject, instead resolved with: ${result}`
                            );
                        }
                        this.#actual = result;
                    }
                )
                .catch(
                    /** @param {PromiseRejectedResult} reason */
                    (reason) => {
                        if (this.#modifiers.resolves) {
                            throw new Error(
                                `Expected promise to resolve, instead rejected with: ${reason}`,
                                { cause: reason }
                            );
                        }
                        this.#actual = reason;
                    }
                );
        } else {
            this.#actual = actual;
        }

        for (const [fnName, fn] of Object.entries(this.constructor.registry)) {
            const resolve = this.#resolve;
            this[fnName] = {
                [fnName](...args) {
                    // TODO: fix
                    // this.#stack = new Error().stack;

                    return resolve(fn(...args));
                },
            }[fnName];
        }
    }

    /**
     * Expects the received value to be strictly equal to the `expected` value.
     *
     * @param {T} expected
     * @param {string} [message=""]
     * @example ```js
     *  expect("foo").toBe("foo");
     *  expect({ foo: 1 }).not.toBe({ foo: 1 });
     * ```
     */
    toBe(expected, message = "") {
        this.#stack = new Error().stack;

        ensureArguments([
            [expected, "any"],
            [message, ["string", null]],
        ]);

        return this.#resolve({
            predicate: (actual) => actual === expected,
            message: (pass) =>
                message ||
                (pass
                    ? `%actual% is[! not] strictly equal to ${formatHumanReadable(expected)}`
                    : `expected values to be strictly equal`),
            details: (actual) => [
                [MarkupHelper.green("Expected:"), expected],
                [MarkupHelper.red("Received:"), actual],
                [MarkupHelper.text("Diff:"), MarkupHelper.diff(expected, actual)],
            ],
        });
    }

    /**
     * Expects the received value to be strictly between `min` and `max`.
     *
     * @param {number | [number, number]} min
     * @param {number | string} [max]
     * @param {string} [message=""]
     * @example ```js
     *  expect(5).toBeBetween(3, 9);
     *  expect(-8).toBeBetween([-10, 0]);
     * ```
     */
    toBeBetween(min, max, message = "") {
        this.#stack = new Error().stack;

        if (isIterable(min)) {
            message = max;
            [min, max] = min;
        }

        ensureArguments([
            [min, "number"],
            [max, "number"],
            [message, ["string", null]],
        ]);

        ensure(
            min <= max,
            `Expected the first argument to be smaller than the second, got ${min} and ${max}`
        );

        return this.#resolve({
            predicate: (actual) => min < actual && actual < max,
            message: (pass) =>
                message ||
                (pass
                    ? `%actual% is[! not] between ${formatHumanReadable(
                          min
                      )} and ${formatHumanReadable(max)}`
                    : `expected value to[! not] be between given range`),
            details: (actual) => [
                [MarkupHelper.green("Expected:"), `${min} - ${max}`],
                [MarkupHelper.red("Received:"), actual],
            ],
        });
    }

    /**
     * Expects the received value to be strictly greater than `max`.
     *
     * @param {number} max
     * @param {string} [message=""]
     * @example ```js
     *  expect(5).toBeGreaterThan(-1);
     *  expect(4 + 2).toBeGreaterThan(5);
     * ```
     */
    toBeGreaterThan(max, message = "") {
        this.#stack = new Error().stack;

        ensureArguments([
            [max, "number"],
            [message, ["string", null]],
        ]);

        return this.#resolve({
            predicate: (actual) => max < actual,
            message: (pass) =>
                message ||
                (pass
                    ? `%actual% is[! not] strictly greater than ${formatHumanReadable(max)}`
                    : `expected value to[! not] be strictly greater`),
            details: (actual) => [
                [MarkupHelper.green("Expected:"), max],
                [MarkupHelper.red("Received:"), actual],
            ],
        });
    }

    /**
     * Expects the received value to be strictly less than `min`.
     *
     * @param {number} min
     * @param {string} [message=""]
     * @example ```js
     *  expect(5).toBeLessThan(10);
     *  expect(8 - 6).toBeLessThan(3);
     * ```
     */
    toBeLessThan(min, message = "") {
        this.#stack = new Error().stack;

        ensureArguments([
            [min, "number"],
            [message, ["string", null]],
        ]);

        return this.#resolve({
            predicate: (actual) => actual < min,
            message: (pass) =>
                message ||
                (pass
                    ? `%actual% is[! not] strictly less than ${formatHumanReadable(min)}`
                    : `expected value to[! not] be strictly less`),
            details: (actual) => [
                [MarkupHelper.green("Expected:"), min],
                [MarkupHelper.red("Received:"), actual],
            ],
        });
    }

    /**
     * Expects the received value to resolve to a truthy expression.
     *
     * @param {string} [message=""]
     * @example ```js
     *  expect(true).toBeTruthy();
     *  expect([]).toBeTruthy();
     * ```
     */
    toBeTruthy(message = "") {
        this.#stack = new Error().stack;

        ensureArguments([[message, ["string", null]]]);

        return this.#resolve({
            predicate: Boolean,
            message: (pass) =>
                message ||
                (pass ? `%actual% is[! not] truthy` : `expected value[! not] to be truthy`),
            details: (actual) => [[MarkupHelper.red("Received:"), actual]],
        });
    }

    /**
     * Expects the received value (`Element`) to be visible in the current view.
     *
     * @param {string} [message=""]
     * @example ```js
     *  expect(document.body).toBeVisible();
     *  expect(document.createElement("div")).not.toBeVisible();
     * ```
     */
    toBeVisible(message = "") {
        this.#stack = new Error().stack;

        ensureArguments([[message, ["string", null]]]);

        return this.#resolve({
            predicate: isVisible,
            message: (pass) =>
                message ||
                (pass ? `%actual% is[! not] visible` : `expected target to be [visible!invisible]`),
            details: (actual) => [[MarkupHelper.red("Received:"), actual]],
        });
    }

    /**
     * Expects the received value (`Element`) to contain a certain `amount` of elements
     * matching the given `target` matcher:
     * - `"any"`: at least one matching element
     * - `number`: exactly <number> element(s)
     *
     * @param {import("../helpers/dom").Target} target
     * @param {number | "any"} [amount="any"]
     * @param {string} [message=""]
     * @example ```js
     *  expect("body").toContain("div.o_webclient", 1);
     *  expect("ul").toContain("li", 4);
     * ```
     */
    toContain(target, amount = "any", message = "") {
        this.#stack = new Error().stack;

        ensureArguments([
            [target, ["any"]],
            [amount, ["string", "number", null]],
            [message, ["string", null]],
        ]);

        let found;
        return this.#resolve({
            transform: (actual) => {
                const root = queryOne(actual);
                found = queryAll(target, { root });
                return root;
            },
            predicate: () => (amount === "any" ? Boolean(found.length) : found.length === amount),
            message: (pass) =>
                message ||
                (pass
                    ? `element %actual% [contains!does not contain] ${formatHumanReadable(
                          amount
                      )} elements matching ${formatHumanReadable(target)}`
                    : `element does not have the correct amount of matches`),
            details: (actual) => [
                [MarkupHelper.green("Expected:"), amount],
                [MarkupHelper.red("Received:"), found.length],
                [MarkupHelper.text("Parent:"), actual],
                [MarkupHelper.text("Matching:"), found],
            ],
        });
    }

    /**
     * Expects the received value to be deeply equal to the `expected` value.
     *
     * @param {T} expected
     * @param {string} [message=""]
     * @example ```js
     *  expect("foo").toEqual("foo");
     *  expect({ foo: 1 }).toEqual({ foo: 1 });
     * ```
     */
    toEqual(expected, message = "") {
        this.#stack = new Error().stack;

        ensureArguments([
            [expected, "any"],
            [message, ["string", null]],
        ]);

        return this.#resolve({
            predicate: (actual) => deepEqual(actual, expected),
            message: (pass) =>
                message ||
                (pass
                    ? `%actual% is[! not] deeply equal to ${formatHumanReadable(expected)}`
                    : `expected values to be deeply equal`),
            details: (actual) => [
                [MarkupHelper.green("Expected:"), expected],
                [MarkupHelper.red("Received:"), actual],
                [MarkupHelper.text("Diff:"), MarkupHelper.diff(expected, actual)],
            ],
        });
    }

    /**
     * Expects the received value (`Element`) to have the given attribute set on
     * itself, and for that attribute value to match the given `value` if any.
     *
     * @param {string} attribute
     * @param {string} [value]
     * @param {string} [message=""]
     * @example ```js
     *  expect("button").toHaveAttribute("disabled");
     *  expect("script").toHaveAttribute("src", "./index.js");
     * ```
     */
    toHaveAttribute(attribute, value, message = "") {
        this.#stack = new Error().stack;

        ensureArguments([
            [attribute, ["string"]],
            [value, ["string", "number", null]],
            [message, ["string", null]],
        ]);

        const expectsValue = ![null, undefined].includes(value);

        return this.#resolve({
            tranform: (actual) => queryOne(actual),
            predicate: (actual) =>
                expectsValue
                    ? actual.getAttribute(attribute) === value
                    : actual.hasAttribute(attribute),
            message: (pass) =>
                message ||
                (pass
                    ? `attribute on %actual% [contains!does not contain] ${formatHumanReadable(
                          amount
                      )} elements matching ${formatHumanReadable(target)}`
                    : `element does not have the correct amount of matches`),
            details: () => [
                [MarkupHelper.green("Expected:"), value],
                [MarkupHelper.red("Received:"), actual.getAttribute(attribute)],
                [
                    MarkupHelper.text("Diff:"),
                    MarkupHelper.diff(value, actual.getAttribute(attribute)),
                ],
            ],
        });
    }

    /**
     * Expects the received value (`Element`) to have the given class name(s).
     *
     * @param {string | string[]} className
     * @param {string} [message=""]
     * @example ```js
     *  expect("button").toHaveClass("btn");
     *  expect("body").toHaveClass(["o_webclient", "o_dark"]);
     * ```
     */
    toHaveClass(className, message = "") {
        this.#stack = new Error().stack;

        ensureArguments([
            [className, ["string", "string[]"]],
            [message, ["string", null]],
        ]);

        const classNames = isIterable(className) ? [...className] : [className];

        return this.#resolve({
            tranform: (actual) => queryOne(actual),
            predicate: (actual) => classNames.every((cls) => actual.classList.contains(cls)),
            message: (pass) =>
                message ||
                (pass
                    ? `%actual% [does not have any!has all] of the given class names`
                    : `expected target to [not have any!have all] of the given class names`),
            details: (actual) => [
                [MarkupHelper.green("Expected:"), classNames],
                [MarkupHelper.red("Received:"), [...actual.classList]],
            ],
        });
    }

    /**
     * Expects the received value to match the given matcher (string or RegExp).
     *
     * @param {import("../utils").Matcher} matcher
     * @param {string} [message=""]
     * @example ```js
     *  expect(new Error("foo")).toMatch("foo");
     *  expect("a foo value").toMatch(/fo.*ue/);
     * ```
     */
    toMatch(matcher, message = "") {
        this.#stack = new Error().stack;

        ensureArguments([
            [matcher, "any"],
            [message, ["string", null]],
        ]);

        return this.#resolve({
            predicate: (actual) => match(actual, matcher),
            message: (pass) =>
                message ||
                (pass
                    ? `%actual% [matchers!does not match] ${formatHumanReadable(matcher)}`
                    : `expected value [! not] to match the given matcher`),
            details: (actual) => [
                [MarkupHelper.green("Matcher:"), matcher],
                [MarkupHelper.red("Received:"), actual],
            ],
        });
    }

    /**
     * Expects the received value (`Function`) to throw an error after being called.
     *
     * @param {import("../utils").Matcher} [matcher=Error]
     * @param {string} [message=""]
     * @example ```js
     *  expect(() => { throw new Error() }).toThrow();
     *  expect(() => Promise.reject("foo")).rejects.toThrow("foo");
     * ```
     */
    toThrow(matcher = Error, message = "") {
        this.#stack = new Error().stack;

        ensureArguments([
            [matcher, "any"],
            [message, ["string", null]],
        ]);

        let name;
        return this.#resolve({
            transform: (actual) => {
                try {
                    actual();
                } catch (error) {
                    return error;
                }
            },
            predicate: (actual) => match(actual, matcher),
            message: (pass) =>
                message ||
                (pass
                    ? `${name} did[! not] throw or reject a matching value`
                    : `${name} rejected a value that did not match the given matcher`),
            details: (actual) => [
                [MarkupHelper.green("Matcher:"), matcher],
                [MarkupHelper.red("Received:"), actual],
            ],
        });
    }

    /**
     * @template R
     * @param {MatcherSpecifications<T, R>} specs
     * @returns {Async extends true ? Promise<void> : void}
     */
    #resolve(specs) {
        if (this.#promise) {
            return this.#promise.then(() => this.#resolveFinalResult(specs));
        } else {
            return this.#resolveFinalResult(specs);
        }
    }

    /**
     * @template R
     * @param {MatcherSpecifications<T, R>} specs
     */
    #resolveFinalResult({ transform, predicate, message, details }) {
        const { not } = this.#modifiers;
        const actual = transform ? transform(this.#actual) : this.#actual;
        let pass = predicate(actual);
        if (not) {
            pass = !pass;
        }

        const assertion = {
            id: nextResultId++,
            message: formatMessage(message(pass), { actual, not }),
            pass,
        };
        if (!pass) {
            const formattedStack = formatStack(this.#stack);
            assertion.info = [
                ...details(actual),
                [MarkupHelper.red("Source:"), MarkupHelper.multiline(formattedStack)],
            ];
        }

        currentResults.assertions.push(assertion);
        currentResults.pass &&= assertion.pass;
    }

    /**
     * Extends the available matchers methods with a given function.
     *
     * @param {(...args: any[]) => MatcherSpecifications<any>} matcher
     */
    static extend(matcher) {
        const name = matcher.name;
        if (!name) {
            throw new Error(`Matcher must be a named function`);
        } else if (this.registry[name]) {
            throw new Error(`A matcher with the name '${name}' already exists`);
        }
        this.registry[name] = matcher;
    }
}

export const expect = Object.assign(
    /**
     * @template [T=unknown]
     * @param {T} actual
     */
    function expect(actual) {
        if (!currentResults) {
            throw new Error(`Cannot call expect outside of a test.`);
        }
        return new Matchers(actual, {});
    },
    {
        /**
         * @param {number} expected
         */
        assertions(expected) {
            if (!Number.isInteger(expected)) {
                throw new Error(`Expected argument to be an integer, got ${expected}`);
            }
            currentResults.afterTestCallbacks.push(() => {
                const actual = currentResults.assertions.length;
                expect(actual).toBe(
                    expected,
                    `Expected ${expected} assertions, but ${actual} were run`
                );
            });
        },
        /** @type {(typeof Matchers)["extend"]} */
        extend: (matcher) => Matchers.extend(matcher),
        hasAssertions() {
            currentResults.afterTestCallbacks.push(() => {
                expect(currentResults.assertions.length).toBeGreaterThan(
                    0,
                    `Expected at least 1 expection, but none were run`
                );
            });
        },
        /**
         * @param {string} name
         */
        step(name) {
            if (typeof name !== "string") {
                throw new Error(`Expected first argument to be a string, got ${name}`);
            }
            currentResults.afterTestCallbacks.push(() => {
                if (currentResults.steps.length) {
                    expect(currentResults.steps).toEqual([], `Unverified steps`);
                }
            });
            currentResults.steps.push(name);
        },
        /**
         * @param {string[]} expectedSteps
         */
        verifySteps(expectedSteps) {
            expect(currentResults.steps).toEqual(expectedSteps);
            currentResults.steps = [];
        },
    }
);
