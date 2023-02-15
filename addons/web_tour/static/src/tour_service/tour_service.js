/** @odoo-module **/

import { markup, whenReady } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { MacroEngine, callWithUnloadCheck } from "@web/core/macro";
import { _t } from "@web/core/l10n/translation";
import { session } from "@web/session";
import { TourPointer } from "../tour_pointer/tour_pointer";
import { tourState } from "./tour_state";
import { compileStepManual, compileStepAuto, compileTourToMacro } from "./tour_compilers";
import { createPointerState } from "./tour_pointer_state";

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
    start: async (_env, { orm, effect }) => {
        await whenReady();

        const tours = extractRegisteredTours();
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
        const consumedTours = new Set(session.web_tours);

        function convertToMacro(tour, { mode, stepDelay, watch }) {
            // IMPROVEMENTS: Custom step compiler. Will probably require decoupling from `mode`.
            const stepCompiler = mode === "auto" ? compileStepAuto : compileStepManual;
            const checkDelay = mode === "auto" ? tour.checkDelay : 50;
            return compileTourToMacro(tour, {
                stepCompiler,
                pointerMethods,
                mode,
                stepDelay,
                watch,
                checkDelay,
                onTourEnd({ name, rainbowManMessage, fadeout }) {
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
                macroEngine.activate(macro);
            }
        }

        /**
         * Upon page reload, there might be a running tour. It should be automatically resumed.
         */
        function resumeTour(tourName) {
            const tour = tours[tourName];
            const stepDelay = tourState.get(tourName, "stepDelay");
            const watch = tourState.get(tourName, "watch");
            const mode = tourState.get(tourName, "mode");
            const macro = convertToMacro(tour, { stepDelay, watch, mode });
            macroEngine.activate(macro);
        }

        registry.category("main_components").add("TourPointer", {
            Component: TourPointer,
            props: { pointerState, setPointerState: pointerMethods.setState },
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
