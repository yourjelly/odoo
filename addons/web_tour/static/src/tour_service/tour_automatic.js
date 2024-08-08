import { tourState } from "./tour_state";
import { config as transitionConfig } from "@web/core/transition";
import { TourStepAutomatic } from "./tour_step_automatic";
import { TourDebugger } from "@web_tour/tour_debugger/tour_debugger";
import { tourDebuggerPlayer } from "@web_tour/tour_debugger/tour_debugger_player";

export class TourAutomatic {
    mode = "auto";
    constructor(data, macroEngine, overlay) {
        Object.assign(this, data);
        this.steps = this.steps.map((step, index) => new TourStepAutomatic(step, this, index));
        this.macroEngine = macroEngine;
        this.stepDelay = +tourState.get(this.name, "stepDelay") || 0;
        this.startDebugger(overlay);
    }

    async startDebugger(overlay) {
        if (tourState.get(this.name, "debug") !== false) {
            overlay.add(TourDebugger, { tour: this }, { sequence: 1987 });
        }
    }

    start(pointer, callback) {
        const currentStepIndex = tourState.get(this.name, "currentIndex");
        const macroSteps = this.steps
            .filter((step) => step.index >= currentStepIndex)
            .flatMap((step) => step.compileToMacro(pointer))
            .concat([
                {
                    action: async () => {
                        tourDebuggerPlayer.setStatus("FINISHED");
                        const debugMode = tourState.get(this.name, "debug");
                        if (debugMode !== false) {
                            await tourDebuggerPlayer.waitFor("STOP");
                        }
                        if (tourState.get(this.name, "stepState") === "errored") {
                            console.error("tour not succeeded");
                        } else {
                            transitionConfig.disabled = false;
                            callback();
                        }
                    },
                },
            ]);

        const macro = {
            name: this.name,
            checkDelay: this.checkDelay,
            steps: macroSteps,
        };

        pointer.start();
        transitionConfig.disabled = true;
        this.macroEngine.activate(macro, true);
    }
}
