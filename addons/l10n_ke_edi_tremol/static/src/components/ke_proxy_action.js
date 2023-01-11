/** @odoo-module **/

import { registry } from "@web/core/registry";
import { KEProxyDialog } from "./ke_proxy_dialog";

export async function KESendInvoiceClientAction(env, action) {
    env.services.dialog.add(KEProxyDialog, {invoices:action.params});
}

registry.category("actions").add("l10n_ke_post_send", KESendInvoiceClientAction);
