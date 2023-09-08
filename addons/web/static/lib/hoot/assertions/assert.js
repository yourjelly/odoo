/** @odoo-module **/

import { markRaw, reactive } from "@odoo/owl";
import { Error, Object } from "../globals";
import { formatTechnical } from "../utils";
import { formatStack, multiline, red } from "./assert_helpers";

/**
 * @template F
 * @typedef {(
 *  F extends (assert: AssertInfo, ...args: infer P) => infer R
 *      ? (...args: P) => R extends Promise<any> ? Promise<void> : void
 *      : never
 *  )} AssertMethodType
 */

/**
 * @typedef {(assert: AssertInfo, ...args: any[]) => AssertResult | Promise<AssertResult>} AssertFunction
 *
 * @typedef {ReturnType<typeof makeAssert> & { isNot: boolean }} AssertInfo
 *
 * @typedef {RegisteredMethods & {
 *  not: Omit<RegisteredMethods, "step" | "verifySteps">;
 * }} AssertMethods
 *
 * @typedef {{
 *  diff?: unknown;
 *  errors?: ({ message: string } | { arg: number; expected: string; actual: string })[];
 *  info?: string[];
 *  message?: string;
 *  pass: boolean;
 * }} AssertResult
 *
 * @typedef {{
 *  between: AssertMethodType<import("./assert_between").between>;
 *  contains: AssertMethodType<import("./assert_contains").contains>;
 *  deepEqual: AssertMethodType<import("./assert_deep_equal").deepEqual>;
 *  equal: AssertMethodType<import("./assert_equal").equal>;
 *  expect: AssertMethodType<import("./assert_expect").expect>;
 *  isVisible: AssertMethodType<import("./assert_is_visible").isVisible>;
 *  hasAttribute: AssertMethodType<import("./assert_has_attribute").hasAttribute>;
 *  hasClass: AssertMethodType<import("./assert_has_class").hasClass>;
 *  match: AssertMethodType<import("./assert_match").match>;
 *  ok: AssertMethodType<import("./assert_ok").ok>;
 *  rejects: AssertMethodType<import("./assert_rejects").rejects>;
 *  step: AssertMethodType<import("./assert_step").step>;
 *  throws: AssertMethodType<import("./assert_throws").throws>;
 *  verifySteps: AssertMethodType<import("./assert_verify_steps").verifySteps>;
 * }} RegisteredMethods
 */

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

export function makeAssert() {
    /**
     * @param {boolean} isNot
     */
    function generateAssertMethods(isNot) {
        const fullInfo = { ...assertInfo, isNot };
        /** @type {RegisteredMethods} */
        const methods = {};
        for (const name in assertFns) {
            const fn = assertFns[name];
            methods[name] = {
                async [name](...args) {
                    const { stack } = new Error();
                    const fnResult = await fn(fullInfo, ...args);
                    const result = { ...fnResult, id: nextResultId++ };
                    if (result.errors?.length) {
                        const messages = result.errors.map((error) => {
                            if (error.message) {
                                return error.message;
                            } else if ("arg" in error) {
                                return `argument ${error.arg} is expected to be a ${
                                    error.expected
                                }, got ${formatTechnical(error.actual)}`;
                            } else {
                                return error;
                            }
                        });
                        assertInfo.pass = false;
                        result.message = `'assert.${name}' error`;
                        result.info = [[red("Reasons:"), multiline(messages)]];
                    }
                    if (!result.pass) {
                        const formattedStack = formatStack(stack);
                        result.info ||= [];
                        result.info.push([red("Source:"), multiline(formattedStack)]);
                    }
                    assertInfo.assertions.push(result);
                    assertInfo.pass &&= result.pass;
                },
            }[name];
        }
        return methods;
    }

    function end() {
        assertInfo.duration = Date.now() - startTime;
    }

    class Assert {
        get not() {
            return generateAssertMethods(true);
        }
    }

    let startTime = Date.now();

    const assertInfo = reactive({
        aborted: false,
        /** @type {AssertResult[]} */
        assertions: [],
        duration: 0,
        end,
        error: null,
        expects: null,
        /** @type {AssertMethods} */
        methods: markRaw(new Assert()),
        pass: true,
        /** @type {string[]} */
        steps: [],
    });

    Object.assign(assertInfo.methods, generateAssertMethods(false));

    return assertInfo;
}

/**
 * @param {AssertFunction} assertFn
 */
export function registerAssertMethod(assertFn) {
    const name = assertFn.name;
    if (!name) {
        throw new Error(`'Assert function must be named`);
    } else if (assertFns[name]) {
        throw new Error(`'${name}' assertion method already exists`);
    }
    assertFns[name] = assertFn;
}

let nextResultId = 1;

/** @type {Record<string, AssertFunction>} */
const assertFns = Object.create(null);
