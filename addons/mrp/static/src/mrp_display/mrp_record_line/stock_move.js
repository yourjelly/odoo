/** @odoo-module */

import { Component } from "@odoo/owl";

export class StockMove extends Component {
    static template = "mrp.StockMove";
    static props = { record: Object };

    setup() {
        this.isLongPressable = false;
        this.longPressed = false;
        this.resModel = this.props.record.resModel;
    }

    get cssClass() {
        let cssClass = this.isLongPressable ? "o_longpressable" : "";
        if (this.isComplete) {
            cssClass += "text-muted text-decoration-line-through";
        }
        return cssClass;
    }

    get isComplete() {
        return (
            this.props.record.data.product_uom_qty &&
            this.props.record.data.quantity_done >= this.props.record.data.product_uom_qty
        );
    }

    onAnimationEnd(ev) {
        if (ev.animationName === "longpress") {
            this._longPress();
        }
    }

    onClick() {
        if (this.longPressed) {
            this.longPressed = false;
            return; // Do nothing since the longpress event was already called.
        }
        this.toggle();
    }

    _longPress() {
        this.longPressed = true;
        console.log("-- long press");
    }

    toggle() {
        const quantity = this.isComplete ? 0 : this.props.record.data.product_uom_qty;
        this.props.record.update({ quantity_done: quantity });
        this.props.record.save(); // TODO: instead of saving after each individual change, it should be better to save at some point all the changes.
    }
}
