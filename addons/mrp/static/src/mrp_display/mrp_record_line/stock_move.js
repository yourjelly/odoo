/** @odoo-module */

import { Component } from "@odoo/owl";

export class StockMove extends Component {
    static template = "mrp.StockMove";
    static props = {
        record: Object,
        parent: Object,
    };

    setup() {
        this.isLongPressable = false;
        this.longPressed = false;
        this.resModel = this.props.record.resModel;
    }

    get cssClass() {
        let cssClass = this.isLongPressable ? "o_longpressable" : "";
        if (this.isComplete) {
            cssClass += " text-muted";
        }
        return cssClass;
    }

    get isComplete() {
        return (
            this.props.record.data.product_uom_qty &&
            this.props.record.data.quantity_done >= this.props.record.data.product_uom_qty
        );
    }

    longPress() {}

    onAnimationEnd(ev) {
        if (ev.animationName === "longpress") {
            this.longPressed = true;
            this.longPress();
        }
    }

    onClick() {
        if (this.longPressed) {
            this.longPressed = false;
            return; // Do nothing since the longpress event was already called.
        }
        this.toggle();
    }

    toggle() {
        const quantity = this.isComplete ? 0 : this.props.record.data.product_uom_qty;
        this.props.record.update({ quantity_done: quantity });
        this.props.record.save(); // TODO: instead of saving after each individual change, it should be better to save at some point all the changes.
    }
}
