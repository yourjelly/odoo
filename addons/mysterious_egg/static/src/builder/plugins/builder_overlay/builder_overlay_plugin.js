import { Plugin } from "@html_editor/plugin";
import { throttleForAnimation } from "@web/core/utils/timing";
import { renderToElement } from "@web/core/utils/render";
import { getScrollingElement, getScrollingTarget } from "@web/core/utils/scrolling";
import builderUtils from "../../utils/utils";

export class BuilderOverlayPlugin extends Plugin {
    static name = "builder_overlay";
    static dependencies = ["selection", "local-overlay"];
    static resources = (p) => ({
        change_selected_toolboxes_listeners: p.openBuilderOverlay.bind(p),
    });

    handleCommand(command) {
        switch (command) {
            case "STEP_ADDED":
                console.warn("step added");
                if (this.overlayElement) {
                    this.update();
                }
                break;
        }
    }

    setup() {
        console.warn("SETUP");
        console.log(this);
        this.overlayContainer = this.shared.makeLocalOverlay("builder-overlay-container");
        this.update = throttleForAnimation(this._update.bind(this));


        // Recompute the overlay when the window is resized.
        window.addEventListener("resize", this.update);

        // On keydown, hide the overlay and then show it again when the mouse
        // moves.
        this.onKeydown = () => {
            this.wasKeydown = true;
            this.toggleOverlayVisibility(false);
        }
        this.onMouseMoveOrDown = throttleForAnimation(() => {
            if (!this.wasKeydown) {
                return;
            }
            this.wasKeydown = false;
            this.toggleOverlayVisibility(true);
            this.refreshPosition();
        });
        this.body = this.document.body;
        this.body.addEventListener("keydown", this.onKeydown);
        this.body.addEventListener("mousemove", this.onMouseMoveOrDown);
        this.body.addEventListener("mousedown", this.onMouseMoveOrDown);


        // Hide the overlay when scrolling. Show it again when the scroll is
        // over and recompute its position.
        this.scrollingElement = getScrollingElement(this.document);
        this.scrollingTarget = getScrollingTarget(this.scrollingElement);
        this._onScrollingElementScroll = throttleForAnimation(() => {
            this.toggleOverlayVisibility(false);
            clearTimeout(this.scrollingTimeout);
            this.scrollingTimeout = setTimeout(() => {
                this.toggleOverlayVisibility(true);
                this.refreshPosition();
            }, 250);
        });
        this.scrollingTarget.addEventListener("scroll", this._onScrollingElementScroll, {capture: true});


        // this.sizingConfig = 
        this.sizingY = {
            selector: "section, .row > div, .parallax, .s_hr, .carousel-item, .s_rating",
            exclude: "section:has(> .carousel), .s_image_gallery .carousel-item, .s_col_no_resize.row > div, .s_col_no_resize",
        };
        this.sizingX = {
            selector: ".row > div",
            exclude: ".s_col_no_resize.row > div, .s_col_no_resize",
        };
        this.sizingGrid = {
            selector: "div.o_grid_item",
        }
    }

    openBuilderOverlay(toolboxes) {
        console.warn("OPEN");
        this.removeBuilderOverlay();
        const toolbox = toolboxes[toolboxes.length - 1];
        console.log(toolbox);
        if (!toolbox) {
            return;
        }
        this.overlayTarget = toolbox.element;
        this.overlayElement = this.renderOverlay();
        this.overlayContainer.append(this.overlayElement);

        // this.resizeObserver = new ResizeObserver(this.update.bind(this));
        // this.resizeObserver.observe(this.overlayTarget);

        this.handlesWrapperEl = this.overlayElement.querySelector(".o_handles");
        this.handleEls = this.overlayElement.querySelectorAll(".o_handle");
        this._update();
        // TODO do something for not sizing
    }

    removeBuilderOverlay() {
        this.overlayElement?.remove();
        // this.resizeObserver?.disconnect();
    }

    renderOverlay(target, config) {
        console.log("RENDER");
        const overlayEl = renderToElement("mysterious_egg.BuilderOverlay");
        console.log(overlayEl);

        return overlayEl;
    }

    _update() {
        console.warn("UPDATE");
        if (!this.overlayElement) {
            return;
        }
        this.refreshPosition();
        this.refreshHandles();
    }

    refreshPosition() {
        // TODO transform
        if (!this.overlayElement) {
            return;
        }
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
        if (!this.overlayElement) {
            return;
        }
        const isMobileView = builderUtils.isMobileView(this.overlayTarget);
        const isGridOn = this.overlayTarget.classList.contains("o_grid_item");
        const isGrid = !isMobileView && isGridOn;
        if (this.overlayTarget.parentNode && this.overlayTarget.parentNode.classList.contains('row')) {
            // Hiding/showing the correct resize handles if we are in grid mode
            // or not.
            for (const handleEl of this.handleEls) {
                const isGridHandle = handleEl.classList.contains('o_grid_handle');
                handleEl.classList.toggle('d-none', isGrid ^ isGridHandle);
                // Disabling the vertical resize if we are in mobile view.
                const isVerticalSizing = handleEl.matches('.n, .s');
                handleEl.classList.toggle("readonly", isMobileView && isVerticalSizing && isGridOn);
            }
        }
    }

    toggleOverlayVisibility(show=false) {
        if (!this.overlayElement) {
            return;
        }
        this.overlayElement.classList.toggle("o_overlay_hidden", !show);
    }

    destroy() {
        this.removeBuilderOverlay();

        // Remove the listeners.
        window.removeEventListener("resize", this.update);
        this.body.removeEventListener("keydown", this.onKeydown);
        this.body.removeEventListener("mousemove", this.onMouseMoveOrDown);
        this.body.removeEventListener("mousedown", this.onMouseMoveOrDown);
        this.scrollingTarget.removeEventListener("scroll", this._onScrollingElementScroll);
    }

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------


}
