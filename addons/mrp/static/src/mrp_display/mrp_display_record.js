/** @odoo-module */

import { CharField } from "@web/views/fields/char/char_field";
import { Component, markup } from "@odoo/owl";
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

    displayInstruction(workorder) {
        const params = {
            title: workorder.data.display_name,
            body: markup(workorder.data.operation_note),
        };
        this.dialogService.add(ConfirmationDialog, params);
    }
}
