/** @odoo-module */

import { standardFieldProps } from "@web/views/fields/standard_field_props";
import { registry } from "@web/core/registry";
import { X2ManyField } from "@web/views/fields/x2many/x2many_field";

export class ClosingJournalLockField extends X2ManyField {

    static template = "account.ClosingJournalLockField";
    static props = { ...standardFieldProps };

    onChange(newValue) {
        debugger;
        this.props.update(newValue);
    }
}

export const closingJournalLockField = {
    component: ClosingJournalLockField,
    supportedTypes: ["many2many"],
    relatedFields: [{ name: "company_id", type: "many2one" }, { name: "journal_id", type: "many2one" }],
};

registry.category("fields").add("closing_journal_lock", closingJournalLockField);
