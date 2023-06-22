/** @odoo-module */
import { patch } from "@web/core/utils/patch";
import { Order } from "@point_of_sale/app/store/models";

patch(Order.prototype, {
    isSimplifiedInvoice() {
        return (
            this.pos.config.is_spanish &&
            this.partner?.id === this.pos.config.simplified_partner_id[0]
        );
    },
    wait_for_push_order() {
        return this.pos.config.is_spanish;
    },
});
