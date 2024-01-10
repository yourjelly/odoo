/** @odoo-module */

import { patch } from "@web/core/utils/patch";
import { ClosePosPopup } from "@point_of_sale/app/navbar/closing_popup/closing_popup";
import { deduceUrl } from "@point_of_sale/utils";

patch(ClosePosPopup.prototype, {
    async closeSession() {
        if (this.pos.config.customer_display_type === "proxy") {
            fetch(`${deduceUrl(this.pos.config.proxy_ip)}/hw_proxy/customer_facing_display`, {
                method: "POST",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    action: "close",
                }),
            }).catch(() => {
                console.log("Failed to send data to customer display");
            });
        }
        return super.closeSession(...arguments);
    },
});
