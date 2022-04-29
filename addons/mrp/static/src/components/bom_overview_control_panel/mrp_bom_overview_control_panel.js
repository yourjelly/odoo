/** @odoo-module **/

import { ControlPanel } from "@web/search/control_panel/control_panel";
import { WarehouseFilter } from "../warehouse_filter/mrp_warehouse_filter";
import { BomOverviewDisplayFilter } from "../bom_overview_display_filter/mrp_bom_overview_display_filter";

const { Component } = owl;

export class BomOverviewControlPanel extends Component {
    setup() {
        this.controlPanelDisplay = {};
        // Cannot use 'control-panel-bottom-right' slot without this, as viewSwitcherEntries doesn't exist in this.env.config here.
        this.env.config.viewSwitcherEntries = [];
    }

    //---- Handlers ----

    updateQuantity(ev) {
        const newVal = isNaN(ev.target.value) ? 1 : parseInt(ev.target.value);
        this.props.bus.trigger("change-quantity", newVal);
    }

    changeVariant(ev) {
        this.props.bus.trigger("change-variant", ev.target.value);
    }

    clickPrint(printAll=false) {
        this.props.bus.trigger("print", printAll);
    }

    clickUnfold() {
        this.props.bus.trigger("unfold-all");
    }
}

BomOverviewControlPanel.template = "mrp.BomOverviewControlPanel";
BomOverviewControlPanel.components = {
    ControlPanel,
    WarehouseFilter,
    BomOverviewDisplayFilter,
};
BomOverviewControlPanel.props = {
    bus: Object,
    bomQuantity: Number,
    showOptions: Object,
    showVariants: { type: Boolean, optional: true },
    variants: { type: Object, optional: true },
    showUom: { type: Boolean, optional: true },
    uomName: { type: String, optional: true },
    currentWarehouse: Object,
    warehouses: { type: Array, optional: true },
};
BomOverviewControlPanel.defaultProps = {
    variants: {},
    warehouses: [],
};
