import { browser } from "@web/core/browser/browser";
import { TourStep } from "./tour_step";
import { EventBus, validate } from "@odoo/owl";
import { session } from "@web/session";
import { utils } from "@web/core/ui/ui_service";
import { tourState } from "./tour_state";
import { TourEngine } from "./tour_engine";

const schema = {
    name: { type: String },
    steps: { type: Function },
    edition: { type: Boolean, optional: true },
    fadeout: { type: String, optional: true },
    rainbowMan: { type: Boolean, optional: true },
    rainbowManMessage: { type: [Function, String], optional: true },
    sequence: { type: Number, optional: true },
    saveAs: { type: String, optional: true },
    test: { type: Boolean, optional: true },
    tests: { type: Boolean, optional: true },
    url: { type: String, optional: true },
    wait_for: { type: [Function, Object], optional: true },
};

export class Tour {
    constructor(data, name) {
        data.name = data.saveAs || name;
        this.validateSchema(data);
        this.wait_for = data.wait_for || Promise.resolve();
        this.rainbowMan = data.rainbowMan === undefined ? true : !!data.rainbowMan;
        this.fadeout = data.fadeout || "medium";
        this.sequence = data.sequence || 1000;
        return this;
    }

    /**
     * @param {TourStep} step
     * @param {TourMode} mode
     */
    shouldOmit(step, mode) {
        const isDefined = (key, obj) => key in obj && obj[key] !== undefined;
        const getEdition = () =>
            (session.server_version_info || []).at(-1) === "e" ? "enterprise" : "community";
        const correctEdition = isDefined("edition", step) ? step.edition === getEdition() : true;
        const correctDevice = isDefined("mobile", step) ? step.mobile === utils.isSmall : true;
        return (
            !correctEdition ||
            !correctDevice ||
            // `step.auto = true` means omitting a step in a manual tour.
            (mode === "manual" && step.auto)
        );
    }

    setState({ mode, stepDelay, keepWatchBrowser, showPointerDuration, debug }) {
        tourState.set(this.name, "currentIndex", 0);
        tourState.set(this.name, "debug", false);
        tourState.set(this.name, "sequence", this.sequence);
        tourState.set(this.name, "debug", debug);
        tourState.set(this.name, "mode", mode);
        tourState.set(this.name, "stepDelay", stepDelay);
        tourState.set(this.name, "keepWatchBrowser", keepWatchBrowser);
        tourState.set(this.name, "showPointerDuration", showPointerDuration);
        return this;
    }

    convertToMacro(pointer) {
        const mode = tourState.get(this.name, "mode");
        const stepDelay = tourState.get(this.name, "stepDelay");
        const keepWatchBrowser = tourState.get(this.name, "keepWatchBrowser");
        const showPointerDuration = tourState.get(this.name, "showPointerDuration");
        const currentIndex = tourState.get(this.name, "currentIndex");
        // IMPROVEMENTS: Custom step compiler. Will probably require decoupling from `mode`.

        const tourSteps = this.steps();
        const steps = tourSteps
            .map((step, index) => {
                const tourStep = new TourStep(step, {
                    name: this.name,
                    steps: tourSteps,
                });
                tourStep.index = index;
                tourStep.stepDelay = stepDelay;
                tourStep.keepWatchBrowser = keepWatchBrowser;
                tourStep.showPointerDuration = showPointerDuration;
                return tourStep;
            })
            .filter((step) => step.index >= currentIndex)
            .filter((step) => !this.shouldOmit(step, mode))
            // Don't include steps before the current index because they're already done.
            .map((step) => step.compileToMacro(mode, pointer))
            .flat(1);
        this.macroSteps = steps;
        return this.macroSteps;
    }

    validateSchema(data) {
        try {
            validate(data, schema);
            Object.assign(this, data);
            return true;
        } catch (error) {
            console.error(`Error for tour : ${JSON.stringify(data, null, 4)}\n${error.message}`);
            return false;
        }
    }

    start() {
        new EventBus().trigger("TOUR-START", {
            name: this.name,
            mode: this.mode,
        });
        const engine = new TourEngine(this.macroSteps);
        engine.whenCompleted.then(() => {
            if (tourState.get(this.name, "stepState") === "succeeded") {
                tourState.clear(this.name);
                new EventBus().trigger("TOUR-FINISHED", {
                    name: this.name,
                    mode: this.mode,
                    rainbowManMessage: this.rainbowManMessage,
                    fadeout: this.fadeout,
                });
                // Used to signal the python test runner that the tour finished without error.
                browser.console.log("tour succeeded");
                // Used to see easily in the python console and to know which tour has been succeeded in suite tours case.
                const succeeded = `║ TOUR ${name} SUCCEEDED ║`;
                const msg = [succeeded];
                msg.unshift("╔" + "═".repeat(succeeded.length - 2) + "╗");
                msg.push("╚" + "═".repeat(succeeded.length - 2) + "╝");
                browser.console.log(`\n\n${msg.join("\n")}\n`);
            } else {
                console.error("tour not succeeded");
            }
        });
    }
}
