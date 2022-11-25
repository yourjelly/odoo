/** @odoo-module **/

import { Component, useState } from "@odoo/owl";

/**
 * @typedef {import("../tour_service/tour_pointer_state").TourPointerState} TourPointerState
 *
 * @typedef TourPointerProps
 * @property {TourPointerState} pointerState
 * @property {(pointerState: Partial<TourPointerState>) => void} setPointerState
 */

/** @extends {Component<TourPointerProps, any>} */
export class TourPointer extends Component {
    static props = {
        pointerState: {
            type: Object,
            shape: {
                content: { type: String, optional: true },
                fixed: Boolean,
                isOpen: { type: Boolean, optional: true },
                isVisible: Boolean,
                position: [
                    { value: "left" },
                    { value: "right" },
                    { value: "top" },
                    { value: "bottom" },
                ],
                x: Number,
                y: Number,
            },
        },
    };

    static template = "web_tour.TourPointer";
    static size = 28; // in pixels

    setup() {
        this.state = useState({ isOpen: false });
    }

    get isOpen() {
        return this.state.isOpen || this.props.pointerState.isOpen;
    }
}
