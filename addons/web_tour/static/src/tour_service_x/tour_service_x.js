/** @odoo-module **/

import { reactive, markup, whenReady } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { MacroEngine, callWithUnloadCheck } from "@web/core/macro";
import { TourPointer } from "../tour_pointer/tour_pointer";
import { tourState } from "./tour_state";
import { session } from "@web/session";
import { _t } from "@web/core/l10n/translation";

// TODO-JCB: Replace the following import with the non-legacy version.
import { device } from "web.config";
import RunningTourActionHelper from "web_tour.RunningTourActionHelper";
import { findTrigger, findExtraTrigger } from "web_tour.utils";

const getEdition = () =>
    session.server_version_info.slice(-1)[0] === "e" ? "enterprise" : "community";
const isMobile = device.isMobile;
const isActionOnly = (step) => "action" in step && !("trigger" in step);

/**
 * TODO-JCB: Don't forget the following:
 * - It doesn't seem to work in mobile. For the tour from [planning.js],
 *   the pointer continues to point to the "app" icon even after click.
 * TODO-JCB: Maybe it's better if jQuery is used internally, and methods that return jQuery element should just return normal Elements.
 * - Maybe partially 'hiding' our reliance to jQuery is a good thing?
 * TODO-JCB: Make sure all the comments are correct.
 * TODO-JCB: take into account use of _consume_tour.
 * TODO-JCB: IDEA: Ability to manually stepping into the next step. Something like: Tour starts in pause, then, the user can press "step button" to do the next step.
 * TODO-JCB: Uncaught (in promise)TypeError: Failed to fetch
 */

/**
 * Checks if [key] maps to a defined (non-undefined) value in [obj].
 * @param {string} key
 * @param {object} obj
 * @returns
 */
function isDefined(key, obj) {
    return key in obj && obj[key] !== undefined;
}

/**
 * Based on [step.run] and the trigger.
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
 * Returns true if `step` should *not* be included in a tour.
 * @param {TourStep} step
 * @param {"manual" | "auto"} mode
 * @returns {boolean}
 */
