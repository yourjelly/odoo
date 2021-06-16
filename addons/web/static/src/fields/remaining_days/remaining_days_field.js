/** @odoo-module **/

import { parseDateTime } from "@web/core/l10n/dates";
import { _lt } from "@web/core/l10n/translation";
import { registry } from "@web/core/registry";

const { Component } = owl;

const FORMATS = {
    date: "yyyy-MM-dd",
    datetime: "yyyy-MM-dd HH:mm:ss",
};

export class RemainingDaysField extends Component {
    get now() {
        return luxon.DateTime.utc();
    }
    get userValue() {
        return parseDateTime(this.props.value, {
            dateOnly: this.props.meta.type === "date",
            format: FORMATS[this.props.meta.type],
        });
    }
    get diffDays() {
        return this.userValue.startOf("day").diff(this.now.startOf("day"), "days").days;
    }
    get formattedValue() {
        return this.props.value;
    }
}
RemainingDaysField.template = "web.RemainingDaysField";

RemainingDaysField.description = _lt("Remaining Days");
RemainingDaysField.supportedFieldTypes = ["date", "datetime"];

registry.category("fields").add("remaining_days", RemainingDaysField);
