/** @odoo-module */

import { Component } from "@odoo/owl";

export class StockMove extends Component {
    static props = {
        record: Object,
        parent: Object,
    };
    static template = "mrp.StockMove";

    setup() {
        this.fieldState = "state";
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
        return this.toConsumeQuantity && this.props.record.data.quantity_done;
    }

    get toConsumeQuantity() {
        const uomQuantity = this.props.record.data.product_uom_qty;
        if (
            this.props.parent.data.product_tracking == "serial" &&
            !this.props.parent.data.show_serial_mass_produce
        ) {
            return uomQuantity / this.props.parent.data.product_qty;
        }
        return uomQuantity;
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
        this.clicked();
    }

    clicked() {
        const quantity = this.isComplete ? 0 : this.toConsumeQuantity;
        this.props.record.update({ quantity_done: quantity });
        this.props.record.save(); // TODO: instead of saving after each individual change, it should be better to save at some point all the changes.
    }

    async openMoveDetails() {
        const resId = [this.props.record.data.id];
        const action = await this.props.record.model.orm.call(
            this.resModel,
            "action_show_details",
            resId
        );
        const options = {
            onClose: async () => {
                await this.props.record.load();
                this.render();
            },
        };
        this.props.record.model.action.doAction(action, options);
    }

    async reload() {
        await this.props.parent.load();
        await this.props.record.load();
        this.props.record.model.notify();
    }
}
