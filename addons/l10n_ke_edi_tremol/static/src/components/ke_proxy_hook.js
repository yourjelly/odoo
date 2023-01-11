/** @odoo-module **/
import { sprintf } from "@web/core/utils/strings";
import { useState } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { _t } from "@web/core/l10n/translation";

export function useKEProxy() {
    const state = useState({
        successfullySent: 0,
        reloadRequired: false,
        length: 0,
        error: false,
        message: '',
    });
    const orm = useService("orm");
    const rpc = useService("rpc");
    const http = useService("http");

    /**
     * Send each of the invoices provided to the proxy connected to the fiscal device. The proxy should return
     * details, from each successfully posted invoice, which are propagated back to the account move using the orm
     * service. Alternatively, the proxy can return an error, in which case the execution of this function should
     * halt, though the successfully posted invoices are still updated as above.
     *
     * @param Array<Object> invoices array representing serialised invoice data and the proxy address to send each invoice to.
     */
    async function postInvoices(invoices) {
        let posted = [];
        state.length = invoices.length;

        // Ping the server to prevent posting to the device when there is no connection to the odoo server
        try {
            await rpc("/web/webclient/version_info", {});
        } catch(e) {
            // Allow the default error handler to execute after displaying an error message in the dialog
            state.message = _t("Connection lost, please try again later.");
            state.error = true;
            throw(e);
        }

        for (const index in invoices) {
            let { move_id, messages, proxy_address, company_vat, name } = invoices[index];
            state.message = sprintf(_t("Posting invoice: %s"), name);
            try {
                let deviceResponse = await http.post(
                    proxy_address + '/hw_proxy/l10n_ke_cu_send', {
                        messages: messages,
                        company_vat: company_vat,
                    },
                );
                if (deviceResponse.status === "ok") {
                    deviceResponse.move_id = move_id;
                    posted.push(deviceResponse);
                    state.successfullySent++;
                } else {
                    state.message = sprintf(_t("Posting the invoice %s has failed with the message: \n %s"), name, deviceResponse.state);
                    state.error = true;
                    break;
                }
            } catch (e) {
                state.message = sprintf(_t("Error trying to connect to the middleware. Is the middleware running? \n Error message: %s"), e.message);
                state.error = true;
                break;
            }
        }
        // Even if the loop above breaks, this is still called, since any posted invoices need to be updated
        if (posted.length) {
            try {
                await orm.call(
                    "account.move",
                    "l10n_ke_cu_responses",
                    [[], posted]
                );
                state.reloadRequired = true;
            } catch (e) {
                state.message = sprintf(_t("Error trying to connect to Odoo. Check your internet connection. Error message: %s"), e.message);
                state.error = true;
            }
        }
    }

    return {
        postInvoices,
        state,
    }
}
