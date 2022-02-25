/** @odoo-module **/

import { usePosition } from "../position/position_hook";
import { LegacyComponent } from "@web/legacy/legacy_component";

const { Component } = owl;

export class Popover extends LegacyComponent {
    setup() {
        usePosition(this.props.target, {
            margin: 16,
            position: this.props.position,
        });
    }
}

Popover.template = "web.PopoverWowl";
Popover.defaultProps = {
    position: "bottom",
};
Popover.props = {
    close: { type: Function },
    popoverClass: {
        optional: true,
        type: String,
    },
    position: {
        type: String,
        validate: (p) => ["top", "bottom", "left", "right"].includes(p),
        optional: true,
    },
    target: HTMLElement,
    slots: {
        type: Object,
        optional: true,
        shape: {
            default: { optional: true },
        },
    },
};
