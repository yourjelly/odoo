/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import SpreadsheetComponent from "@documents_spreadsheet/js/components/spreadsheet_component";
import { _t } from "@web/core/l10n/translation";
const { useSubEnv } = owl.hooks;

patch(SpreadsheetComponent.prototype, 'spreadsheet_email/static/src/js/spreadsheet_component.js',{
    setup() {
        this._super(...arguments);
        useSubEnv({
            email: this.email.bind(this),
        });
    },

    async email() {
        const files = await this.spreadsheet.comp.model.exportTable();
        this.trigger("email", {files});
    }
});