/** @odoo-module */

import { registry } from "@web/core/registry";
import { floatField } from "@web/views/fields/float/float_field";
import { useDebounced } from "@web/core/utils/timing";
import { useState } from "@odoo/owl";

export class SaleProductCatalogQuantity extends floatField.component {
    setup() {
        super.setup();
        this.state = useState({
            quantity: this.props.record.data[this.props.name],
        });
        this.debouncedUpdate = useDebounced(this.updateRecord, 200);
    }

    async updateRecord() {
        await this.props.record.update({ [this.props.name]: this.state.quantity });
    }

    async removeQuantity() {
        if (this.state.quantity !== 0) {
            this.state.quantity = this.state.quantity - 1;
            this.debouncedUpdate();
            // Force a reload of the page, otherwise the filter "In the Order"
            // does not see the change.
            if (this.state.quantity === 1) {
                this.props.record.model.load();
            }
        }
    }

    addQuantity() {
        this.state.quantity = this.state.quantity + 1;
        this.debouncedUpdate();
    }

    onChange(ev) {
        this.state.quantity = parseInt(ev.target.value);
        this.updateRecord();
    }
}

SaleProductCatalogQuantity.template = "sale.SaleProductCatalogQuantity";
export const saleProductCatalogQuantity = {
    ...floatField,
    component: SaleProductCatalogQuantity,
    extractProps: ({ attrs, options }) => ({
        ...floatField.extractProps({ attrs, options }),
    }),
};

registry.category("fields").add("sale_product_catalog_quantity", saleProductCatalogQuantity);
