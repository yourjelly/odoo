import { patch } from "@web/core/utils/patch";
import { PosStore } from "@point_of_sale/app/services/pos_store";

patch(PosStore.prototype, {
    async pay() {
        const currentOrder = this.get_order();
        const refundedOrder = currentOrder?.lines[0]?.refunded_orderline_id?.order_id;
        const razorpayPaymentlines = refundedOrder?.payment_ids.filter(
            (pi) => pi.payment_method_id.use_payment_terminal === "razorpay"
        );
        if (refundedOrder && razorpayPaymentlines?.length === 1) {
            await super.pay();
            const paymentIds = refundedOrder.payment_ids || [];
            // Add all the available payment lines in the refunded order if the current order amount is the same as the refunded order
            if (Math.abs(currentOrder.getTotalDue()) === refundedOrder.amount_total) {
                paymentIds.forEach((pi) => {
                    if (pi.payment_method_id) {
                        const paymentLine = currentOrder.add_paymentline(pi.payment_method_id);
                        paymentLine.set_amount(-pi.amount);
                        paymentLine.updateRefundPaymentLine(pi);
                    }
                });
            } else {
                // Add available payment lines of refunded order based on conditions.
                var getTotalDue = currentOrder.getTotalDue();
                if (getTotalDue < 0 && Math.abs(getTotalDue) > razorpayPaymentlines[0].amount) {
                    const paymentLine = currentOrder.add_paymentline(
                        razorpayPaymentlines[0].payment_method_id
                    );
                    paymentLine.set_amount(-razorpayPaymentlines[0].amount);
                    paymentLine.updateRefundPaymentLine(razorpayPaymentlines[0]);
                }
                if (currentOrder.get_due() < 0) {
                    paymentIds.forEach((pi) => {
                        var current_due = currentOrder.get_due();
                        if (
                            current_due < 0 &&
                            pi.payment_method_id &&
                            !pi.payment_method_id.use_payment_terminal
                        ) {
                            currentOrder
                                .add_paymentline(pi.payment_method_id)
                                .set_amount(current_due);
                        }
                    });
                }
            }
        } else {
            return await super.pay();
        }
    },
});
