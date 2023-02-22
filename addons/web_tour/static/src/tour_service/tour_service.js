/** @odoo-module **/

import { markup, whenReady } from "@odoo/owl";
import { isMobileOS } from "@web/core/browser/feature_detection";
import { _t } from "@web/core/l10n/translation";
import { MacroEngine } from "@web/core/macro";
import { registry } from "@web/core/registry";
import { config as transitionConfig } from "@web/core/transition";
import { session } from "@web/session";
import { TourPointer } from "../tour_pointer/tour_pointer";
import { compileStepAuto, compileStepManual, compileTourToMacro } from "./tour_compilers";
import { createPointerState } from "./tour_pointer_state";
import { tourState } from "./tour_state";
import { callWithUnloadCheck } from "./tour_utils";

/**
 * @typedef {string} JQuerySelector
 * @typedef {import("./tour_utils").RunCommand} RunCommand
 *
 * @typedef Tour
 * @property {string} url
 * @property {TourStep[]} steps
 * @property {boolean} [rainbowMan]
 * @property {number} [sequence]
 * @property {boolean} [test]
 * @property {Promise<any>} [wait_for]
 * @property {string} [saveAs]
 * @property {string} [fadeout]
 * @property {number} [checkDelay]
 *
 * @typedef TourStep
 * @property {string} [id]
 * @property {JQuerySelector} trigger
 * @property {JQuerySelector} [extra_trigger]
 * @property {JQuerySelector} [alt_trigger]
 * @property {JQuerySelector} [skip_trigger]
 * @property {string} [content]
 * @property {"top" | "botton" | "left" | "right"} [position]
 * @property {"community" | "enterprise"} [edition]
 * @property {RunCommand} [run]
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

function extractRegisteredTours() {
    const tours = {};
    for (const [name, tour] of registry.category("web_tour.tours").getEntries()) {
        tours[name] = {
            name: tour.saveAs || name,
            steps: tour.steps,
            url: tour.url,
            rainbowMan: tour.rainbowMan === undefined ? true : !!tour.rainbowMan,
            rainbowManMessage: tour.rainbowManMessage,
            fadeout: tour.fadeout || "medium",
            sequence: tour.sequence || 1000,
            test: tour.test,
            wait_for: tour.wait_for || Promise.resolve(),
            checkDelay: tour.checkDelay,
        };
    }
    return tours;
}

/**
 * @param {TourStep} step
 * @param {"manual" | "auto"} mode
 * @returns {boolean}
 */
function shouldOmit(step, mode) {
    const isDefined = (key, obj) => key in obj && obj[key] !== undefined;
    const getEdition = () =>
        session.server_version_info.slice(-1)[0] === "e" ? "enterprise" : "community";
    const correctEdition = isDefined("edition", step) ? step.edition === getEdition() : true;
    const correctDevice = isDefined("mobile", step) ? step.mobile === isMobileOS() : true;
    return (
        !correctEdition ||
        !correctDevice ||
        // `step.auto = true` means omitting a step in a manual tour.
        (mode === "manual" && step.auto)
    );
}

export const tourService = {
    dependencies: ["orm", "effect"],
    start: async (_env, { orm, effect }) => {
        await whenReady();

        const tours = extractRegisteredTours();
        const macroEngine = new MacroEngine({ target: document });
        const [pointerState, pointerMethods] = createPointerState();
        const consumedTours = new Set(session.web_tours);

        function convertToMacro(tour, { mode, stepDelay, watch }) {
            // IMPROVEMENTS: Custom step compiler. Will probably require decoupling from `mode`.
            const stepCompiler = mode === "auto" ? compileStepAuto : compileStepManual;
            const checkDelay = mode === "auto" ? tour.checkDelay : 50;
            const filteredSteps = tour.steps.filter((step) => !shouldOmit(step, mode));
            return compileTourToMacro(tour, {
                filteredSteps,
                stepCompiler,
                pointerMethods,
                stepDelay,
                watch,
                checkDelay,
                onTourEnd({ name, rainbowManMessage, fadeout }) {
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
                            _t(
                                "<strong><b>Good job!</b> You went through all steps of this tour.</strong>"
                            )
                        );
                    }
                    effect.add({ type: "rainbow_man", message, fadeout });
                    if (mode === "manual") {
                        consumedTours.add(name);
                        orm.call("web_tour.tour", "consume", [[name]]);
                    }
                    // Used to signal the python test runner that the tour finished without error.
                    console.log("test successful");
                },
            });
        }

        /**
         * Disable transition before starting an "auto" tour.
         * @param {Macro} macro
         * @param {'auto' | 'manual'} mode
         */
        function activateMacro(macro, mode) {
            if (mode === "auto") {
                transitionConfig.disabled = true;
            }
            macroEngine.activate(macro);
        }

        function startTour(tourName, options = {}) {
            // set default options
            options = Object.assign({ stepDelay: 0, watch: false, mode: "auto", url: "" }, options);
            const tour = tours[tourName];
            if (!tour) {
                throw new Error(`Tour '${tourName}' is not found.`);
            }
            tourState.set(tourName, "currentIndex", 0);
            tourState.set(tourName, "stepDelay", options.stepDelay);
            tourState.set(tourName, "watch", options.watch);
            tourState.set(tourName, "mode", options.mode);
            const macro = convertToMacro(tour, options);
            const willUnload = callWithUnloadCheck(() => {
                if (tour.url && tour.url !== options.url) {
                    window.location.href = window.location.origin + tour.url;
                }
            });
            if (!willUnload) {
                activateMacro(macro, options.mode);
            }
        }

        function resumeTour(tourName) {
            const tour = tours[tourName];
            const stepDelay = tourState.get(tourName, "stepDelay");
            const watch = tourState.get(tourName, "watch");
            const mode = tourState.get(tourName, "mode");
            const macro = convertToMacro(tour, { stepDelay, watch, mode });
            activateMacro(macro, mode);
        }

        registry.category("main_components").add("TourPointer", {
            Component: TourPointer,
            props: { pointerState },
        });

        if (!window.frameElement) {
            // Resume running tours.
            for (const tourName of tourState.getActiveTourNames()) {
                if (tourName in tours) {
                    resumeTour(tourName);
                } else {
                    // If a tour found in the local storage is not found in the `tours` map,
                    // then it is an outdated tour state. It should be cleared.
                    tourState.clear(tourName);
                }
            }
        }

        odoo.startTour = startTour;
        // Allow caching of result of `isTourReady(tourName)`.
        odoo.isTourReady = (function makeIsTourReady() {
            const isTourReadyCache = {};
            const isWaiting = {};
            return (tourName) => {
                if (!isWaiting[tourName]) {
                    isWaiting[tourName] = true;
                    const tourDesc = tours[tourName];
                    tourDesc.wait_for.then(() => {
                        isTourReadyCache[tourName] = true;
                    });
                } else {
                    return isTourReadyCache[tourName];
                }
            };
        })();

        return {
            startTour,
            getSortedTours() {
                return Object.values(tours).sort((t1, t2) => {
                    return t1.sequence - t2.sequence || (t1.name < t2.name ? -1 : 1);
                });
            },
        };
    },
};

registry.category("services").add("tour_service", tourService);
