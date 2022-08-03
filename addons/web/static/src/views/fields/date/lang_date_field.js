/** @odoo-module **/

import { DateField } from './date_field';
import { registry } from "@web/core/registry";
import { formatDate, strftimeToLuxonFormat } from "@web/core/l10n/dates";

const { onWillStart } = owl;

class LangDateField extends DateField {
    setup() {
        onWillStart(async () => {
            this.props.value = this.props.value.setLocale(this.props.record.data.iso_code);
        });
    }

    get formattedValue() {
        let temp = formatDate(this.props.value, {
            // get local date if field type is datetime
            timezone: this.isDateTime,
            format: strftimeToLuxonFormat(this.props.record.data.time_format),
            numberingSystem: 'latn',
        });

        return temp;
    }
}

registry.category("fields").add("lang_date", LangDateField);