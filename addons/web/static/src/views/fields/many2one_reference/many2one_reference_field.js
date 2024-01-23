/** @odoo-module **/

import { registry } from "@web/core/registry";
import { _t } from "@web/core/l10n/translation";
import { many2OneField, Many2OneField } from "@web/views/fields/many2one/many2one_field";

import { Component } from "@odoo/owl";

export class Many2OneReferenceField extends Component {
    static template = "web.Many2OneReferenceField";
    static components = { Many2OneField };
    static props = Many2OneField.props;

    get relation() {
        const modelField = this.props.record.fields[this.props.name].model_field;
        if (modelField in this.props.record.data) {
            return this.props.record.data[modelField];
        }
        // if modelField isn't in the view, we can determine the model from the value
        const value = this.props.record.data[this.props.name];
        if (value) {
            return value.resModel;
        }
        // the model field isn't and the view and the field is unset -> we don't know the co-model
        // so the field will be readonly
        return undefined;
    }

    get m2oProps() {
        const relation = this.relation;
        const value = this.props.record.data[this.props.name];
        return {
            ...this.props,
            relation,
            value: value ? [value.resId, value.displayName] : false,
            readonly: this.props.readonly || !relation,
            update: (changes) => {
                let nextVal;
                if (changes[this.props.name]) {
                    nextVal = {
                        resModel: relation,
                        resId: changes[this.props.name][0],
                        displayName: changes[this.props.name][1],
                    };
                } else {
                    nextVal = false;
                }
                return this.props.record.update({ [this.props.name]: nextVal });
            },
        };
    }
}

const many2oneReferenceField = {
    component: Many2OneReferenceField,
    displayName: _t("Many2OneReference"),
    relatedFields: [{ name: "display_name", type: "char" }],
    supportedTypes: ["many2one_reference"],
    extractProps: many2OneField.extractProps,
};

registry.category("fields").add("many2one_reference_dynamic", many2oneReferenceField);
