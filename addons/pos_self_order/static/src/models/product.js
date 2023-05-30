/** @odoo-module **/
import { Reactive } from "@pos_self_order/models/reactive";

export class Product extends Reactive {
    constructor({
        price_info,
        has_image,
        attributes,
        name,
        product_id,
        description_sale,
        tag,
        is_pos_groupable,
    }) {
        super();
        this.setup(...arguments);
    }

    setup(product) {
        this.id = product.product_id;
        this.price_info = product.price_info;
        this.has_image = product.has_image;
        this.attributes = product.attributes;
        this.name = product.name;
        this.description_sale = product.description_sale;
        this.tag = product.tag;
        this.is_pos_groupable = product.is_pos_groupable;
    }

    get taxes() {
        return this.priceWithTax - this.priceWithoutTax;
    }

    get priceWithTax() {
        return this.price_info.price_with_tax;
    }

    get priceWithoutTax() {
        return this.price_info.price_without_tax;
    }
}
