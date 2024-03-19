/** @odoo-module */

import { standardFieldProps } from "@web/views/fields/standard_field_props";
import { registry } from "@web/core/registry";
import { X2ManyField } from "@web/views/fields/x2many/x2many_field";

export class ClosingJournalLockField extends X2ManyField { //TODO OCO pas sûr qu'on ait besoin d'hériter de X2ManyField

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

/**
TODO OCO

pour l'inspiration, tu peux regarder
  async _addNewRecord(atFirstPosition) {
    ===> ici dedans, on crée un nouveau record depuis le js

    ====> en fait, this.list.addNewRecord

===> pour la suppression, le widget de rugo impacte directement this.list, semble-t-il (ou this.props.list ?)

**/
