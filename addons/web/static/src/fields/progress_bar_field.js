/** @odoo-module **/

import { registry } from "@web/core/registry";
import { _lt } from "@web/core/l10n/translation";
import { standardFieldProps } from "./standard_field_props";
import { useNumpadDecimal } from "./numpad_decimal_hook";

const { Component, onWillUpdateProps, useState } = owl;

export class ProgressBarField extends Component {
    setup() {
        useNumpadDecimal();
        this.state = useState({
            currentValue: this.props.currentValue.value,
            maxValue: this.props.maxValue.value,
        });
        onWillUpdateProps((nextProps) => {
            if (nextProps.readonly) {
                Object.assign(this.state, {
                    currentValue: nextProps.currentValue.value,
                    maxValue: nextProps.maxValue.value,
                });
            }
        });
    }

    getFormattedValue(part, isHumanReadable = false) {
        return this.props.format(this.state[part], {
            formatter: this.props[part].type,
            humanReadable: isHumanReadable,
        });
    }

    /**
     * @param {String} value
     * @param {String} part
     */
    onChangeValue(value, part) {
        let parsedValue;
        try {
            parsedValue = this.props.parse(value, {
                parser: "float",
            });
            if (this.props[part].type === "integer") {
                parsedValue = Math.floor(parsedValue);
            }
        } catch {
            this.props.setAsInvalid();
            return;
        }
        this.state[part] = parsedValue;
        this.props.record.update({ [this.props[part].fieldName]: parsedValue });
    }

    onInput(ev, part) {
        try {
            this.state[part] = this.props.parse(ev.target.value, {
                parser: this.props[part].type,
            });
        } catch {}
    }
}

ProgressBarField.defaultProps = {
    setAsInvalid: () => {},
};
ProgressBarField.props = {
    ...standardFieldProps,
    currentValue: { type: Object, optional: true },
    isPercentage: { type: Boolean, optional: true },
    maxValue: { type: Object, optional: true },
    isCurrentValueEditable: { type: Boolean, optional: true },
    isMaxValueEditable: { type: Boolean, optional: true },
    setAsInvalid: { type: Function, optional: true },
};
ProgressBarField.template = "web.ProgressBarField";
ProgressBarField.extractProps = (fieldName, record, attrs) => {
    const getPart = (part) => {
        if (attrs.options[part]) {
            let value = attrs.options[part];
            let name;
            if (isNaN(value)) {
                value =
                    (record.data[attrs.options[part]] !== undefined &&
                        record.data[attrs.options[part]]) ||
                    0;
                name = attrs.options[part];
            }
            return {
                fieldName: name,
                value,
                type: value % 1 === 0 ? "integer" : "float",
            };
        }
        const value = part === "max_value" ? 100 : record.data[fieldName] || 0;
        return {
            fieldName: fieldName,
            value,
            type: value % 1 === 0 ? "integer" : "float",
        };
    };
    return {
        currentValue: getPart("current_value"),
        maxValue: getPart("max_value"),
        isPercentage: !attrs.options.max_value,
        isCurrentValueEditable:
            (attrs.options.editable && !attrs.options.edit_max_value) ||
            attrs.options.edit_current_value,
        isMaxValueEditable: attrs.options.edit_max_value,
        setAsInvalid: () => record.setInvalidField(fieldName),
    };
};
ProgressBarField.displayName = _lt("Progress Bar");
ProgressBarField.supportedTypes = ["integer", "float"];

registry.category("fields").add("progressbar", ProgressBarField);
