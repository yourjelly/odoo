/** @odoo-module **/

import { DateField } from './date_field';
import { registry } from "@web/core/registry";
import { loadJS } from "@web/core/assets";
import { formatDate } from "@web/core/l10n/dates";
const { onWillStart } = owl;

class LangDateField extends DateField {
    setup() {
        onWillStart(async () => {
            if (this.props.record.data.iso_code) {
                this.props.value.locale(this.props.record.data.iso_code);
                if (this.props.value._locale._abbr != this.props.record.data.iso_code) {
                    const resp = await loadJS(`web/static/lib/moment/locale/${this.props.record.data.iso_code}.js`);
                    this.props.value.locale(this.props.record.data.iso_code);
                }
            }
        });
    }

    get formattedValue() {
        return formatDate(this.props.value, {
            // get local date if field type is datetime
            timezone: this.isDateTime,
            format: this.props.record.data.date_format,
        });
    }
}

registry.category("fields").add("lang_date", LangDateField);