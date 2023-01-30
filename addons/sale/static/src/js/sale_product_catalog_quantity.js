/** @odoo-module */

import { registry } from "@web/core/registry";
import { IntegerField } from '@web/views/fields/integer/integer_field';


export class SaleProductCatalogQuantity extends IntegerField {
    removeQuantity() {
        if (this.props.value > 0) {
            this.props.update(this.props.value - 1);
        }
   }

    addQuantity() {
        this.props.update(this.props.value + 1);
    }

    // update the quantity whenever the content is changed, otherwise the user
    // have to click outside of the record to update the SOL quantity
    onInput(ev) {
        // otherwise we get a NaN bug when updating values from the keyboard
        let value = parseInt(ev.target.value)
        if (value >= 0) {
            this.props.update(value);
        }
    }
}

SaleProductCatalogQuantity.extractProps = ({ attrs }) => {
    let integerProps = IntegerField.extractProps({attrs});
    return {
        ...integerProps,
        readonly: false,
    };
};
SaleProductCatalogQuantity.template = 'sale.SaleProductCatalogQuantity';

registry.category('fields').add('sale_product_catalog_quantity', SaleProductCatalogQuantity);
