/** @odoo-module **/

import { patch } from 'web.utils';
import { useDebugManager } from "@web/debug/debug_manager";
import { ViewAdapter } from "@web/legacy/action_adapters";

patch(ViewAdapter.prototype, 'mail.view_adapter', {
    setup() {
        const envWowl = this.env;
        useDebugManager((accessRights) =>
            setupDebugMailMessage(envWowl, this, this.props.viewParams.action)
        );
        this._super(...arguments);
    }
});

export function setupDebugMailMessage(env, component, action) {
    const result = [];
    if (component.widget.getSelectedIds().length) {
        result.push({
            type: "item",
            description: env._t("Manage Messages"),
            callback: async () => {
                const selectedIDs = component.widget.getSelectedIds();
                if (!selectedIDs.length) {
                    console.warn(env._t("No message available"));
                    return;
                }
                await env.services.action.doAction({
                    res_model: 'mail.message',
                    name: env._t('Manage Messages'),
                    views: [[false, 'list'], [false, 'form']],
                    type: 'ir.actions.act_window',
                    domain: [['res_id', '=', selectedIDs[0]], ['model', '=', action.res_model]],
                    context: {
                        default_res_model: action.res_model,
                        default_res_id: selectedIDs[0],
                    },
                });
            },
            sequence: 32,
        });
    }
    return result;
}
