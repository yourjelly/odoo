/** @odoo-module **/

import { DateField } from './date_field';
import { registry } from "@web/core/registry";
import { formatDate, strftimeToLuxonFormat } from "@web/core/l10n/dates";
import { NUMBERING_SYSTEMS } from "@web/core/l10n/localization_service";
import { standardFieldProps } from "../standard_field_props";

class LangDateField extends DateField {
    get formattedValue() {
        this.props.value = this.props.value.setLocale(this.props.record.data.iso_code);
        let numbering_system = '';
        const lang = this.props.record.data.code;
        const locale = lang === "sr@latin" ? "sr-Latn-RS" : lang.replace(/_/g, "-");
        for (const [re, numberingSystem] of NUMBERING_SYSTEMS) {
            if (re.test(locale)) {
                numbering_system = numberingSystem;
                break;
            }
        }

        return formatDate(this.props.value, {
            // get local date if field type is datetime
            timezone: this.isDateTime,
            format: strftimeToLuxonFormat(this.props.formatType == 'time_format'?this.props.record.data.time_format:this.props.record.data.date_format),
            numberingSystem: numbering_system,
        });
    }
}

LangDateField.props = {
    ...standardFieldProps,
    formatType: { type: String, optional: true },
};

LangDateField.extractProps = ({ attrs }) => {
    return {
        formatType: attrs.options.format_type,
    };
};

registry.category("fields").add("lang_date", LangDateField);
