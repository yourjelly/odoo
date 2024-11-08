import { patch } from "@web/core/utils/patch";
import { _t } from "@web/core/l10n/translation";
import { OrderWidget } from "@pos_self_order/app/components/order_widget/order_widget";

patch(OrderWidget.prototype, {
    get buttonToShow() {
        const buttonName = this.router.activeSlot === "product_list" ? _t("Order") : _t("Pay");
        const type = this.selfOrder.config.self_ordering_mode;
        const mode = this.selfOrder.config.self_ordering_pay_after;
        const isOnlinePayment = this.selfOrder.models["pos.payment.method"].find(
            (p) => p.is_online_payment
        );
        const order = this.selfOrder.currentOrder;
        const service = this.selfOrder.config.self_ordering_service_mode;
        const isNoLine = order.lines.length === 0;

        if (type === "kiosk") {
            return super.buttonToShow;
        }

        if (order.amount_total === 0 && !isNoLine) {
            return { label: _t("Order"), disabled: false };
        }

        if (mode === "each") {
            return { label: buttonName, disabled: isNoLine };
        } else if (mode === "meal") {
            const order = this.selfOrder.currentOrder;

            if (!order) {
                return { label: "", disabled: true };
            }

            if (Object.keys(order.changes).length > 0) {
                return { label: _t("Order"), disabled: false };
            } else {
                if (isOnlinePayment) {
                    return { label: buttonName, disabled: false };
                } else {
                    if (this.router.activeSlot === "product_list") {
                        return {
                            label: _t("Order"),
                            disabled: true,
                        };
                    } else {
                        const label = service === "counter" ? _t("Pay at cashier") : _t("Pay");
                        return {
                            label: label,
                            disabled: false,
                        };
                    }
                }
            }
        } else {
            return super.buttonToShow;
        }
    },
});
