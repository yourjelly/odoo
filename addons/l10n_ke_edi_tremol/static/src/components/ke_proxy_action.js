/** @odoo-module **/

import { registry } from "@web/core/registry";
import { KEProxyDialog } from "./ke_proxy_dialog";

export async function KESendInvoiceClientAction(env, action) {
    let resolver;
    const prom = new Promise((resolve) => {
        resolver = resolve;
    });
    env.services.dialog.add(
        KEProxyDialog,
        {
            invoices: action.params,
        },
        {
            onClose: () => {
                resolver();
            },
        }
    );
    await prom;
    return { type: "ir.actions.act_window_close" }
}

registry.category("actions").add("l10n_ke_post_send", KESendInvoiceClientAction);
