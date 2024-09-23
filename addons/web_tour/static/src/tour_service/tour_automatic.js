import { tourState } from "./tour_state";
import { config as transitionConfig } from "@web/core/transition";
import { TourStepAutomatic } from "./tour_step_automatic";
import { browser } from "@web/core/browser/browser";
import { Mutex } from "@web/core/utils/concurrency";
import { setupEventActions } from "@web/../lib/hoot-dom/helpers/events";
import { MacroMutationObserver } from "@web/core/macro";
import * as hoot from "@odoo/hoot-dom";

const mutex = new Mutex();

export class TourAutomatic {
    isComplete = false;
    mode = "auto";
    timer = null;
    previousStepIsJustACheck = false;
    constructor(data) {
        Object.assign(this, data);
        this.steps = this.steps.map((step, index) => new TourStepAutomatic(step, this, index));
        this.domStableDelay = this.checkDelay || 500;
        this.observer = new MacroMutationObserver(() => this.continue("mutation"));
        this.stepDelay = tourState.getCurrentConfig().stepDelay || 0;
        this.hasStarted = new Array(this.steps.length).fill(false);
        this.timeouts = new Array(this.steps.length).fill(false);
        this.stepElFound = new Array(this.steps.length).fill(false);
        this.checkDelayForIndeterminisms =
            (parseInt(tourState.getCurrentConfig().check) || 0) * 1000;
        if (this.checkDelayForIndeterminisms > 0) {
            console.warn(`The tour ${this.name} is run in checkForIndeterminisms mode`);
        }
    }

    /**
     * @returns {TourStepAutomatic}
     */
    get currentStep() {
        return this.steps[this.currentIndex];
    }

    get debugMode() {
        const debugMode = tourState.getCurrentConfig().debug;
        return debugMode !== false;
    }

    start(pointer, callback) {
        this.callback = callback;
        this.pointer = pointer;
        setupEventActions(document.createElement("div"));
        transitionConfig.disabled = true;
        this.currentIndex = tourState.getCurrentIndex();
        if (this.debugMode && this.currentIndex === 0) {
            // eslint-disable-next-line no-debugger
            debugger;
        }
        this.observer.observe(document.body);
        this.continue("next");
    }

    stop() {
        transitionConfig.disabled = false;
        this.observer.disconnect();
        if (tourState.getCurrentTourOnError()) {
            console.error("tour not succeeded");
        } else {
            this.callback();
        }
    }

    async findTrigger() {
        let stepEl = null;
        try {
            stepEl = this.currentStep.findTrigger();
        } catch (error) {
            this.throwError([error.message]);
        }
        if (stepEl) {
            this.previousStepIsJustACheck = stepEl !== true && !this.currentStep.hasAction;
            this.stepElFound[this.currentIndex] = stepEl;
            this.removeTimer();
            await this.checkForIndeterminisms();
            if (this.debugMode && stepEl !== true) {
                this.pointer.pointTo(stepEl, this);
            }
            await this.doAction(stepEl);
        }
    }

    async doAction(stepEl) {
        let actionResult = null;
        try {
            actionResult = await this.currentStep.doAction(stepEl);
        } catch (error) {
            this.throwError([error.message]);
        }
        await this.pause();
        this.increment();
        if (!actionResult) {
            // await new Promise((resolve) => requestAnimationFrame(resolve));
            if (this.stepDelay) {
                await new Promise((resolve) => browser.setTimeout(resolve, this.stepDelay));
            }
            this.continue("next");
        }
    }

    /**
     * Add step to a queue via a mutex
     * @param {"mutation"|"next"} from
     */
    continue(from = null) {
        if (this.isComplete) {
            return;
        }
        // From "next" can only be called as first element in queue per step.
        if (from === "next" && this.hasStarted[this.currentIndex]) {
            return;
        }
        let delay = this.domStableDelay;
        // Called once per step.
        if (!this.hasStarted[this.currentIndex]) {
            console.log(`Step ${this.currentIndex + 1} has started from ${from}`);
            this.log();
            this.break();
            this.setTimer();
            delay = 150;
            if (this.previousStepIsJustACheck) {
                delay = 0;
            }
            this.hasStarted[this.currentIndex] = from;
        }
        this.clearTimeout();

        // Each time continue() is called and trigger has not been found yet.
        if (!this.stepElFound[this.currentIndex]) {
            this.timeouts[this.currentIndex] = browser.setTimeout(() => {
                console.log(
                    `[${this.currentIndex + 1}] Start findTrigger from ${from} after ${delay}`
                );
                mutex.exec(() => this.findTrigger());
            }, delay);
        }
    }

