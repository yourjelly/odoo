/** @odoo-module */

import { toRaw } from "@odoo/owl";
import { performance } from "../globals";
import { formatMS, isIterable, log } from "../utils";
import { FILTER_KEYS } from "./config";

/**
 * @param {import("./runner").TestRunner} runner
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

        const table = { ...toRaw(runner.config) };
        for (const key of FILTER_KEYS) {
            if (isIterable(table[key])) {
                table[key] = `[${[...table[key]].join(", ")}]`;
            }
        }
        log.table(table);

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
                    .filter((assertion) => !assertion.pass)
                    .map((assertion) => assertion.errors?.join(" ") || assertion.message)
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
