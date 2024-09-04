/* @odoo-module */

import { Activity } from "@mail/core/web/activity"
import { patch } from "@web/core/utils/patch";
import { ActivityPeppolResponsePopover } from "@account_peppol_invoice_response/core/web/activity_peppol_response_popover";
import { usePopover } from "@web/core/popover/popover_hook";

patch(Activity.prototype, {
    setup() {
        super.setup();
        this.peppolResponsePopover = usePopover(ActivityPeppolResponsePopover, { position: "right" });
    },
    get hasPeppolSend() {
        return activity.state !== "done" && activity.activity_category === "peppol_invoice_response";
    },
    async editPeppolInvoiceResponse() {
        const thread = this.thread;
        const id = this.props.data.id;
        await this.env.services["mail.activity"].editPeppolInvoiceResponse(id);
        this.props.onUpdate(thread);
    },
    async acceptPeppolInvoiceResponse() {
        const thread = this.thread;
        const id = this.props.data.id;
        await this.env.services["mail.activity"].acceptPeppolInvoiceResponse(id);
        this.props.onUpdate(thread);
    },
    async cancelPeppolInvoiceResponse(ev) {
        const thread = this.thread;
        const id = this.props.data.id;
        const [invoiceResponseId] = await this.env.services.orm.create(
            "account_peppol.invoice_response", [{
                code: "RE",
                direction: "outgoing",
                move_id: this.props.data.res_id,
                activity_id: [this.props.data.id],
            }]
        );
        if (this.peppolResponsePopover.isOpen) {
            this.peppolResponsePopover.close();
            return;
        }
        const target = ev.currentTarget || ev.target;
        this.peppolResponsePopover.open(target, {
            id: invoiceResponseId,
            hasHeader: true,
            reload: this.props.onUpdate,
        });
        // await this.env.services["mail.activity"].cancelPeppolInvoiceResponse(id);

        this.props.onUpdate(thread);
    },
});
