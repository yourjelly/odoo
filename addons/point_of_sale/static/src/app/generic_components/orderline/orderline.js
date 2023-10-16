/** @odoo-module */

import { Component } from "@odoo/owl";

export class Orderline extends Component {
    static template = "point_of_sale.Orderline";
    static props = {
        line: { type: Object },
        slots: { type: Object, optional: true },
    };
    static defaultProps = {
        class: {},
    };
}
