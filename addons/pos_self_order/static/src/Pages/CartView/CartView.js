/** @odoo-module */

import { Component, onMounted } from "@odoo/owl";
import { NavBar } from "@pos_self_order/Components/NavBar/NavBar";
import { ProductCard } from "@pos_self_order/Components/ProductCard/ProductCard";
import { Lines } from "@pos_self_order/Components/Lines/Lines";
import { useSelfOrder } from "@pos_self_order/SelfOrderService";
import { PriceDetails } from "@pos_self_order/Components/PriceDetails/PriceDetails";
import { _t } from "@web/core/l10n/translation";

export class CartView extends Component {
    static components = { NavBar, ProductCard, Lines, PriceDetails };
    static props = [];
    static template = "pos_self_order.CartView";
    setup() {
        this.selfOrder = useSelfOrder();

        onMounted(() => {
            this.selfOrder.getOrderTaxesFromServer();
        });
    }

    get buttonToShow() {
        return this.selfOrder.self_order_pay_after === "each" ? "Pay" : "Order";
    }

    processOrder() {
        if (this.selfOrder.self_order_pay_after === "meal") {
            this.selfOrder.sendDraftOrderToServer();
        } else {
            this.selfOrder.notification.add(_t("Not yet implemented!"), { type: "danger" });
        }
    }
}
