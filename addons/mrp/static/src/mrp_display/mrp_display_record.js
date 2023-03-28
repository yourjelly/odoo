/** @odoo-module */

import { CharField } from "@web/views/fields/char/char_field";
import { Component } from "@odoo/owl";
import { ConfirmationDialog } from "@web/core/confirmation_dialog/confirmation_dialog";
import { Field } from "@web/views/fields/field";
import { useService } from "@web/core/utils/hooks";

export class MrpDisplayRecord extends Component {
    static components = { CharField, Field };
    static props = {
        record: Object,
        workorders: Array,
        rawMoves: Array,
    };
    static template = "mrp.MrpDisplayRecord";

    setup() {
        this.dialogService = useService("dialog");

        this.rawMoves = this.props.rawMoves.map((move) => move.data);
        this.record = this.props.record.data;
        this.workorders = this.props.workorders;
    }

    completeMove(move) {
        const quantity = this.isMoveDone(move) ? 0 : move.data.product_uom_qty;
        move.update({ quantity_done: quantity });
        move.save(); // TODO: instead of saving after each individual change, it should be better to save at some point all the changes.
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

    isMoveDone(move) {
        return move.data.quantity_done === move.data.product_uom_qty;
    }

    onClickManufacturingDone(ev) {
        console.log("TODO");
    }

    onClickOpenMenu(ev) {
        console.log("TODO");
    }
}
