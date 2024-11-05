import { Plugin } from "@html_editor/plugin";
import { throttleForAnimation } from "@web/core/utils/timing";
import { renderToElement } from "@web/core/utils/render";
import { getScrollingElement, getScrollingTarget } from "@web/core/utils/scrolling";
import { isMobileView } from "../../utils/utils";

export class BuilderOverlayPlugin extends Plugin {
    static id = "builderOverlay";
    static dependencies = ["selection", "localOverlay"];
    resources = {
        step_added_handlers: this._update.bind(this),
        change_selected_toolboxes_listeners: this.openBuilderOverlay.bind(this),
    };

    setup() {
        this.overlayContainer = this.dependencies.localOverlay.makeLocalOverlay(
            "builder-overlay-container"
        );
        this.overlays = [];
        this.toolboxes = [];

        this.update = throttleForAnimation(this._update.bind(this));

        // Recompute the overlay when the window is resized.
        this.addDomListener(window, "resize", this.update);

        // On keydown, hide the overlay and then show it again when the mouse
        // moves.
        let wasKeydown;
        this.onKeydown = () => {
            wasKeydown = true;
            this.toggleOverlayVisibility(false);
        };
        this.onMouseMoveOrDown = throttleForAnimation(() => {
            if (!wasKeydown) {
                return;
            }
            wasKeydown = false;
            this.toggleOverlayVisibility(true);
            this.refreshPosition();
        });
        const body = this.document.body;
        this.addDomListener(body, "keydown", this.onKeydown);
        this.addDomListener(body, "mousemove", this.onMouseMoveOrDown);
        this.addDomListener(body, "mousedown", this.onMouseMoveOrDown);

        // Hide the overlay when scrolling. Show it again when the scroll is
        // over and recompute its position.
        this.scrollingElement = getScrollingElement(this.document);
        this.scrollingTarget = getScrollingTarget(this.scrollingElement);
        this.onScrollingElementScroll = throttleForAnimation(() => {
            this.toggleOverlayVisibility(false);
            clearTimeout(this.scrollingTimeout);
            this.scrollingTimeout = setTimeout(() => {
                this.toggleOverlayVisibility(true);
                this.refreshPosition();
            }, 250);
        });
        this.addDomListener(this.scrollingTarget, "scroll", this.onScrollingElementScroll, {
            capture: true,
        });

        // TODO sizing config or "option" ?
        this.sizingY = {
            selector: "section, .row > div, .parallax, .s_hr, .carousel-item, .s_rating",
            exclude:
                "section:has(> .carousel), .s_image_gallery .carousel-item, .s_col_no_resize.row > div, .s_col_no_resize",
        };
        this.sizingX = {
            selector: ".row > div",
            exclude: ".s_col_no_resize.row > div, .s_col_no_resize",
        };
        this.sizingGrid = {
            selector: "div.o_grid_item",
        };
    }

    // displayOverlayOptions(el) {
    //     // TODO when options will be more clear:
    //     // - moving
    //     // - timeline
    //     // (maybe other where `displayOverlayOptions: true`)
    //     return el.matches([this.sizingY.selector, this.sizingX.selector, this.sizingGrid.selector].join(","));
    // }

    // TODO improve with different sizing.
    displayHandles(el) {
        return el.matches(
            [this.sizingY.selector, this.sizingX.selector, this.sizingGrid.selector].join(",")
        );
    }

    openBuilderOverlay(toolboxes) {
        this.removeBuilderOverlay();
        if (!toolboxes.length) {
            return;
        }
        this.toolboxes = toolboxes;

        // Create the overlays.
        toolboxes.forEach((toolbox) => {
            const overlayElement = renderToElement("html_builder.BuilderOverlay");
            const overlayTarget = toolbox.element;
            this.overlayContainer.append(overlayElement);
            const displayHandles = this.displayHandles(overlayTarget);

            this.overlays.push(new BuilderOverlay(overlayElement, overlayTarget, displayHandles));
        });

        // Activate the last overlay.
        const innermostOverlay = this.overlays.at(-1);
        innermostOverlay.toggleOverlay(true);

        // Also activate the closest overlay that should have handles.
        if (!innermostOverlay.displayHandles) {
            for (let i = this.overlays.length - 2; i >= 0; i--) {
                const parentOverlay = this.overlays[i];
                if (parentOverlay.displayHandles) {
                    parentOverlay.toggleOverlay(true);
                    break;
                }
            }
        }

        // TODO check if resizeObserver still needed.
        // this.resizeObserver = new ResizeObserver(this.update.bind(this));
        // this.resizeObserver.observe(this.overlayTarget);
    }

    removeBuilderOverlay() {
        this.overlays.forEach((overlay) => overlay.overlayElement.remove());
        this.overlays = [];
        this.toolboxes = [];
        // this.resizeObserver?.disconnect();
    }

    _update() {
        this.overlays.forEach((overlay) => {
            overlay.refreshPosition();
            overlay.refreshHandles();
        });
    }

    refreshPosition() {
        this.overlays.forEach((overlay) => {
            overlay.refreshPosition();
        });
    }

    refreshHandles() {
        this.overlays.forEach((overlay) => {
            overlay.refreshHandles();
        });
    }

    toggleOverlayVisibility(show) {
        this.overlays.forEach((overlay) => {
            overlay.toggleOverlayVisibility(show);
        });
    }

    destroy() {
        this.removeBuilderOverlay();
    }
}

class BuilderOverlay {
    constructor(overlayElement, overlayTarget, displayHandles) {
        this.overlayElement = overlayElement;
        this.overlayTarget = overlayTarget;
        this.displayHandles = displayHandles;
        this.handlesWrapperEl = this.overlayElement.querySelector(".o_handles");
        this.handleEls = this.overlayElement.querySelectorAll(".o_handle");
    }

    isActive() {
        return this.overlayElement.classList.contains("oe_active");
    }

    refreshPosition() {
        if (!this.isActive()) {
            return;
        }

        // TODO transform
        const targetRect = this.overlayTarget.getBoundingClientRect();
        Object.assign(this.overlayElement.style, {
            width: `${targetRect.width}px`,
            height: `${targetRect.height}px`,
            top: `${targetRect.y + window.screenY}px`,
            left: `${targetRect.x + window.screenX}px`,
        });
        this.handlesWrapperEl.style.height = `${targetRect.height}px`;
    }

    refreshHandles() {
        if (!this.displayHandles || !this.isActive()) {
            return;
        }

        // TODO improve => by sizing category

        const isMobile = isMobileView(this.overlayTarget);
        const isGridOn = this.overlayTarget.classList.contains("o_grid_item");
        const isGrid = !isMobile && isGridOn;
        if (
            this.overlayTarget.parentNode &&
            this.overlayTarget.parentNode.classList.contains("row")
        ) {
            // Hiding/showing the correct resize handles if we are in grid mode
            // or not.
            for (const handleEl of this.handleEls) {
                const isGridHandle = handleEl.classList.contains("o_grid_handle");
                handleEl.classList.toggle("d-none", isGrid ^ isGridHandle);
                // Disabling the vertical resize if we are in mobile view.
                const isVerticalSizing = handleEl.matches(".n, .s");
                handleEl.classList.toggle("readonly", isMobile && isVerticalSizing && isGridOn);
            }
        }
    }

    toggleOverlay(show) {
        this.overlayElement.classList.add("oe_active", show);
        this.refreshPosition();
        this.refreshHandles();
    }

    toggleOverlayVisibility(show) {
        if (!this.isActive()) {
            return;
        }
        this.overlayElement.classList.toggle("o_overlay_hidden", !show);
    }
}
