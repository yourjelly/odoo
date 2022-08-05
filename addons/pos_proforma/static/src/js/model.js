/** @odoo-module **/
import { PosStore } from "@point_of_sale/app/store/pos_store";
import { Order } from "@point_of_sale/app/store/models";
import { patch } from "@web/core/utils/patch";

patch(PosStore.prototype, {
    async pushProFormaOrder(order) {
        order.receipt_type = "PS";
        await this.push_single_order(order);
        order.receipt_type = false;
    }
});

patch(Order.prototype, {
    //@override
    export_as_JSON() {
        const json = super.export_as_JSON(...arguments);
        json.receipt_type = this.receipt_type;
        return json;
    }
});
