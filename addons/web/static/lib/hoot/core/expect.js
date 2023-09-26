/** @odoo-module */

import { Boolean, Error, Object, Promise, navigator, performance } from "../globals";
import { isVisible, queryAll, queryOne } from "../helpers/dom";
import {
    MarkupHelper,
    deepEqual,
    ensureArguments,
    formatHumanReadable,
    isIterable,
    match,
} from "../utils";

/**
 * @typedef {ArgumentPrimitive | `${ArgumentPrimitive}[]` | null} ArgumentDef
 *
 * @typedef {"any" | "boolean" | "function" | "number" | "string"} ArgumentPrimitive
 *
 * @typedef {{
 *  id: number;
 *  info?: [any, any][];
 *  message: string;
 *  name: string;
 *  pass: boolean;
 *  ts: number;
 * }} Assertion
 *
 * @typedef {{
 *  aborted: boolean;
 *  afterTestCallbacks: (() => any)[];
 *  assertions: Assertion[];
 *  duration: number;
 *  error: Error | null;
 *  pass: boolean;
 *  steps: string[];
 *  ts: number;
 * }} CurrentResults
 */

/**
 * @template [T=unknown], [R=T]
 * @typedef {{
 *  name: string;
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
 * @param {unknown} value
 */
const canDiff = (value) => value && !["boolean", "number"].includes(typeof value);

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
    let stackLines = String(stack)
        .split(/\n/g)
        .slice(isFirefox() ? 1 : 2); // remove `saveStack` (and ´Error´ in chrome)
    if (stackLines.length > 10) {
        stackLines = [...stackLines.slice(0, 10), `... ${stackLines.length - 10} more`];
    }
    return stackLines.map((v) => MarkupHelper.text(v.trim()));
};

const isFirefox = () => /firefox/i.test(navigator.userAgent);

const ACTUAL_REGEX = /%actual%/i;
const NOT_REGEX = /\[([\w\s]*)!([\w\s]*)\]/;

/** @type {CurrentResults | null} */
let currentResults = null;
let currentStack = "";
let nextResultId = 1;

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

/**
 * @param {import("./runner").TestRunner} runner
 */
