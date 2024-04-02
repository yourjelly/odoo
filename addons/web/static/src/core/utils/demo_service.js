/** @odoo-module */

import { registry } from "@web/core/registry";
import { ConfirmationDialog } from "@web/core/confirmation_dialog/confirmation_dialog";
import { _t } from "@web/core/l10n/translation";
import { markup } from "@odoo/owl";



export const demoService = {
    dependencies: ["orm", "dialog"],
    start(env, { orm, dialog }) {
        return {
            async getFieldData(model, field) {
                const domain = [];
                const records = await orm.searchRead(model, domain, [field]);
                const formattedData = records.map(record => `<div class="fw-bold">${record.id}. ${record[field]}</div>`).join('');
                dialog.add(ConfirmationDialog, {
                    title: _t(`The value in ${field} field of ${model} models are`),
                    body: markup(formattedData)
                });
            },
            async getInstalledmodules() {
                const modules = await orm.searchRead("ir.module.module", [['state', '=', 'installed']], ["name"])
                const formattedData = modules.map((record,i) => `<div class="fw-bold">${i+1}. ${record['name']}</div>`).join('')
                dialog.add(ConfirmationDialog, {
                    title: _t("The installed modules are"),
                    body: markup(formattedData)
                });
            }
        };
    }
};

registry.category('services').add('demo_service', demoService);
