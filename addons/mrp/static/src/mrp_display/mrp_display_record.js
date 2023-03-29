/** @odoo-module */

import { CharField } from "@web/views/fields/char/char_field";
import { Component } from "@odoo/owl";
import { Field } from "@web/views/fields/field";
import { StockMove } from "./mrp_record_line/stock_move";
import { MrpWorkorder } from "./mrp_record_line/mrp_workorder";

export class MrpDisplayRecord extends Component {
    static components = { CharField, Field, StockMove, MrpWorkorder };
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
    }

    get displayDoneButton() {
        return (
            this.workorders.length === 0 || this.workorders.every((wo) => wo.data.state === "done")
        );
    }

    async onClickHeader(ev) {
        const { resModel, resId } = this.props.record;
        if (resModel === "mrp.workorder") {
            await this.props.record.model.orm.call(resModel, "button_pending", [resId]);
            this.props.record.update();
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
