/** @odoo-module */

import { CharField } from "@web/views/fields/char/char_field";
import { Component } from "@odoo/owl";
import { ConfirmationDialog } from "@web/core/confirmation_dialog/confirmation_dialog";
import { Field } from "@web/views/fields/field";
import { useService } from "@web/core/utils/hooks";
import { StockMove } from "@mrp/mrp_display/stock_move";

export class MrpDisplayRecord extends Component {
    static components = { CharField, Field, StockMove };
    static props = {
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
        this.dialogService = useService("dialog");
        this.record = this.props.record.data;
        this.workorders = this.props.workorders;
    }

    displayInstruction(workorder) {
        const params = {
            title: workorder.data.display_name,
            body: workorder.data.operation_note,
        };
        this.dialogService.add(ConfirmationDialog, params);
    }

    get displayDoneButton() {
        return (
            this.workorders.length === 0 || this.workorders.every((wo) => wo.data.state === "done")
        );
    }

    onClickManufacturingDone(ev) {
        console.log("TODO");
    }

    onClickOpenMenu(ev) {
        console.log("TODO");
    }
}
