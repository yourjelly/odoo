/** @odoo-module */

import { ProductInfoPopup } from "@point_of_sale/app/screens/product_screen/product_info_popup/product_info_popup";
import { orm } from "@web/core/orm";
import { patch } from "@web/core/utils/patch";

patch(ProductInfoPopup.prototype, {
    async switchSelfAvailability() {
        await orm.write("product.product", [this.props.product.id], {
            self_order_available: !this.props.product.self_order_available,
        });
        this.props.product.self_order_available = !this.props.product.self_order_available;
    },
});