function shouldOmit(step, mode) {
    const correctEdition = isDefined("edition", step) ? step.edition === getEdition() : true;
    const correctDevice = isDefined("mobile", step) ? step.mobile === isMobile : true;
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

function describeStep(step) {
    return step.content ? `${step.content} (trigger: ${step.trigger})` : step.trigger;
}

function describeFailedStep(step) {
    // TODO-JCB: properly describe failed step
    // console.log("_check_for_tooltip");
    // console.log("- modal_displayed: " + this.$modal_displayed.length);
    // console.log("- trigger '" + tip.trigger + "': " + $trigger.length);
    // console.log("- visible trigger '" + tip.trigger + "': " + $visible_trigger.length);
    // if ($extra_trigger !== undefined) {
    //     console.log("- extra_trigger '" + tip.extra_trigger + "': " + $extra_trigger.length);
    //     console.log("- visible extra_trigger '" + tip.extra_trigger + "': " + extra_trigger);
    // }
    return ["content", "trigger", "alt_trigger", "extra_trigger", "skip_trigger", "run"]
        .reduce((str, key) => {
            if (key in step && typeof step[key] === "string") {
                return `${str}\n${key}: ${step[key]}`;
            } else {
                return str;
            }
        }, "")
        .trim();
}

let tourTimeout;

/**
 * Augments `step` for a tour for 'auto' (run) mode.
 * @param {*} step
 * @param {*} options
 * @returns
 */
function augmentStepAuto(macroDesc, [stepIndex, step], options) {
    const { mode, stepDelay, watch } = options;

    if (shouldOmit(step, mode)) {
        return [];
    }

    let skipAction = false;
    return [
        {
            // log
            action: () => {
                skipAction = false;
                // Log the step that is currently being processed so that when debugging,
                // the developer knows the current step that fails or that's taking time.
                console.log(`Tour ${macroDesc.name}: ${describeStep(step)}`);
                if (!watch) {
                    // TODO-JCB: This can just be a timeout callback on the macro.
                    // console.error notifies the test runner that the tour failed.
                    // But don't do it in watch mode.
                    clearTimeout(tourTimeout);
                    tourTimeout = setTimeout(() => {
                        console.error(describeFailedStep(step));
                    }, (step.timeout || 10000) + stepDelay);
                }
            },
        },
        {
            // find triggers
            allowInvisible: step.allowInvisible,
            delay: stepDelay,
            trigger: () => {
                // TODO-JCB: Remove this hook.
                if (step.beforeFindTriggers) {
                    step.beforeFindTriggers(step);
                }
                const {
                    triggerEl,
                    altTriggerEl,
                    extraTriggerOkay,
                    skipTriggerEl,
                } = findStepTriggers(step);

                // [alt_trigger] - alternative to [trigger].
                // [extra_trigger] - should also be present together with the [trigger].
                let stepEl = extraTriggerOkay && (triggerEl || altTriggerEl);

                // If [skip_trigger] element is present, immediately return [stepEl] for potential
                // consumption of this step.
                if (skipTriggerEl) {
                    skipAction = true;
                    stepEl = skipTriggerEl;
                }
                // TODO-JCB: Show a simple pointer when in watch mode and there is step delay.
                // > PoS doesn't have the css for the original tour pointer. We might to introduce a way to replace the tour pointer component while running the tour.
                if (stepEl) {
                    // TODO-JCB: Remove this. Temporarily used for debugging.
                    if (step.onFindTriggers) {
                        step.onFindTriggers(step, {
                            triggerEl,
                            altTriggerEl,
                            extraTriggerOkay,
                            skipTriggerEl,
                        });
                    }
                }
                return stepEl;
            },
        },
        {
            // Do action. But, should look for the trigger again because it might have been gone.
            allowInvisible: step.allowInvisible,
            trigger: () => {
                const {
                    triggerEl,
                    altTriggerEl,
                    extraTriggerOkay,
                    skipTriggerEl,
                } = findStepTriggers(step);

                // [alt_trigger] - alternative to [trigger].
                // [extra_trigger] - should also be present together with the [trigger].
                let stepEl = extraTriggerOkay && (triggerEl || altTriggerEl);

                // If [skip_trigger] element is present, immediately return [stepEl] for potential
                // consumption of this step.
                if (skipTriggerEl) {
                    skipAction = true;
                    stepEl = skipTriggerEl;
                }

                return stepEl;
            },
            action: (stepEl) => {
                tourState.set(macroDesc.name, "currentIndex", stepIndex + 1);

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
                    try {
                        // `this.$anchor` is expected in many `step.run`.
                        step.run.call({ $anchor: $anchorEl }, actionHelper);
                    } catch (e) {
                        // TODO-JCB: What to do with the following console.error?
                        // console.error(`Tour ${tour_name} failed at step ${self._describeTip(tip)}: ${e.message}`);
                        throw e;
                    }
                } else if (step.run !== undefined) {
                    const m = step.run.match(/^([a-zA-Z0-9_]+) *(?:\(? *(.+?) *\)?)?$/);
                    try {
                        actionHelper[m[1]](m[2]);
                    } catch (e) {
                        // TODO-JCB: What to do with the following console.error?
                        // console.error(`Tour ${tour_name} failed at step ${self._describeTip(tip)}: ${e.message}`);
                        throw e;
                    }
                } else {
                    actionHelper.auto();
                }
            },
        },
    ];
}

/**
 * Augments `step` of a tour for 'manual' (run) mode.
 * TODO-JCB: Describe the trick here. How does the macro engine able to wait for the user's action?
 * TODO-JCB: Improve the code.
 * @param {*} step
 * @param {*} options
 * @returns
 */
