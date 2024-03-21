/** @odoo-module */

import { onWillStart } from "@odoo/owl";

import { standardFieldProps } from "@web/views/fields/standard_field_props";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { X2ManyField } from "@web/views/fields/x2many/x2many_field";

export class ClosingJournalLockField extends X2ManyField { //TODO OCO pas sûr qu'on ait besoin d'hériter de X2ManyField

    //TODO OCO là, c'est community, mais ça devrait peut-être être en enterprise ?

    static template = "account.ClosingJournalLockField";
    static props = { ...standardFieldProps };

    async onChange(newValue) {
        await this.onAdd({context: {default_company_id:1, default_journal_id:2}, editable: true});
        //TODO OCO WIP; juste du test, mais c'est ça qu'il faut appeler pour ajouter un élément !
    }

    setup() {
        super.setup();
        this.orm = useService("orm");

        onWillStart(async () => {
          this.axes_data = await this.orm.call(
              "account.report.closing",
              "_get_journals_lock_grid_axes_data",
              [
                  null,
                  this.props.record.data.company_ids.currentIds,
              ],
          );
        });
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
