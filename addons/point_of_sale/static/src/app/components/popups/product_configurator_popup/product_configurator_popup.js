import { Dialog } from "@web/core/dialog/dialog";
import { Component, onMounted, useEffect, useRef, useState } from "@odoo/owl";
import { usePos } from "@point_of_sale/app/hooks/pos_hook";
import { ProductInfoBanner } from "@point_of_sale/app/components/product_info_banner/product_info_banner";

export class BaseProductAttribute extends Component {
    static template = "";
    static props = ["attribute"];
    setup() {
        this.attribute = this.props.attribute;
        this.values = Object.values(this.attribute.values);
        this.state = useState({
            attribute_value_ids: parseInt(this.values.filter((value) => !value.disabled)[0].id),
            custom_value: "",
        });

        useEffect(
            () => {
                this.attribute.setSelectedValues(this.getSelectedValues());
            },
            () => [this.state.attribute_value_ids]
        );

        useEffect(
            () => {
                const selectedValues = this.getSelectedValues();
                if (selectedValues.length > 0) {
                    selectedValues[0].custom_value = this.state.custom_value;
                }
            },
            () => [this.state.custom_value]
        );
    }

    getSelectedValues() {
        return [this.values.find((val) => val.id === parseInt(this.state.attribute_value_ids))];
    }

    getFormatPriceExtra(val) {
        const sign = val < 0 ? "- " : "+ ";
        return sign + this.env.utils.formatCurrency(Math.abs(val));
    }
}

export class RadioProductAttribute extends BaseProductAttribute {
    static template = "point_of_sale.RadioProductAttribute";

    setup() {
        super.setup();
        this.root = useRef("root");
        onMounted(() => {
            // With radio buttons `t-model` selects the default input by searching for inputs with
            // a matching `value` attribute. In our case, we use `t-att-value` so `value` is
            // not found yet and no radio is selected by default.
            // We then manually select the first input of each radio attribute.
            const radios = this.root.el.querySelectorAll("input[type=radio]");
            this.values.forEach((value, index) => {
                radios[index].checked = value.id === this.state.attribute_value_ids;
            });
        });
    }
}

export class PillsProductAttribute extends BaseProductAttribute {
    static template = "point_of_sale.PillsProductAttribute";
}

export class SelectProductAttribute extends BaseProductAttribute {
    static template = "point_of_sale.SelectProductAttribute";
}

export class ColorProductAttribute extends BaseProductAttribute {
    static template = "point_of_sale.ColorProductAttribute";
}

export class MultiProductAttribute extends BaseProductAttribute {
    static template = "point_of_sale.MultiProductAttribute";

    setup() {
        super.setup();
        this.state.attribute_value_ids = this.values.reduce((acc, value) => {
            acc[value.id] = false;
            return acc;
        }, {});
    }

    onChange() {
        this.attribute.setSelectedValues(this.getSelectedValues());
    }

    getSelectedValues() {
        return this.values.filter((val) => this.state.attribute_value_ids[val.id]);
    }
}

export class ProductConfiguratorPopup extends Component {
    static template = "point_of_sale.ProductConfiguratorPopup";
    static components = {
        RadioProductAttribute,
        ProductInfoBanner,
        PillsProductAttribute,
        SelectProductAttribute,
        ColorProductAttribute,
        MultiProductAttribute,
        Dialog,
    };
    static props = ["productTemplate", "getPayload", "close"];

