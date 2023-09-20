/** @odoo-module **/

import { Error, Object, Promise } from "./globals";
import { formatStack, multiline, red } from "./matchers/expect_helpers";
import { formatTechnical } from "./utils";

/**
 * @typedef {{
 *  aborted: boolean;
 *  afterTestCallbacks: (() => any)[];
 *  assertions: ExpectResult[];
 *  duration: number,
 *  error: Error | null,
 *  pass: boolean,
 *  steps: string[],
 * }} CurrentResults
 *
 * @typedef {(expect: ExpectContext<any>, ...args: any[]) => ExpectResult | Promise<ExpectResult>} ExpectMatcher
 *
 * @typedef {(expect: ExpectContext<any>, ...args: any[]) => void} ExpectMethod
 *
 * @typedef {{
 *  diff?: unknown;
 *  errors?: ({ message: string } | { arg: number; expected: string; actual: string })[];
 *  info?: string[];
 *  message?: string;
 *  pass: boolean;
 * }} ExpectResult
 */

/**
 * @template T
 * @typedef {CurrentResults & {
 *  actual: T;
 *  not: boolean;
 *  resolves: boolean;
 *  rejects: boolean;
 * }} ExpectContext
 */

/**
 * @template F, [T=unknown]
 * @typedef {F extends (expect: ExpectContext<T>, ...args: infer P) => any ? (...args: P) => void : never} MatcherType
 */

/**
 * @template T
 * @typedef {{
 *  toBeBetween: MatcherType<import("./matchers/to_be_between").toBeBetween>;
 *  toBeTruthy: MatcherType<import("./matchers/to_be_truthy").toBeTruthy>;
 *  toBeVisible: MatcherType<import("./matchers/to_be_visible").toBeVisible>;
 *  toBe: MatcherType<import("./matchers/to_be").toBe<T>>;
 *  toContain: MatcherType<import("./matchers/to_contain").toContain>;
 *  toEqual: MatcherType<import("./matchers/to_equal").toEqual<T>>;
 *  toHaveAttribute: MatcherType<import("./matchers/to_have_attribute").toHaveAttribute>;
 *  toHaveClass: MatcherType<import("./matchers/to_have_class").toHaveClass>;
 *  toMatch: MatcherType<import("./matchers/to_match").toMatch>;
 *  toThrow: MatcherType<import("./matchers/to_throw").toThrow<T>>;
 * }} RegisteredMatchers
 */

/**
 * @template T
 * @typedef {{
 *  [key in keyof RegisteredMatchers<T>]:
 *      RegisteredMatchers<T>[key] extends (...args: infer P) => infer R
 *          ? (...args: P) => Promise<R>
 *          : RegisteredMatchers<T>[key]
 * }} RegisteredMatchersAsync
 */

//-----------------------------------------------------------------------------
// Internal
//-----------------------------------------------------------------------------

/**
 * @template T
 * @param {T} actual
 * @param {{ not?: boolean; rejects?: boolean; resolves?: boolean }} context
 */
const generateMatchers = (actual, { not, rejects, resolves }) => {
    const fullInfo = { ...currentResults, actual, not, rejects, resolves };
    /** @type {RegisteredMatchers<T>} */
    const matchers = {};
    for (const name in matchersRegistry) {
        const fn = matchersRegistry[name];
        matchers[name] = {
            [name](...args) {
                let promise;
                if (rejects) {
                    promise = Promise.resolve(actual)
                        .then((result) => {
                            throw new Error(
                                `Expected promise to reject, instead resolved with: ${result}`
                            );
                        })
                        .catch(
                            /** @param {PromiseRejectedResult} reason */
                            (reason) => (fullInfo.actual = reason)
                        );
                } else if (resolves) {
                    promise = Promise.resolve(actual)
                        .then(
                            /** @param {PromiseFulfilledResult<T>} result */
                            (result) => (fullInfo.actual = result)
                        )
                        .catch((reason) => {
                            throw new Error(
                                `Expected promise to resolve, instead rejected with: ${reason}`,
                                { cause: reason }
                            );
                        });
                }
                const { stack } = new Error();
                if (promise) {
                    return promise.then(() => resolveResult(fn(fullInfo, ...args), name, stack));
                } else {
                    return resolveResult(fn(fullInfo, ...args), name, stack);
                }
            },
        }[name];
    }
    return matchers;
};





/**
 * @param {ExpectResult} result
 * @param {string} name
 * @param {string} stack
 */
const resolveResult = (result, name, stack) => {
    const assertion = { ...result, id: nextResultId++ };
    if (assertion.errors?.length) {
        const messages = assertion.errors.map((error) => {
            if (error.message) {
                return error.message;
            } else if ("arg" in error) {
                return `argument ${error.arg} is expected to be a ${error.expected.join(
                    " or a "
                )}, got ${formatTechnical(error.actual)}`;
            } else {
                return error;
            }
        });
        currentResults.pass = false;
        assertion.message = `'expect(...).${name}' error`;
        assertion.info = [[red("Reasons:"), multiline(messages)]];
    }
    if (!assertion.pass) {
        const formattedStack = formatStack(stack);
        assertion.info ||= [];
        assertion.info.push([red("Source:"), multiline(formattedStack)]);
    }
    currentResults.assertions.push(assertion);
    currentResults.pass &&= assertion.pass;
};

class Matchers {}

/** @type {Record<string, ExpectMatcher>} */
const matchersRegistry = Object.create(null);

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

export const expect = Object.assign(
    /**
     * @template [T=unknown]
     * @param {T} actual
     */
    function expect(actual) {
        return Object.assign(new Matchers(), generateMatchers(actual, {}), {
            get not() {
                return generateMatchers(actual, { not: true });
            },
            /** @type {RegisteredMatchersAsync<T>} */
            get rejects() {
                return generateMatchers(actual, { rejects: true });
            },
            /** @type {RegisteredMatchersAsync<T>} */
            get resolves() {
                return generateMatchers(actual, { resolves: true });
            },
        });
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
        /**
         * @param {ExpectMatcher} matcher
         */
        extend(matcher) {
            const name = matcher.name;
            if (!name) {
                throw new Error(`Matcher must be a named function`);
            } else if (matchersRegistry[name]) {
                throw new Error(`A matcher with the name '${name}' already exists`);
            }
            matchersRegistry[name] = matcher;
        },
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
