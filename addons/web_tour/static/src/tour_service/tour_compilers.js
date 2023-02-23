/** @odoo-module **/

import { browser } from "@web/core/browser/browser";
import { debounce } from "@web/core/utils/timing";
import { isVisible } from "@web/core/utils/ui";
import { tourState } from "./tour_state";
import {
    callWithUnloadCheck,
    getConsumeEventType,
    getFirstVisibleElement,
    getJQueryElementFromSelector,
    getScrollParent,
    RunningTourActionHelper,
} from "./tour_utils";

/**
 * @typedef {import("./tour_pointer_state").TourPointerMethods} TourPointerMethods
 *
 * @typedef {import("@web/core/macro").MacroDescriptor} MacroDescriptor
 *
 * @typedef {import("../tour_service/tour_pointer_state").TourPointerState} TourPointerState
 *
 * @typedef {import("./tour_service").TourStep} TourStep
 *
 * @typedef {(stepIndex: number, step: TourStep, options: TourCompilerOptions) => MacroDescriptor[]} TourStepCompiler
 *
 * @typedef TourCompilerOptions
 * @property {Tour} tour
 * @property {number} stepDelay
 * @property {watch} boolean
 * @property {TourPointerMethods} pointerMethods
 */

/**
 * If `inModal` is not false (e.g. true or undefined),
 * find `selector` from the top most visible modal.
 * Otherwise, find `selector` from the whole document.
 *
 * @param {string} selector - any valid jquery selector
 * @param {boolean} inModal
 * @returns {Element | undefined}
 */
function findTrigger(selector, inModal) {
    const $visibleModal = $(".modal:visible").last();
    let $el;
    if (inModal !== false && $visibleModal.length) {
        $el = $visibleModal.find(selector);
    } else {
        $el = getJQueryElementFromSelector(selector);
    }
    return getFirstVisibleElement($el).get(0);
}

function findExtraTrigger(selector) {
    const $el = getJQueryElementFromSelector(selector);
    return getFirstVisibleElement($el).get(0);
}

function findStepTriggers(step) {
    const triggerEl = findTrigger(step.trigger, step.in_modal);
    const altEl = findTrigger(step.alt_trigger, step.in_modal);
    const skipEl = findTrigger(step.skip_trigger, step.in_modal);

    // `extraTriggerOkay` should be true when `step.extra_trigger` is undefined.
    // No need for it to be in the modal.
    const extraTriggerOkay = step.extra_trigger ? findExtraTrigger(step.extra_trigger) : true;

    return { triggerEl, altEl, extraTriggerOkay, skipEl };
}

function describeStep(step) {
    return step.content ? `${step.content} (trigger: ${step.trigger})` : step.trigger;
}

function describeFailedStepSimple(step, tour) {
    return `Tour ${tour.name} failed at step ${describeStep(step)}`;
}

function describeFailedStepDetailed(step, stepIndex, tour) {
    const offset = 3;
    const start = stepIndex - offset >= 0 ? stepIndex - offset : 0;
    const end =
        stepIndex + offset + 1 <= tour.steps.length ? stepIndex + offset + 1 : tour.steps.length;
    let result = "";
    for (let i = start; i < end; i++) {
        const highlight = i === stepIndex;
        const stepString = JSON.stringify(
            tour.steps[i],
            (_key, value) => {
                if (typeof value === "function") {
                    return "[function]";
                } else {
                    return value;
                }
            },
            2
        );
        result += `\n${highlight ? "----- FAILING STEP -----\n" : ""}${stepString},${
            highlight ? "\n-----------------------" : ""
        }`;
    }
    return `${describeFailedStepSimple(step, tour)}\n\n${result.trim()}`;
}

/**
 * Returns the element that will be used in listening to the `consumeEvent`.
 * It doesn't necessarily mean the given element, e.g. when listening to drag
 * event, we have to do it to the closest .ui-draggable ancestor.
 *
 * @param {HTMLElement} el
 * @param {string} consumeEvent
 */
