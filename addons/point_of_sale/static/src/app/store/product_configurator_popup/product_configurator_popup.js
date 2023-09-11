/** @odoo-module */
import { AbstractAwaitablePopup } from "@point_of_sale/app/popup/abstract_awaitable_popup";
import { Component, useRef, useState, useSubEnv } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";

export class BaseProductAttribute extends Component {
    setup() {
        this.env.attribute_components.push(this);
        this.attribute = this.props.attribute;
        this.values = this.attribute.values;
        this.state = useState({
            selected_value: parseFloat(this.values[0].id),
            custom_value: "",
        });
    }

    getValue() {
        const selected_value = this.values.find(
            (val) => val.id === parseFloat(this.state.selected_value)
        );
        let value = selected_value.name;
        if (selected_value.is_custom && this.state.custom_value) {
            value += `: ${this.state.custom_value}`;
        }

        return {
            value,
            valueIds: [selected_value.id],
            extra: selected_value.price_extra,
        };
    }

    updateMultipleAttribute(event) {
        const value = parseInt(event.target.id);

        if (this.state.checkbox_value.has(value)) {
            this.state.checkbox_value.delete(value);
        } else {
            this.state.checkbox_value.add(value);
        }
    }
}

export class RadioProductAttribute extends BaseProductAttribute {
    static template = "point_of_sale.RadioProductAttribute";

    setup() {
        super.setup();
        this.root = useRef("root");
        owl.onMounted(this.onMounted);
    }
    onMounted() {
        // With radio buttons `t-model` selects the default input by searching for inputs with
        // a matching `value` attribute. In our case, we use `t-att-value` so `value` is
        // not found yet and no radio is selected by default.
        // We then manually select the first input of each radio attribute.
        this.root.el.querySelector("input[type=radio]").checked = true;
    }
}

export class SelectProductAttribute extends BaseProductAttribute {
    static template = "point_of_sale.SelectProductAttribute";
}

export class ColorProductAttribute extends BaseProductAttribute {
    static template = "point_of_sale.ColorProductAttribute";
}

export class CheckboxProductAttribute extends BaseProductAttribute {
    static template = "point_of_sale.CheckboxProductAttribute";

    setup() {
        super.setup();
        this.state = useState({
            checkbox_value: new Set(),
        });
    }

    getValue() {
        const selected_values = this.values.filter((val) => this.state.checkbox_value.has(val.id));
        const extra = selected_values.reduce((acc, val) => acc + val.price_extra, 0);
        const value = selected_values.map((val) => val.name).join(", ");
        const valueIds = selected_values.map((val) => val.id);

        return {
            value,
            valueIds,
            extra,
        };
    }
}

export class ProductConfiguratorPopup extends AbstractAwaitablePopup {
    static template = "point_of_sale.ProductConfiguratorPopup";
    static components = {
        RadioProductAttribute,
        SelectProductAttribute,
        CheckboxProductAttribute,
        ColorProductAttribute,
    };

    setup() {
        super.setup();
        useSubEnv({ attribute_components: [] });
        this.state = useState({
            quantity: this.props.quantity || 1,
        });
        this.ui = useService("ui");
    }

    getPayload() {
        var selected_attributes = [];
        const attribute_value_ids = [];
        var price_extra = 0.0;
        const quantity = this.state.quantity;

        this.env.attribute_components.forEach((attribute_component) => {
            const { value, valueIds, extra } = attribute_component.getValue();
            selected_attributes.push(value);
            attribute_value_ids.push(valueIds);
            price_extra += extra;
        });

        return {
            selected_attributes,
            attribute_value_ids,
            price_extra,
            quantity,
        };
    }
    get imageUrl() {
        const product = this.props.product;
        return `/web/image?model=product.product&field=image_128&id=${product.id}&unique=${product.write_date}`;
    }
    get unitPrice() {
        return this.env.utils.formatCurrency(this.props.product.lst_price);
    }
    addOneQuantity() {
        ++this.state.quantity;
    }
    removeOneQuantity() {
        if (this.state.quantity == 1) {
            return;
        }
        --this.state.quantity;
    }
}
