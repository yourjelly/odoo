/** @odoo-module */

import { Component } from "@odoo/owl";
import { ProductCard } from "@point_of_sale/app/generic_components/product_card/product_card";
import { usePos } from "@point_of_sale/app/store/pos_hook";
import { ProductInfoPopup } from "../../product_info_popup/product_info_popup";
import { useService } from "@web/core/utils/hooks";

export class ProductCardWrapper extends Component {
    static template = "point_of_sale.ProductCardWrapper";
    static components = {
        ProductCard,
    };

    setup() {
        super.setup();
        this.pos = usePos();
        this.dialog = useService("dialog");
    }

    get product() {
        return this.props.product;
    }

    addProductToOrder() {
        this.pos.addProductToCurrentOrder(this.product);
    }

    async onProductInfoClick() {
        const info = await this.pos.getProductInfo(this.product, 1);
        this.dialog.add(ProductInfoPopup, { info: info, product: this.product });
    }
}
