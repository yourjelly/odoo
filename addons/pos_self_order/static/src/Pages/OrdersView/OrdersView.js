/** @odoo-module */

import { Component, useState } from "@odoo/owl";
import { useSelfOrder } from "@pos_self_order/SelfOrderService";
import { ProductCard } from "@pos_self_order/Components/ProductCard/ProductCard";
import { Lines } from "@pos_self_order/Components/Lines/Lines";
import { PriceDetails } from "@pos_self_order/Components/PriceDetails/PriceDetails";
import { NavBar } from "@pos_self_order/Components/NavBar/NavBar";
import { _t } from "@web/core/l10n/translation";

export class OrdersView extends Component {
    static template = "pos_self_order.OrdersView";
    static components = { NavBar, ProductCard, Lines, PriceDetails };
    static props = [];

    setup() {
        this.selfOrder = useSelfOrder();
        this.state = useState({
            loadingProgress: true,
        });

        this.loadOrder();
    }

    async loadOrder() {
        await this.selfOrder.getOrderFromServer();
        this.state.loadingProgress = false;
    }

    get orders() {
        return this.selfOrder.orders.filter((o) => o.access_token);
    }

    editOrder(order) {
        if (this.selfOrder.self_order_pay_after === "meal" && order.state === "draft") {
            this.selfOrder.editedOrder = order;
            this.env.navigate("/products");
        } else {
            this.selfOrder.notification.add(_t("You cannot edit an posted order!"), {
                type: "danger",
            });
        }
    }
}
