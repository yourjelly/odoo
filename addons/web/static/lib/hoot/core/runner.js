/** @odoo-module */

import { reactive } from "@odoo/owl";
import { Error, Promise, clearTimeout, setTimeout } from "../globals";
import {
    getFuzzyScore,
    log,
    makeCallbacks,
    normalize,
    parseRegExp,
    shuffle,
    storage,
} from "../utils";
import { DEFAULT_CONFIG } from "./config";
import { Suite } from "./suite";
import { Tag, createTags } from "./tag";
import { Test } from "./test";
import { SKIP_PREFIX, setParams, urlParams } from "./url";

/**
 * @template T
 * @typedef {T | PromiseLike<T>} MaybePromise
 */

//-----------------------------------------------------------------------------
// Internal
//-----------------------------------------------------------------------------

const suiteError = (name, message) =>
    new Error(`Error while registering suite "${name}": ${message}`);

const testError = (name, message) =>
    new Error(`Error while registering test "${name}": ${message}`);

class TimeoutError extends Error {
    name = "TimeoutError";
}

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

export class TestRunner {
    debug = false;
    /** @type {"ready" | "running"} */
    status = "ready";
    /** @type {Suite[]} */
    suites = [];
    /** @type {Set<Tag>} */
    tags = new Set();
    /** @type {Test[]} */
    tests = [];
    /** @type {string | RegExp} */
    textFilter = "";

    get hasFilter() {
        return this.#hasExcludeFilter || this.#hasIncludeFilter;
    }

    #callbacks = makeCallbacks();
    /** @type {Test | null} */
    #currentTest = null;
    #failed = 0;
    #hasExcludeFilter = false;
    #hasIncludeFilter = false;
    /** @type {import("./job").Job[]} */
    #jobs = [];
    #missedCallbacks = [];

