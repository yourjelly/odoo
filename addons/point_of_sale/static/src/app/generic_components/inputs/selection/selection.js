/** @odoo-module */

import { TModelInput } from "@point_of_sale/app/generic_components/inputs/t_model_input";

export class Selection extends TModelInput {
    static template = "point_of_sale.Selection";
    static props = {
        ...super.props,
        "*": true,
        // name: { type: String, optional: true },
        // items: { type: Array, element: { type: Object, shape: ["id", "value"] } },
        class: { type: String, optional: true },
    };
    static defaultProps = {
        class: "",
    };
}
