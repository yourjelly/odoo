/** @odoo-module **/

import { mount, whenReady } from "@odoo/owl";
import { registerAssertMethod } from "./assertions/assert";
import { makeLogger } from "./core/logger";
import { makeTestRunner } from "./core/runner";
import { URL, location } from "./globals";
import { config as domConfig } from "./helpers/dom";
import { config as eventsConfig } from "./helpers/events";
import { HootMain } from "./ui/hoot_main";
import { log } from "./utils";

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
        dev: new URL(location).searchParams.has("debug"),
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
export const registerCleanup = runner.registerCleanup;
export const start = runner.start;
export const suite = runner.suite;
export const test = runner.test;
export const extend = registerAssertMethod;
