import { patch } from "@web/core/utils/patch";
import { _t } from "@web/core/l10n/translation";
import { ask } from "@point_of_sale/app/utils/make_awaitable_dialog";
import { PaymentScreen } from "@point_of_sale/app/screens/payment_screen/payment_screen";

patch(PaymentScreen.prototype, {
    async validateOrder(isForceValidate) {
        const company = this.pos.config.company_id;
        if (company.l10n_at_fiskaly_access_tocken) {
            // It is compulsary to select customer as we need it to send to fiskaly
            if (!this.currentOrder.get_partner()) {
                const confirmed = await ask(this.dialog, {
                    title: _t("Please select the Customer"),
                    body: _t(
                        "You need to select the customer before you can invoice or ship an order."
                    ),
                });
                if (confirmed) {
                    this.pos.selectPartner();
                }
                return false;
            }
        }
        await super.validateOrder(...arguments);
    },
    async afterOrderValidation() {
        if (this.pos.config.company_id.l10n_at_fiskaly_access_tocken) {
            const [signed, receipt_number, qr_data] = await this.pos.data.call(
                "pos.order",
                "fiskaly_receipt_generation",
                [this.pos.selectedOrder.id, this.pos.session.id]
            );
            // updating those in the selected order to use as won't be updated on ui yet
            this.pos.selectedOrder.is_fiskaly_order_receipt_signed = signed;
            this.pos.selectedOrder.l10n_at_pos_order_receipt_qr_data = qr_data;
            this.pos.selectedOrder.l10n_at_pos_order_receipt_number = receipt_number;
        }
        await super.afterOrderValidation(...arguments);
    },
});