    setup() {
        this.pos = usePos();
        this.state = useState({
            product: null,
            selected_attribute_values: this.props.productTemplate.attribute_line_ids
                .filter(({ attribute_id }) => attribute_id.display_type !== "multi")
                .reduce((acc, attribute) => {
                    acc[attribute.attribute_id.id] = [attribute.product_template_value_ids[0]];
                    return acc;
                }, {}),
            attributes: this.props.productTemplate.attribute_line_ids.reduce((acc, attribute) => {
                acc[attribute.attribute_id.id] = {
                    ...attribute,
                    values: this.initAttributeValues(attribute),
                    setSelectedValues: (values) => {
                        this.state.selected_attribute_values = {
                            ...this.state.selected_attribute_values,
                            [attribute.attribute_id.id]: values,
                        };
                    },
                };
                return acc;
            }, {}),
        });

        this.attributes.forEach(({ values }) => {
            Object.values(values).forEach((value) => {
                value.exclude_for.forEach((e) => {
                    const target =
                        this.state.attributes[e.attribute_id.id].values[e.id].exclude_for;
                    if (!target.find((e) => value.id === e.id)) {
                        this.state.attributes[e.attribute_id.id].values[e.id].exclude_for.push(
                            value
                        );
                    }
                });
            });
        });

        this.leafAttributes.forEach((id) => {
            this.checkAttrCompatibility(this.state.attributes[id]);
        });

        useEffect(
            () => {
                this.computeProduct();
                this.checkCompatibility();
            },
            () => [this.state.selected_attribute_values]
        );
    }

    get attributes() {
        return Object.values(this.state.attributes);
    }

    get selectedAttributeValues() {
        return Object.values(this.state.selected_attribute_values).flat();
    }

    get leafAttributes() {
        const seen = new Set();
        const leafs = new Set();
        let last = null;

        const dfs = (value) => {
            if (seen.has(value.id)) {
                return;
            }
            value = this.state.attributes[value.attribute_id.id].values[value.id];
            last = value.attribute_id.id;
            seen.add(value.id);
            value.exclude_for.forEach((value) => dfs(value));
        };

        this.selectedAttributeValues.forEach((value) => {
            last = null;
            dfs(value);
            if (last) {
                leafs.add(last);
            }
        });

        return leafs;
    }

    initAttributeValues(attribute) {
        return attribute.product_template_value_ids.reduce((values, value) => {
            values[value.id] = {
                ...value,
                // attribute_id: attribute.attribute_id,
                exclude_for: value.exclude_for.flatMap(({ value_ids }) => value_ids),
                disabled: false,
                custom_value: "",
            };
            return values;
        }, {});
    }

    computePayload() {
        return {
            attribute_value_ids: this.selectedAttributeValues.map((val) => val.id),
            attribute_custom_values: this.selectedAttributeValues
                .filter((value) => value.is_custom)
                .reduce((acc, value) => {
                    acc[value.id] = value.custom_value;
                    return acc;
                }, []),
            price_extra: this.selectedAttributeValues
                .filter((value) => value.attribute_id.create_variant === "no_variant")
                .reduce((acc, val) => acc + val.price_extra, 0),
        };
    }

    computeProduct() {
        const alwaysVariants = this.attributes.every(
            (line) => line.attribute_id.create_variant === "always"
        );

        if (alwaysVariants) {
            const selectedAttributeValuesIds = this.selectedAttributeValues.map(({ id }) => id);
            const newProduct = this.pos.models["product.product"].find(
                (product) =>
                    product.product_template_variant_value_ids?.length > 0 &&
                    product.product_template_variant_value_ids.every(({ id }) =>
                        selectedAttributeValuesIds.includes(id)
                    )
            );
            if (newProduct) {
                this.state.product = newProduct;
            }
        }
    }

    doSelectedValuesHasConflictWith(exclude_for) {
        const excludedIds = exclude_for.map(({ id }) => id);
        return this.selectedAttributeValues.some(({ id }) => excludedIds.includes(id));
    }

    checkAttrCompatibility(attribute) {
        Object.values(attribute.values).forEach((value) => {
            value.disabled = this.doSelectedValuesHasConflictWith(value.exclude_for);
        });
    }

    checkCompatibility() {
        this.attributes.forEach((attribute) => {
            this.checkAttrCompatibility(attribute);
        });
    }

    isArchivedCombination() {
        const selectedValuesIds = this.selectedAttributeValues
            .filter((value) => value.attribute_id.create_variant === "always")
            .map(({ id }) => id);
        return (
            selectedValuesIds.length > 0 &&
            this.props.productTemplate._isArchivedCombination(selectedValuesIds)
        );
    }

    close() {
        this.props.close();
    }

    confirm() {
        this.props.getPayload(this.computePayload());
        this.props.close();
    }
}
