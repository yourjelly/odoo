/* @odoo-module */

import { session } from "@web/session";
import { isVisible } from "@web/core/utils/ui";
import { tourState } from "./tour_state";

// TODO-JCB: Replace the following import with the non-legacy version.
import RunningTourActionHelper from "web_tour.RunningTourActionHelper";
import { findTrigger, findExtraTrigger } from "web_tour.utils";
import { device } from "web.config";

function isDefined(key, obj) {
    return key in obj && obj[key] !== undefined;
}

function getEdition() {
    return session.server_version_info.slice(-1)[0] === "e" ? "enterprise" : "community";
}

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

/**
 * @param {*} step
 * @param {"manual" | "auto"} mode
 * @returns {boolean}
 */
function shouldOmit(step, mode) {
    const correctEdition = isDefined("edition", step) ? step.edition === getEdition() : true;
    const correctDevice = isDefined("mobile", step) ? step.mobile === device.isMobile : true;
    return (
        !correctEdition ||
        !correctDevice ||
        // `step.auto = true` means omitting a step in a manual tour.
        (mode === "manual" && step.auto)
    );
}

function findStepTriggers(step) {
    const triggerEl = findTrigger(step.trigger, step.in_modal);
    const altTriggerEl = findTrigger(step.alt_trigger, step.in_modal);
    const skipTriggerEl = findTrigger(step.skip_trigger, step.in_modal);

    // `extraTriggerOkay` should be true when `step.extra_trigger` is undefined.
    // No need for it to be in the modal.
    const extraTriggerOkay = step.extra_trigger ? findExtraTrigger(step.extra_trigger) : true;

    return { triggerEl, altTriggerEl, extraTriggerOkay, skipTriggerEl };
}

function describeStepBasic(step) {
    return step.content ? `${step.content} (trigger: ${step.trigger})` : step.trigger;
}

function describeStepDetailed(step) {
    const str = JSON.stringify(
        step,
        (_key, value) => {
            if (typeof value === "function") {
                return "[function]";
            } else {
                return value;
            }
        },
        2
    );
    return str;
}

function describeFailedStep(stepIndex, tour) {
    const offset = 2;
    const start = stepIndex - offset >= 0 ? stepIndex - offset : 0;
    const end = stepIndex + offset + 1 <= tour.steps.length ? stepIndex + offset + 1 : tour.steps.length;
    let result = "";
    for (let i = start; i < end; i++) {
        const highlight = i === stepIndex;
        result += `\n${highlight ? "----- FAILING STEP -----\n" : ""}${describeStepDetailed(
            tour.steps[i],
            highlight
        )}${highlight ? "\n-----------------------" : ""}`;
    }
    return `TOUR FAILED. (name='${tour.name}')\n\n${result.trim()}`;
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
    { tour, mode, stepDelay: _stepDelay, watch: _watch, pointerMethods }
) {
    if (shouldOmit(step, mode)) {
        return [];
    }

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
            pointerMethods.setState({ mode: "info" });
        });
        $anchor.on("mouseleave.anchor", () => {
            pointerMethods.setState({ mode: "bubble" });
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
            action: () => {
                console.log(step.trigger);
            },
        },
        {
            trigger: () => {
                removeListeners();

                if (proceedWith) return proceedWith;

                const {
                    triggerEl,
                    altTriggerEl,
                    extraTriggerOkay,
                    skipTriggerEl,
                } = findStepTriggers(step);

                if (skipTriggerEl) {
                    return skipTriggerEl;
                }

                const stepEl = extraTriggerOkay && (triggerEl || altTriggerEl);

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
                pointerMethods.setState({ isVisible: false, mode: "bubble" });
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

export function compileStepAuto(
    stepIndex,
    step,
    { tour, mode, stepDelay, watch, pointerMethods: _pm }
) {
    if (shouldOmit(step, mode)) {
        return [];
    }

    let skipAction = false;
    return [
        {
            action: () => {
                skipAction = false;
                if (odoo.debug) {
                    console.log(`Tour ${tour.name}: ${describeStepDetailed(step, false)}`);
                } else {
                    console.log(`Tour ${tour.name}: ${describeStepBasic(step)}`);
                }
                if (!watch) {
                    // TODO-JCB: This can just be a timeout callback on the macro.
                    // console.error notifies the test runner that the tour failed.
                    // But don't do it in watch mode.
                    clearTimeout(tourTimeout);
                    tourTimeout = setTimeout(() => {
                        console.error(describeFailedStep(stepIndex, tour));
                    }, (step.timeout || 10000) + stepDelay);
                }
            },
        },
        {
            delay: stepDelay,
            trigger: () => {
                const {
                    triggerEl,
                    altTriggerEl,
                    extraTriggerOkay,
                    skipTriggerEl,
                } = findStepTriggers(step);

                let stepEl = extraTriggerOkay && (triggerEl || altTriggerEl);

                if (skipTriggerEl) {
                    skipAction = true;
                    stepEl = skipTriggerEl;
                }

                if (!stepEl) {
                    return false;
                }

                return canContinue(stepEl, step.allowInvisible) && stepEl;
            },
            action: (stepEl) => {
                tourState.set(tour.name, "currentIndex", stepIndex + 1);

                if (skipAction) {
                    return;
                }

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
                    step.run.call({ $anchor: $anchorEl }, actionHelper);
                } else if (step.run !== undefined) {
                    const m = step.run.match(/^([a-zA-Z0-9_]+) *(?:\(? *(.+?) *\)?)?$/);
                    actionHelper[m[1]](m[2]);
                } else {
                    actionHelper.auto();
                }
            },
        },
    ];
}

export function compileTourToMacro(tour, options) {
    const { stepCompiler, pointerMethods, mode, stepDelay, watch, checkDelay, onTourEnd } = options;
    const currentStepIndex = tourState.get(tour.name, "currentIndex");
    return {
        ...tour,
        checkDelay,
        steps: tour.steps
            .reduce((newSteps, step, i) => {
                if (i < currentStepIndex) {
                    // Don't include the step because it's already done.
                    return newSteps;
                } else {
                    return [
                        ...newSteps,
                        ...stepCompiler(i, step, {
                            tour,
                            mode,
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
