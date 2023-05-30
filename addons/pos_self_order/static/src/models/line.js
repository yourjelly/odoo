/** @odoo-module **/
import { Reactive } from "@pos_self_order/models/reactive";
import { uuidv4 } from "@point_of_sale/utils";

export class Line extends Reactive {
    constructor({
        id,
        product_id,
        qty,
        customer_note,
        selectedVariants,
        description,
        full_product_name,
        price_subtotal_incl,
        price_subtotal,
    }) {
        super();
        this.setup(...arguments);
    }

    setup(line) {
        // server data
        this.id = line.id || null;
        this.uuid = line.uuid || uuidv4();
        this.full_product_name = line.full_product_name;
        this.description = line.description || "";
        this.product_id = line.product_id;
        this.qty = line.qty ? line.qty : 0;
        this.customer_note = line.customer_note;
        this.price_subtotal_incl = line.price_subtotal_incl || 0;
        this.price_subtotal = line.price_subtotal || 0;
        this.selectedVariants = line.selectedVariants || [];
    }
}
