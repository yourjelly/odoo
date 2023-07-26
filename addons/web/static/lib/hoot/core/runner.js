/** @odoo-module **/

import { reactive } from "@odoo/owl";
import { makeAssert } from "../assertions/assert";
import { Error, Promise, clearTimeout, history, location, setTimeout } from "../globals";
import {
    SPECIAL_TAGS,
    log,
    lookup,
    makeCallbacks,
    makeTaggable,
    match,
    shuffle,
    storage,
} from "../utils";
import { Suite } from "./suite";
import { makeTags } from "./tag";
import { Test } from "./test";
import { DEFAULT_CONFIG, makeURLStore } from "./url";

/**
 * @typedef {import("../assertions/assert").AssertMethods} AssertMethods
 *
 * @typedef {Suite | Test} Job
 */

/**
 * @template T
 * @typedef {T | PromiseLike<T>} MaybePromise
 */

// ---------------------------------------------------------------------------
// TestRunner
// ---------------------------------------------------------------------------

class TimeoutError extends Error {
    name = "TimeoutError";
}

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
        let suite = new Suite(
            current,
            name,
            tags.filter((tag) => !tag.special)
        );
        const originalSuite = suites.find((s) => s.id === suite.id);
        if (originalSuite) {
            suite = originalSuite;
        } else {
            (current?.jobs || currentJobs).push(suite);
        }
        suiteStack.push(suite);
        for (const tag of tags) {
            switch (tag.name) {
                case SPECIAL_TAGS.debug:
                    debug = true;
                case SPECIAL_TAGS.only:
                    onlySet.add(suite.id);
                    break;
                case SPECIAL_TAGS.skip:
                    skipSet.add(suite.id);
                    break;
                default:
                    currentTags.add(tag);
            }
        }
        if (skipSet.has(suite.id) && !onlySet.has(suite.id)) {
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
        const test = new Test(
            current,
            name,
            testFn,
            tags.filter((tag) => !tag.special)
        );
        (current?.jobs || currentJobs).push(test);
        tests.push(test);
        for (const tag of tags) {
            switch (tag.name) {
                case SPECIAL_TAGS.debug:
                    debug = true;
                case SPECIAL_TAGS.only:
                    onlySet.add(test.id);
                    break;
                case SPECIAL_TAGS.skip:
                    skipSet.add(test.id);
                    break;
                default:
                    currentTags.add(tag);
            }
        }
        if (skipSet.has(test.id) && !onlySet.has(test.id)) {
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
        }
        if (urlParams.skip) {
            hasFilter = true;
            for (const id of urlParams.skip) {
                skipSet.add(id);
            }
        }

        const { get, remove } = storage("session");
        const previousFails = get("hoot-failed-tests", []);
        if (previousFails.length) {
            hasFilter = true;
            remove("hoot-failed-tests");
            for (const id of previousFails) {
                onlySet.add(id);
            }
        } else if (urlParams.debugTest) {
            hasFilter = true;
            debug = true;
            for (const id of urlParams.debugTest) {
                onlySet.add(id);
            }
        } else if (urlParams.test) {
            hasFilter = true;
            for (const id of urlParams.test) {
                onlySet.add(id);
            }
        } else if (urlParams.suite) {
            hasFilter = true;
            for (const id of urlParams.suite) {
                onlySet.add(id);
            }
        }
    }

    function prepareJobs() {
        /**
         * @param {Job[]} jobs
         * @param {(job: Job) => boolean} predicate
         */
        function getValidJobs(jobs, predicate) {
            return jobs.filter((job) => shouldBeRun(job, predicate));
        }

        /**
         * @param {Job} job
         * @param {(job: Job) => boolean} predicate
         */
        function shouldBeRun(job, predicate) {
            if (predicate(job)) {
                return true;
            }
            if (job instanceof Suite) {
                const subJobs = getValidJobs(job.jobs, predicate);
                if (subJobs.length) {
                    job.jobs = subJobs;
                    return true;
                }
            }
            return false;
        }

        let jobs = currentJobs;
        currentJobs = [];

        if (onlySet.size) {
            jobs = getValidJobs(jobs, (job) => onlySet.has(job.id));
        }

        if (tagSet.size) {
            jobs = getValidJobs(jobs, (job) => job.tags.some((tag) => tagSet.has(tag.id)));
        }

        const textFilter = (url.params.filter || []).join(" ");
        if (textFilter) {
            const matching = [
                ...lookup(textFilter, suites, (suite) => suite.fullName),
                ...lookup(textFilter, tests, (tests) => tests.fullName),
            ];
            jobs = getValidJobs(jobs, (job) => matching.includes(job));
        }

        return config.randomorder ? shuffle(jobs) : jobs;
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
            if (config.randomorder) {
                suite.jobs = shuffle(suite.jobs);
            }

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
            return Promise.race([
                // Test promise
                test.run(assert.methods),
                // Abort & timeout promise
                new Promise((resolve, reject) => {
                    // Set abort signal
                    abortCurrent = resolve;

                    if (!debug) {
                        // Set timeout
                        timeoutId = setTimeout(() => {
                            reject(new TimeoutError(`test took longer than ${config.timeout}ms`));
                        }, config.timeout);
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
        await Promise.resolve(); // make sure code that want to run right after
        // dom ready get the opportunity to execute (and maybe listen to some
        // events, such as beforeAll)

        if (status !== "ready") {
            return;
        }

        status = "running";
        await callbacks.call("before-all");

        while (currentJobs.length && status === "running") {
            const jobs = prepareJobs();
            let job = jobs.shift();
            while (job && status === "running") {
                if (job instanceof Suite) {
                    await runSuite(job);
                    job = job.jobs[job.visited++] || job.parent || jobs.shift();
                } else if (job instanceof Test) {
                    await runTest(job);
                    job = job.parent || jobs.shift();
                }
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

    /** @type {Job[]} */
    let currentJobs = [];
    let abortCurrent = () => {};

    /** @type {Suite[]} */
    const suiteStack = [];

    /** @type {"ready" | "running"} */
    let status = "ready";

    // miscellaneous filtering rules
    let hasFilter = false;

    const onlySet = new Set();
    const skipSet = new Set();
    const tagSet = new Set();

    const tests = [];
    const suites = [];
    const currentTags = new Set();
    let debug = false;

    const callbacks = makeCallbacks();
    const missedCallbacks = [];

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
            return [...currentTags];
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
