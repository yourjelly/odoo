/** @odoo-module **/

import { useAutofocus } from "@web/core/utils/hooks";
import { Dialog } from "@web/core/dialog/dialog";
import { _lt } from "@web/core/l10n/translation";
import { useService } from "@web/core/utils/hooks";

const { useRef } = owl.hooks;

export class CalendarQuickCreate extends Dialog {
    setup() {
        super.setup();
        useAutofocus();
        this.titleRef = useRef("title");
        this.notification = useService("notification");
    }

    get recordTitle() {
        return this.titleRef.el.value.trim();
    }
    get record() {
        return {
            ...this.props.record,
            title: this.recordTitle,
        };
    }

    createRecord() {
        if (this.recordTitle) {
            this.props.model.createRecord(this.record);
            this.close();
        } else {
            this.titleRef.el.classList.add("o_field_invalid");
            this.notification.add(this.env._t("Meeting Subject"), {
                title: this.env._t("Invalid fields"),
                type: "danger",
            });
        }
    }

    /**
     * @param {KeyboardEvent} ev
     */
    onInputKeyup(ev) {
        switch (ev.key) {
            case "Enter":
                this.createRecord();
                break;
            case "Escape":
                this.close();
                break;
        }
    }
    onCreateBtnClick() {
        this.createRecord();
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
