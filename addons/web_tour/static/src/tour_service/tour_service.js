/** @odoo-module **/

import { EventBus, whenReady, reactive, markup } from "@odoo/owl";
import { _t } from "@web/core/l10n/translation";
import { registry } from "@web/core/registry";
import { config as transitionConfig } from "@web/core/transition";
import { session } from "@web/session";
import { TourPointer } from "../tour_pointer/tour_pointer";
import { createPointerState } from "./tour_pointer_state";
import { tourState } from "./tour_state";
import { callWithUnloadCheck } from "./tour_utils";
import { Tour } from "./tour";

/**
 * @typedef {string} HootSelector
 * @typedef {import("./tour_utils").RunCommand} RunCommand
 *
 * @typedef Tour
 * @property {string} url
 * @property {string} name
 * @property {() => TourStep[]} steps
 * @property {boolean} [rainbowMan]
 * @property {number} [sequence]
 * @property {boolean} [test]
 * @property {Promise<any>} [wait_for]
 * @property {string} [saveAs]
 * @property {string} [fadeout]
 * @property {number} [checkDelay]
 * @property {string|undefined} [shadow_dom]
 *
 * @typedef TourStep
 * @property {"enterprise"|"community"|"mobile"|"desktop"|HootSelector[][]} isActive Active the step following {@link isActiveStep} filter
 * @property {string} [id]
 * @property {HootSelector} trigger The node on which the action will be executed.
 * @property {HootSelector} [extra_trigger] Required (extra) node for the step to be executed.
 * @property {HootSelector} [alt_trigger] An alternative node to the trigger (trigger or alt_trigger).
 * @property {string} [content] Description of the step.
 * @property {"top" | "botton" | "left" | "right"} [position] The position where the UI helper is shown.
 * @property {"community" | "enterprise"} [edition]
 * @property {RunCommand} [run] The action to perform when trigger conditions are verified.
 * @property {boolean} [allowInvisible] Allow trigger nodes (any of them) to be invisible
 * @property {boolean} [allowDisabled] Allow the trigger node to be disabled.
 === run() {}``` (mainly to avoid clicking on the trigger by default)
 allows that trigger node can be disabled. run() {} does not allow this behavior.
 * @property {boolean} [auto]
 * @property {boolean} [in_modal] When true, check that trigger node is present in the last visible .modal.
 * @property {number} [width]
 * @property {number} [timeout] By default, when the trigger node isn't found after 10000 milliseconds, it throws an error.
 * You can change this value to lengthen or shorten the time before the error occurs [ms].
 * @property {boolean} [consumeVisibleOnly] TODO: Still used ???
 * @property {string} [consumeEvent] Only in manual mode (onboarding tour). It's the event we want the customer to do.
 * @property {boolean} [mobile] When true, step will only trigger in mobile view.
 * @property {string} [title]
 * @property {string|false|undefined} [shadow_dom] By default, trigger nodes are selected in the main document node 
 * but this property forces to search in a shadowRoot document.

 * @typedef {"manual" | "auto"} TourMode
 */

