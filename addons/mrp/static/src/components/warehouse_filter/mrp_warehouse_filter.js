/** @odoo-module **/

const { Component } = owl;

export class WarehouseFilter extends Component {
    //---- Handlers ----

    onClickWarehouse(warehouseId) {
        this.props.bus.trigger("change-warehouse", warehouseId);
    }
}

WarehouseFilter.template = "mrp.WarehouseFilter";
WarehouseFilter.props = {
    bus: Object,
    warehouses: Array,
    currentWarehouse: {
        type: Object,
        shape: { id: Number, name: String },
    },
};
