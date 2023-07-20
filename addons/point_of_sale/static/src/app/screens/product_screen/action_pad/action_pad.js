/** @odoo-module */

import { usePos } from "@point_of_sale/app/store/pos_hook";
import { Component, useState } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";

/**
 * @props partner
 */
export class ActionpadWidget extends Component {
    static template = "point_of_sale.ActionpadWidget";
    static defaultProps = {
        isActionButtonHighlighted: false,
    };

    setup() {
        this.pos = usePos();
        this.ui = useState(useService("ui"));
    }

    get isLongName() {
        return this.props.partner && this.props.partner.name.length > 10;
    }
    get highlightPay() {
        return (
            this.pos.get_order()?.orderlines?.length &&
            !this.currentOrder.hasChangesToPrint() &&
            this.hasQuantity(this.currentOrder)
        );
    }
    get swapButton() {
        return this.props.actionType === "payment" && this.pos.config.module_pos_restaurant;
    }
    get currentOrder() {
        return this.pos.get_order();
    }
    get addedClasses() {
        if (!this.currentOrder) {
            return {};
        }
        const hasChanges = this.currentOrder.hasChangesToPrint();
        const skipped = hasChanges ? false : this.currentOrder.hasSkippedChanges();
        return {
            highlight: hasChanges,
            altlight: skipped,
        };
    }
    async submitOrder() {
        if (!this.clicked) {
            this.clicked = true;
            try {
                await this.pos.sendOrderInPreparation(this.currentOrder);
            } finally {
                this.clicked = false;
            }
        }
    }
    hasQuantity(order) {
        if (!order) {
            return false;
        } else {
            return (
                order.orderlines.reduce((totalQty, line) => totalQty + line.get_quantity(), 0) > 0
            );
        }
    }
    get categoryCount() {
        const categories = {};
        const orderChange = this.currentOrder.getOrderChanges().orderlines;
        for (const idx in orderChange) {
            const orderline = orderChange[idx];
            const categoryId = this.pos.db.get_product_by_id(orderline.product_id).pos_categ_ids[0];
            const category = this.pos.db.category_by_id[categoryId].name;
            const numProd = orderline.quantity;
            categories[category] = categories[category] ? categories[category] + numProd : numProd;
        }
        let result = "";
        for (const key in categories) {
            result = result + categories[key] + nbsp + key + " | ";
        }
        return result.slice(0, -2);
    }
}
