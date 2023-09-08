/** @odoo-module **/

import { reactive } from "@odoo/owl";
import { makeAssert } from "../assertions/assert";
import { Error, Promise, clearTimeout, setTimeout } from "../globals";
import {
    SPECIAL_TAGS,
    getFuzzyScore,
    makeCallbacks,
    makeTaggable,
    normalize,
    parseRegExp,
    shuffle,
    storage,
} from "../utils";
import { Suite } from "./suite";
import { makeTags } from "./tag";
import { Test } from "./test";
import { DEFAULT_CONFIG, SKIP_PREFIX, setParams, urlParams } from "./url";

/**
 * @typedef {import("../assertions/assert").AssertMethods} AssertMethods
 *
 * @typedef {Suite | Test} Job
 */

/**
 * @template T
 * @typedef {T | PromiseLike<T>} MaybePromise
 */

//-----------------------------------------------------------------------------
// Internal
//-----------------------------------------------------------------------------

class TimeoutError extends Error {
    name = "TimeoutError";
}

const BOOLEAN_REGEX = /^true|false$/i;

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

/**
 * @param {typeof DEFAULT_CONFIG} params
 */
export function makeTestRunner(params) {
    /**
     * @param {string} name
     * @param {(() => void) | string} suiteFn
     * @param {string[]} suiteTags
     */
    function addSuite(name, suiteFn, suiteTags) {
        if (typeof suiteFn === "string") {
            // nesaddSuiteted suite definition
            const nestedArgs = [...arguments].slice(1);
            return addSuite(name, () => addSuite(...nestedArgs));
        }
        if (runner.status !== "ready") {
            throw new Error("Cannot add a suite after starting the test runner");
        }
        const current = getCurrent();
        const tags = makeTags(current?.tags, suiteTags);
        let suite = new Suite(current, name, tags);
        const originalSuite = runner.suites.find((s) => s.id === suite.id);
        if (originalSuite) {
            suite = originalSuite;
        } else {
            (current?.jobs || runner.jobs).push(suite);
        }
        suiteStack.push(suite);
        for (const tag of tags) {
            if (tag.special) {
                switch (tag.name) {
                    case SPECIAL_TAGS.debug:
                        runner.debug = true;
                    case SPECIAL_TAGS.only:
                        only.suites.add(suite.id);
                        break;
                    case SPECIAL_TAGS.skip:
                        skip.suites.add(suite.id);
                        break;
                }
            } else if (!tag.config) {
                runner.tags.add(tag);
            }
        }
        if (skip.suites.has(suite.id) && !only.suites.has(suite.id)) {
            suite.skip = true;
        }
        let result;
        try {
            result = suiteFn();
        } finally {
            suiteStack.pop();
            if (!originalSuite) {
                runner.suites.push(suite);
            }
        }
        if (result !== undefined) {
            throw new Error("Invalid suite definition: cannot return a value");
        }
    }

    /**
     * @param {string} name
     * @param {(assert: AssertMethods) => void | PromiseLike<void>} testFn
     * @param {string[]} testTags
     */
    function addTest(name, testFn, testTags) {
        const current = getCurrent();
        if (!current) {
            throw new Error(`Cannot register test "${name}" outside of a suite.`);
        }
        if (runner.status !== "ready") {
            throw new Error("Cannot add a test after starting the test runner");
        }
        const tags = makeTags(current?.tags, testTags);
        if (handleMulti(tags, name, testFn, testTags)) {
            return;
        }
        const test = new Test(current, name, testFn, tags);
        (current?.jobs || runner.jobs).push(test);
        if (!test.parent?.config.multi) {
            runner.tests.push(test);
        }
        for (const tag of tags) {
            if (tag.special) {
                switch (tag.name) {
                    case SPECIAL_TAGS.debug:
                        runner.debug = true;
                    case SPECIAL_TAGS.only:
                        only.tests.add(test.id);
                        break;
                    case SPECIAL_TAGS.skip:
                        skip.tests.add(test.id);
                        break;
                }
            } else if (!tag.config) {
                runner.tags.add(tag);
            }
        }
        if (skip.tests.has(test.id) && !only.tests.has(test.id)) {
            test.skip = true;
        }
    }

    function getCurrent() {
        return suiteStack.at(-1) || null;
    }

    /**
     * @param {Tag[]} tags
     * @param {string} name
     * @param {(assert: AssertMethods) => void | PromiseLike<void>} testFn
     * @param {string[]} testTags
     */
    function handleMulti(tags, name, testFn, testTags) {
        const index = tags.findIndex((t) => t.config?.multi);
        if (index in tags) {
            const tagsWithoutMulti = [...tags];
            const [multiTag] = tagsWithoutMulti.splice(index, 1);
            const suiteFn = () => {
                for (let i = 0; i < multiTag.config.multi; i++) {
                    addTest(`${i}) ${name}`, testFn, tagsWithoutMulti);
                }
            };
            addSuite(name, suiteFn, testTags);
            return true;
        }
        return false;
    }

    function initFilters() {
        const { get, remove } = storage("session");
        const previousFails = get("hoot-failed-tests", []);
        if (previousFails.length) {
            // Previously failed tests
            runner.hasFilter = true;
            remove("hoot-failed-tests");
            for (const id of previousFails) {
                only.tests.add(id);
            }
            return;
        }

        // Text filter
        if (urlParams.filter) {
            runner.hasFilter = true;
            runner.textFilter = parseRegExp(normalize(urlParams.filter.join(" ")));
        }

        // Suites
        if (urlParams.suite) {
            runner.hasFilter = true;
            for (const id of urlParams.suite) {
                if (id.startsWith(SKIP_PREFIX)) {
                    skip.suites.add(id.slice(SKIP_PREFIX.length));
                } else {
                    only.suites.add(id);
                }
            }
        }

        // Tags
        if (urlParams.tag) {
            runner.hasFilter = true;
            for (const name of urlParams.tag) {
                if (name.startsWith(SKIP_PREFIX)) {
                    skip.tags.add(name.slice(SKIP_PREFIX.length));
                } else {
                    only.tags.add(name);
                }
            }
        }

        // Tests
        if (urlParams.debugTest) {
            runner.hasFilter = true;
            runner.debug = true;
            for (const id of urlParams.debugTest) {
                only.tests.add(id);
            }
        } else if (urlParams.test) {
            runner.hasFilter = true;
            for (const id of urlParams.test) {
                if (id.startsWith(SKIP_PREFIX)) {
                    skip.tests.add(id.slice(SKIP_PREFIX.length));
                } else {
                    only.tests.add(id);
                }
            }
        }
    }

    /**
     * @param {Job[]} jobs
     */
    function prepareJobs(jobs) {
        const filteredJobs = jobs.filter((job) => {
            if (job instanceof Suite) {
                if (only.suites.has(job.id)) {
                    return true;
                }
                job.jobs = prepareJobs(job.jobs);
                return Boolean(job.jobs.length);
            } else {
                if (only.tests.has(job.id)) {
                    return true;
                }
            }

            if (skip.tags.size && job.tags.some((tag) => skip.tags.has(tag.id))) {
                return false;
            }
            if (only.tags.size && job.tags.some((tag) => only.tags.has(tag.id))) {
                return true;
            }

            if (runner.textFilter) {
                // The job matches the URL filter
                if (
                    runner.textFilter instanceof RegExp
                        ? runner.textFilter.test(job.index)
                        : getFuzzyScore(runner.textFilter, job.index) > 0
                ) {
                    return true;
                }
            }

            return !(
                only.suites.size ||
                only.tests.size ||
                only.tags.size ||
                runner.textFilter.length
            );
        });

        return config.randomorder ? shuffle(filteredJobs) : filteredJobs;
    }

    class TestRunner {
        config = config;
        debug = false;
        hasFilter = false;
        /** @type {Job[]} */
        jobs = [];
        /** @type {"ready" | "running"} */
        status = "ready";
        /** @type {Suite[]} */
        suites = [];
        /** @type {Set<Tag>} */
        tags = new Set();
        /** @type {Test[]} */
        tests = [];
        textFilter = "";

        suite = makeTaggable(addSuite);
        test = makeTaggable(addTest);

        /**
         * @param {() => MaybePromise<void>} callback
         */
        afterAll(callback) {
            callbacks.add("after-all", callback);
        }

        /**
         * @param {(suite: Suite) => MaybePromise<void>} callback
         */
        afterAnySuite(callback) {
            callbacks.add("after-suite", callback);
        }

        /**
         * @param {(test: Test) => MaybePromise<void>} callback
         */
        afterAnyTest(callback) {
            callbacks.add("after-test", callback);
        }

        /**
         * @param {(suite: Suite) => MaybePromise<void>} callback
         */
        afterSuite(callback) {
            const current = getCurrent();
            if (!current) {
                throw new Error(
                    `"afterSuite" can only be called when a suite is currently running`
                );
            }
            current.callbacks.add("after-suite", callback);
        }

        /**
         * @param {(test: Test) => MaybePromise<void>} callback
         */
        afterTest(callback) {
            (getCurrent()?.callbacks || callbacks).add("after-test", callback);
        }

        /**
         * @param {() => MaybePromise<void>} callback
         */
        beforeAll(callback) {
            callbacks.add("before-all", callback);
        }

        /**
         * @param {(suite: Suite) => MaybePromise<void>} callback
         */
        beforeAnySuite(callback) {
            callbacks.add("before-suite", callback);
        }

        /**
         * @param {(test: Test) => MaybePromise<void>} callback
         */
        beforeAnyTest(callback) {
            callbacks.add("before-test", callback);
        }

        /**
         * @param {(suite: Suite) => MaybePromise<void>} callback
         */
        beforeSuite(callback) {
            const current = getCurrent();
            if (!current) {
                throw new Error(`"beforeSuite" should only be called inside a suite definition`);
            }
            current.callbacks.add("before-suite", callback);
        }

        beforeTest(callback) {
            (getCurrent()?.callbacks || callbacks).add("before-test", callback);
        }

        /**
         * @param {(test: Test) => MaybePromise<void>} callback
         */
        registerCleanup(callback) {
            const cleanup = () => {
                callbacks.remove("after-test", cleanup);
                return callback();
            };

            callbacks.add("after-test", cleanup);
        }

        /**
         * @param {(test: Test) => MaybePromise<void>} callback
         */
        skippedAnyTest(callback) {
            callbacks.add("skipped-test", callback);
        }

        /**
         * @param {(test: Test) => MaybePromise<void>} callback
         */
        skippedTest(callback) {
            (getCurrent()?.callbacks || callbacks).add("skipped-test", callback);
        }

        async start() {
            // Make sure that code that wants to run right after the DOM is ready gets
            // the opportunity to execute (and maybe call some hook such as 'beforeAll').
            await Promise.resolve();

            if (runner.status !== "ready") {
                return;
            }

            runner.status = "running";
            const jobs = prepareJobs(runner.jobs);

            await callbacks.call("before-all");

            let job = jobs.shift();
            while (job && runner.status === "running") {
                if (job instanceof Suite) {
                    const suite = job;
                    if (suite.visited === 0) {
                        // before suite code
                        suiteStack.push(suite);

                        callbacks.add("before-suite", ...suite.callbacks.get("before-suite"));
                        callbacks.add("before-test", ...suite.callbacks.get("before-test"));
                        callbacks.add("after-test", ...suite.callbacks.get("after-test"));
                        callbacks.add("skipped-test", ...suite.callbacks.get("skipped-test"));
                        callbacks.add("after-suite", ...suite.callbacks.get("after-suite"));

                        await callbacks.call("before-suite", suite);
                    }
                    if (suite.visited === suite.jobs.length) {
                        // after suite code
                        suiteStack.pop();

                        callbacks.remove("before-suite", ...suite.callbacks.get("before-suite"));
                        callbacks.remove("before-test", ...suite.callbacks.get("before-test"));
                        callbacks.remove("after-test", ...suite.callbacks.get("after-test"));
                        callbacks.remove("skipped-test", ...suite.callbacks.get("skipped-test"));
                        callbacks.remove("after-suite", ...suite.callbacks.get("after-suite"));

                        if (runner.debug) {
                            missedCallbacks.push(() => callbacks.call("after-suite", suite));
                        } else {
                            await callbacks.call("after-suite", suite);
                        }
                    }
                    job = suite.jobs[suite.visited++] || suite.parent || jobs.shift();
                } else {
                    const test = job;
                    if (test.skip) {
                        await callbacks.call("skipped-test", test);
                    } else {
                        // Before test
                        const assert = makeAssert();

                        await callbacks.call("before-test", test);

                        // Setup
                        let timeoutId;
                        const timeout = test.config.timeout || config.timeout;
                        await Promise.race([
                            // Test promise
                            test.run(assert.methods),
                            // Abort & timeout promise
                            new Promise((resolve, reject) => {
                                // Set abort signal
                                abortCurrent = resolve;

                                if (!runner.debug) {
                                    // Set timeout
                                    timeoutId = setTimeout(
                                        () =>
                                            reject(
                                                new TimeoutError(
                                                    `test took longer than ${timeout}ms`
                                                )
                                            ),
                                        timeout
                                    );
                                }
                            }).then(() => {
                                assert.aborted = true;
                            }),
                        ])
                            .catch((err) => {
                                assert.error = err;
                                assert.pass = false;
                                if (config.notrycatch) {
                                    throw err;
                                }
                            })
                            .finally(() => {
                                abortCurrent = () => null;
                                clearTimeout(timeoutId);
                            });

                        if (assert.steps > 0) {
                            assert.methods.deepEqual([], assert.steps, `Unverified steps`);
                        }

                        if (assert.expects !== null) {
                            const expected = assert.expects;
                            const actual = assert.assertions.length;
                            assert.methods.equal(
                                expected,
                                actual,
                                `Expected ${expected} assertions, but ${actual} were run`
                            );
                        } else if (!assert.assertions.length) {
                            assert.methods.ok(
                                0,
                                `Expected at least 1 assertion, but none were run`
                            );
                        }

                        assert.end();

                        for (const [key, value] of Object.entries(assert)) {
                            if (typeof value !== "function") {
                                test.lastResults[key] = value;
                            }
                        }

                        // After test (ignored in debug mode)
                        if (runner.debug) {
                            missedCallbacks.push(() => callbacks.call("after-test", test));
                        } else {
                            await callbacks.call("after-test", test);

                            if (urlParams.failfast && !assert.pass && !test.skip) {
                                return runner.stop();
                            }
                        }
                    }
                    job = test.parent || jobs.shift();
                }
            }

            if (!runner.debug) {
                await runner.stop();
            }
        }

        async stop() {
            abortCurrent();
            runner.status = "ready";

            while (missedCallbacks.length) {
                await missedCallbacks.shift()();
            }

            await callbacks.call("after-all");
        }
    }

    const initialConfig = { ...DEFAULT_CONFIG, ...params };
    const rawConfig = { ...initialConfig };

    for (const key in urlParams) {
        if (key in DEFAULT_CONFIG) {
            const [value] = urlParams[key];
            if (BOOLEAN_REGEX.test(value)) {
                rawConfig[key] = value.toLowerCase() === "true";
            } else if (!isNaN(value)) {
                rawConfig[key] = Number(value);
            } else {
                rawConfig[key] = value;
            }
        } else if (key in rawConfig) {
            rawConfig[key] = urlParams[key];
        }
    }
    const config = reactive(rawConfig, () => {
        for (const key in config) {
            if (config[key] !== initialConfig[key]) {
                setParams({ [key]: config[key] });
            } else {
                setParams({ [key]: null });
            }
        }
    });

    /** @type {Suite[]} */
    const suiteStack = [];
    const runner = new TestRunner();

    const only = {
        suites: new Set(),
        tags: new Set(),
        tests: new Set(),
    };
    const skip = {
        suites: new Set(),
        tags: new Set(),
        tests: new Set(),
    };

    const callbacks = makeCallbacks();
    const missedCallbacks = [];

    let abortCurrent = () => {};

    initFilters();

    return runner;
}
