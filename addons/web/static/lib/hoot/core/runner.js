/** @odoo-module */

import { reactive } from "@odoo/owl";
import { setupExpect } from "../expect";
import { Error, Promise, clearTimeout, setTimeout } from "../globals";
import { getFuzzyScore, makeCallbacks, normalize, parseRegExp, shuffle, storage } from "../utils";
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
    hasFilter = false;
    /** @type {"ready" | "running"} */
    status = "ready";
    /** @type {Suite[]} */
    suites = [];
    /** @type {Set<Tag>} */
    tags = new Set();
    /** @type {Test[]} */
    tests = [];
    textFilter = "";

    #callbacks = makeCallbacks();
    /** @type {Test | null} */
    #currentTest = null;
    /** @type {import("./job").Job[]} */
    #jobs = [];
    #missedCallbacks = [];
    #only = {
        suites: new Set(),
        tags: new Set(),
        tests: new Set(),
    };
    #skip = {
        suites: new Set(),
        tags: new Set(),
        tests: new Set(),
    };
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
            this.hasFilter = true;
            remove("failed-tests");
            for (const id of previousFails) {
                this.#only.tests.add(id);
            }
            return;
        }

        // Text filter
        if (urlParams.filter) {
            this.hasFilter = true;
            this.textFilter = parseRegExp(normalize(urlParams.filter));
        }

        // Suites
        if (urlParams.suite) {
            this.hasFilter = true;
            for (const id of urlParams.suite) {
                if (id.startsWith(SKIP_PREFIX)) {
                    this.#skip.suites.add(id.slice(SKIP_PREFIX.length));
                } else {
                    this.#only.suites.add(id);
                }
            }
        }

        // Tags
        if (urlParams.tag) {
            this.hasFilter = true;
            for (const name of urlParams.tag) {
                if (name.startsWith(SKIP_PREFIX)) {
                    this.#skip.tags.add(name.slice(SKIP_PREFIX.length));
                } else {
                    this.#only.tags.add(name);
                }
            }
        }

        // Tests
        if (urlParams.debugTest) {
            this.hasFilter = true;
            this.debug = true;
            for (const id of urlParams.debugTest) {
                this.#only.tests.add(id);
            }
        } else if (urlParams.test) {
            this.hasFilter = true;
            for (const id of urlParams.test) {
                if (id.startsWith(SKIP_PREFIX)) {
                    this.#skip.tests.add(id.slice(SKIP_PREFIX.length));
                } else {
                    this.#only.tests.add(id);
                }
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
     * @param {string[]} tagNames
     * @param {string} name
     * @param {(() => void) | string} suiteFn
     * @param {...(() => void) | string} nestedSuiteArgs
     */
    addSuite(tagNames, name, suiteFn, ...nestedSuiteArgs) {
        if (typeof suiteFn === "string") {
            const nestedSuiteFn = () => this.addSuite([], suiteFn, ...nestedSuiteArgs);
            return this.addSuite(tagNames, name, nestedSuiteFn);
        }
        if (typeof suiteFn !== "function") {
            throw suiteError(
                name,
                `expected second argument to be a function and got ${String(suiteFn)}`
            );
        }
        if (this.status !== "ready") {
            throw suiteError(name, `cannot add a suite after the test this started`);
        }
        const { suite: currentSuite } = this.getCurrent();
        const tags = createTags(currentSuite?.tags, tagNames);
        let suite = new Suite(currentSuite, name, suiteFn, tags);
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
                        this.#skip.suites.add(suite.id);
                        break;
                }
            } else if (!tag.config) {
                this.tags.add(tag);
            }
        }
        if (this.#skip.suites.has(suite.id) && !this.#only.suites.has(suite.id)) {
            suite.config.skip = true;
        }
        let result;
        try {
            result = suiteFn();
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
     * @param {() => void | PromiseLike<void>} testFn
     */
    addTest(tagNames, name, testFn) {
        const { suite: currentSuite } = this.getCurrent();
        if (!currentSuite) {
            throw testError(name, `cannot register a test outside of a suite.`);
        }
        if (typeof testFn !== "function") {
            throw testError(
                name,
                `expected second argument to be a function and got ${String(testFn)}`
            );
        }
        if (this.status !== "ready") {
            throw testError(name, `cannot add a test after the test this started.`);
        }
        const tags = createTags(currentSuite?.tags, tagNames);
        const test = new Test(currentSuite, name, testFn, tags);
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
                        this.#skip.tests.add(test.id);
                        break;
                }
            } else if (!tag.config) {
                this.tags.add(tag);
            }
        }
        if (this.#skip.tests.has(test.id) && !this.#only.tests.has(test.id)) {
            test.config.skip = true;
        }
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
     * @param {(test: Test) => MaybePromise<void>} callback
     */
    skippedAnyTest(callback) {
        this.#callbacks.add("skipped-test", callback);
    }

    /**
     * @param {(test: Test) => MaybePromise<void>} callback
     */
    skippedTest(callback) {
        const { suite } = this.getCurrent();
        if (!suite) {
            throw new Error(
                `Error while calling hook "skippedTest": can only be called inside of a suite function.`
            );
        }
        suite.callbacks.add("skipped-test", callback);
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
            if (job instanceof Suite) {
                const suite = job;
                if (suite.canRun()) {
                    if (suite.visited === 0) {
                        // before suite code
                        this.#suiteStack.push(suite);

                        await this.#callbacks.call("before-suite", suite);
                        await suite.callbacks.call("before-suite", suite);
                    }
                    if (suite.visited === suite.jobs.length) {
                        // after suite code
                        this.#suiteStack.pop();

                        await this.#execAfterCallback(async () => {
                            await suite.callbacks.call("after-suite", suite);
                            await this.#callbacks.call("after-suite", suite);
                        });
                    }
                }
                job = suite.jobs[suite.visited++] || suite.parent || jobs.shift();
            } else {
                const test = job;
                if (test.config.skip) {
                    for (const callbacks of [
                        ...this.#getSuiteCallbacks().reverse(),
                        this.#callbacks,
                    ]) {
                        callbacks.call("skipped-test", test);
                    }
                } else {
                    // Before test
                    this.#currentTest = test;
                    for (const callbacks of [this.#callbacks, ...this.#getSuiteCallbacks()]) {
                        callbacks.call("before-test", test);
                    }

                    // Setup
                    const { setStatus, tearDown } = setupExpect();

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
                        }).then(() => setStatus({ aborted: true })),
                    ])
                        .catch((error) => {
                            setStatus({ error });
                            if (this.config.notrycatch) {
                                throw error;
                            }
                        })
                        .finally(() => {
                            this.#abortCurrent = () => null;
                            clearTimeout(timeoutId);
                        });

                    if (test.hasTag(Tag.TODO)) {
                        setStatus({ pass: true });
                    }

                    test.results.push(await tearDown());

                    await this.#execAfterCallback(async () => {
                        for (const callbacks of [
                            ...this.#getSuiteCallbacks().reverse(),
                            this.#callbacks,
                        ]) {
                            callbacks.call("after-test", test);
                        }
                        if (urlParams.bail && !expect.pass && !test.config.skip) {
                            return this.stop();
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
     * @param {Job} job
     */
    #prepareJob(job) {
        if (job instanceof Suite) {
            if (this.#only.suites.has(job.id)) {
                return true;
            }
            job.jobs = this.#prepareJobs(job.jobs);
            return Boolean(job.jobs.length);
        } else {
            if (this.#only.tests.has(job.id)) {
                return true;
            }
        }

        if (this.#skip.tags.size && job.tags.some((tag) => this.#skip.tags.has(tag.id))) {
            return false;
        }
        if (this.#only.tags.size && job.tags.some((tag) => this.#only.tags.has(tag.id))) {
            return true;
        }

        if (this.textFilter) {
            // The job matches the URL filter
            if (
                this.textFilter instanceof RegExp
                    ? this.textFilter.test(job.index)
                    : getFuzzyScore(this.textFilter, job.index) > 0
            ) {
                return true;
            }
        }

        return !(
            this.#only.suites.size ||
            this.#only.tests.size ||
            this.#only.tags.size ||
            this.textFilter.length
        );
    }

    #getSuiteCallbacks() {
        return this.#suiteStack.map((s) => s.callbacks);
    }

    /**
     * @param {import("./job").Job[]} jobs
     */
    #prepareJobs(jobs) {
        const filteredJobs = jobs.filter((job) => this.#prepareJob(job));

        return this.config.randomorder ? shuffle(filteredJobs) : filteredJobs;
    }
}
