/** @odoo-module */

import { ConfirmationDialog } from "@web/core/confirmation_dialog/confirmation_dialog";
import { Field } from "@web/views/fields/field";
import { StockMove } from "./stock_move";
import { useService } from "@web/core/utils/hooks";
import { MrpTimer } from "@mrp/widgets/timer";

export class MrpWorkorder extends StockMove {
    static components = { ...StockMove.components, Field, MrpTimer };
    static template = "mrp.WorkOrder";

    setup() {
        super.setup();
        this.isLongPressable = true;
        this.dialogService = useService("dialog");
        this.name = this.props.record.data.name;
        this.note = this.props.record.data.operation_note;
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
            body: this.note,
            confirmLabel: this.env._t("Discard"),
            title: this.props.record.data.display_name,
        };
        if (!this.isComplete) {
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
        return this.state === "done";
    }

    async longPress() {
        const { record } = this.props;
        await record.model.orm.call(record.resModel, "button_finish", [record.resId]);
        await this.props.parent.load();
        await this.props.record.load();
        this.props.record.model.notify();
    }

    async clicked() {
        const { record } = this.props;
        const method = record.data.is_user_working ? "button_pending" : "button_start";
        await this.props.record.model.orm.call(record.resModel, method, [record.resId]);
        await this.props.parent.load();
        await this.props.record.load();
        this.props.record.model.notify();
    }

    get state() {
        return this.props.record.data[this.fieldState];
    }
}