    #include = {
        suites: new Set(),
        tags: new Set(),
        tests: new Set(),
    };
    #exclude = {
        suites: new Set(),
        tags: new Set(),
        tests: new Set(),
    };
    #only = {
        suites: new Set(),
        // tags: new Set(),
        tests: new Set(),
    };

    // #skip = {
    //     suites: new Set(),
    //     tags: new Set(),
    //     tests: new Set(),
    // };
    /** @type {Suite[]} */
    #suiteStack = [];

    #abortCurrent = () => {};

    /**
     * @param {typeof DEFAULT_CONFIG} config
     */
    constructor(config) {
        const initialConfig = { ...DEFAULT_CONFIG, ...config };
        this.config = reactive({ ...initialConfig, ...urlParams }, () => {
            for (const key in this.config) {
                if (this.config[key] !== initialConfig[key]) {
                    setParams({ [key]: this.config[key] });
                } else {
                    setParams({ [key]: null });
                }
            }
        });

        const { get, remove } = storage("session");
        const previousFails = get("failed-tests", []);
        if (previousFails.length) {
            // Previously failed tests
            this.#hasIncludeFilter = true;
            remove("failed-tests");
            for (const id of previousFails) {
                this.#include.tests.add(id);
            }
            return;
        }

        // Text filter
        if (urlParams.filter) {
            this.#hasIncludeFilter = true;
            this.textFilter = parseRegExp(normalize(urlParams.filter));
        }

        // Suites
        if (urlParams.suite) {
            for (const id of urlParams.suite) {
                if (id.startsWith(SKIP_PREFIX)) {
                    this.#hasExcludeFilter = true;
                    this.#exclude.suites.add(id.slice(SKIP_PREFIX.length));
                } else {
                    this.#hasIncludeFilter = true;
                    this.#include.suites.add(id);
                }
            }
        }

        // Tags
        if (urlParams.tag) {
            for (const name of urlParams.tag) {
                if (name.startsWith(SKIP_PREFIX)) {
                    this.#hasExcludeFilter = true;
                    this.#exclude.tags.add(name.slice(SKIP_PREFIX.length));
                } else {
                    this.#hasIncludeFilter = true;
                    this.#include.tags.add(name);
                }
            }
        }

        // Tests
        if (urlParams.debugTest) {
            this.#hasIncludeFilter = true;
            this.debug = true;
            for (const id of urlParams.debugTest) {
                this.#include.tests.add(id);
            }
        } else if (urlParams.test) {
            for (const id of urlParams.test) {
                if (id.startsWith(SKIP_PREFIX)) {
                    this.#hasExcludeFilter = true;
                    this.#exclude.tests.add(id.slice(SKIP_PREFIX.length));
                } else {
                    this.#hasIncludeFilter = true;
                    this.#include.tests.add(id);
                }
            }
        }
    }

    /**
     * @param {string[]} tagNames
     * @param {string} name
     * @param {(() => void) | string} fn
     * @param {...(() => void) | string} nestedSuiteArgs
     */
    addSuite(tagNames, name, fn, ...nestedSuiteArgs) {
        name = name.toLowerCase();
        if (typeof fn === "string") {
            const nestedSuiteFn = () => this.addSuite(tagNames, fn, ...nestedSuiteArgs);
            return this.addSuite([], name, nestedSuiteFn);
        }
        if (typeof fn !== "function") {
            throw suiteError(
                name,
                `expected second argument to be a function and got ${String(fn)}`
            );
        }
        if (this.status !== "ready") {
            throw suiteError(name, `cannot add a suite after the test this started`);
        }
        const { suite: currentSuite } = this.getCurrent();
        const tags = createTags(currentSuite?.tags, tagNames);
        let suite = new Suite(currentSuite, name, fn, tags);
        const originalSuite = this.suites.find((s) => s.id === suite.id);
        if (originalSuite) {
            suite = originalSuite;
        } else {
            this.suites.push(suite);
            (currentSuite?.jobs || this.#jobs).push(suite);
        }
        this.#suiteStack.push(suite);
        for (const tag of tags) {
            if (tag.special) {
                switch (tag.name) {
                    case Tag.DEBUG:
                        this.debug = true;
                    // fall through
                    case Tag.ONLY:
                        this.#only.suites.add(suite.id);
                        break;
                    case Tag.SKIP:
                        if (this.#only.suites.has(suite.id)) {
                            log.warn(`'skip' tag of suite ${suite.name} has been ignored`);
                        } else {
                            suite.config.skip = true;
                        }
                        break;
                    case Tag.TODO:
                        suite.config.todo = true;
                        break;
                }
            } else if (!tag.config) {
                this.tags.add(tag);
            }
        }
        let result;
        try {
            result = fn();
        } finally {
            this.#suiteStack.pop();
        }
        if (result !== undefined) {
            throw suiteError(name, `the suite function cannot return a value`);
        }
    }

    /**
     * @param {string[]} tagNames
     * @param {string} name
     * @param {() => void | PromiseLike<void>} fn
     */
    addTest(tagNames, name, fn) {
        const { suite: currentSuite } = this.getCurrent();
        if (!currentSuite) {
            throw testError(name, `cannot register a test outside of a suite.`);
        }
        if (typeof fn !== "function") {
            throw testError(
                name,
                `expected second argument to be a function and got ${String(fn)}`
            );
        }
        if (this.status !== "ready") {
            throw testError(name, `cannot add a test after the test this started.`);
        }
        const tags = createTags(currentSuite?.tags, tagNames);
        const test = new Test(currentSuite, name, fn, tags);
        if (this.tests.some((t) => t.fullName === test.fullName)) {
            throw testError(
                name,
                `a test with that name already exists in the suite "${currentSuite.name}"`
            );
        }
        (currentSuite?.jobs || this.#jobs).push(test);
        this.tests.push(test);
        for (const tag of tags) {
            if (tag.special) {
                switch (tag.name) {
                    case Tag.DEBUG:
                        this.debug = true;
                    // fall through
                    case Tag.ONLY:
                        this.#only.tests.add(test.id);
                        break;
                    case Tag.SKIP:
                        if (this.#only.tests.has(test.id)) {
                            log.warn(`'skip' tag of test ${test.name} has been ignored`);
                        } else {
                            test.config.skip = true;
                        }
                        break;
                    case Tag.TODO:
                        test.config.todo = true;
                        break;
                }
            } else if (!tag.config) {
                this.tags.add(tag);
            }
        }
    }

    /**
     * @param {() => MaybePromise<void>} callback
     */
    afterAll(callback) {
        this.#callbacks.add("after-all", callback);
    }

    /**
     * @param {(test: Test) => MaybePromise<void>} callback
     */
    afterAnySkippedTest(callback) {
        this.#callbacks.add("after-skipped-test", callback);
    }

    /**
     * @param {(suite: Suite) => MaybePromise<void>} callback
     */
    afterAnySuite(callback) {
        this.#callbacks.add("after-suite", callback);
    }

    /**
     * @param {(test: Test) => MaybePromise<void>} callback
     */
    afterAnyTest(callback) {
        this.#callbacks.add("after-test", callback);
    }

    /**
     * @param {(test: Test) => MaybePromise<void>} callback
     */
    afterEach(callback) {
        const { suite } = this.getCurrent();
        if (!suite) {
            throw new Error(
                `Error while calling hook "afterEach": can only be called inside of a suite function.`
            );
        }
        suite.callbacks.add("after-test", callback);
    }

    /**
     * @param {(test: Test) => MaybePromise<void>} callback
     */
    afterEachSkipped(callback) {
        const { suite } = this.getCurrent();
        if (!suite) {
            throw new Error(
                `Error while calling hook "afterEachSkipped": can only be called inside of a suite function.`
            );
        }
        suite.callbacks.add("after-skipped-test", callback);
    }

    /**
     * @param {(suite: Suite) => MaybePromise<void>} callback
     */
    afterSuite(callback) {
        const { suite } = this.getCurrent();
        if (!suite) {
            throw new Error(
                `Error while calling hook "afterSuite": can only be called inside of a suite function.`
            );
        }
        suite.callbacks.add("after-suite", callback);
    }

    /**
     * @param {() => MaybePromise<void>} callback
     */
    beforeAll(callback) {
        this.#callbacks.add("before-all", callback);
    }

    /**
     * @param {(suite: Suite) => MaybePromise<void>} callback
     */
    beforeAnySuite(callback) {
        this.#callbacks.add("before-suite", callback);
    }

    /**
     * @param {(test: Test) => MaybePromise<void>} callback
     */
    beforeAnyTest(callback) {
        this.#callbacks.add("before-test", callback);
    }

    /**
     * @param {(test: Test) => MaybePromise<void>} callback
     */
    beforeEach(callback) {
        const { suite } = this.getCurrent();
        if (!suite) {
            throw new Error(
                `Error while calling hook "beforeEach": can only be called inside of a suite function.`
            );
        }
        suite.callbacks.add("before-test", callback);
    }

    /**
     * @param {(suite: Suite) => MaybePromise<void>} callback
     */
    beforeSuite(callback) {
        const { suite } = this.getCurrent();
        if (!suite) {
            throw new Error(
                `Error while calling hook "beforeSuite": can only be called inside of a suite function.`
            );
        }
        suite.callbacks.add("before-suite", callback);
    }

    getCurrent() {
        return {
            suite: this.#suiteStack.at(-1) || null,
            test: this.#currentTest,
        };
    }

    /**
     * @param {(test: Test) => MaybePromise<void>} callback
     */
    registerCleanup(callback) {
        const cleanup = () => {
            this.#callbacks.remove("after-test", cleanup);
            return callback();
        };

        this.#callbacks.add("after-test", cleanup);
    }

    /**
     * ! This function should NOT be splitted into sub-functions as it would
     * ! bloat the stack traces generated by errors/console. We want to keep
     * ! it to a minimum (i.e. TestRunner.start() > Test.run() > Error)
     */
    async start() {
        if (this.status !== "ready") {
            return;
        }

        this.status = "running";
        const jobs = this.#prepareJobs(this.#jobs);

        await this.#callbacks.call("before-all");

        let job = jobs.shift();
        while (job && this.status === "running") {
            const callbackChain = this.#getCallbackChain(job);
            if (job instanceof Suite) {
                const suite = job;
                if (suite.canRun()) {
                    if (suite.visited === 0) {
                        // before suite code
                        this.#suiteStack.push(suite);

                        for (const callbacks of [...callbackChain].reverse()) {
                            await callbacks.call("before-suite", suite);
                        }
                    }
                    if (suite.visited === suite.jobs.length) {
                        // after suite code
                        this.#suiteStack.pop();

                        await this.#execAfterCallback(async () => {
                            for (const callbacks of callbackChain) {
                                await callbacks.call("after-suite", suite);
                            }
                        });
                    }
                }
                job = suite.jobs[suite.visited++] || suite.parent || jobs.shift();
            } else {
                const test = job;
                if (test.config.skip) {
                    for (const callbacks of callbackChain) {
                        await callbacks.call("after-skipped-test", test);
                    }
                } else {
                    // Before test
                    this.#currentTest = test;
                    for (const callbacks of [...callbackChain].reverse()) {
                        await callbacks.call("before-test", test);
                    }

                    // Setup
                    const timeout = test.config.timeout || this.config.timeout;
                    let timeoutId;
                    await Promise.race([
                        // Test promise
                        test.run(),
                        // Abort & timeout promise
                        new Promise((resolve, reject) => {
                            // Set abort signal
                            this.#abortCurrent = resolve;

                            if (timeout && !this.debug) {
                                // Set timeout
                                timeoutId = setTimeout(
                                    () =>
                                        reject(
                                            new TimeoutError(`test took longer than ${timeout}s`)
                                        ),
                                    timeout
                                );
                            }
                        }).then(() => (test.lastResults.aborted = true)),
                    ])
                        .catch((error) => {
                            const results = test.lastResults;
                            results.error = error;
                            results.pass = false;
                            if (this.config.notrycatch) {
                                throw error;
                            }
                        })
                        .finally(() => {
                            this.#abortCurrent = () => null;
                            clearTimeout(timeoutId);
                        });

                    await this.#execAfterCallback(async () => {
                        for (const callbacks of callbackChain) {
                            await callbacks.call("after-test", test);
                        }
                        if (this.config.bail) {
                            if (!test.config.skip && !test.lastResults.pass) {
                                this.#failed++;
                            }
                            if (this.#failed >= this.config.bail) {
                                return this.stop();
                            }
                        }
                    });
                }
                if (!test.config.multi || ++test.visited === test.config.multi) {
                    this.#currentTest = null;
                    job = test.parent || jobs.shift();
                }
            }
        }

        if (!this.debug) {
            await this.stop();
        }
    }

    async stop() {
        this.#abortCurrent();
        this.status = "ready";

        while (this.#missedCallbacks.length) {
            await this.#missedCallbacks.shift()();
        }

        await this.#callbacks.call("after-all");
    }

    /**
     * Executes a given callback when not in debug mode.
     * @param {() => Promise<void>} callback
     */
    async #execAfterCallback(callback) {
        if (this.debug) {
            this.#missedCallbacks.push(callback);
        } else {
            await callback();
        }
    }

    /**
     * @param {import("./job").Job} job
     */
    #getCallbackChain(job) {
        const chain = [];
        while (job) {
            if (job instanceof Suite) {
                chain.push(job.callbacks);
            }
            job = job.parent;
        }
        chain.push(this.#callbacks);
        return chain;
    }

    /**
     * @param {import("./job").Job} job
     */
    #includeSubJobs(job) {
        if (!(job instanceof Suite)) {
            return;
        }
        for (const subJob of job.jobs) {
            if (subJob instanceof Suite) {
                this.#include.suites.add(subJob.id);
            } else {
                this.#include.tests.add(subJob.id);
            }
        }
    }

    #isIncluded(job) {
        const isSuite = job instanceof Suite;

        // Priority 1: always included if in the "only" set (tag "only" or failed tests)
        const onlySet = isSuite ? this.#only.suites : this.#only.tests;
        if (onlySet.has(job.id)) {
            this.#includeSubJobs(job);
            return true;
        }

        // Priority 2: excluded if in the test or suite "exlude" set
        const excludeSet = isSuite ? this.#exclude.suites : this.#exclude.tests;
        if (excludeSet.has(job.id)) {
            return false;
        }

        // Priority 3: included if in the test or suite "include" set
        const includeSet = isSuite ? this.#include.suites : this.#include.tests;
        if (includeSet.has(job.id)) {
            this.#includeSubJobs(job);
            return true;
        }

        // Priority 4: excluded if one of the job tags is in the tag "exlude" set
        const excludedTags = [...this.#exclude.tags];
        if (excludedTags.some((tag) => job.tagNames.has(tag))) {
            return false;
        }

        // Priority 5: included if one of the job tags is in the tag "include" set
        const includedTags = [...this.#include.tags];
        if (includedTags.some((tag) => job.tagNames.has(tag))) {
            this.#includeSubJobs(job);
            return true;
        }

        // Priority 6: included if the job name matches the text filter
        if (this.textFilter) {
            if (
                this.textFilter instanceof RegExp
                    ? this.textFilter.test(job.index)
                    : getFuzzyScore(this.textFilter, job.index) > 0
            ) {
                return true;
            }
        }

        // If no match: is included if there is no other specific include filter
        return !this.#hasIncludeFilter;
    }

    /**
     * @param {import("./job").Job[]} jobs
     */
    #prepareJobs(jobs) {
        const filteredJobs = jobs.filter((job) => {
            let included = this.#isIncluded(job);
            if (job instanceof Suite) {
                // For suites: included if at least 1 included job
                if (included) {
                    for (const subJob of job.jobs) {
                        if (subJob instanceof Suite) {
                            this.#include.suites.add(subJob.id);
                        } else {
                            this.#include.tests.add(subJob.id);
                        }
                    }
                }
                job.jobs = this.#prepareJobs(job.jobs);
                included ||= job.jobs.length;
            }
            return included;
        });

        return this.config.randomorder ? shuffle(filteredJobs) : filteredJobs;
    }
}
