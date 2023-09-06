/** @odoo-module **/

import { log } from "../utils";

/**
 * @param {ReturnType<typeof import("./runner").makeTestRunner>} runner
 */
export function makeLogger({ beforeAll, afterAnyTest, skippedAnyTest, afterAnySuite, afterAll }) {
    let currentSuiteFailed = 0;
    let currentSuitePassed = 0;
    let currentSuiteSkipped = 0;

    beforeAll(() => {
        log("Starting test suites");
    });

    afterAnyTest((test) => {
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

    skippedAnyTest(() => {
        currentSuiteSkipped++;
    });

    afterAnySuite((suite) => {
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

    afterAll(() => {
        log("All test suites have ended");
    });
}
