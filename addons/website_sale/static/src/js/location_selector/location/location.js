/** @odoo-module **/

import { Component } from "@odoo/owl";

export class Location extends Component {
    static template = "website_sale.locationSelector.location";
    static props = {
        id: String,
        name: String,
        address: String,
        number: Number,
        isSelected: Boolean,
        setSelectedLocation: Function,
    };

}
