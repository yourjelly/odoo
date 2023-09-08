/** @odoo-module **/

import { toRaw } from "@odoo/owl";
import { log } from "../utils";

/**
 * @param {ReturnType<typeof import("./runner").makeTestRunner>} runner
 */
export function makeLogger(runner) {
    let currentSuiteFailed = 0;
    let currentSuitePassed = 0;
    let currentSuiteSkipped = 0;
    let start;

    runner.beforeAll(() => {
        start = Date.now();

        if (runner.config.headless) {
            log("Running in headless mode");
        } else {
            log("Running with UI");
        }
        log.table(toRaw(runner.config));

        log("Starting test suites");
    });

    runner.afterAnyTest((test) => {
        if (test.lastResults.pass) {
            currentSuitePassed++;
        } else {
            currentSuiteFailed++;
            let error;
            if (test.lastResults.error) {
                error = test.lastResults.error.message;
            } else {
                error = test.lastResults.assertions
                    .filter((assert) => !assert.pass)
                    .map((assert) => assert.errors?.join(" ") || assert.message)
                    .join(" and ");
            }

            log.error(`Test "${test.fullName}" failed:`, error);
        }
    });

    runner.skippedAnyTest(() => {
        currentSuiteSkipped++;
    });

    runner.afterAnySuite((suite) => {
        const logArgs = [`Suite "${suite.fullName}" ended`];
        const withArgs = [];
        if (currentSuitePassed) {
            withArgs.push(currentSuitePassed, "passed");
        }
        if (currentSuiteFailed) {
            withArgs.push(currentSuitePassed, "failed");
        }
        if (currentSuiteSkipped) {
            withArgs.push(currentSuitePassed, "skipped");
        }

        if (withArgs.length) {
            logArgs.push("(", ...withArgs, ")");
        }

        log(...logArgs);

        currentSuiteFailed = 0;
        currentSuitePassed = 0;
        currentSuiteSkipped = 0;
    });

    runner.afterAll(() => {
        const time = Date.now() - start;
        log(`All test suites have ended (total time: ${time}ms)`);
    });
}
