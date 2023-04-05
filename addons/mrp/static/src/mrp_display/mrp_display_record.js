/** @odoo-module */

import { CharField } from "@web/views/fields/char/char_field";
import { Component } from "@odoo/owl";
import { Field } from "@web/views/fields/field";
import { StockMove } from "./mrp_record_line/stock_move";
import { MrpWorkorder } from "./mrp_record_line/mrp_workorder";
import { MrpTimer } from "@mrp/widgets/timer";

export class MrpDisplayRecord extends Component {
    static components = { CharField, Field, MrpTimer };
    static props = {
        openMenuPop: Function,
        record: Object,
        subRecords: Array,
    };
    static template = "mrp.MrpDisplayRecord";

    setup() {
        this.record = this.props.record.data;
        this.rawMoves = this.props.subRecords.filter((rec) => rec.resModel === "stock.move");
        this.workorders = this.props.subRecords.filter((rec) => rec.resModel === "mrp.workorder");
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

    get displayDoneButton() {
        return (
            this.workorders.length === 0 || this.workorders.every((wo) => wo.data.state === "done")
        );
    }

    getComponent(record) {
        if (record.resModel === "stock.move") {
            return StockMove;
        } else if (record.resModel === "mrp.workorder") {
            return MrpWorkorder;
        }
        throw Error(`No Component found for the model "${record.resModel}"`);
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

    onClickOpenMenu(ev) {
        this.props.openMenuPop(this.props.record);
    }

    async validate() {
        const { resModel, resId } = this.props.record;
        if (resModel === "mrp.workorder") {
            await this.props.record.model.orm.call(resModel, "button_done", [resId]);
        } else {
            await this.props.record.model.orm.call(resModel, "button_mark_done", [resId]);
        }
        this.props.record.model.load();
    }
}
