import { standardFieldProps } from "@web/views/fields/standard_field_props";
import { registry } from "@web/core/registry";
import {
    Component,
    onWillRender,
    toRaw,
} from "@odoo/owl";

export class LoyaltyCardComponent extends Component {
    static template = "sale_loyalty.sale_order_loyalty_table";
    static props = {
        ...standardFieldProps,
    };

    setup() {
        this.loyalty_card = {};
        this.formatData(this.props);
        onWillRender(() => this.formatData(this.props));
    }

    formatData(props) {
        let loyalty_card_values = toRaw(props.record.data[this.props.name]);
        if (loyalty_card_values["loyalty_card"]){
            this.props.loyalty_card = loyalty_card_values["loyalty_card"];
            this.props.point_name = loyalty_card_values['point_name']
        }else{
            this.props.loyalty_card = undefined;
        }
    }
}

export const loyaltyCardComponent = {
    component: LoyaltyCardComponent,
};

registry.category("fields").add("loyalty-card-values", loyaltyCardComponent);
