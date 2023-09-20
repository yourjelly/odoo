/** @odoo-module */

/**
 * @typedef {Record<string, any>} Schema
 */

//-----------------------------------------------------------------------------
// Internal
//-----------------------------------------------------------------------------

/**
 * @template {Schema} T
 * @param {T} schema
 * @returns {{ [key in keyof T]: ReturnType<T[key]["parse"]> }}
 */
const getSchemaDefaults = (schema) =>
    Object.fromEntries(Object.entries(schema).map(([key, value]) => [key, value.default]));

/**
 * @template {Schema} T
 * @param {T} schema
 * @returns {(keyof T)[]}
 */
const getSchemaKeys = (schema) => Object.keys(schema);

/**
 * @template T
 * @param {(values: string[]) => T} parse
 * @returns {(valueIfEmpty: T) => (values: string[]) => T}
 */
const makeParser = (parse) => (valueIfEmpty) => (values) =>
    values.length ? parse(values) : valueIfEmpty;

const parseBoolean = makeParser(([value]) => value === "true");

const parseNumber = makeParser(([value]) => Number(value) || 0);

/** @type {ReturnType<typeof makeParser<"first-fail" | "failed" | false>>} */
const parseShowDetail = makeParser(([value]) => (value === "false" ? false : value));

const parseString = makeParser(([value]) => value);

const parseStringArray = makeParser((values) => values);

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

export function getJobConfig() {

}

/** @implements {Schema} */
export const CONFIG_SCHEMA = {
    /**
     * Amount of failed tests after which the test runner will be aborted.
     * A falsy value (including 0) means that the runner should not be aborted.
     * @default false
     */
    bail: {
        default: 0,
        parse: parseNumber(1),
    },
    /**
     * Whether to render the test runner user interface.
     * Note: this cannot be changed on runtime: the UI will not be un-rendered or
     * rendered if this param changes.
     * @default false
     */
    headless: {
        default: false,
        parse: parseBoolean(true),
    },
    /**
     * Whether the test runner must be manually started after page load (defaults
     * to starting automatically).
     * @default false
     */
    manual: {
        default: false,
        parse: parseBoolean(true),
    },
    /**
     * Removes the safety try .. catch statements around the tests' run functions
     * to let errors bubble to the browser.
     * @default false
     */
    notrycatch: {
        default: false,
        parse: parseBoolean(true),
    },
    /**
     * Shuffles the running order of tests and suites.
     * @default false
     */
    randomorder: {
        default: false,
        parse: parseBoolean(true),
    },
    /**
     * Determines how the failed tests must be unfolded in the UI:
     * - "first-fail": only the first failed test will be unfolded
     * - "failed": all failed tests will be unfolded
     * - false: all tests will remain folded
     * @default "first-fail"
     */
    showdetail: {
        default: "first-fail",
        parse: parseShowDetail("failed"),
    },
    /**
     * Shows all completed tests including those who passed.
     * @default false
     */
    showpassed: {
        default: false,
        parse: parseBoolean(true),
    },
    /**
     * Shows all skipped tests.
     * @default false
     */
    showskipped: {
        default: false,
        parse: parseBoolean(true),
    },
    /**
     * Duration (in seconds) at the end of which a test will automatically fail.
     * @default 5_000
     */
    timeout: {
        default: 5_000,
        parse: parseNumber(5_000),
    },
};

/** @implements {Schema} */
export const FILTER_SCHEMA = {
    /**
     * Same as the `test` filter while also setting the test runner in "debug" mode.
     * See TestRunner.debug for more info.
     * @default []
     */
    debugTest: {
        default: [],
        parse: parseStringArray([]),
    },
    /**
     * Search string that will filter only matching tests/suites, based on:
     * - their name
     * - the name(s) of their parent suite(s)
     * - their tags
     * @default ""
     */
    filter: {
        default: "",
        parse: parseString(""),
    },
    /**
     * Only suites to run (based on their hash ID).
     * @default []
     */
    suite: {
        default: [],
        parse: parseStringArray([]),
    },
    /**
     * Only suites and tests matching these tags to run (based on their full name).
     * @default []
     */
    tag: {
        default: [],
        parse: parseStringArray([]),
    },
    /**
     * Only tests to run (based on their hash ID).
     * @default []
     */
    test: {
        default: [],
        parse: parseStringArray([]),
    },
};

/** @see {CONFIG_SCHEMA} */
export const DEFAULT_CONFIG = getSchemaDefaults(CONFIG_SCHEMA);
export const CONFIG_KEYS = getSchemaKeys(CONFIG_SCHEMA);

/** @see {FILTER_SCHEMA} */
export const DEFAULT_FILTERS = getSchemaDefaults(FILTER_SCHEMA);
export const FILTER_KEYS = getSchemaKeys(FILTER_SCHEMA);