function getAnchorEl(el, consumeEvent) {
    if (consumeEvent === "drag") {
        // jQuery-ui draggable triggers 'drag' events on the .ui-draggable element,
        // but the tip is attached to the .ui-draggable-handle element which may
        // be one of its children (or the element itself)
        return el.closest(".ui-draggable, .o_draggable");
    }
    if (consumeEvent === "input" && !["textarea", "input"].includes(el.tagName.toLowerCase())) {
        return el.closest("[contenteditable='true']");
    }
    if (consumeEvent.includes("apply.daterangepicker")) {
        return [...el.parentElement.children].find((child) =>
            child.classList.contains("o_field_date_range")
        );
    }
    if (consumeEvent === "sort") {
        // when an element is dragged inside a sortable container (with classname
        // 'ui-sortable'), jQuery triggers the 'sort' event on the container
        return el.closest(".ui-sortable, .o_sortable");
    }
    return el;
}

/**
 * IMPROVEMENT: Consider disabled? Or transitioning (moving) elements?
 * @param {Element} el
 * @param {boolean} allowInvisible
 * @returns {boolean}
 */
function canContinue(el, allowInvisible) {
    const isInDoc = el.ownerDocument.contains(el);
    const isElement = el instanceof el.ownerDocument.defaultView.Element || el instanceof Element;
    // TODO: Take into account ".o_blockUI".
    const isBlocked = document.body.classList.contains("o_ui_blocked");
    return isInDoc && isElement && !isBlocked && (!allowInvisible ? isVisible(el) : true);
}

/**
 * @param {Object} params
 * @param {HTMLElement} params.anchorEl
 * @param {string} params.consumeEvent
 * @param {TourPointerMethods} params.pointerMethods
 * @param {(ev: Event) => any} params.onScroll
 * @param {(ev: Event) => any} params.onConsume
 */
function setupListeners({ anchorEl, consumeEvent, pointerMethods, onScroll, onConsume }) {
    const onMouseEnter = () => pointerMethods.setState({ isOpen: true });

    const onMouseLeave = () => pointerMethods.setState({ isOpen: false });

    anchorEl.addEventListener(consumeEvent, onConsume);
    anchorEl.addEventListener("mouseenter", onMouseEnter);
    anchorEl.addEventListener("mouseleave", onMouseLeave);

    const cleanups = [
        () => {
            anchorEl.removeEventListener(consumeEvent, onConsume);
            anchorEl.removeEventListener("mouseenter", onMouseEnter);
            anchorEl.removeEventListener("mouseleave", onMouseLeave);
        },
    ];

    const scrollEl = getScrollParent(anchorEl);
    if (scrollEl) {
        const debouncedOnScroll = debounce(onScroll, 50);
        scrollEl.addEventListener("scroll", debouncedOnScroll);
        cleanups.push(() => scrollEl.removeEventListener("scroll", debouncedOnScroll));
    }

    return () => {
        while (cleanups.length) {
            cleanups.pop()();
        }
    };
}

/** @type {TourStepCompiler} */
export function compileStepManual(
    stepIndex,
    step,
    { tour, stepDelay: _stepDelay, watch: _watch, pointerMethods }
) {
    // State variables.
    let proceedWith = null;
    let scrolled = false;
    let removeListeners = () => {};

    return [
        {
            action: () => console.log(step.trigger),
        },
        {
            trigger: () => {
                removeListeners();

                if (proceedWith) {
                    return proceedWith;
                }

                const { triggerEl, altEl, extraTriggerOkay, skipEl } = findStepTriggers(step);

                if (skipEl) {
                    return skipEl;
                }

                const stepEl = extraTriggerOkay && (triggerEl || altEl);

                if (stepEl && canContinue(stepEl, step.allowInvisible)) {
                    const consumeEvent = step.consumeEvent || getConsumeEventType(stepEl, step.run);
                    const anchorEl = getAnchorEl(stepEl, consumeEvent);

                    const updatePointer = () => {
                        pointerMethods.setState({ isVisible: true });
                        pointerMethods.update(step, anchorEl);
                    };

                    removeListeners = setupListeners({
                        anchorEl,
                        consumeEvent,
                        pointerMethods,
                        onScroll: updatePointer,
                        onConsume: () => {
                            proceedWith = stepEl;
                            pointerMethods.setState({ isVisible: false, isOpen: false });
                        },
                    });

                    if (!scrolled) {
                        scrolled = true;
                        stepEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
                    }

                    updatePointer();
                } else {
                    pointerMethods.setState({ isVisible: false });
                }
            },
            action: () => {
                tourState.set(tour.name, "currentIndex", stepIndex + 1);

                // Reset state variables.
                proceedWith = null;
                scrolled = false;
            },
        },
    ];
}

