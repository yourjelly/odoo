/** @odoo-module */

import { ConfirmationDialog } from "@web/core/confirmation_dialog/confirmation_dialog";
import { StockMove } from "./stock_move";
import { useService } from "@web/core/utils/hooks";
import { MrpTimer } from "@mrp/widgets/timer";

export class MrpWorkorder extends StockMove {
    static template = "mrp.WorkOrder";
    static components = { ...StockMove.components, MrpTimer };

    setup() {
        super.setup();
        this.isLongPressable = true;
        this.dialogService = useService("dialog");
    }

    get active() {
        return this.props.record.data.is_user_working;
    }

    get cssClass() {
        let cssClass = super.cssClass;
        if (this.active) {
            cssClass += " o_active";
        }
        return cssClass;
    }

    displayInstruction() {
        const params = {
            body: this.props.record.data.operation_note,
            confirmLabel: this.env._t("Discard"),
            title: this.props.record.data.display_name,
        };
        if (this.props.record.data.state != "done") {
            params.confirm = async () => {
                await this.props.record.model.orm.call(
                    this.props.record.resModel,
                    "button_finish",
                    this.props.record.resIds
                );
                await this.props.record.load();
                this.render();
            };
            params.confirmLabel = this.env._t("Validate");
            params.cancel = () => {};
            params.cancelLabel = this.env._t("Discard");
        }
        this.dialogService.add(ConfirmationDialog, params);
    }

    get isComplete() {
        return this.props.record.data.state === "done";
    }

    async longPress() {
        const { record } = this.props;
        await record.model.orm.call(record.resModel, "button_finish", [record.resId]);
        await this.props.record.load();
        this.render();
    }

    async toggle() {
        const { record } = this.props;
        const method = record.data.is_user_working ? "button_pending" : "button_start";
        await this.props.record.model.orm.call(record.resModel, method, [record.resId]);
        await this.props.record.load();
        this.render();
    }
}
