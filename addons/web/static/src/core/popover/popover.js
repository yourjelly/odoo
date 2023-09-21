/** @odoo-module **/

import { Component } from "@odoo/owl";
import { useForwardRefToParent } from "../utils/hooks";
import { usePosition } from "@web/core/position_hook";

export class Popover extends Component {
    setup() {
        useForwardRefToParent("ref");
        usePosition(
            "ref",
            () => this.props.target,
            () => ({
                position: this.props.position,
                fixedPosition: this.props.fixedPosition,
                displayArrow: this.props.displayArrow,
                animationTime: this.props.animationTime,
            })
        );
    }
}

Popover.template = "web.PopoverWowl";
Popover.defaultProps = {
    position: "bottom",
    class: "",
    fixedPosition: false,
    displayArrow: true,
    animationTime: 200,
};
Popover.props = {
    ref: {
        type: Function,
        optional: true,
    },
    class: {
        optional: true,
        type: String,
    },
    position: {
        type: String,
        validate: (p) => {
            const [d, v = "middle"] = p.split("-");
            return (
                ["top", "bottom", "left", "right"].includes(d) &&
                ["start", "middle", "end", "fit"].includes(v)
            );
        },
        optional: true,
    },
    fixedPosition: {
        type: Boolean,
        optional: true,
    },
    displayArrow: {
        type: Boolean,
        optional: true,
    },
    animationTime: {
        type: Number,
        optional: true,
    },
    target: {
        validate: (target) => {
            // target may be inside an iframe, so get the Element constructor
            // to test against from its owner document's default view
            const Element = target?.ownerDocument?.defaultView.Element;
            return Boolean(Element) && target instanceof Element;
        },
    },
    slots: {
        type: Object,
        optional: true,
        shape: {
            default: { optional: true },
        },
    },
};
