/** @odoo-module */

import { patch } from "@web/core/utils/patch";
import { PosBus } from "@point_of_sale/app/bus/pos_bus_service";

patch(PosBus.prototype, {
    // Override
    dispatch(message) {
        super.dispatch(...arguments);

        console.log('message.payload');
        console.log(message);
        console.log(message.payload);
        if (message.type === "VIVA_WALLET_LATEST_RESPONSE" && message.payload === this.pos.config.id) {
            this.pos
                .getPendingPaymentLine("viva_wallet")
                .payment_method.payment_terminal.handleVivaWalletStatusResponse();
        }
    },
});
