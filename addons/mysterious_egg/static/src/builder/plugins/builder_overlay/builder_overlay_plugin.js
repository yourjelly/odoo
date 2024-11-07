import { Plugin } from "@html_editor/plugin";
import { BuilderOverlay } from "./builder_overlay";

export class BuilderOverlayPlugin extends Plugin {
    static name = "builder_overlay";
    static dependencies = ["selection", "overlay"];
    static resources = (p) => ({
        change_selected_toolboxes_listeners: p.openBuilderOverlay.bind(p),
    });

    handleCommand(command) {
        switch (command) {
            case "UPDATE_BUILDER_OVERLAY":
                console.warn("COMMAND");
                console.log(this.overlay);
                console.log(this)
                this.overlay.updatePosition();
                break;
        }
    }

    setup() {
        console.warn("SETUP");
        console.log(this);
        this.overlay = this.shared.createOverlay(BuilderOverlay, {
            positionOptions: {
                position: "bottom-fit",
            },
        });
    }

    destroy() {
        this.removeCurrentOverlay?.();
    }

    openBuilderOverlay(toolboxes) {
        const toolbox = toolboxes[toolboxes.length - 1];
        this.removeCurrentOverlay?.();
        if (!toolbox) {
            return;
        }
        this.removeCurrentOverlay = this.services.overlay.add(BuilderOverlay, {
            target: toolbox.element,
            container: this.document.documentElement,
        });
    }
}