let tourTimeout;

/** @type {TourStepCompiler} */
export function compileStepAuto(stepIndex, step, { tour, stepDelay, watch, pointerMethods: _pm }) {
    let skipAction = false;
    stepDelay = stepDelay || 0;
    return [
        {
            action: async () => {
                // This delay is important for making the current set of tour tests pass.
                // IMPROVEMENT: Find a way to remove this delay.
                await new Promise((resolve) => browser.setTimeout(resolve));
            },
        },
        {
            action: async () => {
                skipAction = false;
                console.log(`Tour ${tour.name} on step: '${describeStep(step)}'`);
                if (!watch) {
                    clearTimeout(tourTimeout);
                    tourTimeout = setTimeout(() => {
                        // The logged text shows the relative position of the failed step.
                        // Useful for finding the failed step.
                        console.warn(describeFailedStepDetailed(step, stepIndex, tour));
                        // console.error notifies the test runner that the tour failed.
                        console.error(describeFailedStepSimple(step, tour));
                    }, (step.timeout || 10000) + stepDelay);
                }
                await new Promise((resolve) => browser.setTimeout(resolve, stepDelay));
            },
        },
        {
            trigger: () => {
                const { triggerEl, altEl, extraTriggerOkay, skipEl } = findStepTriggers(step);

                let stepEl = extraTriggerOkay && (triggerEl || altEl);

                if (skipEl) {
                    skipAction = true;
                    stepEl = skipEl;
                }

                if (!stepEl) {
                    return false;
                }

                return canContinue(stepEl, step.allowInvisible) && stepEl;
            },
            action: async (stepEl) => {
                tourState.set(tour.name, "currentIndex", stepIndex + 1);

                if (skipAction) {
                    return;
                }

                const consumeEvent = step.consumeEvent || getConsumeEventType(stepEl, step.run);
                // When in auto mode, we are not waiting for an event to be consumed, so the
                // anchor is just the step element.
                const $anchorEl = $(stepEl);

                // TODO: Delegate the following routine to the `ACTION_HELPERS` in the macro module.
                const actionHelper = new RunningTourActionHelper({
                    consume_event: consumeEvent,
                    $anchor: $anchorEl,
                });

                let result;
                if (typeof step.run === "function") {
                    // `this.$anchor` is expected in many `step.run`.
                    const willUnload = await callWithUnloadCheck(() =>
                        step.run.call({ $anchor: $anchorEl }, actionHelper)
                    );
                    result = willUnload && "will unload";
                } else if (step.run !== undefined) {
                    const m = step.run.match(/^([a-zA-Z0-9_]+) *(?:\(? *(.+?) *\)?)?$/);
                    actionHelper[m[1]](m[2]);
                } else {
                    actionHelper.auto();
                }

                return result;
            },
        },
    ];
}

export function compileTourToMacro(tour, options) {
    const { filteredSteps, stepCompiler, pointerMethods, stepDelay, watch, checkDelay, onTourEnd } =
        options;
    const currentStepIndex = tourState.get(tour.name, "currentIndex");
    return {
        ...tour,
        checkDelay,
        steps: filteredSteps
            .reduce((newSteps, step, i) => {
                if (i < currentStepIndex) {
                    // Don't include steps before the current index because they're already done.
                    return newSteps;
                } else {
                    return [
                        ...newSteps,
                        ...stepCompiler(i, step, {
                            tour,
                            stepDelay,
                            watch,
                            pointerMethods,
                        }),
                    ];
                }
            }, [])
            .concat([
                {
                    action() {
                        tourState.clear(tour.name);
                        pointerMethods.setState({ isVisible: false });
                        onTourEnd(tour);
                    },
                },
            ]),
    };
}
