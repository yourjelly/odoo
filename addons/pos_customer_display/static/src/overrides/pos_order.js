/** @odoo-module */

import { PosOrder } from "@point_of_sale/app/models/pos_order";
import { registry } from "@web/core/registry";
import { patch } from "@web/core/utils/patch";

const formatCurrency = registry.subRegistries.formatters.content.monetary[1];

patch(PosOrder.prototype, {
    getCustomerDisplayData() {
        return {
            lines: this.lines.map((l) => ({
                ...l.getDisplayData(),
                isSelected: l.isSelected(),
                imageSrc: `/web/image/product.product/${l.product_id.id}/image_128`,
            })),
            finalized: this.finalized,
            amount: formatCurrency(this.get_total_with_tax() || 0),
            paymentLines: this.payment_ids.map((pl) => ({
                name: pl.payment_method_id.name,
                amount: formatCurrency(pl.get_amount()),
            })),
            change: this.get_change() && formatCurrency(this.get_change()),
        };
    },
});