export const tourService = {
    // localization dependency to make sure translations used by tours are loaded
    dependencies: ["orm", "effect", "overlay", "localization"],
    start: async (_env, { orm, effect, overlay }) => {
        await whenReady();
        const toursEnabled = "tour_disable" in session && !session.tour_disable;
        const consumedTours = new Set(session.web_tours);

        /** @type {{ [k: string]: Tour }} */
        const tours = {};
        const tourRegistry = registry.category("web_tour.tours");
        function register(name, tour) {
            tours[name] = new Tour(tour, name);
            tours[name].wait_for.then(() => {
                if (
                    !tour.test &&
                    toursEnabled &&
                    !consumedTours.has(name) &&
                    !tourState.getActiveTourNames().includes(name)
                ) {
                    startTour(name, { mode: "manual", redirect: false });
                }
            });
        }
        for (const [name, tour] of tourRegistry.getEntries()) {
            register(name, tour);
        }
        tourRegistry.addEventListener("UPDATE", ({ detail: { key, value } }) => {
            if (tourRegistry.contains(key)) {
                register(key, value);
                if (
                    tourState.getActiveTourNames().includes(key) &&
                    // Don't resume onboarding tours when tours are disabled
                    (toursEnabled || tourState.get(key, "mode") === "auto")
                ) {
                    resumeTour(key);
                }
            } else {
                delete tours[value];
            }
        });

        const bus = new EventBus();
        const pointers = reactive({});
        /** @type {Set<string>} */
        const runningTours = new Set();

        // FIXME: this is a hack for stable: whenever the macros advance, for each call to pointTo,
        // we push a function that will do the pointing as well as the tour name. Then after
        // a microtask tick, when all pointTo calls have been made by the macro system, we can sort
        // these by tour priority/sequence and only call the one with the highest priority so we
        // show the correct pointer.
        const possiblePointTos = [];
        function createPointer(tourName, config) {
            const { state: pointerState, methods } = createPointerState();
            let remove;
            return {
                start() {
                    pointers[tourName] = {
                        methods,
                        id: tourName,
                        component: TourPointer,
                        props: { pointerState, ...config },
                    };
                    remove = overlay.add(pointers[tourName].component, pointers[tourName].props, {
                        sequence: 1100, // sequence based on bootstrap z-index values.
                    });
                },
                stop() {
                    remove?.();
                    delete pointers[tourName];
                    methods.destroy();
                },
                ...methods,
                async pointTo(anchor, step) {
                    possiblePointTos.push([tourName, () => methods.pointTo(anchor, step)]);
                    await Promise.resolve();
                    // only done once per macro advance
                    if (!possiblePointTos.length) {
                        return;
                    }
                    const toursByPriority = Object.fromEntries(
                        getSortedTours().map((t, i) => [t.name, i])
                    );
                    const sortedPointTos = possiblePointTos
                        .slice(0)
                        .sort(([a], [b]) => toursByPriority[a] - toursByPriority[b]);
                    possiblePointTos.splice(0); // reset for the next macro advance

                    const active = sortedPointTos[0];
                    const [activeId, enablePointer] = active || [];
                    for (const { id, methods } of Object.values(pointers)) {
                        if (id === activeId) {
                            enablePointer();
                        } else {
                            methods.hide();
                        }
                    }
                },
            };
        }

        function startTour(tourName, options = {}) {
            if (runningTours.has(tourName) && options.mode === "manual") {
                return;
            }
            runningTours.add(tourName);
            const defaultOptions = {
                stepDelay: 0,
                keepWatchBrowser: false,
                mode: "auto",
                startUrl: "",
                showPointerDuration: 0,
                redirect: true,
                debug: false,
            };
            options = Object.assign(defaultOptions, options);
            const tour = tours[tourName].setState(options);
            if (tourState.get(tour.name, "debug") !== false) {
                // Starts the tour with a debugger to allow you to choose devtools configuration.
                // eslint-disable-next-line no-debugger
                debugger;
            }
            if (!tour) {
                throw new Error(`Tour '${tourName}' is not found.`);
            }
            const pointer = createPointer(tourName, {
                bounce: !(options.mode === "auto" && options.keepWatchBrowser),
            });
            tour.convertToMacro(pointer);
            const willUnload = callWithUnloadCheck(() => {
                if (tour.url && tour.url !== options.startUrl && options.redirect) {
                    window.location.href = window.location.origin + tour.url;
                }
            });
            if (!willUnload) {
                pointer.start();
                tour.start();
            }
        }

        function resumeTour(tourName) {
            const mode = tourState.get(tourName, "mode");
            const keepWatchBrowser = tourState.get(tourName, "keepWatchBrowser");
            if (runningTours.has(tourName)) {
                return;
            }
            const pointer = createPointer(tourName, {
                bounce: !(mode === "auto" && keepWatchBrowser),
            });
            const tour = tours[tourName];
            runningTours.add(tourName);
            tour.convertToMacro(pointer);
            pointer.start();
            tour.start();
        }

        function getSortedTours() {
            return Object.values(tours).sort((t1, t2) => {
                return t1.sequence - t2.sequence || (t1.name < t2.name ? -1 : 1);
            });
        }

        if (!window.frameElement) {
            // Resume running tours.
            for (const tourName of tourState.getActiveTourNames()) {
                if (tourName in tours) {
                    resumeTour(tourName);
                }
            }
        }

        bus.addEventListener("TOUR-START", ({ name, mode }) => {
            if (mode === "auto") {
                transitionConfig.disabled = true;
            }
        });

        bus.addEventListener("TOUR-FINISHED", ({ name, mode, rainbowManMessage, fadeout }) => {
            if (mode === "auto") {
                transitionConfig.disabled = false;
            }
            let message;
            if (typeof rainbowManMessage === "function") {
                message = rainbowManMessage({
                    isTourConsumed: (name) => consumedTours.has(name),
                });
            } else if (typeof rainbowManMessage === "string") {
                message = rainbowManMessage;
            } else {
                message = markup(
                    _t("<strong><b>Good job!</b> You went through all steps of this tour.</strong>")
                );
            }
            if (mode === "manual") {
                consumedTours.add(name);
                orm.call("web_tour.tour", "consume", [[name]]);
            }
            runningTours.delete(name);
            effect.add({ type: "rainbow_man", message, fadeout });
            pointers[name].stop();
        });

        odoo.startTour = startTour;
        odoo.isTourReady = (tourName) => tours[tourName].wait_for.then(() => true);

        return {
            bus,
            startTour,
            getSortedTours,
        };
    },
};

registry.category("services").add("tour_service", tourService);
