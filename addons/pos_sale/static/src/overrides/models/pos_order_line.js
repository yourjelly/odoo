/** @odoo-module */

import { PosOrderline } from "@point_of_sale/app/models/pos_order_line";
import { patch } from "@web/core/utils/patch";

patch(PosOrderline.prototype, {
    setup(_defaultObj) {
        super.setup(...arguments);
        // It is possible that this orderline is initialized using server data,
        // meaning, it is loaded from localStorage or from server. This means
        // that some fields has already been assigned. Therefore, we only set the options
        // when the original value is falsy.
        if (this.sale_order_origin_id?.shipping_date) {
            this.order_id.setShippingDate(this.sale_order_origin_id.shipping_date);
        }
    },
    setDownPaymentDetails(downpPaymentDetails) {
        if (typeof downpPaymentDetails === "string" && downpPaymentDetails.length > 0) {
            return JSON.parse(downpPaymentDetails);
        }
        return downpPaymentDetails;
    },
    get_sale_order() {
        if (this.sale_order_origin_id) {
            const down_payment_details = this.setDownPaymentDetails(this.down_payment_details);
            const value = {
                name: this.sale_order_origin_id.name,
                details: down_payment_details || false,
            };

            return value;
        }
        return false;
    },
    getDisplayData() {
        const down_payment_details = this.setDownPaymentDetails(this.down_payment_details);

        return {
            ...super.getDisplayData(),
            down_payment_details: down_payment_details,
            so_reference: this.sale_order_origin_id?.name,
        };
    },
    /**
     * Set quantity based on the give sale order line.
     * @param {'sale.order.line'} saleOrderLine
     */
    setQuantityFromSOL(saleOrderLine) {
        if (this.product_id.type === "service") {
            this.set_quantity(saleOrderLine.qty_to_invoice);
        } else {
            this.set_quantity(
                saleOrderLine.product_uom_qty -
                    Math.max(saleOrderLine.qty_delivered, saleOrderLine.qty_invoiced)
            );
        }
    },
});
