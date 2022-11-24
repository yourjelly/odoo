/** @odoo-module */

import { registry } from "@web/core/registry";
import { integerField } from "@web/views/fields/integer/integer_field";

export class SaleProductCatalogQuantity extends integerField.component {
    removeQuantity() {
        const name = this.props.name;
        const value = this.props.record.data[name];
        if (value != 0) {
            this.props.record.update({ [name]: value - 1 });
        }
    }

    addQuantity() {
        const name = this.props.name;
        const value = this.props.record.data[name];
        this.props.record.update({ [name]: value + 1 });
    }

    // update the quantity whenever the content is changed, otherwise the user
    // have to click outside of the record to update the SOL quantity
    onInput(ev) {
        // parse to avoid a NaN bug when updating values from the keyboard
        const name = this.props.name;
        const value = parseInt(ev.target.value);
        if (value >= 0) {
            this.props.record.update({ [name]: value });
        }
    }
}

SaleProductCatalogQuantity.template = "sale.SaleProductCatalogQuantity";
export const saleProductCatalogQuantity = {
    ...integerField,
    component: SaleProductCatalogQuantity,
    extractProps: ({ attrs, options }) => ({
        ...integerField.extractProps({ attrs, options }),
        readonly: false,
    }),
};

registry.category("fields").add("sale_product_catalog_quantity", saleProductCatalogQuantity);