function augmentStepManual(macroDesc, [stepIndex, step], options) {
    const { pointerMethods, mode, macroEngine } = options;

    if (shouldOmit(step, mode)) {
        return [];
    }

    let proceedWith, stepEl, prevEl, consumeEvent, $anchorEl;
    return [
        {
            ...step,
            ...{
                action: () => {
                    console.log(step.trigger);
                },
            },
        },
        {
            trigger: () => {
                if (proceedWith) return proceedWith;

                const {
                    triggerEl,
                    altTriggerEl,
                    extraTriggerOkay,
                    skipTriggerEl,
                } = findStepTriggers(step);

                // This callback can be called multiple times until it returns true.
                // We should take into account the fact the element is not in the
                // dom. [update] takes into account whether [stepEl] is null or not.
                prevEl = stepEl;
                // [alt_trigger] - alternative to [trigger].
                // [extra_trigger] - should also be present together with the [trigger].
                stepEl = extraTriggerOkay && (triggerEl || altTriggerEl);
                consumeEvent = step.consumeEvent || getConsumeEventType($(stepEl), step.run);
                // If [skip_trigger] element is present, immediately return [stepEl] for potential
                // consumption of this step.
                if (stepEl && skipTriggerEl) {
                    return stepEl;
                }

                if (prevEl) {
                    $anchorEl.off(".anchor");
                }
                if (stepEl) {
                    $anchorEl = getAnchorEl($(stepEl), consumeEvent);
                    // Start waiting for action, or automatically perform `step.run`.
                    // Set `proceedWith` to a non-falsy value as a signal to proceed to the next step.
                    pointerMethods.setState({ isVisible: true });
                    $anchorEl.on(`${consumeEvent}.anchor`, async () => {
                        // TODO-JCB: The following logic comes from _getAnchorAndCreateEvent and it might be important to take it into account.
                        // $consumeEventAnchors.on(consumeEvent + ".anchor", (function (e) {
                        //     if (e.type !== "mousedown" || e.which === 1) { // only left click
                        //         if (this.info.consumeVisibleOnly && !this.isShown()) {
                        //             // Do not consume non-displayed tips.
                        //             return;
                        //         }
                        //         this.trigger("tip_consumed");
                        //         this._unbind_anchor_events();
                        //     }
                        // }).bind(this));

                        // stop waiting
                        $anchorEl.off(".anchor");

                        proceedWith = stepEl;

                        // Finally, advance to the next step.
                        // The following will call this `trigger` function which returns the `proceedWith`.
                        macroEngine.advanceMacros();
                    });
                    $anchorEl.on("mouseenter.anchor", () => {
                        pointerMethods.setState({ mode: "info" });
                    });
                    $anchorEl.on("mouseleave.anchor", () => {
                        pointerMethods.setState({ mode: "bubble" });
                    });
                }
                const newAnchor = stepEl && $anchorEl[0];
                pointerMethods.update(step, newAnchor);
            },
            action: () => {
                // Clean up
                proceedWith = undefined;
                stepEl = undefined;
                consumeEvent = undefined;
                $anchorEl = undefined;
                options.pointerMethods.setState({ isVisible: false, mode: "bubble" });
                tourState.set(macroDesc.name, "currentIndex", stepIndex + 1);
            },
        },
    ];
}

/**
 * @param {*} macroDescription
 * @param {*} options
 * @returns
 */
function augmentMacro(macroDescription, augmenter, options) {
    const { pointerMethods, hurray } = options;
    const currentStepIndex = tourState.get(macroDescription.name, "currentIndex");
    return {
        ...macroDescription,
        steps: macroDescription.steps
            .reduce((newSteps, step, i) => {
                if (i < currentStepIndex) {
                    // Don't include the step because it's already done.
                    return newSteps;
                } else {
                    return [
                        ...newSteps,
                        ...(isActionOnly(step)
                            ? [step] // No need to augment action-only step.
                            : augmenter(macroDescription, [i, step], options)),
                    ];
                }
            }, [])
            .concat([
                {
                    action: () => {
                        // Used by the test runner to assert the test tour is done.
                        console.log("test successful");
                        tourState.set(macroDescription.name, "done", true);
                        pointerMethods.setState({ isVisible: false });
                        hurray(macroDescription);
                    },
                },
            ]),
    };
}

