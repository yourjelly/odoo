// import { standardFieldProps } from '@web/views/fields/standard_field_props';
import { registry } from '@web/core/registry';
import { BinaryField, binaryField } from "@web/views/fields/binary/binary_field";
import { onWillRender, toRaw } from "@odoo/owl";

export class LoyaltyTotalComponent extends BinaryField {
    static template = "sale_loyalty.sale_order_loyalty_table";
    static props = {
        ...binaryField,
    };

    setup() {
        this.loyalty_card = {};
        this.formatData(this.props);
        onWillRender(() => this.formatData(this.props));
    }

    formatData(props) {
        const loyalty_card_values = toRaw(props.record.data[this.props.name]);
        this.props.loyalty_card = loyalty_card_values["loyalty_card"]  || undefined;
        this.props.point_name = loyalty_card_values['point_name']
    }
}

export const loyaltyTotalComponent = {
    component: LoyaltyTotalComponent,
};

registry.category("fields").add("loyalty-total-values", loyaltyTotalComponent);
