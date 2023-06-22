/** @odoo-module */
import { patch } from "@web/core/utils/patch";
import { PaymentScreen } from "@point_of_sale/app/screens/payment_screen/payment_screen";

patch(PaymentScreen.prototype, {
    async validateOrder(isForceValidate) {
        if (!this.pos.config.is_spanish) {
            await super.validateOrder(...arguments);
            return;
        }
        this.currentOrder.to_invoice = true;
        const below_limit =
            this.currentOrder.get_total_with_tax() <=
            this.pos.config.l10n_es_simplified_invoice_limit;
        const simplified_partner =
            this.pos.db.partner_by_id[this.pos.config.simplified_partner_id[0]];
        if (below_limit && !this.currentOrder.partner) {
            this.currentOrder.partner = simplified_partner;
        }
        if (!below_limit && this.currentOrder.partner?.id === simplified_partner.id) {
            this.currentOrder.partner = null;
        }
        await super.validateOrder(...arguments);
    },
    shouldDownloadInvoice() {
        return !this.pos.selectedOrder.isSimplifiedInvoice();
    },
    async _postPushOrderResolve(order, order_server_ids) {
        if (this.pos.config.is_spanish) {
            const invoice_name = await this.orm.searchRead(
                "pos.order",
                [["id", "in", order_server_ids]],
                ["account_move"]
            );
            order.invoice_name = invoice_name[0].account_move[1];
        }
        return super._postPushOrderResolve(...arguments);
    },
});
