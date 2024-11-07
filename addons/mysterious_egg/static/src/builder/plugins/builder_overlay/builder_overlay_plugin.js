import { Plugin } from "@html_editor/plugin";
import { throttleForAnimation } from "@web/core/utils/timing";

export class BuilderOverlayPlugin extends Plugin {
    static name = "builder_overlay";
    static dependencies = ["selection", "local-overlay"];
    static resources = (p) => ({
        change_selected_toolboxes_listeners: p.openBuilderOverlay.bind(p),
    });

    handleCommand(command) {
        switch (command) {
            case "STEP_ADDED":
                this.update();
                break;
        }
    }

    setup() {
        // this.overlay = this.shared.createOverlay(BuilderOverlay, {
        //     positionOptions: {
        //         position: "bottom-fit",
        //     },
        // });
        this.overlayContainer = this.shared.makeLocalOverlay("builder-overlay-container");
        this.update = throttleForAnimation(this._update.bind(this));
    }

    renderOverlay(target, config) {
        const div = document.createElement("div");
        div.innerHTML = `
            <div t-ref="root" class="border border-info pe-none border-2">
                <div class="o_handles"
                    <div class="o_handle o_column_handle o_side o_side_y top o_handle_start" t-attf-style="height: {{size.paddingTop}};">
                        <span class="o_handle_indicator"></span>
                    </div>
                    <div class="o_handle o_column_handle o_side o_side_y bottom o_handle_start" t-attf-style="height: {{size.paddingBottom}};">
                        <span class="o_handle_indicator"></span>
                    </div>
                    <div class="o_handle o_column_handle o_side o_side_x end o_handle_start" >
                        <span class="o_handle_indicator"></span>
                    </div>
                    <div class="o_handle o_column_handle o_side o_side_x start o_handle_start">
                        <span class="o_handle_indicator"></span>
                    </div>
                </div>
            </div>
        `;
        this.resizeObserver = new ResizeObserver(this.update.bind(this));
        this.resizeObserver.observe(div);

        return div;
    }

    _update() {
        this.overlayElement.querySelector(
            ".o_column_handle.o_side_y"
        ).style.width = `${this.size.width}px`;
    }

    destroy() {
        this.removeCurrentOverlay?.();
        this.resizeObserver.disconnect();
    }

    openBuilderOverlay(toolboxes) {
        const toolbox = toolboxes[toolboxes.length - 1];
        this.remove();
        if (!toolbox) {
            return;
        }
        this.overlayElement = this.renderOverlay();
        this.overlayContainer.append(this.overlayElement);
    }
    remove() {
        this.overlayElement.remove();
    }
}
