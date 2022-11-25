/** @odoo-module **/

import { browser } from "@web/core/browser/browser";
import { Mutex } from "@web/core/utils/concurrency";

// TODO-JCB: Don't use legacy imports.
import { findTrigger } from "web_tour.utils";

export const ACTION_HELPERS = {
    click(el, _step) {
        el.dispatchEvent(new MouseEvent("mouseover"));
        el.dispatchEvent(new MouseEvent("mouseenter"));
        el.dispatchEvent(new MouseEvent("mousedown"));
        el.dispatchEvent(new MouseEvent("mouseup"));
        el.click();
        el.dispatchEvent(new MouseEvent("mouseout"));
        el.dispatchEvent(new MouseEvent("mouseleave"));
    },
    text(el, step) {
        // simulate an input (probably need to add keydown/keyup events)
        this.click(el, step);
        el.value = step.value;
        el.dispatchEvent(new InputEvent("input", { bubbles: true }));
        el.dispatchEvent(new InputEvent("change", { bubbles: true }));
    },
};

const mutex = new Mutex();

/**
 * Calls the given func then returns/resolves to `true`
 * if it will result to unloading of the page.
 * @param {(...args: any[]) => void} func
 * @param  {any[]} args
 * @returns
 */
export function callWithUnloadCheck(func, ...args) {
    let willUnload = false;
    const beforeunload = () => (willUnload = true);
    window.addEventListener("beforeunload", beforeunload);
    const result = func(...args);
    if (result instanceof Promise) {
        return result.then(() => {
            window.removeEventListener("beforeunload", beforeunload);
            return willUnload;
        });
    } else {
        window.removeEventListener("beforeunload", beforeunload);
        return willUnload;
    }
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// TODO-JCB: Should only find odoo iframe. Exclude iframe from different host.
function findIframe() {
    return document.body.getElementsByTagName("iframe")[0];
}

class TimeoutError extends Error {}

class Macro {
    constructor(descr) {
        this.name = descr.name || "anonymous";
        this.timeoutDuration = descr.timeout || 0;
        this.timeout = null;
        this.currentIndex = 0;
        this.checkDelay = descr.checkDelay || 0;
        this.isComplete = false;
        this.steps = descr.steps;
        this.onStep = descr.onStep || (() => {});
        this.onError = descr.onError;
        this.onTimeout = descr.onTimeout;
        this.setTimer();
    }

    getStepDelay(step) {
        return step.delay || 0;
    }

    /**
     * TODO-JCB: The following note can be removed.
     * > Finding the trigger element and performing the action and other misc operations should be connected.
     * > We should only schedule advancing to the next step when the whole current step finished successfully.
     * > Also, while "doing" the current step, we need to pause mutation observer such that any mutation should
     * > not schedule a new "run" on the current step.
     */
    async advance() {
        if (this.isComplete) {
            return;
        }
        const step = this.steps[this.currentIndex];
        await this.waitForDelay(step);
        const [proceedToAction, el] = this.checkTrigger(step);
        if (proceedToAction) {
            const willUnload = await callWithUnloadCheck(() => this.performAction(el, step));
            if (!willUnload) {
                this.currentIndex++;
                if (this.currentIndex === this.steps.length) {
                    this.isComplete = true;
                    browser.clearTimeout(this.timeout);
                } else {
                    await new Promise((resolve) => setTimeout(resolve));
                    await this.advance();
                }
            }
        }
    }

    async waitForDelay(step) {
        const stepDelay = this.getStepDelay(step);
        if (stepDelay > 0) {
            await sleep(stepDelay);
        }
    }

    /**
     * Find the trigger and assess whether it can continue on performing the actions.
     * @param {Step} param0
     * @returns {[proceedToAction: boolean; el: Element | undefined]}
     */
    checkTrigger({ trigger, in_modal }) {
        let el;

        if (!trigger) {
            return [true, el];
        }

        if (typeof trigger === "function") {
            el = this.safeCall(trigger);
        } else if (typeof trigger === "string") {
            el = findTrigger(trigger, in_modal);
        } else {
            throw new Error(`Trigger can only be string or function.`);
        }

        if (el) {
            return [true, el];
        } else {
            return [false, el];
        }
    }

    /**
     * Calls the `onStep` callback and the `step.action`.
     * @param {Element} el
     * @param {Step} step
     */
    async performAction(el, step) {
        this.safeCall(this.onStep, el, step);
        const action = step.action;
        if (action in ACTION_HELPERS) {
            ACTION_HELPERS[action](el, step);
        } else if (typeof action === "function") {
            await this.safeCall(action, el);
        }
    }

    safeCall(fn, ...args) {
        if (this.isComplete) {
            return;
        }
        try {
            return fn(...args);
        } catch (e) {
            this.handleError(e);
        }
    }

    setTimer() {
        if (this.timeoutDuration) {
            browser.clearTimeout(this.timeout);
            const currentStep = this.steps[this.currentIndex];
            this.timeout = browser.setTimeout(() => {
                if (this.onTimeout) {
                    const index = this.currentIndex;
                    const step = this.steps[index];
                    this.safeCall(this.onTimeout, step, index);
                } else {
                    const error = new TimeoutError("Step timeout");
                    this.handleError(error);
                }
            }, this.timeoutDuration + this.getStepDelay(currentStep));
        }
    }

    handleError(error) {
        // mark the macro as complete, so it can be cleaned up from the
        // engine
        this.isComplete = true;
        browser.clearTimeout(this.timeout);
        if (this.onError) {
            const index = this.currentIndex;
            const step = this.steps[index];
            this.onError(error, step, index);
        } else {
            console.error(error);
        }
    }
}

export class MacroEngine {
    constructor(target = document.body) {
        this.isRunning = false;
        this.timeout = null;
        this.target = target;
        this.defaultCheckDelay = 750;
        this.macros = new Set();
        this.observerOptions = {
            attributes: true,
            childList: true,
            subtree: true,
            characterData: true,
        };
        this.observer = new MutationObserver(() => {
            this.delayedCheck();
        });
        this.iframeObserver = new MutationObserver(() => {
            const iframeEl = findIframe();
            if (iframeEl) {
                iframeEl.addEventListener("load", () => {
                    if (iframeEl.contentDocument) {
                        this.observer.observe(iframeEl.contentDocument, this.observerOptions);
                    }
                });
                // If the iframe was added without a src,
                // its load event was immediately fired and
                // will not fire again unless another src is
                // set. Unfortunately, the case of this
                // happening and the iframe content being
                // altered programmaticaly may happen.
                // (E.g. at the moment this was written,
                // the mass mailing editor iframe is added
                // without src and its content rewritten
                // immediately afterwards).
                if (!iframeEl.src) {
                    if (iframeEl.contentDocument) {
                        this.observer.observe(iframeEl.contentDocument, this.observerOptions);
                    }
                }
            }
        });
    }

    async activate(descr) {
        // micro task tick to make sure we add the macro in a new call stack,
        // so we are guaranteed that we are not iterating on the current macros
        await Promise.resolve();
        const macro = new Macro(descr, this);
        this.macros.add(macro);
        this.start();
    }

    start() {
        if (!this.isRunning) {
            this.isRunning = true;
            this.observer.observe(this.target, this.observerOptions);
            this.iframeObserver.observe(document.body, { childList: true, subtree: true });
        }
        this.delayedCheck();
    }

    stopMacro(name) {
        if (this.isRunning) {
            const macrosToDelete = [...this.macros].filter((macro) => macro.name === name);
            for (const macro of macrosToDelete) {
                this.macros.delete(macro);
            }
            if (this.macros.size === 0) {
                this.stop();
            }
        }
    }

    stop() {
        if (this.isRunning) {
            this.isRunning = false;
            browser.clearTimeout(this.timeout);
            this.timeout = null;
            this.observer.disconnect();
        }
    }

    delayedCheck() {
        // NOTE: This check is introduced because of the use of jquery in finding the trigger.
        // When jquery is completely unused, we can maybe remove this check.
        // TODO-JCB: This check might not be needed pausing/resuming the mutation observer works.
        browser.clearTimeout(this.timeout);

        // TODO-JCB: Write tests for this use of mutex synchronization.
        // TODO-JCB: How about the error when running advanceMacros?
        // > ATM, mutex.exec just ignores it. How should it be handled?
        // > I think it should be propagated so that error message will be logged and the tour will stop.
        // TODO-JCB: Idea: Each macro should have its own timeout for scheduled rechecking of the current step.
        this.timeout = browser.setTimeout(
            () => mutex.exec(this.advanceMacros.bind(this)),
            this.getCheckDelay() || this.defaultCheckDelay
        );
    }

    getCheckDelay() {
        // if a macro has a checkDelay different from 0, use it. Select the maximum.
        return [...this.macros]
            .map((m) => m.checkDelay)
            .filter((delay) => delay > 0)
            .reduce(Math.max, 0);
    }

    async advanceMacros() {
        const toDelete = [];
        const advances = [];
        for (const macro of this.macros) {
            advances.push(macro.advance());
            if (macro.isComplete) {
                toDelete.push(macro);
            }
        }
        // TODO-JCB: Is it necessary to gather all this `advance` promises and await them?
        await Promise.all(advances);
        if (toDelete.length) {
            for (const macro of toDelete) {
                this.macros.delete(macro);
            }
        }
        if (this.macros.size === 0) {
            this.stop();
        }
    }
}