class Intersection {
    constructor() {
        this.currentTarget = null;
        this.rootBounds = null;
        this._targetPosition = "unknown";
        this._observer = new IntersectionObserver((observations) =>
            this._handleObservations(observations)
        );
    }
    _handleObservations(observations) {
        if (observations.length < 1) {
            return;
        }
        const observation = observations[observations.length - 1];
        this.rootBounds = observation.rootBounds;
        if (this.rootBounds && this.currentTarget) {
            if (observation.isIntersecting) {
                this._targetPosition = "in";
            } else {
                const targetBounds = this.currentTarget.getBoundingClientRect();
                if (targetBounds.bottom < this.rootBounds.height / 2) {
                    this._targetPosition = "out-above";
                } else if (targetBounds.top > this.rootBounds.height / 2) {
                    this._targetPosition = "out-below";
                }
            }
        } else {
            this._targetPosition = "unknown";
        }
    }
    /**
     * @returns {'in' | 'out-below' | 'out-above' | 'unknown'}
     */
    get targetPosition() {
        if (!this.rootBounds) {
            return this.currentTarget ? "in" : "unknown";
        } else {
            return this._targetPosition;
        }
    }
    /**
     * @param {Element} newTarget
     */
    setTarget(newTarget) {
        if (this.currentTarget !== newTarget) {
            if (this.currentTarget) {
                this._observer.unobserve(this.currentTarget);
            }
            if (newTarget) {
                this._observer.observe(newTarget);
            }
            this.currentTarget = newTarget;
        }
    }
    stop() {
        this._observer.disconnect();
    }
}

/**
 * @param {*} param0
 * @returns {[state: { x, y, isVisible, position, content, mode, fixed }, methods: { update, setState }]}
 */
function createPointerState({ x, y, isVisible, position, content, mode, fixed }) {
    const intersection = new Intersection();
    const state = reactive({ x, y, isVisible, position, content, mode, fixed });
    const pointerSize = { width: 28, height: 28 };

    // TODO-JCB: Take into account the rtl config.
    function computeLocation(el, position) {
        let top, left;
        const rect = el.getBoundingClientRect();
        if (position == "top") {
            top = rect.top - pointerSize.height;
            left = rect.left + rect.width / 2 - pointerSize.width / 2;
        } else if (position == "bottom") {
            top = rect.top + rect.height;
            left = rect.left + rect.width / 2 - pointerSize.width / 2;
        } else if (position == "left") {
            top = rect.top + rect.height / 2 - pointerSize.height / 2;
            left = rect.left;
        } else if (position == "right") {
            top = rect.top + rect.height / 2 - pointerSize.height / 2;
            left = rect.left + rect.width;
        }
        return [top, left];
    }

    function update(step, anchor) {
        intersection.setTarget(anchor);
        if (anchor) {
            if (intersection.targetPosition === "unknown") {
                // TODO-JCB: Maybe this targetPosition value is not needed.
                console.warn("Something's wrong on the `Intersection` instance.")
            } else if (intersection.targetPosition === "in") {
                const position = step.position || "top";
                const [top, left] = computeLocation(anchor, position);
                setState({
                    x: left,
                    y: top,
                    content: step.content || "",
                    position,
                });
            } else {
                let x = intersection.rootBounds.width / 2;
                let y, position, content;
                if (intersection.targetPosition === "out-below") {
                    y = intersection.rootBounds.height - 80 - 28;
                    position = "top";
                    content = "Scroll down to reach the next step.";
                } else if (intersection.targetPosition === "out-above") {
                    y = 80;
                    position = "bottom";
                    content = "Scroll up to reach the next step.";
                }
                setState({ x, y, content, position });
            }
        } else {
            setState({ isVisible: false });
        }
    }

    function setState(obj) {
        Object.assign(state, obj);
    }

    return [state, { update, setState }];
}

