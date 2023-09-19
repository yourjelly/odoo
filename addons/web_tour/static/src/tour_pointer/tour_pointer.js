/** @odoo-module **/

import { Component, onWillUpdateProps, useEffect, useRef } from "@odoo/owl";
import { reposition } from "@web/core/position_hook";
import { usePosition } from "@web/core/position_hook2";

/**
 * @typedef {import("../tour_service/tour_pointer_state").TourPointerState} TourPointerState
 *
 * @typedef TourPointerProps
 * @property {TourPointerState} pointerState
 * @property {boolean} bounce
 */

/** @extends {Component<TourPointerProps, any>} */
export class TourPointer extends Component {
    static props = {
        pointerState: {
            type: Object,
            shape: {
                anchor: { type: HTMLElement, optional: true },
                content: { type: String, optional: true },
                fixed: { type: Boolean, optional: true },
                isOpen: { type: Boolean, optional: true },
                isVisible: { type: Boolean, optional: true },
                onClick: { type: [Function, { value: null }], optional: true },
                onMouseEnter: { type: [Function, { value: null }], optional: true },
                onMouseLeave: { type: [Function, { value: null }], optional: true },
                position: {
                    type: [
                        { value: "left" },
                        { value: "right" },
                        { value: "top" },
                        { value: "bottom" },
                    ],
                    optional: true,
                },
                rev: { type: Number, optional: true },
            },
        },
        bounce: { type: Boolean, optional: true },
    };

    static defaultProps = {
        bounce: true,
    };

    static template = "web_tour.TourPointer";
    static width = 28; // in pixels
    static height = 28; // in pixels

    setup() {
        let lastAnchor;
        let [anchorX, anchorY] = [0, 0];
        usePosition(
            "pointer",
            () => this.props.pointerState.anchor,
            (pointer, anchor) => {
                // Content changed: we must re-measure the dimensions of the text.
                if (this.isOpen) {
                    pointer.style.removeProperty("width");
                    pointer.style.removeProperty("height");
                    // dimensions = pointer.getBoundingClientRect();
                    // const { width, height } = dimensions;
                    // pointer.style.removeProperty("transition");
                    // pointer.style.setProperty("width", `${width}px`);
                    // pointer.style.setProperty("height", `${height}px`);
                    return;
                } else {
                    pointer.style.setProperty("width", `${this.constructor.width}px`);
                    pointer.style.setProperty("height", `${this.constructor.height}px`);
                }

                if (anchor !== lastAnchor) {
                    lastAnchor = anchor;
                } else {
                    const { x, y } = anchor.getBoundingClientRect();
                    const [lastAnchorX, lastAnchorY] = [anchorX, anchorY];
                    [anchorX, anchorY] = [x, y];
                    // Let's just say that the anchor is static if it moved less than 1px.
                    const delta = Math.sqrt(
                        Math.pow(x - lastAnchorX, 2) + Math.pow(y - lastAnchorY, 2)
                    );
                    if (delta < 1) {
                        return;
                    }
                }

                pointer.style.removeProperty("bottom");
                pointer.style.removeProperty("right");
                return {
                    position: this.position,
                    margin: 6,
                    onPositioned: (_, position) => {
                        const popperRect = pointer.getBoundingClientRect();
                        const { top, left, direction } = position;
                        if (direction === "top") {
                            pointer.style.bottom = `${
                                window.innerHeight - top - popperRect.height
                            }px`;
                            pointer.style.removeProperty("top");
                        } else {
                            pointer.style.top = `${top}px`;
                        }
                        if (direction === "left") {
                            pointer.style.right = `${
                                window.innerWidth - left - popperRect.width
                            }px`;
                            pointer.style.removeProperty("left");
                        } else {
                            pointer.style.left = `${left}px`;
                        }
                    },
                };
            }
        );
    }

    get content() {
        return this.props.pointerState.content || "";
    }

    get isOpen() {
        return this.props.pointerState.isOpen;
    }

    get position() {
        return this.props.pointerState.position || "top";
    }
}
