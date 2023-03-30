/** @odoo-module */

import { ConfirmationDialog } from "@web/core/confirmation_dialog/confirmation_dialog";
import { StockMove } from "./stock_move";
import { useService } from "@web/core/utils/hooks";

export class MrpWorkorder extends StockMove {
    static template = "mrp.WorkOrder";
    setup() {
        super.setup();
        this.isLongPressable = true;
        this.dialogService = useService("dialog");
    }

    displayInstruction() {
        const confirm = () => {
            this.props.record.model.orm.call(
                this.props.record.resModel,
                "button_done",
                this.props.record.resIds
            );
            this.props.record.update();
        };
        const params = {
            body: this.props.record.data.operation_note,
            cancel: () => {},
            cancelLabel: this.env._t("Discard"),
            confirm,
            confirmLabel: this.env._t("Validate"),
            title: this.props.record.data.display_name,
        };
        this.dialogService.add(ConfirmationDialog, params);
    }

    get isComplete() {
        return this.props.record.data.state === "done";
    }

    toggle() {
        // TODO: pause & play.
    }
}
