/** @odoo-module */

import { Navbar } from "@point_of_sale/app/navbar/navbar";
import { deduceUrl } from "@point_of_sale/utils";
import { patch } from "@web/core/utils/patch";

patch(Navbar.prototype, {
    openCustomerDisplay() {
        if (this.pos.config.customer_display_type === "local") {
            window.open(
                `/pos-customer-display/${this.pos.config.access_token}`,
                "newWindow",
                "width=800,height=600,left=200,top=200"
            );
            this.notification.add("Connected");
        }
        if (this.pos.config.customer_display_type === "remote") {
            this.notification.add("Navigate to your POS Customer Display on the other computer");
        }
        if (this.pos.config.customer_display_type === "proxy") {
            this.notification.add("Connecting to the IoT Box");
            fetch(`${deduceUrl(this.pos.config.proxy_ip)}/hw_proxy/customer_facing_display`, {
                method: "POST",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    action: "open",
                    access_token: this.pos.config.access_token,
                }),
            })
                .then(() => {
                    this.notification.add("Connection successful");
                })
                .catch(() => {
                    this.notification.add("Connection failed", { type: "danger" });
                });
        }
    },
});
