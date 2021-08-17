/** @odoo-module **/

import { useAutofocus } from "@web/core/utils/hooks";
import { Dialog } from "@web/core/dialog/dialog";
import { _lt } from "@web/core/l10n/translation";

const { useRef } = owl.hooks;

export class CalendarQuickCreate extends Dialog {
    setup() {
        super.setup();
        useAutofocus();
        this.nameRef = useRef("name");
    }

    get record() {
        return {
            ...this.props.record,
            title: this.nameRef.el.value,
        };
    }

    onCreateBtnClick() {
        this.props.model.createRecord(this.record);
        this.close();
    }
    onEditBtnClick() {
        this.props.editRecord(this.record);
        this.close();
    }
    onCancelBtnClick() {
        this.close();
    }
}

CalendarQuickCreate.bodyTemplate = "web.CalendarQuickCreate.body";
CalendarQuickCreate.footerTemplate = "web.CalendarQuickCreate.footer";
CalendarQuickCreate.size = "modal-sm";
CalendarQuickCreate.title = _lt("New Event");

CalendarQuickCreate.props = {
    close: Function,
    record: Object,
    model: Object,
    editRecord: Function,
};
