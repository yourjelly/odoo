/** @odoo-module */

import { Component } from "@odoo/owl";
import { useSelfOrder } from "@pos_self_order/SelfOrderService";
import { _t } from "@web/core/l10n/translation";

export class Lines extends Component {
    static template = "pos_self_order.Lines";
    setup() {
        this.selfOrder = useSelfOrder();
    }
    get lines() {
        return this.props.order.lines;
    }
    clickOnLine(productId) {
        const order = this.props.order;
        if (
            !order.access_token ||
            (order.state === "draft" && this.selfOrder.self_order_pay_after === "meal")
        ) {
            this.selfOrder.editedOrder = order;
            this.env.navigate("/products/" + productId);
        } else {
            this.selfOrder.notification.add(_t("You cannot edit an posted order!"), {
                type: "danger",
            });
        }
    }
}
