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
        this.model = this.props.record.model;
    }

    get displayDoneButton() {
        const { resModel } = this.props.record;
        if (resModel == "mrp.production") {
            return this._productionDisplayDoneButton();
        }
        return this._workorderDisplayDoneButton();
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

    getComponent(record) {
        if (record.resModel === "stock.move") {
            return StockMove;
        } else if (record.resModel === "mrp.workorder") {
            return MrpWorkorder;
        }
        throw Error(`No Component found for the model "${record.resModel}"`);
    }

    get tracking() {
        const { resModel } = this.props.record;
        if (resModel === "mrp.workorder" || this.record.has_tracking == "none") {
            return false;
        }
        if (this.record.has_tracking == "lot" || this.record.product_qty == 1) {
            return "single";
        }
        return "multiple";
    }

    async onClickHeader() {
        const { resModel, resId } = this.props.record;
        if (resModel === "mrp.workorder") {
            if (this.record.is_user_working) {
                await this.model.orm.call(resModel, "button_pending", [resId]);
            } else {
                await this.model.orm.call(resModel, "button_start", [resId]);
            }
            await this.props.record.load();
            this.render();
        }
    }

    onClickOpenMenu(ev) {
        this.props.openMenuPop(this.props.record);
    }

    async actionAssignSerial() {
        const { resModel, resId } = this.props.record;
        if (resModel === "mrp.workorder") {
            return;
        }
        await this.model.orm.call(resModel, "action_generate_serial", [resId]);
        this.model.load();
    }

    async validate() {
        const { resModel, resId } = this.props.record;
        if (resModel === "mrp.workorder") {
            await this.model.orm.call(resModel, "button_done", [resId]);
        } else if (this.tracking == "multiple") {
            const params = { mark_as_done: true };
            const action = await this.model.orm.call(
                resModel,
                "action_serial_mass_produce_wizard",
                [resId],
                params
            );
            const options = {
                onClose: () => {
                    this.model.load();
                },
            };
            return this.model.action.doAction(action, options);
        } else {
            await this.model.orm.call(resModel, "button_mark_done", [resId]);
        }
        this.model.load();
    }

    _productionDisplayDoneButton() {
        return (
            this.workorders.every((wo) => wo.data.state === "done") &&
            this.rawMoves.every((m) => m.data.quantity_done)
        );
    }

    _workorderDisplayDoneButton() {
        return this.rawMoves.every((m) => m.data.quantity_done);
    }
}
