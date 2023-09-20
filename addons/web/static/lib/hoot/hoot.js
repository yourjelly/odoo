/** @odoo-module **/

import { mount, whenReady } from "@odoo/owl";
import { makeLogger } from "./core/logger";
import { makeTestRunner } from "./core/runner";
import { expect as _expect, registerMatcher } from "./expect";
import { URL, location } from "./globals";
import { config as domConfig } from "./helpers/dom";
import { config as eventsConfig } from "./helpers/events";
import { HootMain } from "./ui/hoot_main";
import { getDebugMode, log } from "./utils";

import "./matchers/to_be";
import "./matchers/to_be_between";
import "./matchers/to_be_truthy";
import "./matchers/to_be_visible";
import "./matchers/to_contain";
import "./matchers/to_equal";
import "./matchers/to_have_attribute";
import "./matchers/to_have_class";
import "./matchers/to_match";
import "./matchers/to_throw";

/**
 * @typedef {{
 *  runner: ReturnType<typeof makeTestRunner>;
 *  url: ReturnType<typeof makeTestRunner>["url"];
 * }} Environment
 */

const runner = makeTestRunner();

makeLogger(runner);

whenReady(async () =>
    mount(HootMain, document.body, {
        dev: getDebugMode(),
        env: { runner },
        name: "HOOT",
    })
);

export const config = {
    ...domConfig,
    ...eventsConfig,
};

log.debug(runner);
export const __debug__ = { runner };

export const afterAll = runner.afterAll;
export const afterSuite = runner.afterSuite;
export const afterEach = runner.afterEach;
export const beforeAll = runner.beforeAll;
export const beforeSuite = runner.beforeSuite;
export const beforeEach = runner.beforeEach;
export const extend = registerMatcher;
export const expect = _expect;
export const registerCleanup = runner.registerCleanup;
export const start = runner.start;
export const suite = runner.suite;
export const test = runner.test;
