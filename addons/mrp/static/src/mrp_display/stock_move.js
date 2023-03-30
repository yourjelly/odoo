/** @odoo-module */

import { Component } from "@odoo/owl";

export class StockMove extends Component {
    static template = "mrp.MrpDisplayStockMove";
    static props = {
        record: Object,
    };

    toggle() {
        const quantity = this.completed ? 0 : this.move.data.product_uom_qty;
        this.move.update({ quantity_done: quantity });
        this.move.save(); // TODO: instead of saving after each individual change, it should be better to save at some point all the changes.
    }

    get move() {
        return this.props.record;
    }

    get completed() {
        return this.move.data.quantity_done === this.move.data.product_uom_qty;
    }
}