export function makeExpect(runner) {
    /**
     * @param {number} expected
     */
    function assertions(expected) {
        if (!currentResults) {
            throw new Error(`Cannot call \`expect.assertions()\` outside of a test.`);
        }
        ensureArguments([[expected, "integer"]]);

        currentResults.afterTestCallbacks.push(() => {
            const actual = currentResults.assertions.length;
            expect(actual).toBe(
                expected,
                `Expected ${expected} assertions, but ${actual} were run`
            );
        });
    }

    /**
     * @template [T=unknown]
     * @param {T} actual
     */
    function expect(actual) {
        if (!currentResults) {
            throw new Error(`Cannot call \`expect()\` outside of a test.`);
        }

        return new Matchers(actual, {}, runner.config.headless);
    }

    /** @type {(typeof Matchers)["extend"]} */
    function extend(matcher) {
        return Matchers.extend(matcher);
    }

    /**
     * Sets the current test to fail. An assertion can be added as well to provide
     * additional context.
     *
     * @param {Assertion} [assertion]
     */
    function fail(assertion) {
        if (!currentResults) {
            throw new Error(`Cannot call \`expect.fail()\` outside of a test.`);
        }

        currentResults.pass = false;
        if (assertion) {
            currentResults.assertions.push({ ...assertion, pass: false });
        }
    }

    function hasAssertions() {
        if (!currentResults) {
            throw new Error(`Cannot call \`expect.hasAssertions()\` outside of a test.`);
        }

        currentResults.afterTestCallbacks.push(() => {
            expect(currentResults.assertions.length).toBeGreaterThan(
                0,
                `Expected at least 1 expection, but none were run`
            );
        });
    }

    /**
     * Sets the current test to pass. An assertion can be added as well to provide
     * additional context.
     *
     * @param {Assertion} [assertion]
     */
    function pass(assertion) {
        if (!currentResults) {
            throw new Error(`Cannot call \`expect.pass()\` outside of a test.`);
        }

        currentResults.pass = true;
        if (assertion) {
            currentResults.assertions.push({ ...assertion, pass: true });
        }
    }

    /**
     * @param {string} name
     */
    function step(name) {
        if (!currentResults) {
            throw new Error(`Cannot call \`expect.setp()\` outside of a test.`);
        }
        ensureArguments([[name, "string"]]);

        currentResults.afterTestCallbacks.push(() => {
            if (currentResults.steps.length) {
                expect(currentResults.steps).toEqual([], `Unverified steps`);
            }
        });
        currentResults.steps.push(name);
    }

    runner.beforeAnyTest((test) => {
        currentResults = {
            aborted: false,
            afterTestCallbacks: [],
            assertions: [],
            duration: 0,
            error: null,
            pass: true,
            steps: [],
            ts: performance.now(),
        };
        test.results.push(currentResults);
    });

    runner.afterAnyTest(async (test) => {
        if (!currentResults) {
            return;
        }

        currentResults.duration = performance.now() - currentResults.ts;

        if (test.config.todo) {
            if (currentResults.pass) {
                currentResults.error = new Error(`tests tagged with "todo" are expected to fail`);
                currentResults.pass = false;
            } else {
                expect.pass();
            }
        }

        while (currentResults.afterTestCallbacks.length) {
            await currentResults.afterTestCallbacks.pop()();
        }

        currentResults = null;
    });

    return Object.assign(expect, {
        assertions,
        extend,
        fail,
        hasAssertions,
        pass,
        step,
    });
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
    #headless = false;
    /** @type {Modifiers} */
    #modifiers = {
        not: false,
        rejects: false,
        resolves: false,
    };
    /** @type {Promise<T> | null} */
    #promise = null;

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

        return new Matchers(this.#actual, { ...this.#modifiers, not: true }, this.#headless);
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

        return new Matchers(this.#actual, { ...this.#modifiers, rejects: true }, this.#headless);
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

        return new Matchers(this.#actual, { ...this.#modifiers, resolves: true }, this.#headless);
    }

    /**
     * @param {T} actual
     * @param {Modifiers<Async>} modifiers
     * @param {boolean} headless
     */
    constructor(actual, modifiers, headless) {
        this.#modifiers = modifiers;
        this.#headless = headless;

        if (this.#modifiers.rejects || this.#modifiers.resolves) {
            this.#promise = Promise.resolve(actual)
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
            const resolve = this.#resolve.bind(this);
            const saveStack = this.#saveStack.bind(this);
            this[fnName] = {
                [fnName](...args) {
                    saveStack();
                    const result = fn(...args);
                    return resolve({ ...result, name: fnName });
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
        this.#saveStack();

        ensureArguments([
            [expected, "any"],
            [message, ["string", null]],
        ]);

        return this.#resolve({
            name: "toBe",
            predicate: (actual) => actual === expected,
            message: (pass) =>
                message ||
                (pass
                    ? `%actual% is[! not] strictly equal to ${formatHumanReadable(expected)}`
                    : `expected values to be strictly equal`),
            details: (actual) => {
                const details = [
                    [MarkupHelper.green("Expected:"), expected],
                    [MarkupHelper.red("Received:"), actual],
                ];
                if (canDiff(actual) && canDiff(expected)) {
                    details.push([MarkupHelper.text("Diff:"), MarkupHelper.diff(expected, actual)]);
                }
                return details;
            },
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
        this.#saveStack();

        ensureArguments([
            [max, "number"],
            [message, ["string", null]],
        ]);

        return this.#resolve({
            name: "toBeGreaterThan",
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
        this.#saveStack();

        ensureArguments([
            [min, "number"],
            [message, ["string", null]],
        ]);

        return this.#resolve({
            name: "toBeLessThan",
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
        this.#saveStack();

        ensureArguments([[message, ["string", null]]]);

        return this.#resolve({
            name: "toBeTruthy",
            predicate: Boolean,
            message: (pass) =>
                message ||
                (pass ? `%actual% is[! not] truthy` : `expected value[! not] to be truthy`),
            details: (actual) => [[MarkupHelper.red("Received:"), actual]],
        });
    }

    /**
     * Expects the received value to be of the given type.
     *
     * @param {"bigint" | "boolean" | "function" | "number" | "object" | "string" | "symbol" | "undefined"} type
     * @param {string} [message=""]
     * @example ```js
     *  expect("foo").toBeTypeOf("");
     *  expect({ foo: 1 }).toBeTypeOf("object");
     * ```
     */
    toBeTypeOf(type, message = "") {
        this.#saveStack();

        ensureArguments([
            [type, "string"],
            [message, ["string", null]],
        ]);

        return this.#resolve({
            name: "toBeTypeOf",
            transform: (actual) => typeof actual,
            predicate: (actual) => actual === type,
            message: (pass) =>
                message ||
                (pass
                    ? `%actual% is[! not] of type ${formatHumanReadable(type)}`
                    : `expected values to be of the given type`),
            details: (actual) => [
                [MarkupHelper.green("Expected:"), type],
                [MarkupHelper.red("Received:"), actual],
            ],
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
        this.#saveStack();

        ensureArguments([[message, ["string", null]]]);

        return this.#resolve({
            name: "toBeVisible",
            predicate: isVisible,
            message: (pass) =>
                message ||
                (pass ? `%actual% is[! not] visible` : `expected target to be [visible!invisible]`),
            details: (actual) => [[MarkupHelper.red("Received:"), actual]],
        });
    }

    /**
     * Expects the received value to be strictly between `min` (inclusive) and
     * `max` (exclusive).
     *
     * @param {number} min (inclusive)
     * @param {number} max (exlusive)
     * @param {string} [message=""]
     * @example ```js
     *  expect(3).toBeWithin(3, 9);
     *  expect(-8).toBeWithin([-10, 0]);
     * ```
     */
    toBeWithin(min, max, message = "") {
        this.#saveStack();

        ensureArguments([
            [min, "number"],
            [max, "number"],
            [message, ["string", null]],
        ]);

        if (min > max) {
            throw new Error(
                `Expected the first argument to be smaller than the second, got ${min} and ${max}`
            );
        }

        return this.#resolve({
            name: "toBeWithin",
            predicate: (actual) => min <= actual && actual < max,
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
        this.#saveStack();

        ensureArguments([
            [target, ["any"]],
            [amount, ["string", "number", null]],
            [message, ["string", null]],
        ]);

        let found;
        return this.#resolve({
            name: "toContain",
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
        this.#saveStack();

        ensureArguments([
            [expected, "any"],
            [message, ["string", null]],
        ]);

        return this.#resolve({
            name: "toEqual",
            predicate: (actual) => deepEqual(actual, expected),
            message: (pass) =>
                message ||
                (pass
                    ? `%actual% is[! not] deeply equal to ${formatHumanReadable(expected)}`
                    : `expected values to be deeply equal`),
            details: (actual) => {
                const details = [
                    [MarkupHelper.green("Expected:"), expected],
                    [MarkupHelper.red("Received:"), actual],
                ];
                if (canDiff(actual) && canDiff(expected)) {
                    details.push([MarkupHelper.text("Diff:"), MarkupHelper.diff(expected, actual)]);
                }
                return details;
            },
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
        this.#saveStack();

        ensureArguments([
            [attribute, ["string"]],
            [value, ["string", "number", null]],
            [message, ["string", null]],
        ]);

        const expectsValue = ![null, undefined].includes(value);

        return this.#resolve({
            name: "toHaveAttribute",
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
            details: () => {
                const received = actual.getAttribute(attribute);
                const details = [
                    [MarkupHelper.green("Expected:"), value],
                    [MarkupHelper.red("Received:"), received],
                ];
                if (canDiff(received) && canDiff(value)) {
                    details.push([MarkupHelper.text("Diff:"), MarkupHelper.diff(value, received)]);
                }
                return details;
            },
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
        this.#saveStack();

        ensureArguments([
            [className, ["string", "string[]"]],
            [message, ["string", null]],
        ]);

        const classNames = isIterable(className) ? [...className] : [className];

        return this.#resolve({
            name: "toHaveClass",
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
        this.#saveStack();

        ensureArguments([
            [matcher, "any"],
            [message, ["string", null]],
        ]);

        return this.#resolve({
            name: "toMatch",
            predicate: (actual) => match(actual, matcher),
            message: (pass) =>
                message ||
                (pass
                    ? `%actual% [matches!does not match] ${formatHumanReadable(matcher)}`
                    : `expected value [! not] to match the given matcher`),
            details: (actual) => [
                [MarkupHelper.green("Matcher:"), matcher],
                [MarkupHelper.red("Received:"), actual],
            ],
        });
    }

    /**
     * Expects the received value to satisfy the given predicate, taking the received
     * value as argument.
     *
     * @param {(actual: T) => boolean} predicate
     * @param {string} [message=""]
     * @example ```js
     *  expect("foo").toSatisfy((value) => typeof value === "string");
     *  expect(false).not.toSatisfy(Boolean);
     * ```
     */
    toSatisfy(predicate, message = "") {
        this.#saveStack();

        ensureArguments([
            [predicate, "function"],
            [message, ["string", null]],
        ]);

        return this.#resolve({
            name: "toSatisfy",
            predicate: (actual) => predicate(actual),
            message: (pass) =>
                message ||
                (pass
                    ? `%actual% [satisfies!does not satisfy] the predicate ${formatHumanReadable(
                          predicate
                      )}`
                    : `expected value to[! not] satisfy the predicate`),
            details: (actual) => [
                [MarkupHelper.green("Expected:"), true],
                [MarkupHelper.red("Received:"), actual],
                [MarkupHelper.text("Predicate:"), predicate],
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
        this.#saveStack();

        ensureArguments([
            [matcher, "any"],
            [message, ["string", null]],
        ]);

        let name;
        return this.#resolve({
            name: "toThrow",
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
     * Expects the received steps to be equal to the current steps. This also resets
     * the current steps.
     *
     * @param {string} [message=""]
     * @example ```js
     *  expect(() => { throw new Error() }).toThrow();
     *  expect(() => Promise.reject("foo")).rejects.toThrow("foo");
     * ```
     */
    toVerifySteps(message = "") {
        this.#saveStack();

        ensureArguments([[message, ["string", null]]]);

        let expected;
        return this.#resolve({
            name: "toVerifySteps",
            predicate: (actual) => {
                expected = currentResults.steps;
                currentResults.steps = [];
                return deepEqual(actual, expected);
            },
            message: (pass) =>
                message ||
                (pass
                    ? expected.length
                        ? `[${expected.map(formatHumanReadable).join(", ")}]`
                        : "no steps"
                    : `expected the following steps`),
            details: (actual) => [
                [MarkupHelper.green("Expected:"), expected],
                [MarkupHelper.red("Received:"), actual],
                [MarkupHelper.text("Diff:"), MarkupHelper.diff(expected, actual)],
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
    #resolveFinalResult({ name, transform, predicate, message, details }) {
        const { not } = this.#modifiers;
        const actual = transform ? transform(this.#actual) : this.#actual;
        let pass = predicate(actual);
        if (not) {
            pass = !pass;
        }

        const assertion = {
            id: nextResultId++,
            name,
            message: formatMessage(message(pass), { actual, not }),
            pass,
            ts: performance.now(),
        };
        if (!pass) {
            const formattedStack = formatStack(currentStack);
            assertion.info = [
                ...details(actual),
                [MarkupHelper.red("Source:"), MarkupHelper.multiline(formattedStack)],
            ];
        }

        currentResults.assertions.push(assertion);
        currentResults.pass &&= assertion.pass;
    }

    #saveStack() {
        if (!this.#headless) {
            currentStack = new Error().stack;
        }
    }

    /**
     * Extends the available matchers methods with a given function.
     *
     * @param {(...args: any[]) => MatcherSpecifications<any>} matcher
     */
    static extend(matcher) {
        ensureArguments([[matcher, "function"]]);

        const { name } = matcher;
        if (!name) {
            throw new Error(`Matcher must be a named function`);
        }
        if (this.registry[name]) {
            throw new Error(`A matcher with the name '${name}' already exists`);
        }

        this.registry[name] = matcher;
    }
}
