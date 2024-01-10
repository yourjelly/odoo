/** @odoo-module */

import { Chrome } from "@point_of_sale/app/pos_app";
import { deduceUrl } from "@point_of_sale/utils";
import { patch } from "@web/core/utils/patch";
import { effect } from "@web/core/utils/reactive";
import { batched } from "@web/core/utils/timing";

patch(Chrome.prototype, {
    setup() {
        super.setup(...arguments);
        if (this.pos.config.customer_display_type === "none") {
            return;
        }
        this.customerDisplayChannel = new BroadcastChannel("UPDATE_CUSTOMER_DISPLAY");
        effect(
            batched(({ selectedOrder }) => {
                if (!selectedOrder) {
                    return;
                }
                this.sendOrderToCustomerDisplay(selectedOrder);
            }),
            [this.pos]
        );
    },
    sendOrderToCustomerDisplay(selectedOrder) {
        if (this.pos.config.customer_display_type === "local") {
            this.customerDisplayChannel.postMessage(selectedOrder.getCustomerDisplayData());
        }
        if (this.pos.config.customer_display_type === "remote") {
            this.pos.data.call("pos.config", "update_customer_display", [
                [this.pos.config.id],
                selectedOrder.getCustomerDisplayData(),
                this.pos.config.access_token,
            ]);
        }
        if (this.pos.config.customer_display_type === "proxy") {
            fetch(`${deduceUrl(this.pos.config.proxy_ip)}/hw_proxy/customer_facing_display`, {
                method: "POST",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    action: "set",
                    data: selectedOrder.getCustomerDisplayData(),
                }),
            }).catch(() => {
                console.log("Failed to send data to customer display");
            });
        }
    },
});