function sanitizedRegisteredTours(tourMap) {
    function register() {
        var args = Array.prototype.slice.call(arguments);
        var last_arg = args[args.length - 1];
        var name = args[0];
        if (tourMap[name]) {
            console.warn(_.str.sprintf("Tour %s is already defined", name));
            return;
        }
        var options = args.length === 2 ? {} : args[1];
        var steps = last_arg instanceof Array ? last_arg : [last_arg];
        var tour = {
            name: options.saveAs || name,
            steps: steps,
            url: options.url,
            rainbowMan: options.rainbowMan === undefined ? true : !!options.rainbowMan,
            rainbowManMessage: options.rainbowManMessage,
            fadeout: options.fadeout || "medium",
            sequence: options.sequence || 1000,
            test: options.test,
            wait_for: options.wait_for || Promise.resolve(),
            checkDelay: options.checkDelay,
        };
        if (options.skip_enabled) {
            tour.skip_link = markup(`<p><span class="o_skip_tour">${_t("Skip tour")}</span></p>`);
        }
        tourMap[tour.name] = tour;
    }
    for (const [name, tour] of registry.category("web_tour.tours").getEntries()) {
        register(name, tour, tour.steps);
    }
    return tourMap;
}

/**
 * TODO-JCB: Not sure of this.
 * @typedef {string} Markup
 * @typedef {string} JQuerySelector
 * TODO-JCB: what is [Actions]?
 * @typedef {string | (actions: Actions) => void | Promise<void>} Runnable
 *
 * @typedef TourMetadata
 * @property {string} url
 * @property {string | () => Markup} [rainbowManMessage]
 * @property {boolean} [rainbowMan]
 * @property {number} [sequence]
 * @property {boolean} [test]
 * @property {Promise<any>} [wait_for]
 * @property {string} [saveAs]
 * @property {boolean} [skip_enabled]
 * // The following is proposed:
 * @property {string} name
 *
 * @typedef TourStep
 * @property {string} [id]
 * @property {JQuerySelector} trigger
 * @property {JQuerySelector} [extra_trigger]
 * @property {JQuerySelector} [alt_trigger]
 * @property {JQuerySelector} [skip_trigger]
 * @property {Markup} [content]
 * @property {"left" | "top" | "right" | "bottom"} [position]
 * @property {"community" | "enterprise"} [edition]
 * @property {Runnable} [run]
 * @property {boolean} [auto]
 * @property {boolean} [in_modal]
 * @property {number} [width]
 * @property {number} [timeout]
 * @property {boolean} [consumeVisibleOnly]
 * @property {boolean} [noPrepend]
 * @property {string} [consumeEvent]
 * @property {boolean} [mobile]
 * @property {string} [title]
 */