    /**
     * Allow to add a debugger to the tour at the current step
     */
    break() {
        if (this.currentStep.break && this.debugMode) {
            // eslint-disable-next-line no-debugger
            debugger;
        }
    }

    clearTimeout() {
        if (this.timeouts[this.currentIndex]) {
            browser.clearTimeout(this.timeouts[this.currentIndex]);
            this.timeouts[this.currentIndex] = false;
        }
    }

    log() {
        console.groupCollapsed(this.currentStep.describeMe);
        if (this.debugMode) {
            console.log(this.currentStep.stringify);
        }
        console.groupEnd();
    }

    increment() {
        this.currentIndex++;
        if (this.currentIndex === this.steps.length) {
            this.isComplete = true;
            this.stop();
            return;
        }
        tourState.setCurrentIndex(this.currentIndex);
    }

    setTimer() {
        const timeout = this.currentStep.timeout || 10000;
        this.timer = browser.setTimeout(() => {
            this.throwError([
                `TIMEOUT: This step cannot be succeeded within ${timeout}ms.`,
                ...this.currentStep.describeWhyFailed,
            ]);
        }, timeout);
    }

    async checkForIndeterminisms() {
        if (this.checkDelayForIndeterminisms > 0) {
            await new Promise((resolve) => {
                browser.setTimeout(() => {
                    const stepEl = this.currentStep.findTrigger();
                    if (this.stepElFound[this.currentIndex] === stepEl) {
                        resolve();
                    } else {
                        this.throwError([
                            `UNDETERMINISTIC: two differents elements has been found in ${this.checkDelayForIndeterminisms}ms for trigger ${this.currentStep.trigger}`,
                        ]);
                    }
                }, this.checkDelayForIndeterminisms);
            });
        }
    }

    removeTimer() {
        this.clearTimeout();
        if (this.timer) {
            browser.clearTimeout(this.timer);
        }
    }

    /**
     * Allow to pause the tour at current step
     */
    async pause() {
        if (!this.isComplete && this.currentStep.pause && this.debugMode) {
            const styles = [
                "background: black; color: white; font-size: 14px",
                "background: black; color: orange; font-size: 14px",
            ];
            console.log(
                `%cTour is paused. Use %cplay()%c to continue.`,
                styles[0],
                styles[1],
                styles[0]
            );
            await new Promise((resolve) => {
                window.hoot = hoot;
                window.play = () => {
                    delete window.hoot;
                    delete window.play;
                    resolve();
                };
            });
        }
    }

    get describeWhereIFailed() {
        const offset = 3;
        const start = Math.max(this.index - offset, 0);
        const end = Math.min(this.index + offset, this.steps.length - 1);
        const result = [];
        for (let i = start; i <= end; i++) {
            const stepString = this.steps[i].stringify;
            const text = [stepString];
            if (i === this.index) {
                const line = "-".repeat(10);
                const failing_step = `${line} FAILED: ${this.describeMe} ${line}`;
                text.unshift(failing_step);
                text.push("-".repeat(failing_step.length));
            }
            result.push(...text);
        }
        return result.join("\n");
    }

    /**
     * @param {string} [error]
     */
    throwError(errors = []) {
        tourState.setCurrentTourOnError();
        const tourConfig = tourState.getCurrentConfig();
        // console.error notifies the test runner that the tour failed.
        errors.unshift(`FAILED: ${this.describeMe}.`);
        console.error(errors.join("\n"));
        // The logged text shows the relative position of the failed step.
        // Useful for finding the failed step.
        console.dir(this.describeWhereIFailed);
        if (tourConfig.debug !== false) {
            // eslint-disable-next-line no-debugger
            debugger;
        }
        this.isComplete = true;
        return;
    }
}
