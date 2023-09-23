/** @odoo-module */

import { toRaw } from "@odoo/owl";
import { performance } from "../globals";
import { formatMS, log } from "../utils";

/**
 * @param {import("../core/runner").TestRunner} runner
 */
export function makeLogger(runner) {
    let currentSuiteFailed = 0;
    let currentSuitePassed = 0;
    let currentSuiteSkipped = 0;
    let start;

    runner.beforeAll(() => {
        start = performance.now();

        if (runner.config.headless) {
            log("Running in headless mode");
        } else {
            log("Running with UI");
        }
        log.table(toRaw(runner.config));

        log("Starting test suites");
    });

    runner.afterAnyTest(({ fullName, lastResults }) => {
        if (lastResults.pass) {
            currentSuitePassed++;
        } else {
            currentSuiteFailed++;
            let error;
            if (lastResults.error) {
                error = lastResults.error.message;
            } else {
                error = lastResults.assertions
                    .filter((expect) => !expect.pass)
                    .map((expect) => expect.errors?.join(" ") || expect.message)
                    .join(" and ");
            }

            log.error(`Test "${fullName}" failed:`, error);
        }
    });

    runner.afterAnySkippedTest(() => {
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
        const time = performance.now() - start;
        log(`All test suites have ended (total time: ${formatMS(time)})`);
    });
}
