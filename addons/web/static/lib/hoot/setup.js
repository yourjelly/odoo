/** @odoo-module **/

import { mount, whenReady } from "@odoo/owl";
import { registerAssertMethod } from "./assertions/assert";
import "./assertions/assert_deep_equal";
import "./assertions/assert_equal";
import "./assertions/assert_ok";
import "./assertions/assert_step";
import "./assertions/assert_throws";
import "./assertions/assert_verify_steps";
import { makeLogger } from "./core/logger";
import { makeTestRunner } from "./core/runner";
import { config as domConfig } from "./helpers/dom";
import { config as eventsConfig } from "./helpers/events";
import { HootMain } from "./ui/hoot_main";
import { log } from "./utils";
import { urlParams } from "./core/url";

/**
 * @typedef {{
 *  runner: ReturnType<typeof makeTestRunner>;
 *  url: ReturnType<typeof makeTestRunner>["url"];
 * }} Environment
 */

const runner = makeTestRunner();

makeLogger(runner);

whenReady(async () =>
    mount(HootMain, document.body, { dev: urlParams.debug, env: { runner }, name: "HOOT" })
);

export const config = {
    ...domConfig,
    ...eventsConfig,
};

log.debug(runner);
export const __debug__ = { runner };

export const afterEach = runner.afterTest;
export const afterSuite = runner.afterSuite;
export const beforeEach = runner.beforeTest;
export const beforeSuite = runner.beforeSuite;
export const registerCleanup = runner.registerCleanup;
export const start = runner.start;
export const suite = runner.suite;
export const test = runner.test;
export const extend = registerAssertMethod;
