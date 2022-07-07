/** @odoo-module **/

// Allow us to add and remove selection labels
import { _lt } from "@web/core/l10n/translation";
import { useService } from "@web/core/utils/hooks";
const { Component, useState, onWillUpdateProps } = owl;

export class PropertySelection extends Component {

    setup() {
        this.notification = useService("notification");
    }

    /**
     * Return the current available options.
     *
     * Make a deep copy to not change original object to be able to restore
     * the old props if we discard the editing of the forma view.
     */
    get options () {
        return JSON.parse(JSON.stringify(this.props.value || []));
    }

    onNewOption(event) {
        if (event.key !== 'Enter') {
            return;
        }

        const target = event.target;
        const newLabel = target.value;

        if (!newLabel || !newLabel.length) {
            return;
        }
        target.value = '';

        const newValue = this.labelToValue(newLabel);

        for (let option of this.props.value) {
            if (option[0] === newValue) {
                this.notification.add(
                    _lt('This option is already available'),
                    { type: 'warning' },
                );
                return;
            }
        }

        const value = [...this.options, [newValue, newLabel]];
        this.props.onChange(value);
    }

    onDeleteOption(optionIndex) {
        console.log('onDeleteOption', optionIndex);
        const value = this.options;
        value.splice(optionIndex, 1);
        this.props.onChange(value);
    }

    /**
     * Transform the label into a value
     */
    labelToValue(label) {
        if (!label) {
            return '';
        }
        return label.toLowerCase().replace(' ', '_');
    }

}

PropertySelection.template = "web.PropertySelection";
PropertySelection.components = {

};
PropertySelection.props = {
    value: {},
    readonly: { type: Boolean, optional: true },
    onChange: { type: Function, optional: true },
};