export const tourService = {
    dependencies: ["orm", "effect"],
    start: async (_env, { orm: _orm, effect }) => {
        await whenReady();

        const tourMap = sanitizedRegisteredTours({});
        const macroEngine = new MacroEngine(document);

        const [pointerState, pointerMethods] = createPointerState({
            content: "",
            position: "top",
            x: 0,
            y: 0,
            isVisible: false,
            mode: "bubble",
            fixed: false,
        });

        /**
         * TODO-JCB: `run` and `odoo.startTour` are just the same.
         * @param {string} tourName
         * @param {{ mode: "auto" | "manual" } | undefined} [options] - if provided, it means a force restart.
         */
        function run(tourName, options) {
            if (window.frameElement) {
                // Don't run on iframe
                return;
            }
            if (options) {
                tourState.reset(tourName, options);
                macroEngine.stopMacro(tourName);
            }
            const tourDesc = tourMap[tourName];

            // TODO-JCB: Correct this. This happens because run is called multiple times. It should only be called once.
            if (!tourDesc) {
                console.log(`${tourName} not found.`);
                return;
            }

            const mode = tourState.get(tourName, "mode");
            const stepDelay = tourState.get(tourName, "stepDelay");
            const watch = tourState.get(tourName, "watch");
            const augmentedMacro = augmentMacro(
                Object.assign(tourDesc, {
                    checkDelay: mode === "manual" ? 50 : tourDesc.checkDelay,
                }),
                mode === "manual" ? augmentStepManual : augmentStepAuto,
                {
                    macroEngine,
                    pointerMethods,
                    mode,
                    stepDelay,
                    watch,
                    hurray({ rainbowManMessage, fadeout }) {
                        let message = rainbowManMessage;
                        if (message) {
                            message =
                                typeof message === "function"
                                    ? message(registry.get("tourManager"))
                                    : message;
                        } else {
                            message = markup(
                                _t(
                                    "<strong><b>Good job!</b> You went through all steps of this tour.</strong>"
                                )
                            );
                        }
                        effect.add({ type: "rainbow_man", message, fadeout });
                    },
                }
            );

            const willUnload = callWithUnloadCheck(() => {
                if (tourDesc.url && !tourState.get(tourName, "navigated")) {
                    tourState.set(tourName, "navigated", true);
                    if (tourDesc.url !== options.url) {
                        window.location.href = window.location.origin + tourDesc.url;
                    }
                }
            });

            if (!willUnload) {
                // The pointer points to the trigger and waits for the user to do the action.
                macroEngine.activate(augmentedMacro);
            }
        }

        registry.category("main_components").add("TourPointer", {
            Component: TourPointer,
            props: { pointerState, setPointerState: pointerMethods.setState },
        });

        // Resume active tours.
        for (const tourName of tourState.getActiveTours()) {
            run(tourName);
        }

        // Checking whether the tour is ready is stateful so we use a higher order function.
        // We do this so that the `wait_for` is not spawn everytime the tour runner calls `isTourReady`.
        // We're doing this because we don't want to await for all the `wait_for` of the tours.
        function makeIsTourReady() {
            const isTourReadyMap = {};
            const isWaiting = {};
            return (tourName) => {
                if (!isWaiting[tourName]) {
                    isWaiting[tourName] = true;
                    const tourDesc = tourMap[tourName];
                    tourDesc.wait_for.then(() => {
                        isTourReadyMap[tourName] = true;
                    });
                } else {
                    return isTourReadyMap[tourName];
                }
            };
        }

        odoo.startTour = (name, { stepDelay, watch, url }) => {
            tourState.set(name, "stepDelay", stepDelay ?? 0);
            tourState.set(name, "watch", watch);
            run(name, { mode: "auto", url });
        };
        odoo.isTourReady = makeIsTourReady();

        const consumed_tours = [];

        /**
         * @private
         * @returns {Object} All the active tours as a map
         */
        function _getActiveTourMap() {
            return Object.fromEntries(
                Object.entries(tourMap).filter(
                    // TODO-JCB: fix consumed_tours
                    ([key, _value]) => !consumed_tours.includes(key)
                )
            );
        }

        /**
         * @private
         * @returns {Array} Takes an Object (map) of tours and returns all the values
         */
        function _fromTourMapToArray(tourMap) {
            return Object.values(tourMap).sort((t1, t2) => {
                return t1.sequence - t2.sequence || (t1.name < t2.name ? -1 : 1);
            });
        }

        /**
         * @returns {Array} All the tours
         */
        function _getAllTours() {
            return _fromTourMapToArray(tourMap);
        }

        /**
         * @returns {Array} All the active tours
         */
        function getActiveTours() {
            return _fromTourMapToArray(_getActiveTourMap());
        }

        /**
         * @returns {Array} The onboarding tours
         */
        function getOnboardingTours() {
            return _getAllTours().filter((t) => !t.test);
        }

        /**
         * @returns {Array} The testing tours
         */
        function getTestingTours() {
            return _getAllTours().filter((t) => t.test);
        }

        // TODO-JCB: Fix this patch.
        registry.add("tourManager", {
            _isTourConsumed() {},
            _consume_tour(name, errorMessage) {
                throw new Error(`Tour '${name}' failed. Error message: ${errorMessage}`);
            },
            running_tour: null,
        });

        return { run, getOnboardingTours, getTestingTours, getActiveTours };
    },
};

registry.category("services").add("tour_service_x", tourService);
