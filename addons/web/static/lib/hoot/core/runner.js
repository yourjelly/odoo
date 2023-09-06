/** @odoo-module **/

import { reactive } from "@odoo/owl";
import { makeAssert } from "../assertions/assert";
import { Error, Promise, clearTimeout, history, location, setTimeout } from "../globals";
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
import { DEFAULT_CONFIG, SKIP_PREFIX, makeURLStore } from "./url";

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
        if (status !== "ready") {
            throw new Error("Cannot add a suite after starting the test runner");
        }
        const current = getCurrent();
        const tags = makeTags(current?.tags, suiteTags);
        let suite = new Suite(current, name, tags);
        const originalSuite = suites.find((s) => s.id === suite.id);
        if (originalSuite) {
            suite = originalSuite;
        } else {
            (current?.jobs || rootJobs).push(suite);
        }
        suiteStack.push(suite);
        for (const tag of tags) {
            if (tag.special) {
                switch (tag.name) {
                    case SPECIAL_TAGS.debug:
                        debug = true;
                    case SPECIAL_TAGS.only:
                        suiteSet.add(suite.id);
                        break;
                    case SPECIAL_TAGS.skip:
                        skipSet.add(suite.id);
                        break;
                }
            } else if (!tag.config) {
                allTags.add(tag);
            }
        }
        if (skipSet.has(suite.id) && !suiteSet.has(suite.id)) {
            suite.skip = true;
        }
        let result;
        try {
            result = suiteFn();
        } finally {
            suiteStack.pop();
            if (!originalSuite) {
                suites.push(suite);
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
        if (config.nostandalone && !current) {
            throw new Error(
                "Test runner is setup to refuse standalone tests. Please add a surrounding 'suite' statement."
            );
        }
        if (status !== "ready") {
            throw new Error("Cannot add a test after starting the test runner");
        }
        const tags = makeTags(current?.tags, testTags);
        if (handleMulti(tags, name, testFn, testTags)) {
            return;
        }
        const test = new Test(current, name, testFn, tags);
        (current?.jobs || rootJobs).push(test);
        if (!test.parent.config.multi) {
            tests.push(test);
        }
        for (const tag of tags) {
            if (tag.special) {
                switch (tag.name) {
                    case SPECIAL_TAGS.debug:
                        debug = true;
                    case SPECIAL_TAGS.only:
                        testSet.add(test.id);
                        break;
                    case SPECIAL_TAGS.skip:
                        skipSet.add(test.id);
                        break;
                }
            } else if (!tag.config) {
                allTags.add(tag);
            }
        }
        if (skipSet.has(test.id) && !testSet.has(test.id)) {
            test.skip = true;
        }
    }

    /**
     * @param {() => MaybePromise<void>} callback
     */
    function afterAll(callback) {
        callbacks.add("after-all", callback);
    }

    /**
     * @param {(suite: Suite) => MaybePromise<void>} callback
     */
    function afterAnySuite(callback) {
        callbacks.add("after-suite", callback);
    }

    /**
     * @param {(test: Test) => MaybePromise<void>} callback
     */
    function afterAnyTest(callback) {
        callbacks.add("after-test", callback);
    }

    /**
     * @param {(suite: Suite) => MaybePromise<void>} callback
     */
    function afterSuite(callback) {
        const current = getCurrent();
        if (!current) {
            throw new Error(`"afterSuite" can only be called when a suite is currently running`);
        }
        current.callbacks.add("after-suite", callback);
    }

    /**
     * @param {(test: Test) => MaybePromise<void>} callback
     */
    function afterTest(callback) {
        (getCurrent()?.callbacks || callbacks).add("after-test", callback);
    }

    /**
     * @param {() => MaybePromise<void>} callback
     */
    function beforeAll(callback) {
        callbacks.add("before-all", callback);
    }

    /**
     * @param {(suite: Suite) => MaybePromise<void>} callback
     */
    function beforeAnySuite(callback) {
        callbacks.add("before-suite", callback);
    }

    /**
     * @param {(test: Test) => MaybePromise<void>} callback
     */
    function beforeAnyTest(callback) {
        callbacks.add("before-test", callback);
    }

    /**
     * @param {(suite: Suite) => MaybePromise<void>} callback
     */
    function beforeSuite(callback) {
        const current = getCurrent();
        if (!current) {
            throw new Error(`"beforeSuite" should only be called inside a suite definition`);
        }
        current.callbacks.add("before-suite", callback);
    }

    function beforeTest(callback) {
        (getCurrent()?.callbacks || callbacks).add("before-test", callback);
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
        const urlParams = url.params;
        if (urlParams.tag) {
            hasFilter = true;
            for (const name of urlParams.tag) {
                tagSet.add(name);
            }
        }
        if (urlParams.filter) {
            hasFilter = true;
            textFilter = parseRegExp(normalize(urlParams.filter.join(" ")));
        }

        const { get, remove } = storage("session");
        const previousFails = get("hoot-failed-tests", []);
        if (previousFails.length) {
            // Previously failed tests
            hasFilter = true;
            remove("hoot-failed-tests");
            for (const id of previousFails) {
                testSet.add(id);
            }
        } else {
            // Suites
            if (urlParams.suite) {
                hasFilter = true;
                for (const id of urlParams.suite) {
                    if (id.startsWith(SKIP_PREFIX)) {
                        skipSet.add(id.slice(SKIP_PREFIX.length));
                    } else {
                        suiteSet.add(id);
                    }
                }
            }
            // Tests
            if (urlParams.debugTest) {
                hasFilter = true;
                debug = true;
                for (const id of urlParams.debugTest) {
                    testSet.add(id);
                }
            } else if (urlParams.test) {
                hasFilter = true;
                for (const id of urlParams.test) {
                    if (id.startsWith(SKIP_PREFIX)) {
                        skipSet.add(id.slice(SKIP_PREFIX.length));
                    } else {
                        testSet.add(id);
                    }
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
                if (suiteSet.has(job.id)) {
                    // The suite is in the suites' 'only' set
                    return true;
                }
                job.jobs = prepareJobs(job.jobs);
                if (job.jobs.length) {
                    // The suite has valid tests to run
                    return true;
                }
            } else {
                if (testSet.has(job.id)) {
                    // The test is in the tests' 'only' set
                    return true;
                }
            }

            if (tagSet.size && job.tags.some((tag) => tagSet.has(tag.id))) {
                // The job has a matching tag
                return true;
            }

            if (textFilter) {
                // The job matches the URL filter
                const fullName = normalize(job.fullName);
                return textFilter instanceof RegExp
                    ? textFilter.test(fullName)
                    : getFuzzyScore(textFilter, fullName) > 0;
            } else {
                // There are no 'only' suites or 'only' tests
                return suiteSet.size + testSet.size === 0;
            }
        });
        return config.randomorder ? shuffle(filteredJobs) : filteredJobs;
    }

    /**
     * @param {(test: Test) => MaybePromise<void>} callback
     */
    function registerCleanup(callback) {
        const cleanup = () => {
            callbacks.remove(cleanup);
            return callback();
        };

        callbacks.add("after-test", cleanup);
    }

    /**
     * @param {Suite} suite
     */
    async function runSuite(suite) {
        if (suite.visited === 0) {
            // before suite code
            suiteStack.push(suite);

            callbacks.add("before-suite", suite.callbacks);
            callbacks.add("before-test", suite.callbacks);
            callbacks.add("after-test", suite.callbacks);
            callbacks.add("skipped-test", suite.callbacks);
            callbacks.add("after-suite", suite.callbacks);

            await callbacks.call("before-suite", suite);
        }
        if (suite.visited === suite.jobs.length) {
            // after suite code
            suiteStack.pop();

            callbacks.remove("before-suite", suite.callbacks);
            callbacks.remove("before-test", suite.callbacks);
            callbacks.remove("after-test", suite.callbacks);
            callbacks.remove("skipped-test", suite.callbacks);
            callbacks.remove("after-suite", suite.callbacks);

            if (debug) {
                missedCallbacks.push(() => callbacks.call("after-suite", suite));
            } else {
                await callbacks.call("after-suite", suite);
            }
        }
    }

    /**
     * @param {Test} test
     */
    async function runTest(test) {
        const run = (assert) => {
            let timeoutId;
            const timeout = test.config.timeout || config.timeout;
            return Promise.race([
                // Test promise
                test.run(assert.methods),
                // Abort & timeout promise
                new Promise((resolve, reject) => {
                    // Set abort signal
                    abortCurrent = resolve;

                    if (!debug) {
                        // Set timeout
                        timeoutId = setTimeout(
                            () => reject(new TimeoutError(`test took longer than ${timeout}ms`)),
                            timeout
                        );
                    }
                }).then(() => {
                    assert.aborted = true;
                }),
            ]).finally(() => {
                abortCurrent = () => null;
                clearTimeout(timeoutId);
            });
        };

        if (test.skip) {
            await callbacks.call("skipped-test", test);
        } else {
            // Before test
            const assert = makeAssert();

            await callbacks.call("before-test", test);

            // Setup
            if (url.params.notrycatch) {
                await run(assert);
            } else {
                try {
                    await run(assert);
                } catch (err) {
                    assert.error = err;
                    assert.pass = false;
                }
            }

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
                assert.methods.ok(0, `Expected at least 1 assertion, but none were run`);
            }

            assert.end();

            for (const [key, value] of Object.entries(assert)) {
                if (typeof value !== "function") {
                    test.lastResults[key] = value;
                }
            }

            // After test (ignored in debug mode)
            if (debug) {
                missedCallbacks.push(() => callbacks.call("after-test", test));
            } else {
                await callbacks.call("after-test", test);

                if (url.params.failfast && !assert.pass && !test.skip) {
                    return stop();
                }
            }
        }
    }

    /**
     * @param {(test: Test) => MaybePromise<void>} callback
     */
    function skippedAnyTest(callback) {
        callbacks.add("skipped-test", callback);
    }

    /**
     * @param {(test: Test) => MaybePromise<void>} callback
     */
    function skippedTest(callback) {
        (getCurrent()?.callbacks || callbacks).add("skipped-test", callback);
    }

    async function start() {
        // Make sure that code that wants to run right after the DOM is ready gets
        // the opportunity to execute (and maybe call some hook such as 'beforeAll').
        await Promise.resolve();

        if (status !== "ready") {
            return;
        }

        status = "running";
        const jobs = prepareJobs(rootJobs);

        await callbacks.call("before-all");

        let job = jobs.shift();
        while (job && status === "running") {
            if (job instanceof Suite) {
                await runSuite(job);
                job = job.jobs[job.visited++] || job.parent || jobs.shift();
            } else {
                await runTest(job);
                job = job.parent || jobs.shift();
            }
        }

        if (!debug) {
            await stop();
        }
    }

    async function stop() {
        abortCurrent();
        status = "ready";

        while (missedCallbacks.length) {
            await missedCallbacks.pop()();
        }

        await callbacks.call("after-all");
    }

    const url = makeURLStore({ history, location });
    const initialConfig = { ...DEFAULT_CONFIG, ...params };
    const rawConfig = { ...initialConfig, meta: { ...initialConfig.meta } };

    for (const key in url.params) {
        if (key in rawConfig) {
            rawConfig[key] = url.params[key][0];
        }
    }
    const config = reactive(rawConfig, () => {
        for (const key in config) {
            if (key === "meta") {
                continue;
            }
            if (config[key] !== initialConfig[key]) {
                url.setParams({ [key]: config[key] });
            } else {
                url.setParams({ [key]: null });
            }
        }
    });

    const test = makeTaggable(addTest);
    const suite = makeTaggable(addSuite);

    /** @type {Suite[]} */
    const suiteStack = [];

    /** @type {"ready" | "running"} */
    let status = "ready";
    let textFilter = "";
    let hasFilter = false;
    let debug = false;

    const skipSet = new Set();
    const suiteSet = new Set();
    const tagSet = new Set();
    const testSet = new Set();

    const tests = [];
    const suites = [];

    const callbacks = makeCallbacks();
    const missedCallbacks = [];

    /** @type {Job[]} */
    const rootJobs = [];
    const allTags = new Set();

    let abortCurrent = () => {};

    initFilters();

    return {
        get debug() {
            return debug;
        },
        get hasFilter() {
            return hasFilter;
        },
        get status() {
            return status;
        },
        get suites() {
            return suites;
        },
        get tags() {
            return [...allTags];
        },
        get tests() {
            return tests;
        },
        config,
        url,
        afterAll,
        afterAnySuite,
        afterAnyTest,
        afterSuite,
        afterTest,
        beforeAll,
        beforeAnySuite,
        beforeAnyTest,
        beforeSuite,
        beforeTest,
        registerCleanup,
        skippedAnyTest,
        skippedTest,
        start,
        stop,
        suite,
        test,
    };
}
