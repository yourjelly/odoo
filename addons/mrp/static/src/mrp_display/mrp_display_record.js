/** @odoo-module */

import { CharField } from "@web/views/fields/char/char_field";
import { Component } from "@odoo/owl";
import { Field } from "@web/views/fields/field";
import { StockMove } from "./mrp_record_line/stock_move";
import { MrpWorkorder } from "./mrp_record_line/mrp_workorder";
import { MrpTimer } from "@mrp/widgets/timer";

export class MrpDisplayRecord extends Component {
    static components = { CharField, Field, StockMove, MrpWorkorder, MrpTimer };
    static props = {
        openMenuPop: Function,
        record: Object,
        workorders: { type: Array, optional: true },
        rawMoves: { type: Array, optional: true },
    };
    static defaultProps = {
        rawMoves: [],
        workorders: [],
    };
    static template = "mrp.MrpDisplayRecord";

    setup() {
        this.record = this.props.record.data;
        this.workorders = this.props.workorders;
        this.rawMoves = this.props.rawMoves;
    }

    get displayDoneButton() {
        return (
            this.workorders.length === 0 || this.workorders.every((wo) => wo.data.state === "done")
        );
    }

    get active() {
        const { resModel } = this.props.record;
        if (resModel === "mrp.production") {
            return this.workorders.length
                ? this.workorders.some((wo) => wo.data.is_user_working)
                : this.rawMoves.some((move) => move.data.quantity_done);
        }
        return this.record.is_user_working;
    }

    async onClickHeader() {
        const { resModel, resId } = this.props.record;
        if (resModel === "mrp.workorder") {
            if (this.record.is_user_working) {
                await this.props.record.model.orm.call(resModel, "button_pending", [resId]);
            } else {
                await this.props.record.model.orm.call(resModel, "button_start", [resId]);
            }
            await this.props.record.load();
            this.render();
        }
    }

    onClickManufacturingDone(ev) {
        console.log("TODO");
    }

    onClickOpenMenu(ev) {
        this.props.openMenuPop(this.props.record);
    }
}
