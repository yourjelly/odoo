/** @odoo-module **/

import { Dialog } from "@web/core/dialog/dialog";
import { useService } from "@web/core/utils/hooks";
import { useKEProxy } from "./ke_proxy_hook";
import { Component, useEffect } from "@odoo/owl";


export class KEProxyDialog extends Component {
    setup() {
        this.action = useService("action");
        this.sender = useKEProxy();
        this.state = this.sender.state;
        this.sender.postInvoices(this.props.invoices);
        useEffect(
            () => {
                if (this.state.successfullySent == this.state.length &&
                    this.state.reloadRequired == true) {
                    this.doReload()
                }
            },
            () => [this.state.reloadRequired]
        );
    };

    doReload() {
        this.props.close();
    }

    closeAndReload() {
        if (this.state.reloadRequired) {
            return this.props.close();
        } else {
            return this.props.close();
        }
    }
}

KEProxyDialog.template = "l10n_ke_edi_tremol.KEProxyDialog";
KEProxyDialog.components = { Dialog };
KEProxyDialog.props = {
    invoices: Object,
    close: Function,
};
