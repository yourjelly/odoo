/** @odoo-module */
import { patch } from "@web/core/utils/patch";
import { PosBus } from "@point_of_sale/app/bus/pos_bus_service";

patch(PosBus.prototype, {
    // Override
    dispatch(message) {
        super.dispatch(...arguments);
        if (message.type === "MERCADO_PAGO_LATEST_MESSAGE") {
            console.log("received notification with data", message)
            const line = this.pos.getPendingPaymentLine("mercado_pago")
            if (line) {
                if (line.payment_method.payment_terminal.webhook_resolver) {
                    line.payment_method.payment_terminal.webhook_resolver("mp_msg_received");
                }
            }
        }
    },
});
