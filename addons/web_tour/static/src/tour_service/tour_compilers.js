/** @odoo-module **/

import { isVisible } from "@web/core/utils/ui";
import { tourState } from "./tour_state";
import { callWithUnloadCheck } from "./tour_utils";
import { browser } from "@web/core/browser/browser";

// TODO-JCB: Replace the following import with the non-legacy version.
import RunningTourActionHelper from "web_tour.RunningTourActionHelper";
import { findTrigger, findExtraTrigger } from "web_tour.utils";
import { device } from "web.config";

/**
 * @typedef {import("../tour_service/tour_pointer_state").TourPointerState} TourPointerState
 */

/**
 * TODO-JCB: How about converting this into registry? Something like the error registry.
 * @param {jQuery} $element
 * @param {Runnable} run
 * @returns {string}
 */
function getConsumeEventType($element, run) {
    if ($element.hasClass("o_field_many2one") || $element.hasClass("o_field_many2manytags")) {
        return "autocompleteselect";
    } else if (
        $element.is("textarea") ||
        $element.filter("input").is(function () {
            const type = $(this).attr("type");
            return !type || !!type.match(/^(email|number|password|search|tel|text|url)$/);
        })
    ) {
        // FieldDateRange triggers a special event when using the widget
        if ($element.hasClass("o_field_date_range")) {
            return "apply.daterangepicker input";
        }
        if (
            device.isMobile &&
            $element.closest(".o_field_widget").is(".o_field_many2one, .o_field_many2many")
        ) {
            return "click";
        }
        return "input";
    } else if ($element.hasClass("ui-draggable-handle")) {
        return "drag";
    } else if (typeof run === "string" && run.indexOf("drag_and_drop") === 0) {
        // this is a heuristic: the element has to be dragged and dropped but it
        // doesn't have class 'ui-draggable-handle', so we check if it has an
        // ui-sortable parent, and if so, we conclude that its event type is 'sort'
        if ($element.closest(".ui-sortable").length) {
            return "sort";
        }
        if (
            (run.indexOf("drag_and_drop_native") === 0 &&
                $element.hasClass("o_record_draggable")) ||
            $element.closest(".o_record_draggable").length
        ) {
            return "mousedown";
        }
    }
    return "click";
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
    const offset = 4;
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
        result += `\n${highlight ? "----- FAILING STEP -----\n" : ""}${stepString}${
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
 * @param {jQuery} $el
 * @param {string} consumeEvent
 * @returns {jQuery}
 */
function getAnchorEl($el, consumeEvent) {
    let $consumeEventAnchors = $el;
    if (consumeEvent === "drag") {
        // jQuery-ui draggable triggers 'drag' events on the .ui-draggable element,
        // but the tip is attached to the .ui-draggable-handle element which may
        // be one of its children (or the element itself)
        $consumeEventAnchors = $el.closest(".ui-draggable");
    } else if (consumeEvent === "input" && !$el.is("textarea, input")) {
        $consumeEventAnchors = $el.closest("[contenteditable='true']");
    } else if (consumeEvent.includes("apply.daterangepicker")) {
        $consumeEventAnchors = $el.parent().children(".o_field_date_range");
    } else if (consumeEvent === "sort") {
        // when an element is dragged inside a sortable container (with classname
        // 'ui-sortable'), jQuery triggers the 'sort' event on the container
        $consumeEventAnchors = $el.closest(".ui-sortable");
    }
    return $consumeEventAnchors;
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

export function compileStepManual(
    stepIndex,
    step,
    { tour, stepDelay: _stepDelay, watch: _watch, pointerMethods }
) {
    function getScrollParent(node) {
        if (node == null) {
            return null;
        }
        if (node.scrollHeight > node.clientHeight) {
            return node;
        } else {
            return getScrollParent(node.parentNode);
        }
    }

    function setupListeners({ $anchor, consumeEvent, onScroll, onConsume }) {
        const anchorEl = $anchor[0];
        const scrollEl = getScrollParent(anchorEl);

        let timeout;
        let removeScrollListener = () => {};

        if (scrollEl) {
            function scroll() {
                clearTimeout(timeout);
                timeout = setTimeout(onScroll, 50);
            }
            scrollEl.addEventListener("scroll", scroll);
            removeScrollListener = () => scrollEl.removeEventListener("scroll", scroll);
        }

        $anchor.on(`${consumeEvent}.anchor`, onConsume);
        $anchor.on("mouseenter.anchor", () => {
            pointerMethods.setState({ isOpen: true });
        });
        $anchor.on("mouseleave.anchor", () => {
            pointerMethods.setState({ isOpen: false });
        });
        const removeAnchorListeners = () => $anchor.off(".anchor");

        return () => {
            removeScrollListener();
            removeAnchorListeners();
        };
    }

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
                    const consumeEvent =
                        step.consumeEvent || getConsumeEventType($(stepEl), step.run);
                    const $anchor = getAnchorEl($(stepEl), consumeEvent);
                    const anchorEl = $anchor[0];

                    const updatePointer = () => {
                        pointerMethods.setState({ isVisible: true });
                        pointerMethods.update(step, anchorEl);
                    };

                    removeListeners = setupListeners({
                        $anchor,
                        consumeEvent,
                        onScroll: updatePointer,
                        onConsume: () => {
                            proceedWith = stepEl;
                            pointerMethods.setState({ isVisible: false });
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
                pointerMethods.setState({ isVisible: false, isOpen: false });
                tourState.set(tour.name, "currentIndex", stepIndex + 1);

                // Reset state variables.
                proceedWith = null;
                scrolled = false;
                removeListeners = () => {};
            },
        },
    ];
}

let tourTimeout;

export function compileStepAuto(stepIndex, step, { tour, stepDelay, watch, pointerMethods: _pm }) {
    let skipAction = false;
    stepDelay = stepDelay || 0;
    return [
        {
            action: async () => {
                // IMPROVEMENT: Find a way to remove this delay.
                // Synthetic delay between finding the trigger. Important for making the current set of tests pass.
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
                if (stepDelay > 0) {
                    await new Promise((resolve) => browser.setTimeout(resolve, stepDelay));
                }
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

                let result;

                const consumeEvent = step.consumeEvent || getConsumeEventType($(stepEl), step.run);
                // When in auto mode, we are not waiting for an event to be consumed, so the
                // anchor is just the step element.
                const $anchorEl = $(stepEl);

                // TODO: Delegate the following routine to the `ACTION_HELPERS` in the macro module.
                const actionHelper = new RunningTourActionHelper({
                    consume_event: consumeEvent,
                    $anchor: $anchorEl,
                });
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
    const {
        filteredSteps,
        stepCompiler,
        pointerMethods,
        stepDelay,
        watch,
        checkDelay,
        onTourEnd,
    } = options;
    const currentStepIndex = tourState.get(tour.name, "currentIndex");
    return {
        ...tour,
        checkDelay,
        steps: filteredSteps
            .reduce((newSteps, step, i) => {
                if (i < currentStepIndex) {
                    // Don't include the step because it's already done.
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
