/** @odoo-module **/

import { ControlPanel } from "@web/search/control_panel/control_panel";

const { Component } = owl;

export class StockTracabilityControlPanel extends Component {
    setup() {
        super.setup();
        this.display = {
            "top-left": true,
            "top-right": false,
            "bottom-left": true,
            "bottom-left-buttons": true,
            "bottom-right": false,
        }
    }

    print() {
        console.log('ok');
    }
}

StockTracabilityControlPanel.template = 'stock.StockTracabilityControlPanel'
StockTracabilityControlPanel.components = {
    ControlPanel, 
}
